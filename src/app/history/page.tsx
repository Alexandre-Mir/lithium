import { connection } from "next/server";
import { getAllReadingSessions } from "@/app/actions";
import { HistoryView } from "@/components/history/history-view";
import { ReadingSessionWithReading } from "@/types/database";

export const instant = false;

export default async function HistoryPage() {
  await connection();
  let sessions: ReadingSessionWithReading[] = [];
  let truncated = false;
  let connectionError: string | null = null;

  try {
    const result = await getAllReadingSessions();
    sessions = (result.sessions ?? []) as ReadingSessionWithReading[];
    truncated = result.truncated;
  } catch (err: unknown) {
    console.warn("Aviso ao carregar sessões de histórico:", err);
    connectionError =
      err instanceof Error ? err.message : "Falha na conexão com o banco.";
  }

  return (
    <div>
      {connectionError && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs px-4 py-3 text-center">
          <strong>Aviso de Banco:</strong> {connectionError}.
        </div>
      )}
      <HistoryView initialSessions={sessions} truncated={truncated} />
    </div>
  );
}
