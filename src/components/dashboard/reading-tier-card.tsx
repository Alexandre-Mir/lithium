"use client";

import { useState } from "react";
import Link from "next/link";
import { ReadingWithSubject, Deliverable } from "@/types/database";
import { markReadingAsRead } from "@/app/actions";
import { markReadingAsUnread } from "@/app/actions";
import { daysUntil, formatDateBR } from "@/lib/dates";
import { computeRemaining } from "@/lib/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Zap,
  Clock,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  FileText,
  Play,
} from "lucide-react";
import { startReadingTimer } from "@/lib/reading-timer-store";
import { addToast } from "@/lib/toast-store";

interface ReadingTierCardProps {
  reading: ReadingWithSubject;
  tierNumber: 2 | 3 | 4;
  linkedDeliverable?: Deliverable | null;
  onOpenSession: (reading: ReadingWithSubject) => void;
  onRefresh?: () => void;
}

export function ReadingTierCard({
  reading,
  tierNumber,
  linkedDeliverable,
  onOpenSession,
  onRefresh,
}: ReadingTierCardProps) {
  const [loading, setLoading] = useState(false);
  const [optimisticIsRead, setOptimisticIsRead] = useState<boolean | null>(null);
  const isRead = optimisticIsRead ?? reading.is_read;

  const subject = reading.subject;
  const themeColor = subject?.theme_color || "#4f46e5";

  const speed = Number(reading.current_speed_pph) || 20;
  const progress = computeRemaining({
    targetPages: reading.target_pages,
    pagesRead: reading.pages_read,
    speedPph: speed,
  });
  const formattedHours = progress.hoursRemaining.toFixed(1).replace(".", ",");

  const handleMarkAsRead = async () => {
    try {
      setLoading(true);
      setOptimisticIsRead(true);
      await markReadingAsRead(reading.id);
      onRefresh?.();
      addToast({
        message: `«${reading.title}» concluída`,
        actionLabel: "Desfazer",
        onAction: async () => {
          await markReadingAsUnread(reading.id);
          setOptimisticIsRead(null);
          onRefresh?.();
        },
      });
    } catch (err) {
      console.error(err);
      setOptimisticIsRead(null);
      alert("Erro ao concluir leitura.");
    } finally {
      setLoading(false);
    }
  };

  const displayedDeadline = reading.deadline ?? reading.suggested_deadline ?? null;
  const isSuggestedDeadline = !reading.deadline && Boolean(reading.suggested_deadline);
  const daysUntilDeadline = displayedDeadline ? daysUntil(displayedDeadline) : null;
  const pagesPerDay = daysUntilDeadline !== null && progress.pagesRemaining > 0
    ? Math.ceil(progress.pagesRemaining / Math.max(1, daysUntilDeadline))
    : 0;

  if (isRead) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="line-through">{reading.title}</span>
        </div>
        <Badge variant="outline" className="text-[10px] text-emerald-800 bg-white border-emerald-300 py-0">
          Concluído (D+1, D+7, D+21 gerados)
        </Badge>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-md bg-white dark:bg-gray-900 p-3.5 transition-colors ${
        tierNumber === 2
          ? "border-2 border-red-300 dark:border-red-900"
          : "border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Info Principal */}
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: `${themeColor}15`,
                color: themeColor,
              }}
            >
              {subject?.name || "Disciplina"}
            </span>

            <Badge variant="outline" className="text-[10px] py-0 px-1 border-gray-300 text-gray-700 dark:text-gray-300 uppercase font-bold">
              {reading.type === "book" ? (
                <span className="flex items-center gap-1">
                  <BookOpen className="w-2.5 h-2.5" /> Livro
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5" /> Artigo
                </span>
              )}
            </Badge>

            {tierNumber === 2 && linkedDeliverable && (
              <Badge className="bg-red-600 text-white text-[10px] font-bold py-0 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Entrega: {linkedDeliverable.title} (em {daysUntil(linkedDeliverable.date)}d)
              </Badge>
            )}

            {displayedDeadline && daysUntilDeadline !== null && (
              <span className={`text-[11px] font-mono flex items-center gap-1 ${
                isSuggestedDeadline
                  ? "italic text-indigo-700 dark:text-indigo-300"
                  : daysUntilDeadline <= 2
                    ? "text-red-600 font-bold"
                    : "text-gray-500"
              }`}>
                <Calendar className="w-3 h-3" />
                {isSuggestedDeadline ? "Sugestão: " : ""}
                {formatDateBR(displayedDeadline, { day: "2-digit", month: "2-digit" })}
                {isSuggestedDeadline
                  ? ` (estimativa: ${daysUntilDeadline}d)`
                  : daysUntilDeadline >= 0 ? ` (${daysUntilDeadline}d)` : " (Atrasado)"}
              </span>
            )}
          </div>

          <div>
            <Link href={`/library/${reading.id}`} className="relative z-10 block after:absolute after:inset-0"><h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">{reading.title}</h4></Link>
            {reading.chapter_title && (
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                ↳ {reading.chapter_title}
              </p>
            )}
            {reading.author && (
              <p className="text-[11px] text-gray-500 italic">
                por {reading.author}
              </p>
            )}
          </div>

          {/* Métricas Flat */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400 pt-0.5">
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-gray-400" />
              <span>{reading.pages_read} de {reading.target_pages} págs</span>
            </div>

            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-gray-400" />
              <span>{speed.toFixed(1)} p/h</span>
            </div>

            <div className="flex items-center gap-1 font-semibold text-gray-800 dark:text-gray-200">
              <Clock className="w-3 h-3 text-gray-400" />
              <span>~{formattedHours}h restantes</span>
            </div>

            {pagesPerDay > 0 && (
              <div className="flex items-center gap-1 text-[10px] italic text-indigo-700 dark:text-indigo-300">
                <Calendar className="w-3 h-3 text-gray-400" />
                ~{pagesPerDay} págs/dia
              </div>
            )}
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress.progressPercent}%`, backgroundColor: themeColor }}
            />
          </div>

          {progress.goalReached && !isRead && (
            <Badge variant="outline" className="w-fit border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800 py-0 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              Meta atingida
            </Badge>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="relative z-10 flex items-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t border-gray-100 dark:border-gray-800 md:border-t-0">
          <Button
            type="button"
            onClick={() => startReadingTimer(reading.id, reading.title)}
            size="sm"
            aria-label={`Iniciar cronômetro para ${reading.title}`}
            title="Iniciar cronômetro"
            className="h-8 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            <Play className="mr-1 h-3.5 w-3.5" /> Iniciar
          </Button>
          <Button
            onClick={() => onOpenSession(reading)}
            size="sm"
            variant="outline"
            className="text-xs font-semibold h-8 rounded border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-none"
          >
            <Sparkles className="w-3 h-3 mr-1 text-gray-500" />
            Sessão
          </Button>

          <div className="mx-1 h-6 border-l border-gray-200 dark:border-gray-800" aria-hidden="true" />
          <Button
            onClick={handleMarkAsRead}
            disabled={loading}
            size="sm"
            variant={progress.goalReached ? "default" : "ghost"}
            className={`${progress.goalReached ? "bg-emerald-700 hover:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"} text-xs font-semibold h-8 rounded shadow-none`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Concluir
          </Button>
        </div>
      </div>
    </div>
  );
}
