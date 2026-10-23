"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, LayoutDashboard, Table2, Library, BookOpen } from "lucide-react";

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
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent font-extrabold text-xl">
              Lithium
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-normal text-muted-foreground uppercase tracking-widest">
              Motor Cognitivo
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-secondary text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${item.active ? "text-indigo-600" : ""}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
