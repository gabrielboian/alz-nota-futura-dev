'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS: { label: string; href: string }[] = [
  { label: 'Gestão embarques', href: '/logistics/shipments' },
  { label: 'Ajuste em massa', href: '/logistics/orders' },
];

export function LogisticsSubNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex items-center gap-1 border-b border-slate-200">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(link.href + '/');
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? 'border-b-2 border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue'
                : 'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-tertiary hover:text-text-primary'
            }
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
