#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import xlsx from "xlsx";

const { Client } = pg;

const usage = () => {
  console.log("Usage: node scripts/import-project-results-xlsx.mjs <file.xlsx> [--sheet <sheetName>] [--truncate]");
};

const args = process.argv.slice(2);
const inputPaths = [];
let sheetName;
let truncate = false;

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
  console.error(`Unknown option: ${arg}`);
  usage();
  process.exit(1);
}

if (inputPaths.length === 0) {
  usage();
  process.exit(1);
}

const env = {
  host: process.env.USERS_DB_HOST ?? "localhost",
  port: Number(process.env.USERS_DB_PORT ?? 5433),
  database: process.env.USERS_DB_NAME ?? "users_db",
  user: process.env.USERS_DB_USER ?? "users_admin",
  password: process.env.USERS_DB_PASSWORD ?? "users_password",
  table: process.env.USERS_PROJECT_RESULTS_TABLE ?? "project_results"
};

const safeIdentifier = (identifier) => {
  const parts = String(identifier).split(".");
  const allowed = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (parts.some((part) => !allowed.test(part))) {
    throw new Error(`Invalid table name: ${identifier}`);
  }
  return parts.map((part) => `"${part}"`).join(".");
};

const tableName = safeIdentifier(env.table);

const toStringValue = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeHeader = (value) => toStringValue(value).toLowerCase().replace(/ё/g, "е");

const toInt = (value) => {
  const numeric = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
};

// Region names in the source differ from the map's canonical names
// ("Алматы", "Жамбылская обл.", "Мангыстауская"); store the canonical ones.
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
  ["туркестан", "Туркестанская область"],
  ["кызылорд", "Кызылординская область"],
  ["улытау", "Улытауская область"],
  ["абай", "Абайская область"],
  ["павлодар", "Павлодарская область"],
  ["жамбыл", "Жамбылская область"],
  ["костанай", "Костанайская область"],
  ["актюбинская", "Актюбинская область"]
];

const canonicalRegion = (value) => {
  const raw = toStringValue(value);
  const normalized = raw.toLowerCase();
  const match = REGION_ALIASES.find(([needle]) => normalized.includes(needle));
  return match ? match[1] : raw;
};

const parsePeriod = (value) => {
  const years = (toStringValue(value).match(/(19|20)\d{2}/g) ?? []).map(Number);
  if (years.length === 0) {
    return { startYear: null, endYear: null };
  }
  return { startYear: Math.min(...years), endYear: Math.max(...years) };
};

const COLUMNS = {
  irn: ["ИРН"],
  financingType: ["Форма финансирование", "Форма финансирования"],
  applicant: ["Заявитель"],
  customer: ["Заказчик"],
  region: ["Регион заявителя", "Регион"],
  period: ["Период реализации"],
  contest: ["Наименование конкурса"],
  priority: ["Приоритетное направление"],
  domestic: ["Отечественные публикации за 3 год", "Отечественные публикации за 3 года", "Отечественные публикации"],
  foreign: ["Зарубежные публикации за 3 года", "Зарубежные публикации"],
  wos: ["WoS за 3 года", "WoS"],
  scopus: ["Scopus за 3 года", "Scopus"],
  patents: ["Патенты за 3 года", "Патенты"],
  implementations: ["Внедрении", "Внедрения"],
  classifierL1: ["Классификатор научных направлений, уровень 1"],
  classifierL2: ["Классификатор научных направлений, уровень 2"],
  classifierL3: ["Классификатор научных направлений, уровень 3"],
  mrnti: ["МРНТИ.1", "МРНТИ"],
  status: ["Этап реализация", "Этап реализации"]
};

const filePath = path.resolve(process.cwd(), inputPaths[0]);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const workbook = xlsx.readFile(filePath, { cellDates: false });
const targetSheetName = sheetName || workbook.SheetNames[0];
const sheet = workbook.Sheets[targetSheetName];
if (!sheet) {
  console.error(`Sheet not found: ${targetSheetName}. Available: ${workbook.SheetNames.join(", ")}`);
  process.exit(1);
}

const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: true });
const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
const headerByNormalized = new Map(headers.map((header) => [normalizeHeader(header), header]));

const resolveHeader = (aliases) => {
  for (const alias of aliases) {
    const header = headerByNormalized.get(normalizeHeader(alias));
    if (header) return header;
  }
  return undefined;
};

const columnHeaders = Object.fromEntries(
  Object.entries(COLUMNS).map(([key, aliases]) => [key, resolveHeader(aliases)])
);

const missing = Object.entries(columnHeaders)
  .filter(([, header]) => !header)
  .map(([key]) => key);
if (!columnHeaders.irn) {
  console.error("Column 'ИРН' not found");
  process.exit(1);
}
if (missing.length > 0) {
  console.warn(`Columns not found (left empty): ${missing.join(", ")}`);
}

const cell = (row, key) => (columnHeaders[key] ? row[columnHeaders[key]] : "");

const rows = new Map();
rawRows.forEach((row, index) => {
  const irn = toStringValue(cell(row, "irn"));
  if (!irn) return;

  const { startYear, endYear } = parsePeriod(cell(row, "period"));
  const excelData = {};
  headers.forEach((header) => {
    const value = row[header];
    if (value !== "" && value !== null && value !== undefined) {
      excelData[toStringValue(header)] = typeof value === "number" ? value : toStringValue(value);
    }
  });

  rows.set(irn, {
    irn,
    financingType: toStringValue(cell(row, "financingType")),
    applicant: toStringValue(cell(row, "applicant")),
    customer: toStringValue(cell(row, "customer")),
    region: canonicalRegion(cell(row, "region")),
    period: toStringValue(cell(row, "period")),
    startYear,
    endYear,
    contest: toStringValue(cell(row, "contest")),
    priority: toStringValue(cell(row, "priority")),
    domestic: toInt(cell(row, "domestic")),
    foreign: toInt(cell(row, "foreign")),
    wos: toInt(cell(row, "wos")),
    scopus: toInt(cell(row, "scopus")),
    patents: toInt(cell(row, "patents")),
    implementations: toInt(cell(row, "implementations")),
    classifierL1: toStringValue(cell(row, "classifierL1")),
    classifierL2: toStringValue(cell(row, "classifierL2")),
    classifierL3: toStringValue(cell(row, "classifierL3")),
    mrnti: toStringValue(cell(row, "mrnti")),
    status: toStringValue(cell(row, "status")),
    excelData,
    sourceRef: `${path.basename(filePath)}:${targetSheetName}:${index + 2}`
  });
});

const validRows = Array.from(rows.values());
if (validRows.length === 0) {
  console.log("No valid rows found");
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

try {
  await client.query("BEGIN");

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      irn TEXT PRIMARY KEY,
      financing_type TEXT NULL,
      applicant TEXT NULL,
      customer TEXT NULL,
      region TEXT NULL,
      period TEXT NULL,
      start_year INTEGER NULL,
      end_year INTEGER NULL,
      contest TEXT NULL,
      priority TEXT NULL,
      domestic_publications INTEGER NOT NULL DEFAULT 0,
      foreign_publications INTEGER NOT NULL DEFAULT 0,
      wos_publications INTEGER NOT NULL DEFAULT 0,
      scopus_publications INTEGER NOT NULL DEFAULT 0,
      patents INTEGER NOT NULL DEFAULT 0,
      implementations INTEGER NOT NULL DEFAULT 0,
      classifier_l1 TEXT NULL,
      classifier_l2 TEXT NULL,
      classifier_l3 TEXT NULL,
      mrnti TEXT NULL,
      status TEXT NULL,
      excel_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_ref TEXT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  if (truncate) {
    await client.query(`TRUNCATE TABLE ${tableName}`);
  }

  const upsertSql = `
    INSERT INTO ${tableName} (
      irn, financing_type, applicant, customer, region, period, start_year, end_year, contest, priority,
      domestic_publications, foreign_publications, wos_publications, scopus_publications, patents, implementations,
      classifier_l1, classifier_l2, classifier_l3, mrnti, status, excel_data, source_ref, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb, $23, NOW()
    )
    ON CONFLICT (irn) DO UPDATE
    SET
      financing_type = EXCLUDED.financing_type,
      applicant = EXCLUDED.applicant,
      customer = EXCLUDED.customer,
      region = EXCLUDED.region,
      period = EXCLUDED.period,
      start_year = EXCLUDED.start_year,
      end_year = EXCLUDED.end_year,
      contest = EXCLUDED.contest,
      priority = EXCLUDED.priority,
      domestic_publications = EXCLUDED.domestic_publications,
      foreign_publications = EXCLUDED.foreign_publications,
      wos_publications = EXCLUDED.wos_publications,
      scopus_publications = EXCLUDED.scopus_publications,
      patents = EXCLUDED.patents,
      implementations = EXCLUDED.implementations,
      classifier_l1 = EXCLUDED.classifier_l1,
      classifier_l2 = EXCLUDED.classifier_l2,
      classifier_l3 = EXCLUDED.classifier_l3,
      mrnti = EXCLUDED.mrnti,
      status = EXCLUDED.status,
      excel_data = EXCLUDED.excel_data,
      source_ref = EXCLUDED.source_ref,
      updated_at = NOW()
  `;

  for (const row of validRows) {
    await client.query(upsertSql, [
      row.irn,
      row.financingType || null,
      row.applicant || null,
      row.customer || null,
      row.region || null,
      row.period || null,
      row.startYear,
      row.endYear,
      row.contest || null,
      row.priority || null,
      row.domestic,
      row.foreign,
      row.wos,
      row.scopus,
      row.patents,
      row.implementations,
      row.classifierL1 || null,
      row.classifierL2 || null,
      row.classifierL3 || null,
      row.mrnti || null,
      row.status || null,
      JSON.stringify(row.excelData),
      row.sourceRef
    ]);
  }

  await client.query("COMMIT");
  console.log(`Imported ${validRows.length} project results from ${path.basename(filePath)} into ${env.database}.${env.table}`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Import failed:", error.message || error);
  process.exitCode = 1;
} finally {
  await client.end();
}
