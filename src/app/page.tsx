import { connection } from "next/server";
import { getDashboardData, getSubjectStats } from "@/app/actions";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import {
  ReadingWithSubject,
  SpacedReviewWithReading,
  Deliverable,
  SubjectStat,
} from "@/types/database";

export const instant = false;

export default async function HomePage() {
  await connection();
  let tier1: SpacedReviewWithReading[] = [];
  let tier2: ReadingWithSubject[] = [];
  let tier3: ReadingWithSubject[] = [];
  let tier4: ReadingWithSubject[] = [];
  let readingDeliverableMap: Record<string, string> = {};
  let allDeliverables: Deliverable[] = [];
  let subjectStats: SubjectStat[] = [];
  let subjectStatsTruncated = false;
  let lastSessionReadingId: string | null = null;
  let todayReadingMinutes = 0;
  let dailyGoalMinutes = 60;
  let recommendedReadingId: string | null = null;
  let recommendedPages = 0;
  let connectionError: string | null = null;

  try {
    const [data, statsResult] = await Promise.all([
      getDashboardData(),
      getSubjectStats(),
    ]);

    tier1 = (data.tier1 as unknown as SpacedReviewWithReading[]) || [];
    tier2 = (data.tier2 as unknown as ReadingWithSubject[]) || [];
    tier3 = (data.tier3 as unknown as ReadingWithSubject[]) || [];
    tier4 = (data.tier4 as unknown as ReadingWithSubject[]) || [];
    readingDeliverableMap = data.readingDeliverableMap || {};
    allDeliverables = data.allDeliverables || [];
    lastSessionReadingId = data.lastSessionReadingId ?? null;
    todayReadingMinutes = data.todayReadingMinutes ?? 0;
    dailyGoalMinutes = data.dailyGoalMinutes ?? 60;
    recommendedReadingId = data.recommendedReadingId ?? null;
    recommendedPages = data.recommendedPages ?? 0;
    subjectStats = statsResult.stats || [];
    subjectStatsTruncated = statsResult.truncated;

    if (data.schemaError) {
      connectionError = data.schemaError;
    }
  } catch (err: unknown) {
    console.warn("Aviso ao carregar dados do Dashboard Cascata:", err);
    connectionError =
      err instanceof Error ? err.message : "Falha na conexão com o banco.";
  }

  return (
    <div>
      {connectionError && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs px-4 py-3 text-center flex flex-col sm:flex-row items-center justify-center gap-2">
          <span>
            <strong>Aviso de Banco:</strong> {connectionError}.
          </span>
          <span className="text-muted-foreground">
            Execute o script atualizado em{" "}
            <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono">
              supabase/schema.sql
            </code>{" "}
            no SQL Editor do Supabase.
          </span>
        </div>
      )}
      <DashboardView
        tier1={tier1}
        tier2={tier2}
        tier3={tier3}
        tier4={tier4}
        readingDeliverableMap={readingDeliverableMap}
        allDeliverables={allDeliverables}
        subjectStats={subjectStats}
        subjectStatsTruncated={subjectStatsTruncated}
        lastSessionReadingId={lastSessionReadingId}
        todayReadingMinutes={todayReadingMinutes}
        dailyGoalMinutes={dailyGoalMinutes}
        recommendedReadingId={recommendedReadingId}
        recommendedPages={recommendedPages}
      />
    </div>
  );
}
