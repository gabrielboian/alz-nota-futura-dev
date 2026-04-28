import { InternalRoleType, User } from '@/types';
import { hasAnyInternalRole, hasPlatformAdminAccess } from './permissions';

export const ACCESS_DENIED_PATH = '/acesso-negado';

export type PageDataScope = 'ALL_DATA' | 'LINKED_ONLY';

export interface PagePermissionPolicy {
  allowInternalRoles?: InternalRoleType[];
  requireColumnFilters?: boolean;
}

/**
 * PAGE_PERMISSION_RULES — per-page policies keyed by URL prefix.
 * The longest matching prefix wins. Platform admins (superuser or ADMIN role)
 * automatically bypass these rules.
 *
 * Users may hold multiple roles (e.g. COMERCIAL + LOGISTICS) — any role in the
 * `allowInternalRoles` array grants access.
 */
export const PAGE_PERMISSION_RULES: Record<string, PagePermissionPolicy> = {
  '/shipments': { allowInternalRoles: ['COMERCIAL'] },
  '/logistics': { allowInternalRoles: ['LOGISTICS'] },
  '/fiscal': { allowInternalRoles: ['FISCAL'] },
  '/invoices': { allowInternalRoles: ['FISCAL'] },
  '/reprocess': { allowInternalRoles: ['LOGISTICS', 'FISCAL'] },
};

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function findMatchingPagePermissionRule(pathname: string): PagePermissionPolicy | null {
  const normalizedPath = normalizePath(pathname);

  const matchedEntry = Object.entries(PAGE_PERMISSION_RULES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));

  return matchedEntry?.[1] ?? null;
}

export function canAccessPageByRole(user: User | null, pathname: string): boolean {
  const rule = findMatchingPagePermissionRule(pathname);

  // No rule matched: allow any authenticated user.
  if (!rule) return !!user;
  if (!user) return false;
  if (hasPlatformAdminAccess(user)) return true;

  const hasAllowedInternalRole =
    !!rule.allowInternalRoles && rule.allowInternalRoles.length > 0 && hasAnyInternalRole(user, rule.allowInternalRoles);

  return hasAllowedInternalRole;
}

export interface PageAccessContext {
  canAccess: boolean;
  dataScope: PageDataScope;
  requireColumnFilters: boolean;
}

export function getPageAccessContext(user: User | null, pathname: string): PageAccessContext {
  const rule = findMatchingPagePermissionRule(pathname);
  const canAccess = canAccessPageByRole(user, pathname);

  return {
    canAccess,
    dataScope: 'ALL_DATA',
    requireColumnFilters: !!rule?.requireColumnFilters,
  };
}

export function getFirstAccessibleDashboardPath(user: User | null): string {
  if (!user) return '/login';
  return '/overview';
}

export function resolveUnauthorizedDashboardPath(user: User | null, attemptedPath: string): string {
  if (!user) {
    return '/login';
  }

  const firstAccessiblePath = getFirstAccessibleDashboardPath(user);

  if (firstAccessiblePath !== '/login') {
    return firstAccessiblePath;
  }

  const encodedAttemptedPath = encodeURIComponent(normalizePath(attemptedPath));
  return `${ACCESS_DENIED_PATH}?from=${encodedAttemptedPath}`;
}
