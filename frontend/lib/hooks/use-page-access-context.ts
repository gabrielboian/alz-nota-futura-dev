'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getPageAccessContext } from '@/lib/utils/page-permissions';

export function usePageAccessContext(pathnameOverride?: string) {
  const pathname = usePathname();
  const { user } = useAuth();

  return useMemo(
    () => getPageAccessContext(user, pathnameOverride ?? pathname),
    [pathname, pathnameOverride, user]
  );
}
