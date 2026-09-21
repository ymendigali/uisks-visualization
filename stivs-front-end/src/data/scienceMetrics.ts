import { regionsData } from '../components/Home/regionsData';
import type { RegionType } from '../components/Home/regionsData';

export interface RegionScienceMetrics {
  id: string;
  name: string;
  type: RegionType;
  publications: number;
  organizations: number;
  authors: number;
  citations: number;
  citedArticlesShare: number;
  medianHIndex: number;
  highCitedShare: number;
  concentrationTop10: number;
  activeAuthors: number;
  activeOrganizations: number;
  topicsWithCriticalMass: number;
  avgMrntiCitations: number;
  collaborationShare: number;
  visibilityIndex: number;
}

export interface RegionScienceProfile extends RegionScienceMetrics {
  publicationsPerOrg: number;
  publicationsPerAuthor: number;
  citationsPerArticle: number;
  activityIndex: number;
  influenceIndex: number;
  stabilityIndex: number;
}

export interface NationalScienceSnapshot {
  publications: number;
  citationsPerArticle: number;
  activeAuthors: number;
  medianHIndex: number;
  collaborationShare: number;
  visibilityIndex: number;
}

export interface ScienceDataset {
  metrics: RegionScienceProfile[];
  metricsById: Map<string, RegionScienceProfile>;
  indexBounds: {
    activity: { min: number; max: number };
    influence: { min: number; max: number };
    stability: { min: number; max: number };
  };
  indexAverages: {
    activity: number;
    influence: number;
    stability: number;
  };
  nationalSnapshot: NationalScienceSnapshot;
}

// This module has no year-partitioned source data (see the
// "модуль находится на стадии интеграции" banner on the metrics page) — every
// figure is derived from a single static regionsData snapshot. The year filter
// scales that snapshot's absolute volumes (publications, staff, funding) by a
// deterministic per-year growth curve anchored on SCIENCE_YEAR_RANGE.max, so
// switching years still shows a coherent, reproducible trend instead of being
// purely decorative, until real per-year data is wired in.
export const SCIENCE_YEAR_RANGE = { min: 2021, max: 2025 } as const;
const YEAR_GROWTH_RATE = 0.055;

const getYearFactor = (year: number): number => (1 + YEAR_GROWTH_RATE) ** (year - SCIENCE_YEAR_RANGE.max);

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const toFixedNumber = (value: number, fractionDigits = 2): number => {
  return Number(value.toFixed(fractionDigits));
};

const buildBaseMetrics = (year: number): RegionScienceMetrics[] => {
  const factor = getYearFactor(year);

  return regionsData.map((region) => {
    const { stats } = region;
    const publications = Math.round(stats.publications.total * factor);
    const orgBase = (stats.projects.total * factor) / 16 + (region.type === 'city' ? 18 : 10);
    const organizations = Math.max(10, Math.round(orgBase));
    const authors = Math.max(140, Math.round(stats.people.total * factor * 0.38));
    const journalShare = stats.publications.total ? stats.publications.journals / stats.publications.total : 0.4;
    const programShare = stats.projects.total ? stats.projects.programs / stats.projects.total : 0.45;
    const conferenceShare = stats.publications.total
      ? stats.publications.conferences / stats.publications.total
      : 0.2;
    const professorShare = stats.people.total ? stats.people.professors / stats.people.total : 0.12;
    const assocShare = stats.people.total ? stats.people.associateProfessors / stats.people.total : 0.08;
    const contractShare = stats.projects.total ? stats.projects.contracts / stats.projects.total : 0.18;
    const financesTotal = stats.finances.total * factor;

    const citationsPerArticle = clamp(
      toFixedNumber(1.9 + journalShare * 2.2 + (financesTotal / 120) * 0.9 + professorShare * 2.1, 2),
      1.5,
      6.4,
    );
    const citations = Math.round(publications * citationsPerArticle);

    const citedArticlesShare = clamp(
      toFixedNumber(0.5 + journalShare * 0.33 + programShare * 0.22, 3),
      0.5,
      0.92,
    );

    const medianHIndex = clamp(
      toFixedNumber(3 + journalShare * 4 + assocShare * 6, 1),
      3,
      10.5,
    );

    const highCitedShare = clamp(
      toFixedNumber(0.07 + journalShare * 0.23 + (financesTotal / 140) * 0.05, 3),
      0.07,
      0.32,
    );

    const concentrationTop10 = clamp(
      toFixedNumber(0.24 + (1 - Math.min(authors / 5200, 0.98)) * 0.28 + contractShare * 0.24, 3),
      0.2,
      0.65,
    );

    const activeAuthors = Math.max(
      120,
      Math.round(
        authors * clamp(0.38 + journalShare * 0.3 + conferenceShare * 0.22, 0.4, 0.78),
      ),
    );

    const activeOrganizations = Math.max(
      6,
      Math.round(organizations * clamp(0.58 + programShare * 0.3, 0.55, 0.9)),
    );

    const topicsWithCriticalMass = clamp(
      Math.round(4 + (stats.projects.programs * factor) / 35 + (stats.publications.other * factor) / 140),
      4,
      22,
    );

    const avgMrntiCitations = clamp(
      toFixedNumber(citationsPerArticle * 0.78 + programShare * 4, 1),
      2,
      8.6,
    );

    const collaborationShare = clamp(
      toFixedNumber(0.18 + contractShare * 0.55 + assocShare * 0.28, 3),
      0.2,
      0.6,
    );

    const visibilityIndex = clamp(
      toFixedNumber(
        citationsPerArticle * 14 + citedArticlesShare * 42 + collaborationShare * 38 + highCitedShare * 80,
        1,
      ),
      28,
      96,
    );

    return {
      id: region.id,
      name: region.name,
      type: region.type,
      publications,
      organizations,
      authors,
      citations,
      citedArticlesShare,
      medianHIndex,
      highCitedShare,
      concentrationTop10,
      activeAuthors,
      activeOrganizations,
      topicsWithCriticalMass,
      avgMrntiCitations,
      collaborationShare,
      visibilityIndex,
    } satisfies RegionScienceMetrics;
  });
};

interface ZGetter {
  (value: number): number;
}

const createZGetter = (values: number[]): ZGetter => {
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);

  return (value: number) => {
    if (std === 0) {
      return 0;
    }
    return (value - mean) / std;
  };
};

const collectBounds = (values: number[]) => {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  } as const;
};

const buildScienceDataset = (year: number): ScienceDataset => {
  const baseMetrics = buildBaseMetrics(year);

  const publicationsValues = baseMetrics.map((item) => item.publications);
  const publicationsPerOrgValues = baseMetrics.map((item) => item.publications / item.organizations);
  const citationsPerArticleValues = baseMetrics.map((item) => item.citations / Math.max(item.publications, 1));
  const citedShareValues = baseMetrics.map((item) => item.citedArticlesShare);
  const hIndexValues = baseMetrics.map((item) => item.medianHIndex);
  const concentrationInverseValues = baseMetrics.map((item) => 1 - item.concentrationTop10);
  const activeAuthorsValues = baseMetrics.map((item) => item.activeAuthors);
  const collaborationValues = baseMetrics.map((item) => item.collaborationShare);

  const zA1 = createZGetter(publicationsValues);
  const zA2 = createZGetter(publicationsPerOrgValues);
  const zB1 = createZGetter(citationsPerArticleValues);
  const zB2 = createZGetter(citedShareValues);
  const zB3 = createZGetter(hIndexValues);
  const zC1 = createZGetter(concentrationInverseValues);
  const zC2 = createZGetter(activeAuthorsValues);
  const zD3 = createZGetter(collaborationValues);

  const scienceProfiles: RegionScienceProfile[] = baseMetrics.map((metric) => {
    const publicationsPerOrg = metric.publications / metric.organizations;
    const publicationsPerAuthor = metric.publications / metric.authors;
    const citationsPerArticle = metric.citations / Math.max(metric.publications, 1);

    const activityIndex = zA1(metric.publications) + zA2(publicationsPerOrg);
    const influenceIndex =
      zB1(citationsPerArticle) + zB2(metric.citedArticlesShare) + zB3(metric.medianHIndex);
    const stabilityIndex =
      zC1(1 - metric.concentrationTop10) + zC2(metric.activeAuthors) + zD3(metric.collaborationShare);

    return {
      ...metric,
      publicationsPerOrg,
      publicationsPerAuthor,
      citationsPerArticle,
      activityIndex,
      influenceIndex,
      stabilityIndex,
    } satisfies RegionScienceProfile;
  });

  const activityValues = scienceProfiles.map((item) => item.activityIndex);
  const influenceValues = scienceProfiles.map((item) => item.influenceIndex);
  const stabilityValues = scienceProfiles.map((item) => item.stabilityIndex);

  const aggregate = scienceProfiles.reduce(
    (acc, region) => {
      acc.publications += region.publications;
      acc.citations += region.citations;
      acc.activeAuthors += region.activeAuthors;
      acc.medianHIndexWeighted += region.medianHIndex * region.authors;
      acc.authors += region.authors;
      acc.collaborationWeighted += region.collaborationShare * region.publications;
      acc.visibility += region.visibilityIndex;
      acc.count += 1;
      return acc;
    },
    {
      publications: 0,
      citations: 0,
      activeAuthors: 0,
      medianHIndexWeighted: 0,
      authors: 0,
      collaborationWeighted: 0,
      visibility: 0,
      count: 0,
    },
  );

  const nationalSnapshot: NationalScienceSnapshot = {
    publications: Math.round(aggregate.publications / aggregate.count),
    citationsPerArticle: aggregate.publications ? aggregate.citations / aggregate.publications : 0,
    activeAuthors: Math.round(aggregate.activeAuthors / aggregate.count),
    medianHIndex: aggregate.authors ? aggregate.medianHIndexWeighted / aggregate.authors : 0,
    collaborationShare: aggregate.publications ? aggregate.collaborationWeighted / aggregate.publications : 0,
    visibilityIndex: aggregate.visibility / aggregate.count,
  };

  return {
    metrics: scienceProfiles,
    metricsById: new Map(scienceProfiles.map((profile) => [profile.id, profile])),
    indexBounds: {
      activity: collectBounds(activityValues),
      influence: collectBounds(influenceValues),
      stability: collectBounds(stabilityValues),
    },
    indexAverages: {
      activity: activityValues.reduce((acc, value) => acc + value, 0) / activityValues.length,
      influence: influenceValues.reduce((acc, value) => acc + value, 0) / influenceValues.length,
      stability: stabilityValues.reduce((acc, value) => acc + value, 0) / stabilityValues.length,
    },
    nationalSnapshot,
  };
};

const datasetCache = new Map<number, ScienceDataset>();

export const getScienceDataset = (year: number = SCIENCE_YEAR_RANGE.max): ScienceDataset => {
  const clampedYear = clamp(year, SCIENCE_YEAR_RANGE.min, SCIENCE_YEAR_RANGE.max);
  const cached = datasetCache.get(clampedYear);
  if (cached) {
    return cached;
  }

  const dataset = buildScienceDataset(clampedYear);
  datasetCache.set(clampedYear, dataset);
  return dataset;
};

export const getRegionScienceMetric = (regionId: string, year?: number): RegionScienceProfile | null => {
  return getScienceDataset(year).metricsById.get(regionId) ?? null;
};
