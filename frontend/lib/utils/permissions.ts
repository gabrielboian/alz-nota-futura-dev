import { InternalRoleType, User } from '@/types';

function hasActiveInternalRole(user: User, role: InternalRoleType): boolean {
  return (
    user.internal_roles?.some((internalRole) => internalRole.is_active && internalRole.role === role) ?? false
  );
}

export function isSuperuser(user: User | null): boolean {
  return !!user?.is_superuser;
}

export function isInternalStaff(user: User | null): boolean {
  return !!user?.is_internal_staff;
}

export function hasInternalRole(user: User | null, role: InternalRoleType): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  return hasActiveInternalRole(user, role);
}

export function hasAnyInternalRole(user: User | null, roles: InternalRoleType[]): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  return roles.some((role) => hasActiveInternalRole(user, role));
}

export function hasComercialRole(user: User | null): boolean {
  return hasInternalRole(user, 'COMERCIAL');
}

export function hasLogisticsRole(user: User | null): boolean {
  return hasInternalRole(user, 'LOGISTICS');
}

export function hasFiscalRole(user: User | null): boolean {
  return hasInternalRole(user, 'FISCAL');
}

export function hasAdminRole(user: User | null): boolean {
  return hasInternalRole(user, 'ADMIN');
}

export function hasPlatformAdminAccess(user: User | null): boolean {
  return isSuperuser(user) || hasAdminRole(user);
}
