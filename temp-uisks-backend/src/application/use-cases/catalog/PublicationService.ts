import { Publication } from "../../../domain/catalog/Publication";
import { ProjectResult } from "../../../domain/catalog/ProjectResult";
import {
  FilterOptionCountString,
  ProjectResultRepository,
  PublicationFilterMeta,
  PublicationFilterOptions,
  PublicationListFilters,
  PublicationRepository
} from "../../ports/CatalogRepositories";
import { PaginatedResult } from "../../ports/Pagination";

export type PublicationAnalyticsFilters = {
  region?: string;
  yearFrom?: number;
  yearTo?: number;
  irn?: string;
  financingType?: string;
  priority?: string;
  contest?: string;
  applicant?: string;
  customer?: string;
  mrnti?: string;
  status?: string;
};

export type PublicationsSummary = {
  total: number;
  domestic: number;
  foreign: number;
  scopus: number;
  wos: number;
  patents: number;
  implementations: number;
  projects: number;
};

export type PublicationsTimeseriesItem = {
  year: number;
  total: number;
  domestic: number;
  foreign: number;
  scopus: number;
  wos: number;
  patents: number;
  implementations: number;
};

export type PublicationsDistributions = {
  scopusWos: { scopus: number; wos: number };
  priorities: Array<{ priority: string; value: number }>;
  topApplicants: Array<{ name: string; value: number }>;
  patentsVsImplementations: { patents: number; implementations: number };
};

export type PublicationsAnalyticsFilterOptions = {
  irn: FilterOptionCountString[];
  financingType: FilterOptionCountString[];
  priority: FilterOptionCountString[];
  contest: FilterOptionCountString[];
  applicant: FilterOptionCountString[];
  customer: FilterOptionCountString[];
  mrnti: FilterOptionCountString[];
  status: FilterOptionCountString[];
  region: FilterOptionCountString[];
  yearRange: { min: number | null; max: number | null };
};

const normalize = (value: string | undefined): string =>
  String(value ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

const isNoFilterValue = (value?: string): boolean =>
  ["", "all", "any", "все", "все регионы", "national"].includes(normalize(value));

const normalizeRegion = (value: string): string =>
  normalize(value)
    .replace(/[.,]/g, " ")
    .replace(/(^|\s)(город|г|область|обл)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Filter values are exact option values from /analytics-filters, except MRNTI,
// which also accepts a code prefix (e.g. "31" or "31.25").
const matchesFilters = (item: ProjectResult, filters: PublicationAnalyticsFilters): boolean => {
  const exact = (actual: string, expected?: string) => isNoFilterValue(expected) || normalize(actual) === normalize(expected);

  if (!isNoFilterValue(filters.region) && normalizeRegion(item.region) !== normalizeRegion(filters.region ?? "")) {
    return false;
  }
  if (
    !exact(item.irn, filters.irn) ||
    !exact(item.financingType, filters.financingType) ||
    !exact(item.priority, filters.priority) ||
    !exact(item.contest, filters.contest) ||
    !exact(item.applicant, filters.applicant) ||
    !exact(item.customer, filters.customer) ||
    !exact(item.status, filters.status)
  ) {
    return false;
  }
  if (!isNoFilterValue(filters.mrnti) && !normalize(item.mrnti).startsWith(normalize(filters.mrnti))) {
    return false;
  }
  if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
    if (item.startYear === null || item.endYear === null) {
      return false;
    }
    if (filters.yearFrom !== undefined && item.endYear < filters.yearFrom) {
      return false;
    }
    if (filters.yearTo !== undefined && item.startYear > filters.yearTo) {
      return false;
    }
  }
  return true;
};

const countValues = (values: string[]): FilterOptionCountString[] => {
  const counter = new Map<string, number>();
  for (const value of values) {
    if (value) {
      counter.set(value, (counter.get(value) ?? 0) + 1);
    }
  }
  return Array.from(counter.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "ru"))
    .map(([value, count]) => ({ value, count }));
};

const round2 = (value: number): number => Number(value.toFixed(2));

export class PublicationService {
  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly projectResultRepository?: ProjectResultRepository
  ) {}

  list(filters: PublicationListFilters): Promise<PaginatedResult<Publication>> {
    return this.publicationRepository.list(filters);
  }

  getFilters(): Promise<PublicationFilterOptions> {
    return this.publicationRepository.getFilters();
  }

  getFilterMeta(filters: PublicationListFilters): Promise<PublicationFilterMeta> {
    return this.publicationRepository.getFilterMeta(filters);
  }

  getById(id: string): Promise<Publication | null> {
    return this.publicationRepository.getById(id);
  }

  create(input: Publication): Promise<Publication> {
    return this.publicationRepository.create(input);
  }

  update(id: string, input: Partial<Publication>): Promise<Publication | null> {
    return this.publicationRepository.update(id, input);
  }

  delete(id: string): Promise<boolean> {
    return this.publicationRepository.delete(id);
  }

  async getSummary(filters: PublicationAnalyticsFilters): Promise<PublicationsSummary> {
    const items = await this.getAnalyticsItems(filters);
    const sum = (pick: (item: ProjectResult) => number) => items.reduce((total, item) => total + pick(item), 0);

    const domestic = sum((item) => item.domesticPublications);
    const foreign = sum((item) => item.foreignPublications);

    return {
      total: domestic + foreign,
      domestic,
      foreign,
      scopus: sum((item) => item.scopusPublications),
      wos: sum((item) => item.wosPublications),
      patents: sum((item) => item.patents),
      implementations: sum((item) => item.implementations),
      projects: items.length
    };
  }

  // Results are reported per project for its whole period, so each project's
  // figures are spread evenly across the years of that period.
  async getTimeseries(filters: PublicationAnalyticsFilters): Promise<{ items: PublicationsTimeseriesItem[] }> {
    const items = await this.getAnalyticsItems(filters);
    const metrics = ["domestic", "foreign", "scopus", "wos", "patents", "implementations"] as const;
    type Metric = (typeof metrics)[number];
    const years = new Map<number, Record<Metric, number>>();

    for (const item of items) {
      if (item.startYear === null || item.endYear === null) {
        continue;
      }
      const span = Math.max(item.endYear - item.startYear + 1, 1);
      const values: Record<Metric, number> = {
        domestic: item.domesticPublications,
        foreign: item.foreignPublications,
        scopus: item.scopusPublications,
        wos: item.wosPublications,
        patents: item.patents,
        implementations: item.implementations
      };

      for (let year = item.startYear; year <= item.endYear; year += 1) {
        if ((filters.yearFrom !== undefined && year < filters.yearFrom) || (filters.yearTo !== undefined && year > filters.yearTo)) {
          continue;
        }
        const current = years.get(year) ?? { domestic: 0, foreign: 0, scopus: 0, wos: 0, patents: 0, implementations: 0 };
        for (const metric of metrics) {
          current[metric] += values[metric] / span;
        }
        years.set(year, current);
      }
    }

    return {
      items: Array.from(years.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, value]) => ({
          year,
          total: round2(value.domestic + value.foreign),
          domestic: round2(value.domestic),
          foreign: round2(value.foreign),
          scopus: round2(value.scopus),
          wos: round2(value.wos),
          patents: round2(value.patents),
          implementations: round2(value.implementations)
        }))
    };
  }

  async getDistributions(filters: PublicationAnalyticsFilters): Promise<PublicationsDistributions> {
    const items = await this.getAnalyticsItems(filters);
    const priorities = new Map<string, number>();
    const applicants = new Map<string, number>();

    let scopus = 0;
    let wos = 0;
    let patents = 0;
    let implementations = 0;

    for (const item of items) {
      const publications = item.domesticPublications + item.foreignPublications;
      if (item.priority && publications > 0) {
        priorities.set(item.priority, (priorities.get(item.priority) ?? 0) + publications);
      }
      if (item.applicant && publications > 0) {
        applicants.set(item.applicant, (applicants.get(item.applicant) ?? 0) + publications);
      }
      scopus += item.scopusPublications;
      wos += item.wosPublications;
      patents += item.patents;
      implementations += item.implementations;
    }

    const toSorted = (map: Map<string, number>) => Array.from(map.entries()).sort((a, b) => b[1] - a[1]);

    return {
      scopusWos: { scopus, wos },
      priorities: toSorted(priorities).map(([priority, value]) => ({ priority, value })),
      topApplicants: toSorted(applicants)
        .slice(0, 5)
        .map(([name, value]) => ({ name, value })),
      patentsVsImplementations: { patents, implementations }
    };
  }

  async getAnalyticsFilters(): Promise<PublicationsAnalyticsFilterOptions> {
    const items = this.projectResultRepository ? await this.projectResultRepository.listAll() : [];
    const startYears = items.map((item) => item.startYear).filter((year): year is number => year !== null);
    const endYears = items.map((item) => item.endYear).filter((year): year is number => year !== null);

    return {
      irn: countValues(items.map((item) => item.irn)),
      financingType: countValues(items.map((item) => item.financingType)),
      priority: countValues(items.map((item) => item.priority)),
      contest: countValues(items.map((item) => item.contest)),
      applicant: countValues(items.map((item) => item.applicant)),
      customer: countValues(items.map((item) => item.customer)),
      mrnti: countValues(items.map((item) => item.mrnti.split(".")[0] ?? "")),
      status: countValues(items.map((item) => item.status)),
      region: countValues(items.map((item) => item.region)),
      yearRange: {
        min: startYears.length ? Math.min(...startYears) : null,
        max: endYears.length ? Math.max(...endYears) : null
      }
    };
  }

  private async getAnalyticsItems(filters: PublicationAnalyticsFilters): Promise<ProjectResult[]> {
    if (!this.projectResultRepository) {
      return [];
    }
    const items = await this.projectResultRepository.listAll();
    return items.filter((item) => matchesFilters(item, filters));
  }
}
