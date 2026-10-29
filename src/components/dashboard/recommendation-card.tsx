"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpenCheck, Play, Sparkles, SquarePen, ArrowLeftRight } from "lucide-react";
import type { Deliverable, ReadingWithSubject } from "@/types/database";
import { Button } from "@/components/ui/button";
import { ReadingCover } from "@/components/library/reading-cover";
import { getRecommendationContext } from "@/lib/recommendation";

interface RecommendationCardProps {
  reading: ReadingWithSubject | null;
  suggestedPages: number;
  alternativeReading: ReadingWithSubject | null;
  alternativePages: number;
  linkedDeliverable: Deliverable | null;
  alternativeDeliverable: Deliverable | null;
  today: string;
  goalReached: boolean;
  onStartTimer: (reading: ReadingWithSubject) => void;
  onRegisterSession: (reading: ReadingWithSubject) => void;
}

export function RecommendationCard({
  reading,
  suggestedPages,
  alternativeReading,
  alternativePages,
  linkedDeliverable,
  alternativeDeliverable,
  today,
  goalReached,
  onStartTimer,
  onRegisterSession,
}: RecommendationCardProps) {
  const [selectedReadingId, setSelectedReadingId] = useState<string | null>(null);
  if (goalReached) {
    return (
      <section className="rounded-md border border-emerald-400 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
          <h2 className="text-xs font-bold uppercase tracking-wide">Meta diária concluída! 🎉</h2>
        </div>
        <p className="mt-2 text-xs text-emerald-900 dark:text-emerald-200">
          Vá descansar ou leia por puro prazer.
        </p>
      </section>
    );
  }

  if (!reading) {
    return (
      <section className="rounded-md border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <BookOpenCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xs font-bold uppercase tracking-wide">Próxima leitura recomendada</h2>
        </div>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Ainda não há leituras ativas para recomendar.
        </p>
        <Link
          href="/library"
          className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Adicionar ou gerenciar leituras
        </Link>
      </section>
    );
  }

  const showingAlternative = Boolean(
    alternativeReading && selectedReadingId === alternativeReading.id,
  );
  const activeReading = showingAlternative ? alternativeReading : reading;
  const activePages = showingAlternative ? alternativePages : suggestedPages;
  const activeDeliverable = showingAlternative ? alternativeDeliverable : linkedDeliverable;
  if (!activeReading) return null;

  const firstPage = activeReading.pages_read + 1;
  const lastPage = activeReading.pages_read + activePages;
  const context = getRecommendationContext(activeReading, today);
  const deadlineLabel = context.daysUntilDeadline === null
    ? null
    : context.daysUntilDeadline < 0
      ? `atrasada há ${Math.abs(context.daysUntilDeadline)} ${Math.abs(context.daysUntilDeadline) === 1 ? "dia" : "dias"}`
      : context.daysUntilDeadline === 0
        ? "vence hoje"
        : context.daysUntilDeadline === 1
          ? "vence amanhã"
          : `em ${context.daysUntilDeadline} dias`;

  return (
    <section className="rounded-md border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-950 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
        <BookOpenCheck className="h-4 w-4" />
        <h2 className="text-xs font-bold uppercase tracking-wide">Próxima leitura recomendada</h2>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="w-24 shrink-0 sm:w-28">
          <ReadingCover
            reading={activeReading}
            themeColor={activeReading.subject.theme_color}
            size="card"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-[11px] font-semibold" style={{ color: activeReading.subject.theme_color }}>
            {activeReading.subject.name}
          </p>
          <Link
            href={`/library/${activeReading.id}`}
            className="block truncate text-base font-bold text-gray-900 hover:underline dark:text-gray-100"
            title={activeReading.title}
          >
            {activeReading.title}
          </Link>
          {activeReading.chapter_title && (
            <p className="truncate text-xs text-gray-600 dark:text-gray-400">↳ {activeReading.chapter_title}</p>
          )}
          <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
            Meta de hoje: ler {activePages} páginas (páginas {firstPage} a {lastPage})
          </p>
          <p className="text-[11px] text-gray-700 dark:text-gray-300" aria-live="polite">
            {activeDeliverable && deadlineLabel
              ? `${activeDeliverable.title}: ${deadlineLabel}`
              : deadlineLabel
                ? `Prazo ${deadlineLabel}`
                : null}
            {activeDeliverable && deadlineLabel ? " · " : ""}
            {context.pagesRemaining} pág. restantes
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 rounded bg-gray-900 text-xs text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
              onClick={() => onStartTimer(activeReading)}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              Iniciar cronômetro
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded text-xs"
              onClick={() => onRegisterSession(activeReading)}
            >
              <SquarePen className="mr-1 h-3.5 w-3.5" />
              Registro manual
            </Button>
            {alternativeReading && alternativeReading.id !== activeReading.id && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded text-xs"
                onClick={() => setSelectedReadingId(alternativeReading.id)}
                aria-label={`Trocar para a leitura ${alternativeReading.title}`}
              >
                <ArrowLeftRight className="mr-1 h-3.5 w-3.5" />
                Trocar sugestão
              </Button>
            )}
            {showingAlternative && reading && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded text-xs"
                onClick={() => setSelectedReadingId(null)}
              >
                Voltar à principal
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
