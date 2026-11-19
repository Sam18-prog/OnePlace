import { DEFAULT_SCHOOL_ID } from '../config/school';

const VALID_SCHOOL_ID_REGEX = /^[a-zA-Z0-9_-]{2,64}$/;

export function isValidSchoolIdentifier(value: unknown): value is string {
  return typeof value === 'string' && VALID_SCHOOL_ID_REGEX.test(value.trim());
}

/**
 * Safely resolves the active school tenant identifier from:
 * 1. An explicit hostname-to-schoolId mapping (VITE_SCHOOL_DOMAIN_MAP JSON)
 * 2. Optional query param (?school=<id>) ONLY if explicitly allowlisted via allowedSchools
 * 3. Configured default school ID (VITE_SCHOOL_ID or 'oakridge-high')
 *
 * Prevents untrusted arbitrary query-parameter tenant enumeration while enabling
 * clean multi-school subdomain or pilot-preview routing.
 */
export function resolveActiveSchoolId(params: {
  hostname?: string;
  search?: string;
  domainMapJson?: string;
  allowedQuerySchoolsCsv?: string;
  fallbackSchoolId?: string;
}): string {
  const fallback = isValidSchoolIdentifier(params.fallbackSchoolId)
    ? params.fallbackSchoolId.trim()
    : DEFAULT_SCHOOL_ID;

  // 1. Check hostname mapping first
  const host = (params.hostname || '').trim().toLowerCase();
  if (host && params.domainMapJson) {
    try {
      const parsed = JSON.parse(params.domainMapJson) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        const mapped = parsed[host];
        if (isValidSchoolIdentifier(mapped)) {
          return mapped.trim();
        }
      }
    } catch {
      // Ignore malformed domain map JSON and fall back cleanly
    }
  }

  // 2. Check explicit allowlisted query parameter (?school=<id>)
  if (params.search && params.allowedQuerySchoolsCsv) {
    const allowlist = new Set(
      params.allowedQuerySchoolsCsv
        .split(',')
        .map((s) => s.trim())
        .filter((s) => isValidSchoolIdentifier(s))
    );
    if (allowlist.size > 0) {
      const qs = new URLSearchParams(params.search);
      const requested = qs.get('school')?.trim();
      if (requested && isValidSchoolIdentifier(requested) && allowlist.has(requested)) {
        return requested;
      }
    }
  }

  return fallback;
}

export function getRuntimeSchoolId(): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const domainMapJson =
    typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_SCHOOL_DOMAIN_MAP as string | undefined) : undefined;
  const allowedQuerySchoolsCsv =
    typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_ALLOWED_QUERY_SCHOOLS as string | undefined)
      : undefined;

  return resolveActiveSchoolId({
    hostname,
    search,
    domainMapJson,
    allowedQuerySchoolsCsv,
    fallbackSchoolId: DEFAULT_SCHOOL_ID,
  });
}
