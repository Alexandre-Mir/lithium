"use client";

import { AgendaReviewDialog } from "@/components/agenda/agenda-review-dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateBR, todayISO } from "@/lib/dates";
import type { AgendaMilestoneReviewEvent } from "@/lib/agenda";

export function Tier1MilestoneCard({ review }: { review: AgendaMilestoneReviewEvent }) {
  const isOverdue = review.date < todayISO();

  return (
    <article className="flex flex-col gap-3 rounded-md border border-indigo-200 bg-indigo-50/70 p-3.5 dark:border-indigo-950 dark:bg-indigo-950/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-indigo-300 py-0 text-[10px] text-indigo-800 dark:border-indigo-900 dark:text-indigo-300">
            Revisão Ativa · {review.reviewType}
          </Badge>
          <Badge
            variant="outline"
            className={isOverdue
              ? "border-red-300 py-0 text-[10px] text-red-700 dark:border-red-900 dark:text-red-300"
              : "border-amber-300 py-0 text-[10px] text-amber-900 dark:border-amber-900 dark:text-amber-200"}
          >
            {isOverdue ? `Atrasada (${formatDateBR(review.date)})` : "Hoje"}
          </Badge>
        </div>
        <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
          {review.milestoneTitle}
        </p>
        <p className="truncate text-[11px] text-gray-600 dark:text-gray-400">
          {review.bookTitle} · página {review.milestonePage}
        </p>
      </div>
      <AgendaReviewDialog review={review} />
    </article>
  );
}
