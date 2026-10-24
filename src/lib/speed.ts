import type { ReadingSpeedStat, ReadingType } from "@/types/database";

export const MIN_SESSIONS = 3;
export const MIN_MINUTES = 45;
export const DEFAULT_SPEED_PPH = 20;

function roundSpeed(pages: number, minutes: number): number {
  return Math.round((pages / minutes) * 60 * 10) / 10;
}

function meetsMinimum(stats: Pick<ReadingSpeedStat, "sessions" | "total_minutes">): boolean {
  return stats.sessions >= MIN_SESSIONS && stats.total_minutes >= MIN_MINUTES;
}

function aggregate(stats: readonly ReadingSpeedStat[]): ReadingSpeedStat {
  return stats.reduce(
    (total, stat) => ({
      reading_type: stat.reading_type,
      sessions: total.sessions + stat.sessions,
      total_pages: total.total_pages + stat.total_pages,
      total_minutes: total.total_minutes + stat.total_minutes,
    }),
    { reading_type: "book", sessions: 0, total_pages: 0, total_minutes: 0 },
  );
}

export function pickInitialSpeed(stats: readonly ReadingSpeedStat[], type: ReadingType): number {
  const typeStats = aggregate(stats.filter((stat) => stat.reading_type === type));
  if (meetsMinimum(typeStats)) return roundSpeed(typeStats.total_pages, typeStats.total_minutes);

  const globalStats = aggregate(stats);
  if (meetsMinimum(globalStats)) return roundSpeed(globalStats.total_pages, globalStats.total_minutes);

  return DEFAULT_SPEED_PPH;
}
