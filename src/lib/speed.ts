import type { ReadingSpeedStat, ReadingType } from "@/types/database";
import { pph } from "@/lib/session-time";

export const MIN_SESSIONS = 3;
export const MIN_SECONDS = 2_700;
export const DEFAULT_SPEED_PPH = 20;
export const DEFAULT_PAGES_PER_DAY = 15;
const PLANNED_READING_HOURS_PER_DAY = 1;

function roundSpeed(pages: number, seconds: number): number {
  return Math.round(pph(pages, seconds) * 10) / 10;
}

function meetsMinimum(stats: Pick<ReadingSpeedStat, "sessions" | "total_seconds">): boolean {
  return stats.sessions >= MIN_SESSIONS && stats.total_seconds >= MIN_SECONDS;
}

type SpeedTotals = Pick<ReadingSpeedStat, "reading_type" | "sessions" | "total_pages" | "total_seconds">;

function aggregate(stats: readonly ReadingSpeedStat[]): SpeedTotals {
  return stats.reduce<SpeedTotals>(
    (total, stat) => ({
      reading_type: stat.reading_type,
      sessions: total.sessions + stat.sessions,
      total_pages: total.total_pages + stat.total_pages,
      total_seconds: total.total_seconds + stat.total_seconds,
    }),
    { reading_type: "book", sessions: 0, total_pages: 0, total_seconds: 0 },
  );
}

export function pickInitialSpeed(stats: readonly ReadingSpeedStat[], type: ReadingType): number {
  const typeStats = aggregate(stats.filter((stat) => stat.reading_type === type));
  if (meetsMinimum(typeStats)) return roundSpeed(typeStats.total_pages, typeStats.total_seconds);

  const globalStats = aggregate(stats);
  if (meetsMinimum(globalStats)) return roundSpeed(globalStats.total_pages, globalStats.total_seconds);

  return DEFAULT_SPEED_PPH;
}

/**
 * Converte a média histórica p/h em um ritmo diário de planejamento.
 * Como o app não guarda horas planejadas por dia, a estimativa considera
 * um bloco diário de uma hora. Sem sessões válidas, usa 15 páginas/dia.
 */
export function pickUserPacePagesPerDay(stats: readonly ReadingSpeedStat[]): number {
  const globalStats = aggregate(stats);
  if (globalStats.total_pages <= 0 || globalStats.total_seconds <= 0) {
    return DEFAULT_PAGES_PER_DAY;
  }

  return Math.max(1, Math.round(pph(globalStats.total_pages, globalStats.total_seconds) * PLANNED_READING_HOURS_PER_DAY));
}

export interface ReadingProgressTotals {
  sessions: number;
  pages_read: number;
  total_seconds: number;
}

export function speedFromTotals(
  totals: ReadingProgressTotals | null,
  stats: readonly ReadingSpeedStat[],
  type: ReadingType,
): number {
  if (!totals || totals.sessions < 1) return pickInitialSpeed(stats, type);
  return Math.round(pph(totals.pages_read, totals.total_seconds) * 100) / 100;
}
