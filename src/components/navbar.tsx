"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brain, LayoutDashboard, GraduationCap, Library, CalendarDays, Menu, X, LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuState, setMobileMenuState] = useState({ pathname, open: false });
  const mobileMenuOpen = mobileMenuState.pathname === pathname && mobileMenuState.open;

  if (pathname === "/login") return null;

  const navItems = [
    {
      label: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
    },
    {
      label: "Agenda",
      href: "/agenda",
      icon: CalendarDays,
      active: pathname.startsWith("/agenda"),
    },
    {
      label: "Biblioteca",
      href: "/library",
      icon: Library,
      active: pathname.startsWith("/library"),
    },
    {
      label: "Disciplinas",
      href: "/setup",
      icon: GraduationCap,
      active: pathname.startsWith("/setup"),
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
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
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

        <form action={signOut} className="hidden md:block">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </form>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-900 md:hidden"
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileMenuState({ pathname, open: !mobileMenuOpen })}
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      {mobileMenuOpen && (
        <nav id="mobile-navigation" className="border-t border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-950 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 sm:px-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuState({ pathname, open: false })}
                  aria-current={item.active ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-2 rounded px-3 py-2 text-sm font-medium ${
                    item.active
                      ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <form action={signOut}>
              <button
                type="submit"
                className="flex min-h-10 w-full items-center gap-2 rounded px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sair
              </button>
            </form>
          </div>
        </nav>
      )}
    </header>
  );
}
