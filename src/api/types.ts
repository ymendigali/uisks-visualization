export interface ApiErrorResponse {
  error?: string;
}

export type UserRole = 'admin' | 'staff' | 'viewer';

export interface ApiUser {
  id: string;
  email: string;
  name?: string;
  fullName?: string;
  role?: UserRole;
}

export interface AuthResponse {
  token: string;
  role?: UserRole;
  user: ApiUser;
}

export interface BackendProject {
  id: string;
  title: string;
  lead: string;
  region: string;
  status: string;
  budget: number;
  spent: number;
  startDate: string | null;
  endDate: string | null;
  tags?: string[];
  description?: string;
  teamIds?: string[];
  publicationsIds?: string[];
  files?: string[];
  financingType?: string;
  priority?: string;
  contest?: string;
  customer?: string;
  mrnti?: string;
  trl?: number | null;
}

export interface BackendEmployee {
  id: string;
  name: string;
  position: string;
  department: string;
  region: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  projectsIds?: string[];
  metrics?: Record<string, number | string>;
  bio?: string;
  publicationsIds?: string[];
}

export interface BackendPublication {
  id: string;
  title: string;
  authors: string[];
  year: number;
  type: string;
  doi?: string;
  projectId?: string;
  link?: string;
  abstract?: string;
  pdfUrl?: string;
}

export interface FinanceSummary {
  totalBudget: number;
  totalSpent: number;
  byCategory: Array<{ category: string; amount: number }>;
  byRegion: Array<{ region: string; amount: number }>;
}

export interface FinanceFilterOptions {
  irn: string[];
  financingType: string[];
  cofinancing: string[];
  expense: string[];
  priority: string[];
  competition: string[];
  applicant: string[];
  customer: string[];
  status: string[];
  yearRange?: {
    min: number;
    max: number;
  };
}

export interface FinanceFilterMeta {
  irn: FilterOptionCountString[];
  financingType: FilterOptionCountString[];
  cofinancing: FilterOptionCountString[];
  expense: FilterOptionCountString[];
  priority: FilterOptionCountString[];
  competition: FilterOptionCountString[];
  applicant: FilterOptionCountString[];
  customer: FilterOptionCountString[];
  status: FilterOptionCountString[];
  minYear?: number;
  maxYear?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ProjectFilterOptions {
  irn: string[];
  status: string[];
  region: string[];
  financingType: string[];
  priority: string[];
  applicant: string[];
  contest: string[];
  customer: string[];
  mrnti: string[];
  trl: string[];
}

export interface EmployeeFilterOptions {
  searchTerm?: string;
  region: string[];
  position: string[];
  department: string[];
  minAge: number;
  maxAge: number;
  affiliateType: string[];
  gender: string[];
  degree: string[];
  citizenship: string[];
  projectRole: string[];
  hIndexGroup: string[];
  mrnti: string[];
  classifier: string[];
}

export interface PublicationFilterOptions {
  type: string[];
  year: number[];
  applicant: string[];
}

export interface FilterOptionCountString {
  value: string;
  count: number;
}

export interface FilterOptionCountNumber {
  value: number;
  count: number;
}

export interface ProjectFilterMeta {
  irn: FilterOptionCountString[];
  status: FilterOptionCountString[];
  region: FilterOptionCountString[];
  financingType: FilterOptionCountString[];
  priority: FilterOptionCountString[];
  applicant: FilterOptionCountString[];
  mrnti: FilterOptionCountString[];
  trl: FilterOptionCountString[];
}

export interface EmployeeFilterMeta {
  region: FilterOptionCountString[];
  position: FilterOptionCountString[];
  department: FilterOptionCountString[];
  affiliateType: FilterOptionCountString[];
  gender: FilterOptionCountString[];
  degree: FilterOptionCountString[];
  citizenship: FilterOptionCountString[];
  projectRole: FilterOptionCountString[];
  hIndexGroup: FilterOptionCountString[];
  mrnti: FilterOptionCountString[];
  classifier: FilterOptionCountString[];
  minAge: number;
  maxAge: number;
}

export interface PublicationFilterMeta {
  type: FilterOptionCountString[];
  year: FilterOptionCountNumber[];
  applicant: FilterOptionCountString[];
}

export interface DashboardRegionSummary {
  region: string;
  projects: number;
  publications: number;
  employees: number;
  budget: number;
}

export interface DashboardFilterOption {
  value: string;
  label: string;
}

export interface DashboardFilterOptions {
  priority: DashboardFilterOption[];
  applicant: DashboardFilterOption[];
}

export interface DashboardSummary {
  projects: {
    total: number;
    grants: number;
    programs: number;
    contracts: number;
    commercialization: number;
    avgDuration: number;
  };
  publications: {
    total: number;
    journals: number;
    conferences: number;
    books: number;
    other: number;
  };
  people: {
    total: number;
    docents: number;
    professors: number;
    associateProfessors: number;
    avgAge: number;
  };
  finances: {
    total: number;
    lastYear: number;
    avgExpense: number;
    budgetUsage: number;
    regionalPrograms: number;
  };
  byRegion: DashboardRegionSummary[];
}
