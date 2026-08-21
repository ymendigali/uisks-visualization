import { regionsData } from '../components/Home/regionsData';
import { apiRequest, authStorage } from './client';
import type {
  AuthResponse,
  BackendEmployee,
  BackendProject,
  BackendPublication,
  DashboardFilterOptions,
  DashboardSummary,
  EmployeeFilterOptions,
  EmployeeFilterMeta,
  ProjectFilterMeta,
  FinanceFilterMeta,
  FinanceFilterOptions,
  FinanceSummary,
  PaginatedResponse,
  ProjectFilterOptions,
  PublicationFilterOptions,
  PublicationFilterMeta,
  UserRole,
} from './types';

const asRole = (value: string | undefined): UserRole => {
  if (value === 'admin' || value === 'staff' || value === 'viewer') {
    return value;
  }
  return 'viewer';
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\./g, '')
    .trim();

const regionByNormalizedName = new Map(
  regionsData.map((region) => [normalize(region.name), region.id]),
);

const partialRegionAliases: Array<[string, string]> = [
  ['астана', 'astana'],
  ['алматы', 'almaty-city'],
  ['шымкент', 'shymkent'],
  ['западно-казахстан', 'west-kazakhstan'],
  ['восточно-казахстан', 'east-kazakhstan'],
  ['северо-казахстан', 'north-kazakhstan'],
  ['алматинская', 'almaty'],
  ['жетысуская', 'jetisu'],
  ['мангыстауская', 'mangystau'],
  ['мангистауская', 'mangystau'],
  ['акмолинская', 'akmola'],
  ['атырауская', 'atyrau'],
  ['карагандинская', 'karaganda'],
  ['туркестанская', 'turkistan'],
  ['кызылординская', 'kyzylorda'],
  ['улытауская', 'ulytau'],
  ['абайская', 'abai'],
  ['павлодарская', 'pavlodar'],
  ['жамбылская', 'zhambyl'],
  ['костанайская', 'kostanay'],
  ['актюбинская', 'aktobe'],
];

const matchRegionId = (regionName: string): string | undefined => {
  const normalized = normalize(regionName);
  if (!normalized) {
    return undefined;
  }

  const exact = regionByNormalizedName.get(normalized);
  if (exact) {
    return exact;
  }

  for (const [needle, regionId] of partialRegionAliases) {
    if (normalized.includes(needle)) {
      return regionId;
    }
  }

  return undefined;
};

export const mapRegionToId = (regionName: string): string => matchRegionId(regionName) ?? 'national';

/**
 * Returns the full, human-readable region label for a raw backend region string:
 * the matched Kazakhstan region's full name, the raw value itself for recognized
 * foreign locations, or undefined when the value carries no real information.
 */
export const resolveRegionLabel = (regionName: string): string | undefined => {
  const matchedId = matchRegionId(regionName);
  if (matchedId) {
    const region = regionsData.find((item) => item.id === matchedId);
    if (region) {
      return region.name;
    }
  }

  const trimmed = regionName.trim();
  const unknownValues = new Set(['', '-', '.', 'не указано', 'не указан', 'нигде', 'другое']);
  if (!trimmed || unknownValues.has(normalize(trimmed))) {
    return undefined;
  }

  return trimmed;
};

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },

  async register(payload: { email: string; password: string; name: string; role?: UserRole }): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: payload,
    });
  },

  async me() {
    return apiRequest<{ user: { id: string; email: string; name: string; role: UserRole }; role: UserRole }>(
      '/api/auth/me',
      { auth: true },
    );
  },

  persistAuth(response: AuthResponse) {
    authStorage.setToken(response.token);
    const user = {
      ...response.user,
      role: asRole(response.role ?? response.user.role),
      name: response.user.name ?? response.user.fullName ?? '',
    };
    authStorage.setUser(JSON.stringify(user));
  },

  async logout(): Promise<void> {
    try {
      await apiRequest<{ success: boolean }>('/api/auth/logout', {
        method: 'POST',
        auth: true,
      });
    } finally {
      authStorage.clear();
    }
  },
};

const withQuery = (path: string, query?: Record<string, string | number | undefined>): string => {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
};

const toDashboardFilterOption = (item: unknown): { value: string; label: string } | null => {
  if (typeof item === 'string') {
    const value = item.trim();
    return value.length > 0 ? { value, label: value } : null;
  }

  if (item && typeof item === 'object') {
    const source = item as Record<string, unknown>;
    const rawValue = source.value;
    const rawLabel = source.label ?? source.name ?? source.title;

    if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
      const value = rawValue.trim();
      const label = typeof rawLabel === 'string' && rawLabel.trim().length > 0 ? rawLabel.trim() : value;
      return { value, label };
    }

    if (typeof rawLabel === 'string' && rawLabel.trim().length > 0) {
      const value = rawLabel.trim();
      return { value, label: value };
    }
  }

  return null;
};

const toDashboardFilterList = (value: unknown): Array<{ value: string; label: string }> => {
  if (!Array.isArray(value)) {
    return [];
  }

  const options = value
    .map((item) => toDashboardFilterOption(item))
    .filter((option): option is { value: string; label: string } => option !== null);

  const uniqueOptions = new Map<string, { value: string; label: string }>();
  options.forEach((option) => {
    if (!uniqueOptions.has(option.value)) {
      uniqueOptions.set(option.value, option);
    }
  });

  return Array.from(uniqueOptions.values());
};

export const projectsApi = {
  list(query?: {
    irn?: string;
    status?: string;
    region?: string;
    financingType?: string;
    priority?: string;
    applicant?: string;
    contest?: string;
    customer?: string;
    mrnti?: string;
    trl?: number;
    startYear?: number;
    endYear?: number;
    q?: string;
    page?: number;
    limit?: number;
  }, signal?: AbortSignal) {
    return apiRequest<PaginatedResponse<BackendProject>>(withQuery('/api/projects', query), { signal });
  },

  filters() {
    return apiRequest<ProjectFilterOptions>('/api/projects/filters');
  },

  filtersMeta(query?: {
    irn?: string;
    status?: string;
    region?: string;
    financingType?: string;
    priority?: string;
    applicant?: string;
    q?: string;
  }) {
    return apiRequest<ProjectFilterMeta>(withQuery('/api/projects/filters-meta', query));
  },
};

export const employeesApi = {
  list(query?: {
    searchTerm?: string;
    region?: string;
    position?: string;
    department?: string;
    minAge?: number;
    maxAge?: number;
    affiliateType?: string;
    gender?: string;
    degree?: string;
    citizenship?: string;
    projectRole?: string;
    hIndexGroup?: string;
    mrnti?: string;
    classifier?: string;
    minHIndex?: number;
    maxHIndex?: number;
    q?: string;
    page?: number;
    limit?: number;
  }, signal?: AbortSignal) {
    return apiRequest<PaginatedResponse<BackendEmployee>>(withQuery('/api/employees', query), { signal });
  },

  filters() {
    return apiRequest<EmployeeFilterOptions>('/api/employees/filters');
  },

  filtersMeta(query?: {
    region?: string;
    position?: string;
    department?: string;
    minAge?: number;
    maxAge?: number;
    affiliateType?: string;
    gender?: string;
    degree?: string;
    citizenship?: string;
    projectRole?: string;
    hIndexGroup?: string;
    mrnti?: string;
    classifier?: string;
    minHIndex?: number;
    maxHIndex?: number;
    q?: string;
  }, signal?: AbortSignal) {
    return apiRequest<EmployeeFilterMeta>(withQuery('/api/employees/filters-meta', query), { signal });
  },
};

export const publicationsApi = {
  list(query?: { year?: number; type?: string; q?: string; page?: number; limit?: number }, signal?: AbortSignal) {
    return apiRequest<PaginatedResponse<BackendPublication>>(withQuery('/api/publications', query), { signal });
  },

  filters() {
    return apiRequest<PublicationFilterOptions>('/api/publications/filters');
  },

  filtersMeta(query?: { year?: number; type?: string; q?: string }, signal?: AbortSignal) {
    return apiRequest<PublicationFilterMeta>(withQuery('/api/publications/filters-meta', query), { signal });
  },
};

export const financesApi = {
  summary(query?: {
    year?: number;
    startYear?: number;
    endYear?: number;
    region?: string;
    irn?: string;
    financingType?: string;
    cofinancing?: string;
    expense?: string;
    priority?: string;
    competition?: string;
    applicant?: string;
    customer?: string;
    status?: string;
  }, signal?: AbortSignal) {
    return apiRequest<FinanceSummary>(withQuery('/api/finances/summary', query), { signal });
  },

  filters() {
    return apiRequest<FinanceFilterOptions>('/api/finances/filters');
  },

  filtersMeta(query?: {
    year?: number;
    startYear?: number;
    endYear?: number;
    region?: string;
    irn?: string;
    financingType?: string;
    cofinancing?: string;
    expense?: string;
    priority?: string;
    competition?: string;
    applicant?: string;
    customer?: string;
    status?: string;
  }, signal?: AbortSignal) {
    return apiRequest<FinanceFilterMeta>(withQuery('/api/finances/filters-meta', query), { signal });
  },
};

export const dashboardApi = {
  async filters() {
    const payload = await apiRequest<Record<string, unknown>>('/api/dashboard/filters');

    const priority = toDashboardFilterList(payload.priority);
    const applicant = toDashboardFilterList(payload.applicant ?? payload.organization);

    return {
      priority,
      applicant,
    } as DashboardFilterOptions;
  },

  summary(query?: { priority?: string; organization?: string; region?: string; year?: number }) {
    return apiRequest<DashboardSummary>(withQuery('/api/dashboard/summary', query));
  },
};
