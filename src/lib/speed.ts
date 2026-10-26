import type { ReadingSpeedStat, ReadingType } from "@/types/database";

export const MIN_SESSIONS = 3;
export const MIN_SECONDS = 2_700;
export const DEFAULT_SPEED_PPH = 20;

function roundSpeed(pages: number, seconds: number): number {
  return Math.round((pages / seconds) * 3_600 * 10) / 10;
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
