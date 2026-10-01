#!/usr/bin/env node
// Merges the "ВНТИ Проекты" registry export (one row per project: IRN, titles, applicant,
// customer, region, period, contest, priority, funding amount, classifiers, MRNTI, status)
// into the projects table. Unlike import-projects-xlsx.mjs it never replaces excel_data:
// registry fields are layered over the existing JSON, so finance breakdowns imported from
// other files are kept. Projects missing from the file are left untouched.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import xlsx from "xlsx";

const { Client } = pg;

const args = process.argv.slice(2);
const filePathArg = args.find((arg) => !arg.startsWith("--"));
const sheetIndex = args.indexOf("--sheet");
const sheetName = sheetIndex >= 0 ? args[sheetIndex + 1] : undefined;

if (!filePathArg) {
  console.log("Usage: node scripts/merge-projects-xlsx.mjs <file.xlsx> [--sheet <sheetName>]");
  process.exit(1);
}

const env = {
  host: process.env.USERS_DB_HOST ?? "localhost",
  port: Number(process.env.USERS_DB_PORT ?? 5433),
  database: process.env.USERS_DB_NAME ?? "users_db",
  user: process.env.USERS_DB_USER ?? "users_admin",
  password: process.env.USERS_DB_PASSWORD ?? "users_password",
  table: process.env.USERS_PROJECTS_TABLE ?? "projects"
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

const toAmount = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const numeric = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : 0;
};

// Existing rows use "г. Алматы"; the registry writes "город Алматы".
const normalizeRegion = (value) => toStringValue(value).replace(/^город\s+/i, "г. ");

// Status codes understood by the Projects page.
const STATUS_CODES = [
  ["в реализации", "active"],
  ["заверш", "completed"],
  ["приостановл", "suspended"]
];

const toStatusCode = (value) => {
  const normalized = toStringValue(value).toLowerCase();
  return STATUS_CODES.find(([needle]) => normalized.includes(needle))?.[1] ?? "active";
};

const COLUMNS = {
  irn: ["ИРН"],
  financingType: ["Форма финансирование", "Форма финансирования"],
  title: ["Наименование работы"],
  titleKz: ["Наименование работы на каз"],
  applicant: ["Заявитель"],
  customer: ["Заказчик"],
  region: ["Регион заявителя"],
  period: ["Период реализации"],
  contest: ["Наименование конкурса"],
  priority: ["Приоритетное направление"],
  amount: ["Сумма финансирования"],
  classifierL1: ["Классификатор научных направлений, уровень 1"],
  classifierL2: ["Классификатор научных направлений, уровень 2"],
  classifierL3: ["Классификатор научных направлений, уровень 3"],
  mrnti: ["МРНТИ.1", "МРНТИ"],
  status: ["Статусы", "Статус"]
};

const filePath = path.resolve(process.cwd(), filePathArg);
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
const columnHeaders = Object.fromEntries(
  Object.entries(COLUMNS).map(([key, aliases]) => [
    key,
    aliases.map((alias) => headerByNormalized.get(normalizeHeader(alias))).find(Boolean)
  ])
);

const missing = Object.entries(columnHeaders)
  .filter(([, header]) => !header)
  .map(([key]) => key);
if (!columnHeaders.irn || !columnHeaders.title) {
  console.error("Columns 'ИРН' and 'Наименование работы' are required");
  process.exit(1);
}
if (missing.length > 0) {
  console.warn(`Columns not found (left unchanged): ${missing.join(", ")}`);
}

const cell = (row, key) => (columnHeaders[key] ? toStringValue(row[columnHeaders[key]]) : "");

const rows = new Map();
rawRows.forEach((row, index) => {
  const id = cell(row, "irn");
  if (!id) return;

  const statusText = cell(row, "status");
  const amount = columnHeaders.amount ? toAmount(row[columnHeaders.amount]) : 0;

  // Keys match what PostgresProjectRepository reads from excel_data.
  const excelPatch = Object.fromEntries(
    Object.entries({
      "Наименование на русском языке": cell(row, "title"),
      "Наименование на казахском языке": cell(row, "titleKz"),
      "Заявитель": cell(row, "applicant"),
      "Заказчик": cell(row, "customer"),
      "Регион заявителя": normalizeRegion(cell(row, "region")),
      "Период реализации": cell(row, "period"),
      "Конкурс": cell(row, "contest"),
      "Наименование конкурса": cell(row, "contest"),
      "Приоритетное направление": cell(row, "priority"),
      "Тип финансирования": cell(row, "financingType"),
      "Сумма финансирования": amount || "",
      "Классификатор научных направлений, уровень 1": cell(row, "classifierL1"),
      "Классификатор научных направлений, уровень 2": cell(row, "classifierL2"),
      "Классификатор научных направлений, уровень 3": cell(row, "classifierL3"),
      "МРНТИ.1": cell(row, "mrnti"),
      "Статус": statusText
    }).filter(([, value]) => value !== "")
  );

  rows.set(id, {
    id,
    title: cell(row, "title"),
    lead: cell(row, "applicant"),
    region: normalizeRegion(cell(row, "region")),
    status: statusText ? toStatusCode(statusText) : "",
    budget: amount,
    priority: cell(row, "priority"),
    financingType: cell(row, "financingType"),
    mrnti: cell(row, "mrnti"),
    excelPatch,
    sourceRef: `${path.basename(filePath)}:${targetSheetName}:${index + 2}`
  });
});

const validRows = Array.from(rows.values());
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

  const existing = await client.query(`SELECT id FROM ${tableName}`);
  const existingIds = new Set(existing.rows.map((row) => row.id));

  // Empty file values (NULL) keep the current column. An existing descriptive
  // "МРНТИ" ("86-ОХРАНА ТРУДА ... 86.01.00") is kept; new projects get the code.
  const upsertSql = `
    INSERT INTO ${tableName} (
      id, title, lead, region, status, budget, spent, priority, financing_type, tags, excel_data, source_ref, updated_at
    ) VALUES (
      $1, $2, COALESCE($3, ''), COALESCE($4, 'Не указан'), COALESCE($5, 'active'), COALESCE($6::numeric, 0), 0, $7, $8, $9,
      $10::jsonb || CASE WHEN $11::text IS NOT NULL THEN jsonb_build_object('МРНТИ', $11::text) ELSE '{}'::jsonb END,
      $12, NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      title = COALESCE(NULLIF($2, ''), ${tableName}.title),
      lead = COALESCE($3, ${tableName}.lead),
      region = COALESCE($4, ${tableName}.region),
      status = COALESCE($5, ${tableName}.status),
      budget = COALESCE($6::numeric, ${tableName}.budget),
      priority = COALESCE($7, ${tableName}.priority),
      financing_type = COALESCE($8, ${tableName}.financing_type),
      excel_data = ${tableName}.excel_data || $10::jsonb
        || CASE
             WHEN COALESCE(${tableName}.excel_data->>'МРНТИ', '') = '' AND $11::text IS NOT NULL
               THEN jsonb_build_object('МРНТИ', $11::text)
             ELSE '{}'::jsonb
           END,
      source_ref = $12,
      updated_at = NOW()
  `;

  for (const row of validRows) {
    await client.query(upsertSql, [
      row.id,
      row.title,
      row.lead || null,
      row.region || null,
      row.status || null,
      row.budget || null,
      row.priority || null,
      row.financingType || null,
      [row.priority, row.financingType].filter(Boolean),
      JSON.stringify(row.excelPatch),
      row.mrnti || null,
      row.sourceRef
    ]);
  }

  await client.query("COMMIT");
  const updated = validRows.filter((row) => existingIds.has(row.id)).length;
  console.log(
    `Merged ${validRows.length} projects from ${path.basename(filePath)}: ${updated} updated, ${validRows.length - updated} added; ` +
      `${existingIds.size - updated} existing projects not in the file were left unchanged`
  );
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Import failed:", error.message || error);
  process.exitCode = 1;
} finally {
  await client.end();
}
