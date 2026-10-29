import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getAgendaData, getDeliverables, getSubjects } from "@/app/actions";
import { AgendaView } from "@/components/agenda/agenda-view";
import { getAgendaMonthRange, sortAgendaEvents, type AgendaEvent } from "@/lib/agenda";
import { todayISO } from "@/lib/dates";
import type { Deliverable, Subject } from "@/types/database";

export const instant = false;

export default async function AgendaPage() {
  await connection();
  const today = todayISO();
  const { from, to, monthISO } = getAgendaMonthRange(today);
  let events: AgendaEvent[] = [];
  let deliverables: Deliverable[] = [];
  let subjects: Subject[] = [];
  let connectionError: string | null = null;

  try {
    const [data, allDeliverables, allSubjects] = await Promise.all([
      getAgendaData(from, to),
      getDeliverables(),
      getSubjects(),
    ]);
    events = sortAgendaEvents([...data.deliverables, ...data.reviews]);
    deliverables = allDeliverables ?? [];
    subjects = allSubjects ?? [];
  } catch (cause: unknown) {
    unstable_rethrow(cause);
    console.warn("Aviso ao carregar a Agenda:", cause);
    connectionError = cause instanceof Error ? cause.message : "Falha na conexão com o banco.";
  }

  return (
    <div>
      {connectionError && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-900 dark:text-amber-200">
          <strong>Aviso de Agenda:</strong> {connectionError}. Verifique a migration{" "}
          <code className="font-mono">supabase/migration-v1.10.sql</code> e a conexão do Supabase.
        </div>
      )}
      <AgendaView
        events={events}
        today={today}
        monthISO={monthISO}
        deliverables={deliverables}
        subjects={subjects}
      />
    </div>
  );
}
