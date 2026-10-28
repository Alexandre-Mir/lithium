import { connection } from "next/server";
import { getDashboardData, getMilestoneSummaries, getSubjectStats } from "@/app/actions";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { AgendaMilestoneReviewEvent } from "@/lib/agenda";
import { emptyConsistencyHeatmap, type ConsistencyHeatmapModel } from "@/lib/consistency-heatmap";
import {
  ReadingWithSubject,
  SpacedReviewWithReading,
  Deliverable,
  SubjectStat,
  MilestoneSummaryWithBook,
} from "@/types/database";

export const instant = false;

export default async function HomePage() {
  await connection();
  let tier1: SpacedReviewWithReading[] = [];
  let milestoneReviews: AgendaMilestoneReviewEvent[] = [];
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
  let averageSpeedPph = 20;
  let recommendedReadingId: string | null = null;
  let recommendedPages = 0;
  let cognitiveBudget = {
    budgetMinutes: 60,
    demandedMinutes: 0,
    tier1Minutes: 0,
    tier2Minutes: 0,
    isOverloaded: false,
    overloadMinutes: 0,
    pagesCapped: false,
  };
  let milestoneSummaries: MilestoneSummaryWithBook[] = [];
  let consistencyHeatmap: ConsistencyHeatmapModel = emptyConsistencyHeatmap();
  let connectionError: string | null = null;

  const [dashboardResult, statsResult, summariesResult] = await Promise.allSettled([
    getDashboardData(),
    getSubjectStats(),
    getMilestoneSummaries(),
  ]);

  if (dashboardResult.status === "fulfilled") {
    const data = dashboardResult.value;
    tier1 = (data.tier1 as unknown as SpacedReviewWithReading[]) || [];
    milestoneReviews = data.milestoneReviews || [];
    tier2 = (data.tier2 as unknown as ReadingWithSubject[]) || [];
    tier3 = (data.tier3 as unknown as ReadingWithSubject[]) || [];
    tier4 = (data.tier4 as unknown as ReadingWithSubject[]) || [];
    readingDeliverableMap = data.readingDeliverableMap || {};
    allDeliverables = data.allDeliverables || [];
    lastSessionReadingId = data.lastSessionReadingId ?? null;
    todayReadingMinutes = data.todayReadingMinutes ?? 0;
    dailyGoalMinutes = data.dailyGoalMinutes ?? 60;
    averageSpeedPph = data.averageSpeedPph ?? 20;
    recommendedReadingId = data.recommendedReadingId ?? null;
    recommendedPages = data.recommendedPages ?? 0;
    cognitiveBudget = data.cognitiveBudget ?? cognitiveBudget;
    consistencyHeatmap = data.consistencyHeatmap ?? consistencyHeatmap;
    if (data.schemaError) connectionError = data.schemaError;
  } else {
    console.warn("Aviso ao carregar o Dashboard:", dashboardResult.reason);
    connectionError = dashboardResult.reason instanceof Error
      ? dashboardResult.reason.message
      : "Falha na conexão com o banco.";
  }

  if (statsResult.status === "fulfilled") {
    subjectStats = statsResult.value.stats || [];
    subjectStatsTruncated = statsResult.value.truncated;
  } else {
    console.warn("Aviso ao carregar métricas por disciplina:", statsResult.reason);
    connectionError ??= statsResult.reason instanceof Error
      ? statsResult.reason.message
      : "Não foi possível carregar as métricas por disciplina.";
  }

  if (summariesResult.status === "fulfilled") {
    milestoneSummaries = summariesResult.value;
  } else {
    console.warn("Aviso ao carregar tarefas de Revisão Ativa:", summariesResult.reason);
    connectionError ??= summariesResult.reason instanceof Error
      ? summariesResult.reason.message
      : "Não foi possível carregar as tarefas de revisão.";
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
        milestoneReviews={milestoneReviews}
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
        averageSpeedPph={averageSpeedPph}
        recommendedReadingId={recommendedReadingId}
        recommendedPages={recommendedPages}
        cognitiveBudget={cognitiveBudget}
        consistencyHeatmap={consistencyHeatmap}
        milestoneSummaries={milestoneSummaries}
      />
    </div>
  );
}
