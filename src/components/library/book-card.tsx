"use client";

import { useState } from "react";
import Link from "next/link";
import { ReadingWithProgress, Subject } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markReadingAsRead, markReadingAsUnread } from "@/app/actions";
import { formatDateBR } from "@/lib/dates";
import { computeRemaining } from "@/lib/progress";
import { ReadingCover } from "@/components/library/reading-cover";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Clock,
  Zap,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Play,
} from "lucide-react";
import { startReadingTimer } from "@/lib/reading-timer-store";

interface BookCardProps {
  reading: ReadingWithProgress;
  subject?: Subject;
  onOpenSessionModal?: (reading: ReadingWithProgress) => void;
  onRefresh?: () => void;
}

export function BookCard({
  reading,
  subject,
  onOpenSessionModal,
  onRefresh,
}: BookCardProps) {
  const [isReadOverride, setIsReadOverride] = useState<boolean | null>(null);
  const [unmarkConfirmOpen, setUnmarkConfirmOpen] = useState(false);
  const isRead = isReadOverride ?? reading.is_read;

  const handleMarkAsRead = async () => {
    setIsReadOverride(true);
    try {
      await markReadingAsRead(reading.id);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setIsReadOverride(null);
    }
  };

  const handleUnmarkAsRead = async () => {
    setIsReadOverride(false);
    try {
      await markReadingAsUnread(reading.id);
      onRefresh?.();
    } catch (error) {
      setIsReadOverride(null);
      throw error;
    }
  };

  const speed = Number(reading.current_speed_pph) || 20;
  const remaining = computeRemaining({
    targetPages: reading.target_pages,
    pagesRead: reading.pages_read,
    speedPph: speed,
    isRead,
  });
  const estimatedHours = remaining.hoursRemaining.toFixed(1).replace(".", ",");

  const themeColor = subject?.theme_color || "#4f46e5";

  return (
    <div className="relative flex flex-col rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-colors hover:border-gray-300 dark:hover:border-gray-700">
      {/* Header Visual Flat */}
      <div className="relative isolate border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        <Link href={`/library/${reading.id}`} className="relative z-10 block">
          <ReadingCover reading={reading} themeColor={themeColor} size="card" />
        </Link>

        <div className="absolute right-2 top-2 z-20">
          <button
            type="button"
            onClick={() => (isRead ? setUnmarkConfirmOpen(true) : void handleMarkAsRead())}
            aria-label={isRead ? `Desmarcar ${reading.title} como lida` : `Marcar ${reading.title} como lida`}
            className={`p-1 rounded border transition-colors ${
              isRead
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-900"
            }`}
            title={isRead ? "Concluído" : "Marcar como lida"}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-3.5 space-y-2.5">
        <div className="flex flex-wrap gap-1">
          <Badge
            variant="outline"
            className="text-[10px] uppercase font-bold border-gray-200 py-0 dark:border-gray-800"
          >
            {reading.type === "book" ? "Livro" : "Artigo"}
          </Badge>
          {subject && (
            <span
              className="max-w-full truncate rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold dark:border-gray-800"
              style={{ color: themeColor }}
              title={subject.name}
            >
              {subject.name}
            </span>
          )}
        </div>
        <div>
            <Link href={`/library/${reading.id}`} className="relative z-10 block">
            <h3
            className={`font-bold text-xs line-clamp-2 ${
              isRead ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"
            }`}
            title={reading.title}
          >
            {reading.title}
            </h3></Link>
          {reading.chapter_title && (
            <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium mt-0.5 line-clamp-1">
              ↳ {reading.chapter_title}
            </p>
          )}
          {reading.author && (
            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1 italic">
              por {reading.author}
            </p>
          )}
        </div>

        {/* Métricas Flat */}
        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-600 dark:text-gray-400 font-mono">
          <div className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-gray-400" />
            <span>{reading.pages_read}/{reading.target_pages}p</span>
          </div>

          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-gray-400" />
            <span>{Number(reading.current_speed_pph).toFixed(1)} p/h</span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>{isRead ? "Concluída" : `~${estimatedHours}h restantes`}</span>
          </div>

          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gray-400" />
            {reading.deadline ? (
              <span>{formatDateBR(reading.deadline, { day: "2-digit", month: "2-digit" })}</span>
            ) : reading.suggested_deadline ? (
              <span className="truncate italic text-indigo-700 dark:text-indigo-300" title="Prazo sugerido">
                Sug.: {formatDateBR(reading.suggested_deadline, { day: "2-digit", month: "2-digit" })}
              </span>
            ) : (
              <span className="text-gray-400">Sem prazo</span>
            )}
          </div>
        </div>

        {reading.isbn && (
          <div className="text-[10px] text-gray-400 font-mono truncate">
            ISBN: {reading.isbn}
          </div>
        )}
        {reading.doi && (
          <div className="text-[10px] text-indigo-500 font-mono truncate">
            DOI: {reading.doi}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-1.5 p-3.5 pt-0 lg:flex-row">
        <Button
          type="button"
          onClick={() => startReadingTimer(reading.id, reading.title, {
            currentPage: reading.pages_read,
            totalPages: reading.full_book_pages ?? reading.target_pages,
          })}
          size="sm"
          aria-label={`Iniciar cronômetro para ${reading.title}`}
          className="h-8 min-w-0 flex-1 whitespace-nowrap bg-gray-900 px-2 text-[10px] font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          <Play className="mr-1 h-3 w-3 shrink-0" /> Iniciar Cronômetro
        </Button>
        <Button
          onClick={() => onOpenSessionModal?.(reading)}
          disabled={isRead}
          size="sm"
          variant="ghost"
          className="h-8 min-w-0 flex-1 whitespace-nowrap px-2 text-[10px] font-semibold text-gray-600 dark:text-gray-300"
        >
          <Sparkles className="mr-1 h-3 w-3 shrink-0" /> Registro Manual
        </Button>
      </div>
      <ConfirmDialog
        open={unmarkConfirmOpen}
        onOpenChange={setUnmarkConfirmOpen}
        title="Desmarcar leitura?"
        description={`Desmarcar «${reading.title}»? As revisões D+1, D+7 e D+21 desta leitura serão apagadas.`}
        confirmLabel="Desmarcar"
        onConfirm={handleUnmarkAsRead}
      />
    </div>
  );
}
