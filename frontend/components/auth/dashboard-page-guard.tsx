'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { canAccessPageByRole, resolveUnauthorizedDashboardPath } from '@/lib/utils/page-permissions';

interface DashboardPageGuardProps {
  children: React.ReactNode;
}

export function DashboardPageGuard({ children }: DashboardPageGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const lastRedirectRef = useRef<string | null>(null);

  const canAccess = canAccessPageByRole(user, pathname);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      if (lastRedirectRef.current !== '/login') {
        lastRedirectRef.current = '/login';
        router.replace('/login');
      }
      return;
    }

    if (canAccess) {
      lastRedirectRef.current = null;
      return;
    }

    const targetPath = resolveUnauthorizedDashboardPath(user, pathname);

    if (targetPath === pathname) {
      return;
    }

    if (lastRedirectRef.current !== targetPath) {
      lastRedirectRef.current = targetPath;
      router.replace(targetPath);
    }
  }, [canAccess, isAuthenticated, isLoading, pathname, router, user]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-slate-600">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!canAccess) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-slate-600">Redirecionando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
