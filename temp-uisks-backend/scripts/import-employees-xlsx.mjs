#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";
import xlsx from "xlsx";

const { Client } = pg;

const usage = () => {
  console.log(
    "Usage: node scripts/import-employees-xlsx.mjs <fileOrDir> [more files...] [--sheet <sheetName>] [--truncate | --merge]"
  );
};

const args = process.argv.slice(2);
if (args.length === 0) {
  usage();
  process.exit(1);
}

const inputPaths = [];
let sheetName;
let truncate = false;
let merge = false;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!arg.startsWith("--")) {
    inputPaths.push(arg);
    continue;
  }
  if (arg === "--sheet") {
    sheetName = args[index + 1];
    index += 1;
    continue;
  }
  if (arg === "--truncate") {
    truncate = true;
    continue;
  }
  if (arg === "--merge") {
    merge = true;
    continue;
  }

  console.error(`Unknown option: ${arg}`);
  usage();
  process.exit(1);
}

if (truncate && merge) {
  console.error("--truncate and --merge cannot be used together");
  process.exit(1);
}

if (inputPaths.length === 0) {
  console.error("At least one file or directory is required");
  usage();
  process.exit(1);
}

const env = {
  host: process.env.USERS_DB_HOST ?? "localhost",
  port: Number(process.env.USERS_DB_PORT ?? 5433),
  database: process.env.USERS_DB_NAME ?? "users_db",
  user: process.env.USERS_DB_USER ?? "users_admin",
  password: process.env.USERS_DB_PASSWORD ?? "users_password",
  table: process.env.USERS_EMPLOYEES_TABLE ?? "employees"
};

const normalize = (value) => String(value ?? "").toLowerCase().trim();
const normalizeName = (value) => String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const toStringValue = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

// Placeholder values in exports that mean "no data".
const UNKNOWN_VALUES = new Set(["", "-", "не указано", "не указан", "нет", "нигде", "другое"]);
const knownOrEmpty = (value) => (UNKNOWN_VALUES.has(normalize(value)) ? "" : toStringValue(value));

// Exports fill ID cells with placeholders ("0", "123", "000000", ORCIDs, e-mails...).
// Keep only well-formed IDs; the raw cell stays in excel_data.
const toScopusAuthorId = (value) => {
  const text = toStringValue(value);
  return /^\d{10,11}$/.test(text) && !/^(\d)\1+$/.test(text) ? text : "";
};

// ResearcherID looks like "AAE-9753-2019"; it is often wrapped in a URL or a label.
const toResearcherId = (value) => {
  const match = toStringValue(value).match(/(?:^|[^A-Za-z])([A-Za-z]{1,4})\s*-\s*(\d{4})\s*-\s*(\d{4})(?!\d)/);
  return match ? `${match[1].toUpperCase()}-${match[2]}-${match[3]}` : "";
};

// Kazakhstan regions are stored under the map's canonical names so that region
// filters match ("Мангыстауская" vs "Мангистауская область", "город Алматы" ...).
const REGION_ALIASES = [
  ["астана", "Город Астана"],
  ["шымкент", "Город Шымкент"],
  ["алматинская", "Алматинская область"],
  ["алматы", "Город Алматы"],
  ["западно-казахстан", "Западно-Казахстанская область"],
  ["восточно-казахстан", "Восточно-Казахстанская область"],
  ["северо-казахстан", "Северо-Казахстанская область"],
  ["жетысу", "Жетысуская область"],
  ["мангыстау", "Мангистауская область"],
  ["мангистау", "Мангистауская область"],
  ["акмолинская", "Акмолинская область"],
  ["атырау", "Атырауская область"],
  ["карагандинская", "Карагандинская область"],
  ["туркестанская", "Туркестанская область"],
  ["кызылординская", "Кызылординская область"],
  ["улытау", "Улытауская область"],
  ["абайская", "Абайская область"],
  ["павлодарская", "Павлодарская область"],
  ["жамбылская", "Жамбылская область"],
  ["костанайская", "Костанайская область"],
  ["актюбинская", "Актюбинская область"]
];

const canonicalRegion = (value) => {
  const text = knownOrEmpty(value);
  const match = REGION_ALIASES.find(([needle]) => normalize(text).includes(needle));
  return match ? match[1] : text;
};

// Fields whose column exists in at least one input file. In --merge mode these
// replace stored values (an empty cell clears them); other fields keep theirs.
const presentFields = new Set();

const isExcelFile = (fileName) => /\.(xlsx|xlsm|xls)$/i.test(fileName);

const resolveInputFiles = (rawPaths) => {
  const files = [];

  for (const rawPath of rawPaths) {
    const resolved = path.resolve(process.cwd(), rawPath);
    if (!fs.existsSync(resolved)) {
      console.error(`Path not found: ${resolved}`);
      process.exit(1);
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const nested = fs
        .readdirSync(resolved)
        .filter((name) => isExcelFile(name))
        .sort((a, b) => a.localeCompare(b))
        .map((name) => path.join(resolved, name));
      files.push(...nested);
      continue;
    }

    if (!isExcelFile(resolved)) {
      console.error(`Unsupported file type (expected .xlsx/.xls/.xlsm): ${resolved}`);
      process.exit(1);
    }

    files.push(resolved);
  }

  const unique = Array.from(new Set(files));
  if (unique.length === 0) {
    console.error("No Excel files found in input paths");
    process.exit(1);
  }

  return unique;
};

const sourceFiles = resolveInputFiles(inputPaths);

const toNumber = (value) => {
  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/,/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
};

const findField = (row, aliases) => {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const key = entries.find(([candidate]) => normalize(candidate) === normalize(alias));
    if (key) {
      return key[1];
    }
  }
  return "";
};

const parseCodes = (value) =>
  toStringValue(value)
    .split(/[,;\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const safeIdentifier = (identifier) => {
  const parts = String(identifier).split(".");
  const allowed = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (parts.some((part) => !allowed.test(part))) {
    throw new Error(`Invalid table name: ${identifier}`);
  }
  return parts.map((part) => `"${part}"`).join(".");
};

const tableName = safeIdentifier(env.table);

const toJsonSafeCellValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return toStringValue(value);
};

const buildExcelData = (headers, row) => {
  const excelData = {};
  headers.forEach((header, index) => {
    const key = toStringValue(header) || `column_${index + 1}`;
    const cellValue = toJsonSafeCellValue(row[header]);
    if (cellValue !== null) {
      excelData[key] = cellValue;
    }
  });
  return excelData;
};

const parseWorkbookRows = (workbook, sourceFile) => {
  const targetSheetName = sheetName || (workbook.SheetNames.includes("expdata") ? "expdata" : workbook.SheetNames[0]);

  if (!workbook.Sheets[targetSheetName]) {
    console.error(`Sheet not found: ${targetSheetName}`);
    console.error(`Available sheets in ${path.basename(sourceFile)}: ${workbook.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const sheet = workbook.Sheets[targetSheetName];
  // Some exports declare a range up to column XFD with placeholder headers ("Столбец139"...)
  // and no data below them; shrink the range to cells that actually hold data.
  let lastRow = 0;
  let lastCol = 0;
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const value = sheet[address]?.v;
    if (value === undefined || value === null || value === "") continue;
    const cell = xlsx.utils.decode_cell(address);
    if (cell.r > 0) {
      lastRow = Math.max(lastRow, cell.r);
      lastCol = Math.max(lastCol, cell.c);
    }
  }
  sheet["!ref"] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });

  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: true });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const hasHeader = (aliases) => headers.some((header) => aliases.some((alias) => normalize(header) === normalize(alias)));
  const FIELD_HEADERS = {
    region: ["Регион"],
    academicDegree: ["Ученая степень", "Степень"],
    scopusAuthorId: ["Author ID SCOPUS"],
    researcherIdWos: ["Researcher ID web of science"],
    citizenship: ["Гражданство"],
    department: ["Место работы"],
    hIndex: ["H-index"]
  };
  for (const [field, aliases] of Object.entries(FIELD_HEADERS)) {
    if (hasHeader(aliases)) presentFields.add(field);
  }

  return rows
    .map((row, index) => {
      const name = toStringValue(findField(row, ["ф.и.о.", "фио", "ФИО"]));
      if (!name) {
        return null;
      }

      const citizenship = knownOrEmpty(findField(row, ["Гражданство"]));
      const academicDegree = knownOrEmpty(findField(row, ["Ученая степень", "Степень"]));
      const position = toStringValue(findField(row, ["Ученое звание"]));
      const scopusAuthorId = toScopusAuthorId(findField(row, ["Author ID SCOPUS"]));
      const researcherIdWos = toResearcherId(findField(row, ["Researcher ID web of science"]));
      const orcid = toStringValue(findField(row, ["ORCID ID"]));
      const hIndexRaw = findField(row, ["H-index"]);
      const hIndex = knownOrEmpty(hIndexRaw) === "" ? null : toNumber(hIndexRaw);
      const region = canonicalRegion(findField(row, ["Регион"]));
      const gender = toStringValue(findField(row, ["Gender"])) || toStringValue(findField(row, ["Пол"]));
      const department = knownOrEmpty(findField(row, ["Место работы"]));
      const classifier = toStringValue(findField(row, ["Классификатор научных направлений"]));
      const mrnti = knownOrEmpty(findField(row, ["МРНТИ", "Код МРНТИ"]));
      const leadCodes = parseCodes(findField(row, ["Отчет н.р.", "НР в проекте"]));
      const memberCodes = parseCodes(findField(row, ["Отчет ч.и.г.", "ЧИГ в проекте"]));
      const projectIds = Array.from(new Set([...leadCodes, ...memberCodes]));
      const roleText = normalize(findField(row, ["Роль в проекте"]));
      const isLead = leadCodes.length > 0 || /(^|[\s,])нр($|[\s,])/.test(roleText);
      const isMember = memberCodes.length > 0 || roleText.includes("чиг");
      const projectRole = isLead ? "руководитель" : isMember ? "исполнитель" : "";

      const idSource = scopusAuthorId || `${name}|${department}|${region || "Не указан"}`;
      const generatedId = crypto.createHash("sha1").update(idSource).digest("hex").slice(0, 16);

      return {
        id: `employee-${generatedId}`,
        name,
        position,
        department,
        region,
        hIndex,
        academicDegree,
        scopusAuthorId,
        researcherIdWos,
        orcid,
        gender,
        citizenship,
        projectRole,
        mrnti,
        classifier,
        projectIds,
        excelData: buildExcelData(headers, row),
        sourceRef: `${path.basename(sourceFile)}:${targetSheetName}:${index + 2}`
      };
    })
    .filter(Boolean);
};

const allRows = [];
for (const sourceFile of sourceFiles) {
  const workbook = xlsx.readFile(sourceFile, { cellDates: false });
  allRows.push(...parseWorkbookRows(workbook, sourceFile));
}

if (allRows.length === 0) {
  console.log("No valid rows found in provided Excel files");
  process.exit(0);
}

const client = new Client({
  host: env.host,
  port: env.port,
  database: env.database,
  user: env.user,
  password: env.password
});

await client.connect();

// In merge mode, rows are matched to existing employees by normalized full name.
// Scopus Author ID only tells namesakes apart: exports reuse one ID for different
// people, so it is never trusted on its own. Each stored employee is claimed by at
// most one file row, so namesakes stay separate records.
let matchedExisting = 0;
if (merge) {
  const tableExists = await client.query("SELECT to_regclass($1) AS name", [env.table]);
  if (tableExists.rows[0]?.name) {
    const existing = await client.query(
      `SELECT id, name, scopus_author_id, excel_data->>'Author ID SCOPUS' AS raw_scopus FROM ${tableName} ORDER BY id`
    );
    const candidatesByName = new Map();
    for (const { id, name, scopus_author_id: scopusId, raw_scopus: rawScopus } of existing.rows) {
      const key = normalizeName(name);
      const scopusIds = new Set([toScopusAuthorId(rawScopus), toScopusAuthorId(scopusId)].filter(Boolean));
      candidatesByName.set(key, [...(candidatesByName.get(key) ?? []), { id, scopusIds }]);
    }

    const claimed = new Set();
    // Rows with a Scopus ID go first so they take the namesake record holding that ID.
    const ordered = [...allRows].sort((a, b) => Number(Boolean(b.scopusAuthorId)) - Number(Boolean(a.scopusAuthorId)));
    for (const row of ordered) {
      const candidates = (candidatesByName.get(normalizeName(row.name)) ?? []).filter((item) => !claimed.has(item.id));
      const match =
        (row.scopusAuthorId && candidates.find((item) => item.scopusIds.has(row.scopusAuthorId))) || candidates[0];
      if (match) {
        row.id = match.id;
        claimed.add(match.id);
        matchedExisting += 1;
      }
    }
  }
}

const deduplicated = new Map();
let mergedCount = 0;
for (const row of allRows) {
  const existing = deduplicated.get(row.id);
  if (!existing) {
    deduplicated.set(row.id, row);
    continue;
  }
  mergedCount += 1;
  deduplicated.set(row.id, {
    ...existing,
    projectIds: Array.from(new Set([...existing.projectIds, ...row.projectIds])),
    excelData: { ...existing.excelData, ...row.excelData }
  });
}

const validRows = Array.from(deduplicated.values());

try {
  await client.query("BEGIN");

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position TEXT NULL,
      department TEXT NULL,
      region TEXT NULL,
      email TEXT NULL,
      phone TEXT NULL,
      h_index NUMERIC(10,2) NOT NULL DEFAULT 0,
      academic_degree TEXT NULL,
      scopus_author_id TEXT NULL,
      researcher_id_wos TEXT NULL,
      orcid TEXT NULL,
      gender TEXT NULL,
      citizenship TEXT NULL,
      project_role TEXT NULL,
      mrnti TEXT NULL,
      classifier TEXT NULL,
      project_ids TEXT NULL,
      excel_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_ref TEXT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_employees_region ON ${tableName}(region)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_employees_department ON ${tableName}(department)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_employees_excel_data_gin ON ${tableName} USING GIN (excel_data)`);

  if (truncate) {
    await client.query(`TRUNCATE TABLE ${tableName}`);
  }

  const replaceSql = `
    INSERT INTO ${tableName} (
      id, name, position, department, region, h_index, academic_degree, scopus_author_id,
      researcher_id_wos, orcid, gender, citizenship, project_role, mrnti, classifier,
      project_ids, excel_data, source_ref, updated_at
    ) VALUES (
      $1, $2, $3, $4, COALESCE($5, 'Не указан'), COALESCE($6, 0), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      name = EXCLUDED.name,
      position = EXCLUDED.position,
      department = EXCLUDED.department,
      region = EXCLUDED.region,
      h_index = EXCLUDED.h_index,
      academic_degree = EXCLUDED.academic_degree,
      scopus_author_id = EXCLUDED.scopus_author_id,
      researcher_id_wos = EXCLUDED.researcher_id_wos,
      orcid = EXCLUDED.orcid,
      gender = EXCLUDED.gender,
      citizenship = EXCLUDED.citizenship,
      project_role = EXCLUDED.project_role,
      mrnti = EXCLUDED.mrnti,
      classifier = EXCLUDED.classifier,
      project_ids = EXCLUDED.project_ids,
      excel_data = EXCLUDED.excel_data,
      source_ref = EXCLUDED.source_ref,
      updated_at = NOW()
  `;

  // Fields whose column is in the file replace stored values; fields missing from
  // the file keep them (COALESCE with NULL).
  const t = tableName;
  const fromFile = (field, column, fileValue, fallback = `${t}.${column}`) =>
    presentFields.has(field) ? fileValue : `COALESCE(${fileValue}, ${fallback})`;
  const mergeSql = replaceSql.replace(/ON CONFLICT \(id\) DO UPDATE[\s\S]*$/, `ON CONFLICT (id) DO UPDATE
    SET
      position = COALESCE(EXCLUDED.position, ${t}.position),
      department = ${fromFile("department", "department", "EXCLUDED.department")},
      region = ${presentFields.has("region") ? "EXCLUDED.region" : `COALESCE($5, ${t}.region)`},
      h_index = ${presentFields.has("hIndex") ? "COALESCE($6, 0)" : `COALESCE($6, ${t}.h_index)`},
      academic_degree = ${fromFile("academicDegree", "academic_degree", "EXCLUDED.academic_degree")},
      scopus_author_id = ${fromFile("scopusAuthorId", "scopus_author_id", "EXCLUDED.scopus_author_id")},
      researcher_id_wos = ${fromFile("researcherIdWos", "researcher_id_wos", "EXCLUDED.researcher_id_wos")},
      orcid = COALESCE(EXCLUDED.orcid, ${t}.orcid),
      gender = COALESCE(EXCLUDED.gender, ${t}.gender),
      citizenship = ${fromFile("citizenship", "citizenship", "EXCLUDED.citizenship")},
      project_role = COALESCE(EXCLUDED.project_role, ${t}.project_role),
      mrnti = COALESCE(EXCLUDED.mrnti, ${t}.mrnti),
      classifier = COALESCE(EXCLUDED.classifier, ${t}.classifier),
      project_ids = COALESCE(EXCLUDED.project_ids, ${t}.project_ids),
      excel_data = ${t}.excel_data || EXCLUDED.excel_data,
      source_ref = EXCLUDED.source_ref,
      updated_at = NOW()
  `);
  const upsertSql = merge ? mergeSql : replaceSql;

  for (const row of validRows) {
    await client.query(upsertSql, [
      row.id,
      row.name,
      row.position || null,
      row.department || null,
      row.region || null,
      row.hIndex,
      row.academicDegree || null,
      row.scopusAuthorId || null,
      row.researcherIdWos || null,
      row.orcid || null,
      row.gender || null,
      row.citizenship || null,
      row.projectRole || null,
      row.mrnti || null,
      row.classifier || null,
      row.projectIds.join(",") || null,
      JSON.stringify(row.excelData || {}),
      row.sourceRef
    ]);
  }

  await client.query("COMMIT");
  console.log(
    `Imported ${validRows.length} unique rows (merged ${mergedCount} duplicates) from ${sourceFiles.length} file(s) into ${env.database}.${env.table}`
  );
  if (merge) {
    console.log(`Merge mode: ${matchedExisting} rows matched existing employees by name`);
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Import failed:", error.message || error);
  process.exitCode = 1;
} finally {
  await client.end();
}
