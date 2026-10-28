"use client";

import { Brain, FileText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AgendaReviewDialog } from "@/components/agenda/agenda-review-dialog";
import {
  formatAgendaDayHeading,
  getScheduledReviewStatusLabel,
  groupAgendaEventsByDate,
  type AgendaEvent,
} from "@/lib/agenda";

interface AgendaListProps {
  events: AgendaEvent[];
  today: string;
  emptyMessage?: string;
}

export function AgendaList({ events, today, emptyMessage = "Nenhum compromisso nesta data." }: AgendaListProps) {
  if (events.length === 0) {
    return (
      <div className="border border-gray-200 bg-white px-4 py-8 text-center text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  const groups = groupAgendaEventsByDate(events, today);
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.date} aria-label={formatAgendaDayHeading(group.date, today)} className="space-y-2">
          <div className="flex items-baseline justify-between border-b border-gray-200 pb-1.5 dark:border-gray-800">
            <h3 className="text-xs font-bold capitalize text-gray-900 dark:text-gray-100">{group.label}</h3>
            <span className="font-mono text-[10px] text-gray-500">{group.date}</span>
          </div>
          <div className="space-y-2">
            {group.items.map((event) => (
              <AgendaEventCard key={`${event.kind}:${event.id}`} event={event} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AgendaEventCard({ event }: { event: AgendaEvent }) {
  if (event.kind === "deliverable") {
    return (
      <article className="flex items-start gap-3 border border-red-200 bg-red-50/70 px-3 py-3 dark:border-red-950 dark:bg-red-950/30">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-red-200 bg-white text-red-700 dark:border-red-900 dark:bg-gray-950 dark:text-red-300">
          <FileText className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 border-red-300 px-1.5 text-[10px] text-red-800 dark:border-red-900 dark:text-red-300">
              Entrega
            </Badge>
            <span className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{event.title}</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-gray-600 dark:text-gray-400">{event.subjectName}</p>
        </div>
      </article>
    );
  }

  const statusLabel = getScheduledReviewStatusLabel(event.status);
  const statusClass = event.status === "completed"
    ? "border-emerald-300 text-emerald-800 dark:border-emerald-900 dark:text-emerald-300"
    : event.status === "missed"
      ? "border-red-300 text-red-800 dark:border-red-900 dark:text-red-300"
      : "border-indigo-300 text-indigo-800 dark:border-indigo-900 dark:text-indigo-300";
  const reviewLabel = event.source === "milestone"
    ? `Revisão Ativa ${event.reviewType}`
    : event.reviewType === "active_recall" ? "Revisão Ativa" : `Revisão ${event.reviewType}`;

  return (
    <article className="flex items-start gap-3 border border-indigo-200 bg-indigo-50/70 px-3 py-3 dark:border-indigo-950 dark:bg-indigo-950/30">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-indigo-200 bg-white text-indigo-700 dark:border-indigo-900 dark:bg-gray-950 dark:text-indigo-300">
        <Brain className="h-3.5 w-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 border-indigo-300 px-1.5 text-[10px] text-indigo-800 dark:border-indigo-900 dark:text-indigo-300">
              {reviewLabel}
            </Badge>
            <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${statusClass}`}>
              {statusLabel}
            </Badge>
          </div>
          {event.source === "milestone" ? (
            <>
              <p className="mt-1 truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{event.milestoneTitle}</p>
              <p className="truncate text-[11px] text-gray-600 dark:text-gray-400">
                {event.bookTitle} · página {event.milestonePage}
              </p>
            </>
          ) : (
            <>
              <Link href={`/library/${event.readingId}`} className="mt-1 block truncate text-xs font-semibold text-gray-900 hover:underline dark:text-gray-100">
                {event.bookTitle}
              </Link>
              <p className="truncate text-[11px] text-gray-600 dark:text-gray-400">
                {[event.chapterTitle, event.subjectName].filter(Boolean).join(" · ") || "Revisão da leitura"}
              </p>
            </>
          )}
        </div>
        {event.status === "pending" && <AgendaReviewDialog review={event} />}
      </div>
    </article>
  );
}
