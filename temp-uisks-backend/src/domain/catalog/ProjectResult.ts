// Per-project research output (publications, patents, implementations) reported
// over the project's implementation period.
export interface ProjectResult {
  irn: string;
  financingType: string;
  applicant: string;
  customer: string;
  region: string;
  period: string;
  startYear: number | null;
  endYear: number | null;
  contest: string;
  priority: string;
  domesticPublications: number;
  foreignPublications: number;
  wosPublications: number;
  scopusPublications: number;
  patents: number;
  implementations: number;
  classifierL1: string;
  classifierL2: string;
  classifierL3: string;
  mrnti: string;
  status: string;
}
