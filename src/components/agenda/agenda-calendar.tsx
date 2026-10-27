"use client";

import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { APP_TIMEZONE, timestampToDateISO } from "@/lib/dates";
import { formatAgendaMonthLabel, type AgendaEvent } from "@/lib/agenda";

interface AgendaCalendarProps {
  events: AgendaEvent[];
  monthISO: string;
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
}

function isoToCalendarDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function AgendaCalendar({
  events,
  monthISO,
  selectedDate,
  today,
  onSelectDate,
}: AgendaCalendarProps) {
  const { deliverableDates, reviewDates, datesWithBoth } = useMemo(() => {
    const deliverables = new Set(events.filter((event) => event.kind === "deliverable").map((event) => event.date));
    const reviews = new Set(events.filter((event) => event.kind === "review").map((event) => event.date));
    return {
      deliverableDates: [...deliverables].map(isoToCalendarDate),
      reviewDates: [...reviews].map(isoToCalendarDate),
      datesWithBoth: [...deliverables].filter((date) => reviews.has(date)).map(isoToCalendarDate),
    };
  }, [events]);

  return (
    <section className="border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold capitalize text-gray-900 dark:text-gray-100">
          {formatAgendaMonthLabel(monthISO)}
        </h2>
        <div className="flex items-center gap-3 text-[10px] text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" /> Entregas</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-indigo-500" /> Revisões</span>
        </div>
      </div>
      <Calendar
        mode="single"
        month={isoToCalendarDate(`${monthISO}-01`)}
        selected={isoToCalendarDate(selectedDate)}
        today={isoToCalendarDate(today)}
        timeZone={APP_TIMEZONE}
        weekStartsOn={0}
        hideNavigation
        modifiers={{
          hasDeliverable: deliverableDates,
          hasReview: reviewDates,
          hasBoth: datesWithBoth,
        }}
        modifiersClassNames={{
          hasDeliverable: "after:absolute after:bottom-0.5 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-red-500",
          hasReview: "before:absolute before:bottom-0.5 before:left-1/2 before:h-1.5 before:w-1.5 before:-translate-x-1/2 before:rounded-full before:bg-indigo-500",
          hasBoth: "before:left-[calc(50%-4px)] after:left-[calc(50%+2px)]",
        }}
        onSelect={(date) => {
          if (!date) return;
          const iso = timestampToDateISO(date.toISOString());
          if (iso) onSelectDate(iso);
        }}
      />
    </section>
  );
}
