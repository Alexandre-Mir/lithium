"use client";

import { useState } from "react";
import { Brain, ChevronRight } from "lucide-react";
import { MilestoneSummaryDialog } from "@/components/library/milestone-summary-dialog";
import type { MilestoneSummaryWithBook } from "@/types/database";

export function MilestoneSummaryTasks({ summaries }: { summaries: MilestoneSummaryWithBook[] }) {
  if (summaries.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          Tarefas de Revisão Ativa
        </h2>
        <span className="font-mono text-[10px] text-gray-500">{summaries.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {summaries.map((summary) => (
          <MilestoneSummaryTask key={summary.id} summary={summary} />
        ))}
      </div>
    </section>
  );
}

function MilestoneSummaryTask({ summary }: { summary: MilestoneSummaryWithBook }) {
  const [open, setOpen] = useState(false);
  const needsDraft = summary.status === "pending";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 border border-indigo-200 bg-indigo-50 px-3 py-3 text-left hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70"
      >
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
            {needsDraft
              ? `Você alcançou o marco ${summary.milestone_title}. Crie seu resumo.`
              : `Revise seu resumo: ${summary.milestone_title}`}
          </span>
          <span className="mt-1 block truncate text-[10px] text-gray-600 dark:text-gray-400">
            {summary.book.title} · página {summary.milestone_page}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-300" />
      </button>
      <MilestoneSummaryDialog summary={summary} open={open} onOpenChange={setOpen} />
    </>
  );
}
