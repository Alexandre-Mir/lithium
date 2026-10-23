"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, LayoutDashboard, Table2, Library, Clock } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Dashboard Cascata",
      href: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
    },
    {
      label: "Setup & Planilha",
      href: "/setup",
      icon: Table2,
      active: pathname.startsWith("/setup"),
    },
    {
      label: "Biblioteca",
      href: "/library",
      icon: Library,
      active: pathname.startsWith("/library"),
    },
    {
      label: "Histórico",
      href: "/history",
      icon: Clock,
      active: pathname.startsWith("/history"),
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900">
            <Brain className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-base text-gray-900 dark:text-gray-100">
              Lithium
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono text-gray-500 uppercase">
              Motor Cognitivo
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  item.active
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-gray-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
