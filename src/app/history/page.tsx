import { connection } from "next/server";
import { getAllReadingSessions } from "@/app/actions";
import { HistoryView } from "@/components/history/history-view";
import type { HeatmapSessionInput } from "@/lib/consistency-heatmap";
import { ReadingSessionWithReading } from "@/types/database";

export const instant = false;

export default async function HistoryPage() {
  await connection();
  let sessions: ReadingSessionWithReading[] = [];
  let nextOffset = 0;
  let totalCount = 0;
  let totalPages = 0;
  let totalSeconds = 0;
  let hasMore = false;
  let heatmapSessions: HeatmapSessionInput[] = [];
  let connectionError: string | null = null;

  try {
    const result = await getAllReadingSessions(0);
    sessions = (result.sessions ?? []) as ReadingSessionWithReading[];
    nextOffset = result.nextOffset;
    totalCount = result.totalCount;
    totalPages = result.totalPages;
    totalSeconds = result.totalSeconds;
    hasMore = result.hasMore;
    heatmapSessions = result.heatmapSessions;
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
      <HistoryView
        key={`${totalCount}:${totalPages}:${totalSeconds}:${sessions.map((session) => `${session.id}:${session.pages_read}:${session.duration_seconds}:${session.source}`).join("|")}`}
        initialSessions={sessions}
        initialNextOffset={nextOffset}
        initialHasMore={hasMore}
        initialHeatmapSessions={heatmapSessions}
        totalCount={totalCount}
        totalPages={totalPages}
        totalSeconds={totalSeconds}
      />
    </div>
  );
}
