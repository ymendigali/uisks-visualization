export interface Project {
  id: string;
  title: string;
  lead: string;
  region: string;
  status: string;
  budget: number;
  spent: number;
  startDate: string | null;
  endDate: string | null;
  tags: string[];
  financingType?: string;
  priority?: string;
  contest?: string;
  customer?: string;
  mrnti?: string;
  // Top-level MRNTI section for filtering, e.g. "31 — Химия".
  mrntiSection?: string;
  trl?: number | null;
  startYear?: number | null;
  endYear?: number | null;
  excelData?: Record<string, unknown>;
  description?: string;
  teamIds?: string[];
  publicationsIds?: string[];
  files?: string[];
}
