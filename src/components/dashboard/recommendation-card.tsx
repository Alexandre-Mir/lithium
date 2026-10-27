"use client";

import Link from "next/link";
import { BookOpenCheck, Play, Sparkles, SquarePen } from "lucide-react";
import type { ReadingWithSubject } from "@/types/database";
import { Button } from "@/components/ui/button";
import { ReadingCover } from "@/components/library/reading-cover";

interface RecommendationCardProps {
  reading: ReadingWithSubject | null;
  suggestedPages: number;
  goalReached: boolean;
  onStartTimer: (reading: ReadingWithSubject) => void;
  onRegisterSession: (reading: ReadingWithSubject) => void;
}

export function RecommendationCard({
  reading,
  suggestedPages,
  goalReached,
  onStartTimer,
  onRegisterSession,
}: RecommendationCardProps) {
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
          href="/setup"
          className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Adicionar uma leitura
        </Link>
      </section>
    );
  }

  const firstPage = reading.pages_read + 1;
  const lastPage = reading.pages_read + suggestedPages;

  return (
    <section className="rounded-md border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-950 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
        <BookOpenCheck className="h-4 w-4" />
        <h2 className="text-xs font-bold uppercase tracking-wide">Próxima leitura recomendada</h2>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="w-24 shrink-0 sm:w-28">
          <ReadingCover
            reading={reading}
            themeColor={reading.subject.theme_color}
            size="card"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-[11px] font-semibold" style={{ color: reading.subject.theme_color }}>
            {reading.subject.name}
          </p>
          <Link
            href={`/library/${reading.id}`}
            className="block truncate text-base font-bold text-gray-900 hover:underline dark:text-gray-100"
            title={reading.title}
          >
            {reading.title}
          </Link>
          {reading.chapter_title && (
            <p className="truncate text-xs text-gray-600 dark:text-gray-400">↳ {reading.chapter_title}</p>
          )}
          <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
            Meta de Hoje: Ler {suggestedPages} páginas (Páginas {firstPage} a {lastPage})
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 rounded bg-gray-900 text-xs text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
              onClick={() => onStartTimer(reading)}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              Iniciar cronômetro
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded text-xs"
              onClick={() => onRegisterSession(reading)}
            >
              <SquarePen className="mr-1 h-3.5 w-3.5" />
              Registro manual
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
