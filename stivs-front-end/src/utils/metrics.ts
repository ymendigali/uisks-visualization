import { regionsData } from '../components/Home/regionsData';
import type { RegionMetrics, RegionShape } from '../components/Home/regionsData';

export const formatNumber = (
  value: number,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 },
): string => {
  const mergedOptions: Intl.NumberFormatOptions = {
    maximumFractionDigits: 0,
    ...options,
  };

  return new Intl.NumberFormat('ru-RU', mergedOptions).format(value);
};

export const calculateNationalMetrics = (
  regions: RegionShape[] = regionsData,
): RegionMetrics => {
  const summary: RegionMetrics = {
    projects: {
      total: 0,
      grants: 0,
      programs: 0,
      contracts: 0,
      commercialization: 0,
      avgDuration: 0,
    },
    publications: {
      total: 0,
      journals: 0,
      conferences: 0,
      books: 0,
      other: 0,
    },
    people: {
      total: 0,
      docents: 0,
      professors: 0,
      associateProfessors: 0,
      avgAge: 0,
    },
    finances: {
      total: 0,
      lastYear: 0,
      avgExpense: 0,
      budgetUsage: 0,
      regionalPrograms: 0,
    },
  };

  let durationAccumulator = 0;
  let durationWeight = 0;
  let ageAccumulator = 0;
  let ageWeight = 0;
  let usageAccumulator = 0;
  let usageWeight = 0;

  regions.forEach((region) => {
    const stats = region.stats;

    summary.projects.total += stats.projects.total;
    summary.projects.grants += stats.projects.grants;
    summary.projects.programs += stats.projects.programs;
    summary.projects.contracts += stats.projects.contracts;
    summary.projects.commercialization += stats.projects.commercialization;
    durationAccumulator += stats.projects.avgDuration * stats.projects.total;
    durationWeight += stats.projects.total;

    summary.publications.total += stats.publications.total;
    summary.publications.journals += stats.publications.journals;
    summary.publications.conferences += stats.publications.conferences;
    summary.publications.books += stats.publications.books;
    summary.publications.other += stats.publications.other;

    summary.people.total += stats.people.total;
    summary.people.docents += stats.people.docents;
    summary.people.professors += stats.people.professors;
    summary.people.associateProfessors += stats.people.associateProfessors;
    ageAccumulator += stats.people.avgAge * stats.people.total;
    ageWeight += stats.people.total;

    summary.finances.total += stats.finances.total;
    summary.finances.lastYear += stats.finances.lastYear;
    summary.finances.avgExpense += stats.finances.avgExpense * stats.finances.total;
    summary.finances.regionalPrograms += stats.finances.regionalPrograms;
    usageAccumulator += stats.finances.budgetUsage * stats.finances.total;
    usageWeight += stats.finances.total;
  });

  summary.projects.avgDuration = durationWeight ? durationAccumulator / durationWeight : 0;
  summary.people.avgAge = ageWeight ? ageAccumulator / ageWeight : 0;
  summary.finances.avgExpense = summary.finances.total
    ? summary.finances.avgExpense / summary.finances.total
    : 0;
  summary.finances.budgetUsage = usageWeight ? usageAccumulator / usageWeight : 0;

  return summary;
};
