"use client";

import { useState } from "react";
import { Subject } from "@/types/database";
import { SubjectsTable } from "./subjects-table";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface SetupViewProps {
  initialSubjects: Subject[];
}

export function SetupView({ initialSubjects }: SetupViewProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
      {/* Top Header Flat */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Disciplinas
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Organize suas disciplinas, professores e dias de aula.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
          Sincronizar
        </button>
      </div>

      <section className="space-y-4">
        <SubjectsTable
          initialSubjects={initialSubjects}
          onRefresh={handleRefresh}
        />
      </section>
    </div>
  );
}
