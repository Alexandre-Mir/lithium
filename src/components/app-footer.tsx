"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock } from "lucide-react";

export function AppFooter() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="container mx-auto flex min-h-11 max-w-7xl items-center justify-between gap-3 px-4 text-[10px] text-gray-500 sm:px-8">
        <span>Lithium</span>
        <Link
          href="/history"
          className="inline-flex min-h-10 items-center gap-1.5 font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <Clock className="h-3.5 w-3.5" />
          Histórico de sessões
        </Link>
      </div>
    </footer>
  );
}
