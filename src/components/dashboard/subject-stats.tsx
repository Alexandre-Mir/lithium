"use client";

import { SubjectStat } from "@/types/database";
import { formatDuration } from "@/lib/session-time";
import { Clock, BookOpen, GraduationCap } from "lucide-react";

interface SubjectStatsProps {
  stats: SubjectStat[];
  truncated?: boolean;
}

export function SubjectStats({ stats, truncated = false }: SubjectStatsProps) {
  if ((!stats || stats.length === 0) && !truncated) return null;

  return (
    <>
      {truncated && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Dados truncados em 1.000 registros
        </div>
      )}
      {stats.length > 0 && <section className="space-y-3">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <h2 className="text-sm font-bold tracking-wider text-gray-700 dark:text-gray-300 uppercase">
            Métricas por Disciplina (Tempo Real)
          </h2>
        </div>
        <span className="text-xs text-gray-500 font-mono">
          {stats.length} disciplina(s)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.id}
            className="rounded-md border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900 space-y-2.5 transition-colors hover:border-gray-300 dark:hover:border-gray-700"
          >
            {/* Header da Disciplina */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: stat.theme_color }}
                />
                <h3 className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">
                  {stat.name}
                </h3>
              </div>
              <span className="text-[10px] text-gray-500 font-mono shrink-0">
                {stat.completedReadings}/{stat.totalReadings} leituras
              </span>
            </div>

            {stat.professor && (
              <p className="text-[11px] text-gray-500 truncate">
                Prof. {stat.professor}
              </p>
            )}

            {/* Métricas: Tempo Total e Páginas Lidas */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800/60 text-xs">
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                  {formatDuration(stat.totalSeconds)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                <BookOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                  {stat.totalPages}/{stat.totalTargetPages}p
                </span>
              </div>
            </div>

            {/* Barra de Progresso Linear */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <span>Páginas lidas / meta</span>
                <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                  {stat.progressPercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${stat.progressPercent}%`,
                    backgroundColor: stat.theme_color || "#4f46e5",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      </section>}
    </>
  );
}
