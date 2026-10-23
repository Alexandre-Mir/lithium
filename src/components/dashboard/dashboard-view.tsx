"use client";

import { useState } from "react";
import {
  ReadingWithSubject,
  SpacedReviewWithReading,
  Deliverable,
} from "@/types/database";
import { Tier1Card } from "./tier1-card";
import { ReadingTierCard } from "./reading-tier-card";
import { ReadingSessionModal } from "@/components/reading-session-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Sparkles,
  Flame,
  AlertTriangle,
  GraduationCap,
  Compass,
  CheckCircle2,
  Clock,
  Layers,
  Zap,
  Calendar,
  BookOpen,
  ArrowDownRight,
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
}

export function DashboardView({
  tier1,
  tier2,
  tier3,
  tier4,
  readingDeliverableMap,
  allDeliverables,
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
    // Escolhe a tarefa mais prioritária (Tier 2 se houver, senão Tier 3, senão Tier 4)
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

  // Métricas do dia
  const totalTasks = tier1.length + tier2.length + tier3.length + tier4.length;
  const totalUrgentPages = tier2.reduce((acc, r) => acc + r.target_pages, 0);

  // Estimativa de tempo total de leitura pendente
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
      {/* Top Hero Section */}
      <div className="rounded-3xl border bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Background decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                <Brain className="w-3.5 h-3.5 text-indigo-300" />
                Motor Cognitivo Ativo
              </span>
              <span className="text-xs text-indigo-200/80 capitalize">
                {todayFormatted}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Efeito Cascata Diário
            </h1>
            <p className="text-sm text-indigo-200/90 max-w-2xl leading-relaxed">
              Sua alocação de tempo é gerenciada dinamicamente: consolidação de memória primeiro,
              provas críticas em seguida, graduação regular e ritmo autônomo.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            <Button
              onClick={handleQuickSessionAny}
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 text-sm h-12 px-6"
            >
              <Sparkles className="w-4 h-4 mr-2 text-amber-200" />
              Sessão de Leitura Rápida
            </Button>
            <Link href="/setup">
              <Button
                variant="outline"
                size="lg"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold text-sm h-12"
              >
                Configurar Planilha
              </Button>
            </Link>
          </div>
        </div>

        {/* Mini métricas em cards translúcidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 relative z-10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-xs text-indigo-200 block">Total de Ações</span>
            <span className="text-2xl font-black font-mono text-white">
              {totalTasks}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-xs text-indigo-200 block">Repetições Hoje</span>
            <span className="text-2xl font-black font-mono text-indigo-300">
              {tier1.length}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-xs text-indigo-200 block">Zona de Perigo</span>
            <span className="text-2xl font-black font-mono text-rose-300">
              {tier2.length}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-xs text-indigo-200 block">Carga Estimada</span>
            <span className="text-2xl font-black font-mono text-amber-300">
              ~{totalReadingHours.toFixed(1)}h
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TIER 1: SPACED REVIEWS (Repetição Espaçada — D+1, D+7, D+21)  */}
      {/* ============================================================ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
              T1
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  Repetições Espaçadas Agendadas
                </h2>
                <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase">
                  Prioridade Máxima (D+1, D+7, D+21)
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Active Recall para retenção permanente. Deve ser executado antes de novos conteúdos.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
            {tier1.length} pendente(s)
          </span>
        </div>

        {tier1.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Nenhuma repetição agendada para hoje! A curva do esquecimento está protegida.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
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
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
              T2
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  Zona de Perigo — Provas e Entregas em &le; 7 dias
                </h2>
                <Badge className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] uppercase flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Hard Deadline
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Leituras vinculadas a entregas iminentes de matérias ativas. Prioridade imediata de leitura.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
            {tier2.length} leitura(s) • {totalUrgentPages}p
          </span>
        </div>

        {tier2.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Nenhuma leitura na Zona de Perigo no momento. Você está adiantado!</span>
          </div>
        ) : (
          <div className="space-y-2.5">
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
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
              T3
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  Leituras Regulares — Disciplinas da Graduação
                </h2>
                <Badge variant="outline" className="text-sky-700 bg-sky-50 border-sky-200 font-bold text-[10px] uppercase">
                  Estudo Ativo
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Prazos acadêmicos convencionais sem prova nos próximos 7 dias.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
            {tier3.length} leitura(s)
          </span>
        </div>

        {tier3.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>Nenhuma leitura acadêmica regular pendente.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
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
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
              T4
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  Estudos Autônomos & Projetos Pessoais
                </h2>
                <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 font-bold text-[10px] uppercase">
                  Prazos Elásticos
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Leituras autodirigidas e de livre interesse. Absorção de carga cognitiva em momentos de folga.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
            {tier4.length} leitura(s)
          </span>
        </div>

        {tier4.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Compass className="w-4 h-4 text-slate-400" />
            <span>Nenhuma leitura autônoma cadastrada no momento.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
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
