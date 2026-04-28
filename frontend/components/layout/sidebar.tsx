"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Truck,
  Package,
  FileText,
  Receipt,
  Folder,
  ChevronDown,
  ChevronRight,
  LogOut,
  RotateCw,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { canAccessPageByRole } from "@/lib/utils/page-permissions";
import Image from "next/image";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    title: "Home",
    href: "/overview",
    icon: <Home className="w-5 h-5" />,
  },
  {
    title: "Solicitar embarque",
    href: "/shipments",
    icon: <Truck className="w-5 h-5" />,
  },
  {
    title: "Logística",
    href: "/logistics",
    icon: <Package className="w-5 h-5" />,
    children: [
      {
        title: "Gestão de embarques",
        href: "/logistics/shipments",
        icon: null,
      },
      {
        title: "Ajuste em massa",
        href: "/logistics/orders",
        icon: null,
      },
    ],
  },
  {
    title: "Instruções Fiscais",
    href: "/fiscal",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    title: "NF Entrega Futura",
    href: "/invoices",
    icon: <Receipt className="w-5 h-5" />,
    children: [
      {
        title: "Gestão de saldos",
        href: "/invoices/balances",
        icon: null,
      },
      {
        title: "Upload base",
        href: "/invoices/upload",
        icon: null,
      },
    ],
  },
  {
    title: "Base contratos",
    href: "/contracts",
    icon: <Folder className="w-5 h-5" />,
  },
  {
    title: "Reprocessamento",
    href: "/reprocess",
    icon: <RotateCw className="w-5 h-5" />,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(["/logistics", "/invoices"]);
  const [collapsed, setCollapsed] = useState(false);

  const computedNavItems: NavItem[] = navItems
    .map((item) => {
      if (!item.children || item.children.length === 0) {
        return canAccessPageByRole(user, item.href) ? item : null;
      }

      const allowedChildren = item.children.filter((child) => canAccessPageByRole(user, child.href));
      const canAccessParent = canAccessPageByRole(user, item.href);

      if (!canAccessParent && allowedChildren.length === 0) {
        return null;
      }

      return {
        ...item,
        children: allowedChildren,
      };
    })
    .filter((item): item is NavItem => item !== null);

  function toggleExpanded(href: string) {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((item) => item !== href) : [...prev, href]
    );
  }

  return (
    <div
      className={`${collapsed ? "w-16" : "w-58.5"} h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 overflow-hidden`}
    >
      {/* Logo */}
      <div className={`p-4 border-b border-slate-200 flex ${collapsed ? "justify-center" : "justify-between"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-8 h-8">
              <Image src="/images/logo.png" alt="Logo alz grãos" fill className="object-cover" priority />
            </div>
            <button
              onClick={() => setCollapsed(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex self-center gap-2 relative w-20 h-12 m-auto">
              <Image src="/images/logo.png" alt="Logo alz grãos" fill className="object-cover" priority />
            </div>
            <div className="flex items-center">
              <Image
                src="/icons/message.svg"
                alt="Toggle sidebar"
                width={24}
                height={24}
                className="cursor-pointer"
                onClick={() => setCollapsed(true)}
              />
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {computedNavItems.map((item) => (
            <li key={item.href}>
              {item.children ? (
                collapsed ? (
                  <div
                    className={`flex justify-center px-2 py-2.5 rounded-lg ${
                      pathname.startsWith(item.href) ? "bg-orange-300/20 text-slate-900" : "text-slate-900"
                    }`}
                  >
                    {item.icon}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.href)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        pathname.startsWith(item.href)
                          ? "bg-orange-300/20 text-slate-900"
                          : "text-slate-900 hover:bg-orange-50/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.title}</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${expandedItems.includes(item.href) ? "rotate-180" : ""}`}
                      />
                    </button>
                    {expandedItems.includes(item.href) && (
                      <ul className="mt-1 ml-4 space-y-1">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={`block px-4 py-2 text-sm rounded-lg transition-colors ${
                                pathname === child.href
                                  ? "bg-orange-300/20 text-slate-900 font-medium"
                                  : "text-slate-900 hover:bg-orange-50/20"
                              }`}
                            >
                              {child.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-4"} py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    pathname === item.href
                      ? "bg-orange-300/20 text-slate-900"
                      : "text-slate-900 hover:bg-orange-50/20"
                  }`}
                >
                  {item.icon}
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-200">
        <button
          onClick={() => logout()}
          className={`w-full cursor-pointer flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-4"} py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors`}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );
}
