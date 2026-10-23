"use client";

import { useState } from "react";
import {
  ReadingWithSubject,
  SpacedReviewWithReading,
  Deliverable,
  SubjectStat,
} from "@/types/database";
import { Tier1Card } from "./tier1-card";
import { ReadingTierCard } from "./reading-tier-card";
import { SubjectStats } from "./subject-stats";
import { ReadingSessionModal } from "@/components/reading-session-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  Compass,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DashboardViewProps {
  tier1: SpacedReviewWithReading[];
  tier2: ReadingWithSubject[];
  tier3: ReadingWithSubject[];
  tier4: ReadingWithSubject[];
  readingDeliverableMap: Record<string, string>;
  allDeliverables: Deliverable[];
  subjectStats?: SubjectStat[];
}

export function DashboardView({
  tier1,
  tier2,
  tier3,
  tier4,
  readingDeliverableMap,
  allDeliverables,
  subjectStats = [],
}: DashboardViewProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeReading, setActiveReading] = useState<ReadingWithSubject | null>(null);

  const deliverableMap = new Map(allDeliverables.map((d) => [d.id, d]));

  const handleOpenSession = (reading: ReadingWithSubject) => {
    setActiveReading(reading);
    setModalOpen(true);
  };

  const handleQuickSessionAny = () => {
    const topReading = tier2[0] || tier3[0] || tier4[0];
    if (topReading) {
      setActiveReading(topReading);
      setModalOpen(true);
    } else {
      alert("Nenhuma leitura pendente para iniciar sessão. Cadastre leituras no Setup!");
    }
  };

  const handleRefresh = () => {
    router.refresh();
  };

  const totalTasks = tier1.length + tier2.length + tier3.length + tier4.length;
  const totalUrgentPages = tier2.reduce((acc, r) => acc + r.target_pages, 0);

  const totalReadingHours = [...tier2, ...tier3, ...tier4].reduce((acc, r) => {
    const sp = Number(r.current_speed_pph) || 20;
    return acc + (r.target_pages / sp);
  }, 0);

  const todayFormatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-8">
      {/* Top Hero Section - Flat Design (fundo sólido, sem gradientes ou sombras pesadas) */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 text-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-800 text-gray-300 border border-gray-700">
                <Brain className="w-3.5 h-3.5 text-indigo-400" />
                Motor Cognitivo
              </span>
              <span className="text-xs text-gray-400 capitalize">
                {todayFormatted}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Efeito Cascata Diário
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Alocação algorítmica de tempo: retenção em primeiro lugar (Active Recall),
              provas críticas a seguir (&le; 7 dias), estudos regulares e ritmo autônomo.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2.5 shrink-0">
            <Button
              onClick={handleQuickSessionAny}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 rounded shadow-none"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Sessão Rápida
            </Button>
            <Link href="/history">
              <Button
                variant="outline"
                size="sm"
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700 font-medium text-xs h-9 rounded"
              >
                <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                Histórico
              </Button>
            </Link>
            <Link href="/setup">
              <Button
                variant="outline"
                size="sm"
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700 font-medium text-xs h-9 rounded"
              >
                Planilha
              </Button>
            </Link>
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
              {tier1.length}
            </span>
          </div>

          <div className="bg-gray-950/60 rounded p-2.5 border border-gray-800">
            <span className="text-[10px] font-semibold text-gray-400 uppercase block">Zona de Perigo</span>
            <span className="text-xl font-bold font-mono text-red-400">
              {tier2.length}
            </span>
          </div>

          <div className="bg-gray-950/60 rounded p-2.5 border border-gray-800">
            <span className="text-[10px] font-semibold text-gray-400 uppercase block">Carga Estimada</span>
            <span className="text-xl font-bold font-mono text-amber-400">
              ~{totalReadingHours.toFixed(1)}h
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MÉTRICAS POR DISCIPLINA (Calculadas em tempo real)           */}
      {/* ============================================================ */}
      {subjectStats.length > 0 && <SubjectStats stats={subjectStats} />}

      {/* ============================================================ */}
      {/* TIER 1: SPACED REVIEWS (Repetição Espaçada — D+1, D+7, D+21)  */}
      {/* ============================================================ */}
      <section className="space-y-3">
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
            {tier1.length} pendente(s)
          </span>
        </div>

        {tier1.length === 0 ? (
          <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Nenhuma repetição agendada para hoje! A curva do esquecimento está protegida.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {tier1.map((rev) => (
              <Tier1Card key={rev.id} review={rev} onRefresh={handleRefresh} />
            ))}
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/* TIER 2: ZONA DE PERIGO (Entregas e Provas em <= 7 dias)       */}
      {/* ============================================================ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-red-600 text-white flex items-center justify-center font-bold text-xs">
              T2
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wider text-gray-900 dark:text-gray-100 uppercase">
                  Zona de Perigo — Provas e Entregas em &le; 7 dias
                </h2>
                <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-300 py-0 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Hard Deadline
                </Badge>
              </div>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">
            {tier2.length} leitura(s) • {totalUrgentPages}p
          </span>
        </div>

        {tier2.length === 0 ? (
          <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Nenhuma leitura na Zona de Perigo no momento.</span>
          </div>
        ) : (
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
        )}
      </section>

      {/* ============================================================ */}
      {/* TIER 3: LEITURAS REGULARES DA FACULDADE (Estudo Ativo)        */}
      {/* ============================================================ */}
      <section className="space-y-3">
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
      </section>

      {/* ============================================================ */}
      {/* TIER 4: ESTUDO AUTÔNOMO (Prazos Elásticos)                     */}
      {/* ============================================================ */}
      <section className="space-y-3">
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

        {tier4.length === 0 ? (
          <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <Compass className="w-4 h-4 text-gray-400" />
            <span>Nenhuma leitura autônoma pendente.</span>
          </div>
        ) : (
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
        )}
      </section>

      {/* Modal de Sessão de Leitura Reutilizado */}
      <ReadingSessionModal
        reading={activeReading}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
