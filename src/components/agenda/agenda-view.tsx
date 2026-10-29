"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgendaCalendar } from "@/components/agenda/agenda-calendar";
import { AgendaList } from "@/components/agenda/agenda-list";
import { DeliverablesTable } from "@/components/agenda/deliverables-table";
import { formatDateBR } from "@/lib/dates";
import { formatAgendaMonthLabel, sortAgendaEvents, type AgendaEvent } from "@/lib/agenda";
import type { Deliverable, Subject } from "@/types/database";

interface AgendaViewProps {
  events: AgendaEvent[];
  today: string;
  monthISO: string;
  deliverables: Deliverable[];
  subjects: Subject[];
}

export function AgendaView({ events, today, monthISO, deliverables, subjects }: AgendaViewProps) {
  const router = useRouter();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [selectedDateState, setSelectedDateState] = useState<string | null>(null);
  const selectedDate = selectedDateState ?? today;
  const sortedEvents = sortAgendaEvents(events);
  const selectedEvents = sortedEvents.filter((event) => event.date === selectedDate);
  const deliverableCount = events.filter((event) => event.kind === "deliverable").length;
  const reviewCount = events.filter((event) => event.kind === "review").length;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-gray-800">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wide text-gray-500">Planejamento acadêmico</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Agenda</h1>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Entregas e revisões espaçadas de {formatAgendaMonthLabel(monthISO)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 p-0.5 dark:border-gray-800" role="group" aria-label="Modo de visualização">
            <Button
              type="button"
              size="sm"
              variant={view === "calendar" ? "default" : "ghost"}
              aria-pressed={view === "calendar"}
              onClick={() => setView("calendar")}
              className="rounded-sm text-[11px]"
            >
              <CalendarDays className="mr-1 h-3.5 w-3.5" /> Calendário
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className="rounded-sm text-[11px]"
            >
              <List className="mr-1 h-3.5 w-3.5" /> Lista
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        <div className="border border-red-200 bg-red-50 px-3 py-2 dark:border-red-950 dark:bg-red-950/30">
          <p className="text-[10px] font-semibold uppercase text-red-800 dark:text-red-300">Entregas no mês</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-gray-900 dark:text-gray-100">{deliverableCount}</p>
        </div>
        <div className="border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-950 dark:bg-indigo-950/30">
          <p className="text-[10px] font-semibold uppercase text-indigo-800 dark:text-indigo-300">Revisões no mês</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-gray-900 dark:text-gray-100">{reviewCount}</p>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(300px,auto)_minmax(0,1fr)]">
          <AgendaCalendar
            events={sortedEvents}
            monthISO={monthISO}
            selectedDate={selectedDate}
            today={today}
            onSelectDate={setSelectedDateState}
          />
          <section className="min-w-0 space-y-3">
            <div className="flex items-baseline justify-between border-b border-gray-200 pb-1.5 dark:border-gray-800">
              <h2 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                {selectedDate === today ? "Hoje" : formatDateBR(selectedDate)}
              </h2>
              <span className="font-mono text-[10px] text-gray-500">{selectedEvents.length} item(ns)</span>
            </div>
            <AgendaList events={selectedEvents} today={today} />
          </section>
        </div>
      ) : (
        <AgendaList
          events={sortedEvents}
          today={today}
          emptyMessage="Nenhuma entrega ou revisão agendada para este mês."
        />
      )}

      <section className="space-y-3 border-t border-gray-200 pt-5 dark:border-gray-800">
        <header className="border-b border-gray-200 pb-2 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Gerenciar entregas e provas</h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Cadastre e atualize prazos; todos os eventos aparecem no calendário da Agenda.
          </p>
        </header>
        <DeliverablesTable
          initialDeliverables={deliverables}
          subjects={subjects}
          onRefresh={() => router.refresh()}
        />
      </section>
    </div>
  );
}
