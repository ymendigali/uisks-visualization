import { Pool } from "pg";
import { ProjectResultRepository } from "../../../application/ports/CatalogRepositories";
import { ProjectResult } from "../../../domain/catalog/ProjectResult";

type ProjectResultRow = {
  irn: string;
  financing_type: string | null;
  applicant: string | null;
  customer: string | null;
  region: string | null;
  period: string | null;
  start_year: number | null;
  end_year: number | null;
  contest: string | null;
  priority: string | null;
  domestic_publications: number;
  foreign_publications: number;
  wos_publications: number;
  scopus_publications: number;
  patents: number;
  implementations: number;
  classifier_l1: string | null;
  classifier_l2: string | null;
  classifier_l3: string | null;
  mrnti: string | null;
  status: string | null;
};

const toQualifiedTable = (value: string): string => {
  const parts = value.trim().split(".");
  const valid = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (parts.length === 0 || parts.some((part) => !valid.test(part))) {
    throw new Error("USERS_PROJECT_RESULTS_TABLE contains unsupported characters");
  }
  return parts.map((part) => `"${part}"`).join(".");
};

const toText = (value: string | null): string => (value ?? "").trim();

const toNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

export class PostgresProjectResultRepository implements ProjectResultRepository {
  private readonly qualifiedTable: string;

  constructor(
    private readonly pool: Pool,
    tableName: string
  ) {
    this.qualifiedTable = toQualifiedTable(tableName);
  }

  async listAll(): Promise<ProjectResult[]> {
    const exists = await this.pool.query<{ name: string | null }>("SELECT to_regclass($1) AS name", [
      this.qualifiedTable
    ]);
    if (!exists.rows[0]?.name) {
      return [];
    }

    const result = await this.pool.query<ProjectResultRow>(`
      SELECT
        irn, financing_type, applicant, customer, region, period, start_year, end_year, contest, priority,
        domestic_publications, foreign_publications, wos_publications, scopus_publications, patents, implementations,
        classifier_l1, classifier_l2, classifier_l3, mrnti, status
      FROM ${this.qualifiedTable}
      ORDER BY irn
    `);

    return result.rows.map((row) => ({
      irn: row.irn,
      financingType: toText(row.financing_type),
      applicant: toText(row.applicant),
      customer: toText(row.customer),
      region: toText(row.region),
      period: toText(row.period),
      startYear: row.start_year,
      endYear: row.end_year,
      contest: toText(row.contest),
      priority: toText(row.priority),
      domesticPublications: toNumber(row.domestic_publications),
      foreignPublications: toNumber(row.foreign_publications),
      wosPublications: toNumber(row.wos_publications),
      scopusPublications: toNumber(row.scopus_publications),
      patents: toNumber(row.patents),
      implementations: toNumber(row.implementations),
      classifierL1: toText(row.classifier_l1),
      classifierL2: toText(row.classifier_l2),
      classifierL3: toText(row.classifier_l3),
      mrnti: toText(row.mrnti),
      status: toText(row.status)
    }));
  }
}
