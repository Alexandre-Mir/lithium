"use client";

import { useState } from "react";
import {
  ReadingWithSubject,
  SpacedReviewWithReading,
  Deliverable,
  SubjectStat,
  MilestoneSummaryWithBook,
} from "@/types/database";
import { Tier1Card } from "./tier1-card";
import { Tier1MilestoneCard } from "./tier1-milestone-card";
import { ReadingTierCard } from "./reading-tier-card";
import { SubjectStats } from "./subject-stats";
import { ReadingSessionModal } from "@/components/reading-session-modal";
import type { ReadingSessionTarget } from "@/components/reading-session-modal";
import { QuickSessionDialog } from "@/components/dashboard/quick-session-dialog";
import { DailyGoalCard } from "@/components/dashboard/daily-goal-card";
import { RecommendationCard } from "@/components/dashboard/recommendation-card";
import {
  CognitiveOverloadAlert,
  type CognitiveBudgetSummary,
} from "@/components/dashboard/cognitive-overload-alert";
import { ConsistencyHeatmap } from "@/components/consistency-heatmap";
import { MilestoneSummaryTasks } from "@/components/dashboard/milestone-summary-tasks";
import { formatTodayLongBR } from "@/lib/dates";
import { sumPendingLoad } from "@/lib/progress";
import type { AgendaMilestoneReviewEvent } from "@/lib/agenda";
import type { ConsistencyHeatmapModel } from "@/lib/consistency-heatmap";
import { estimateTimerDurationSeconds } from "@/lib/reading-timer";
import { startReadingTimer } from "@/lib/reading-timer-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Sparkles,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DashboardViewProps {
  tier1: SpacedReviewWithReading[];
  milestoneReviews: AgendaMilestoneReviewEvent[];
  tier2: ReadingWithSubject[];
  tier3: ReadingWithSubject[];
  tier4: ReadingWithSubject[];
  readingDeliverableMap: Record<string, string>;
  allDeliverables: Deliverable[];
  subjectStats?: SubjectStat[];
  subjectStatsTruncated?: boolean;
  lastSessionReadingId?: string | null;
  todayReadingMinutes: number;
  dailyGoalMinutes: number;
  averageSpeedPph: number;
  recommendedReadingId: string | null;
  recommendedPages: number;
  cognitiveBudget: CognitiveBudgetSummary;
  consistencyHeatmap: ConsistencyHeatmapModel;
  milestoneSummaries: MilestoneSummaryWithBook[];
}

export function DashboardView({
  tier1,
  milestoneReviews,
  tier2,
  tier3,
  tier4,
  readingDeliverableMap,
  allDeliverables,
  subjectStats = [],
  subjectStatsTruncated = false,
  lastSessionReadingId = null,
  todayReadingMinutes,
  dailyGoalMinutes,
  averageSpeedPph,
  recommendedReadingId,
  recommendedPages,
  cognitiveBudget,
  consistencyHeatmap,
  milestoneSummaries,
}: DashboardViewProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [quickSessionOpen, setQuickSessionOpen] = useState(false);
  const [activeReading, setActiveReading] = useState<ReadingSessionTarget | null>(null);

  const deliverableMap = new Map(allDeliverables.map((d) => [d.id, d]));
  const recommendedReading = [...tier2, ...tier3, ...tier4].find(
    (reading) => reading.id === recommendedReadingId,
  ) ?? null;

  const handleOpenSession = (reading: ReadingWithSubject) => {
    setActiveReading({
      id: reading.id,
      title: reading.title,
      currentPage: reading.pages_read,
      totalPages: reading.full_book_pages ?? reading.target_pages,
    });
    setModalOpen(true);
  };

  const handleStartRecommendedTimer = (reading: ReadingWithSubject) => {
    startReadingTimer(
      reading.id,
      reading.title,
      {
        currentPage: reading.pages_read,
        totalPages: reading.full_book_pages ?? reading.target_pages,
      },
      estimateTimerDurationSeconds(recommendedPages, Number(reading.current_speed_pph) || 0),
    );
  };

  const handleRefresh = () => {
    router.refresh();
  };

  const totalReviewTasks = tier1.length + milestoneReviews.length;
  const totalTasks = totalReviewTasks + tier2.length + tier3.length + tier4.length;
  const tier1Tasks = [
    ...tier1.map((review) => ({ kind: "reading" as const, date: review.review_date, review })),
    ...milestoneReviews.map((review) => ({ kind: "milestone" as const, date: review.date, review })),
  ].sort((left, right) => left.date.localeCompare(right.date));
  const totalUrgentPages = sumPendingLoad(tier2).pagesRemaining;
  const totalReadingHours = sumPendingLoad([...tier2, ...tier3, ...tier4]).hoursRemaining;
  const recommendedSpeed = recommendedReading
    ? Number(recommendedReading.current_speed_pph) || 20
    : null;
  const recommendedEffortHours = recommendedSpeed === null
    ? null
    : recommendedPages / recommendedSpeed;

  const todayFormatted = formatTodayLongBR();
  const formattedRemainingHours = totalReadingHours.toFixed(1).replace(".", ",");
  const formattedRecommendedEffort = recommendedEffortHours?.toFixed(1).replace(".", ",");

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-8">
      {/* Top Hero Section - Flat Design (fundo sólido, sem gradientes ou sombras) */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 text-white p-6 shadow-none">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Dashboard
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              <span className="capitalize">{todayFormatted}</span>
              <span> · Revisões, prazos e leituras para hoje.</span>
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2.5 shrink-0">
            <Button
              onClick={() => {
                setQuickSessionOpen(true);
              }}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 rounded shadow-none"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Sessão Rápida
            </Button>
          </div>
        </div>

        {/* Métricas Flat */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-5 border-t border-gray-800">
          <div className="bg-gray-950/60 rounded p-2.5 border border-gray-800">
            <span className="text-[10px] font-semibold text-gray-400 uppercase block">Total de Ações</span>
            <span className="text-xl font-bold font-mono text-white">
              {totalTasks}
            </span>
          </div>

          <div className="bg-gray-950/60 rounded p-2.5 border border-gray-800">
            <span className="text-[10px] font-semibold text-gray-400 uppercase block">Repetições Hoje</span>
            <span className="text-xl font-bold font-mono text-indigo-400">
              {totalReviewTasks}
            </span>
          </div>

          <div className="bg-gray-950/60 rounded p-2.5 border border-gray-800">
            <span className="text-[10px] font-semibold text-gray-400 uppercase block">Prazos próximos</span>
            <span className="text-xl font-bold font-mono text-amber-300">
              {tier2.length}
            </span>
          </div>

          <div className="bg-gray-950/60 rounded p-2.5 border border-gray-800">
            <span className="text-[10px] font-semibold text-gray-400 uppercase block">Esforço hoje</span>
            <span className="text-xl font-bold font-mono text-amber-400">
              {formattedRecommendedEffort === undefined ? "—" : `~${formattedRecommendedEffort}h`}
            </span>
          </div>
        </div>
      </div>

      <ConsistencyHeatmap model={consistencyHeatmap} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
        <DailyGoalCard
          todayReadingMinutes={todayReadingMinutes}
          goalMinutes={dailyGoalMinutes}
          averageSpeedPph={averageSpeedPph}
        />
        <section className="flex flex-col justify-center rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4" />
            <h2 className="text-xs font-bold uppercase tracking-wide">Carga total pendente</h2>
          </div>
          <p className="mt-1 font-mono text-xl font-bold text-gray-900 dark:text-gray-100">
            ~{formattedRemainingHours}h
          </p>
          <p className="text-[10px] text-gray-500">Tempo estimado de todas as leituras pendentes</p>
        </section>
      </div>

      <CognitiveOverloadAlert
        budget={cognitiveBudget}
        recommendedPages={recommendedPages}
      />

      <RecommendationCard
        reading={recommendedReading}
        suggestedPages={recommendedPages}
        goalReached={todayReadingMinutes >= dailyGoalMinutes}
        onStartTimer={handleStartRecommendedTimer}
        onRegisterSession={handleOpenSession}
      />

      <MilestoneSummaryTasks summaries={milestoneSummaries} />

      {/* ============================================================ */}
      {/* MÉTRICAS POR DISCIPLINA (Calculadas em tempo real)           */}
      {/* ============================================================ */}
      {(subjectStats.length > 0 || subjectStatsTruncated) && <SubjectStats stats={subjectStats} truncated={subjectStatsTruncated} />}

      {/* ============================================================ */}
      {/* TIER 1: SPACED REVIEWS (Repetição Espaçada — D+1, D+7, D+21)  */}
      {/* ============================================================ */}
      {tier1Tasks.length > 0 && <section className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 flex items-center justify-center font-bold text-xs">
              T1
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wider text-gray-900 dark:text-gray-100 uppercase">
                  Repetições Espaçadas Agendadas
                </h2>
                <Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-700 dark:text-indigo-300 py-0">
                  Prioridade Máxima (D+1, D+7, D+21)
                </Badge>
              </div>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
            {totalReviewTasks} pendente(s)
          </span>
        </div>

        <div className="space-y-2">
          {tier1Tasks.map((task) => (
            task.kind === "reading" ? (
              <Tier1Card key={`reading:${task.review.id}`} review={task.review} onRefresh={handleRefresh} />
            ) : (
              <Tier1MilestoneCard key={`milestone:${task.review.id}`} review={task.review} />
            )
          ))}
        </div>
      </section>}

      {/* ============================================================ */}
      {/* TIER 2: ZONA DE PERIGO (Entregas e Provas em <= 7 dias)       */}
      {/* ============================================================ */}
      {tier2.length > 0 && <section className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
              T2
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wider text-gray-900 dark:text-gray-100 uppercase">
                  Zona de Atenção — Provas e Entregas em até 7 dias
                </h2>
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-800 dark:border-amber-900 dark:text-amber-300 py-0 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Prazo Rígido
                </Badge>
              </div>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
            {tier2.length} leitura(s) • {totalUrgentPages}p
          </span>
        </div>

        <div className="space-y-2">
          {tier2.map((reading) => {
            const linkedDeliverableId = readingDeliverableMap[reading.id];
            const linkedDeliverable = linkedDeliverableId
              ? deliverableMap.get(linkedDeliverableId)
              : null;
            return (
              <ReadingTierCard
                key={reading.id}
                reading={reading}
                tierNumber={2}
                linkedDeliverable={linkedDeliverable}
                onOpenSession={handleOpenSession}
                onRefresh={handleRefresh}
              />
            );
          })}
        </div>
      </section>}

      {/* ============================================================ */}
      {/* TIER 3: LEITURAS REGULARES DA FACULDADE (Estudo Ativo)        */}
      {/* ============================================================ */}
      {totalTasks === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white p-5 text-center text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          <p>Nada pendente por agora</p>
          <Link
            href="/setup"
            className="mt-2 inline-block font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Cadastrar leituras
          </Link>
        </div>
      ) : <section className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gray-700 text-white flex items-center justify-center font-bold text-xs">
              T3
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider text-gray-900 dark:text-gray-100 uppercase">
                Leituras Regulares — Disciplinas da Graduação
              </h2>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-gray-600 dark:text-gray-400">
            {tier3.length} leitura(s)
          </span>
        </div>

        {tier3.length === 0 ? (
          <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <span>Nenhuma leitura regular pendente.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {tier3.map((reading) => {
              const linkedDeliverableId = readingDeliverableMap[reading.id];
              const linkedDeliverable = linkedDeliverableId
                ? deliverableMap.get(linkedDeliverableId)
                : null;
              return (
                <ReadingTierCard
                  key={reading.id}
                  reading={reading}
                  tierNumber={3}
                  linkedDeliverable={linkedDeliverable}
                  onOpenSession={handleOpenSession}
                  onRefresh={handleRefresh}
                />
              );
            })}
          </div>
        )}
      </section>}

      {/* ============================================================ */}
      {/* TIER 4: ESTUDO AUTÔNOMO (Prazos Elásticos)                     */}
      {/* ============================================================ */}
      {tier4.length > 0 && <section className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-amber-700 text-white flex items-center justify-center font-bold text-xs">
              T4
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider text-gray-900 dark:text-gray-100 uppercase">
                Estudos Autônomos & Projetos Pessoais
              </h2>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
            {tier4.length} leitura(s)
          </span>
        </div>

        <div className="space-y-2">
          {tier4.map((reading) => (
            <ReadingTierCard
              key={reading.id}
              reading={reading}
              tierNumber={4}
              onOpenSession={handleOpenSession}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      </section>}

      {/* Modal de Sessão de Leitura Reutilizado */}
      <ReadingSessionModal
        reading={activeReading}
        isOpen={modalOpen}
        mode="manual"
        onClose={() => setModalOpen(false)}
        onSuccess={handleRefresh}
      />
      {quickSessionOpen && (
        <QuickSessionDialog
          open={quickSessionOpen}
          onOpenChange={setQuickSessionOpen}
          tier2={tier2}
          tier3={tier3}
          tier4={tier4}
          lastSessionReadingId={lastSessionReadingId}
          recommendedReadingId={recommendedReadingId}
          recommendedPages={recommendedPages}
          onRegisterSession={handleOpenSession}
        />
      )}
    </div>
  );
}
