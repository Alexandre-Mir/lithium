import { addDaysISO, formatDateBR, todayISO, timestampToDateISO } from "@/lib/dates";
import { sessionSecondsOnDate } from "@/lib/session-time";

export const CONSISTENCY_HEATMAP_DAYS = 28;

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatmapSessionInput {
  duration_minutes: number;
  duration_seconds?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
}

export interface HeatmapDay {
  date: string;
  minutes: number;
  sessions: number;
  level: HeatmapLevel;
}

export interface ConsistencyHeatmapModel {
  days: HeatmapDay[];
  activeDays: number;
  totalMinutes: number;
  windowStart: string;
  windowEnd: string;
}

const LEVEL_THRESHOLDS_MINUTES = [0, 15, 45, 90] as const;

/** Data de calendário (SP) atribuída à sessão: início → fim → criação. */
export function sessionHeatmapDate(session: HeatmapSessionInput): string | null {
  return (
    timestampToDateISO(session.started_at) ??
    timestampToDateISO(session.ended_at) ??
    timestampToDateISO(session.created_at)
  );
}

/** Intensidade monocromática estilo commits (0 vazio … 4 mais denso). */
export function minutesToHeatmapLevel(minutes: number): HeatmapLevel {
  const safe = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  if (safe <= 0) return 0;
  if (safe < LEVEL_THRESHOLDS_MINUTES[1]) return 1;
  if (safe < LEVEL_THRESHOLDS_MINUTES[2]) return 2;
  if (safe < LEVEL_THRESHOLDS_MINUTES[3]) return 3;
  return 4;
}

/** 0 = segunda … 6 = domingo (calendário UTC da data ISO pura). */
export function weekdayMondayFirst(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const sundayBased = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return sundayBased === 0 ? 6 : sundayBased - 1;
}

/**
 * Agrega sessões nos últimos `windowDays` (incluindo hoje) em São Paulo.
 * Células vazias no início/fim da grade completam semanas (Seg→Dom).
 */
/** Modelo vazio (útil como fallback de UI quando a carga falha). */
export function emptyConsistencyHeatmap(
  today: string = todayISO(),
): ConsistencyHeatmapModel {
  return buildConsistencyHeatmap([], today);
}

export function buildConsistencyHeatmap(
  sessions: readonly HeatmapSessionInput[],
  today: string = todayISO(),
  windowDays: number = CONSISTENCY_HEATMAP_DAYS,
): ConsistencyHeatmapModel {
  const safeWindow = Number.isFinite(windowDays) && windowDays > 0
    ? Math.floor(windowDays)
    : CONSISTENCY_HEATMAP_DAYS;
  const windowEnd = today;
  const windowStart = addDaysISO(today, -(safeWindow - 1));

  const totals = new Map<string, { minutes: number; sessions: number }>();
  for (const session of sessions) {
    for (let offset = 0; offset < safeWindow; offset += 1) {
      const date = addDaysISO(windowStart, offset);
      const seconds = sessionSecondsOnDate(session, date);
      if (seconds <= 0) continue;
      const current = totals.get(date) ?? { minutes: 0, sessions: 0 };
      totals.set(date, {
        minutes: current.minutes + seconds / 60,
        sessions: current.sessions + 1,
      });
    }
  }

  const days: HeatmapDay[] = [];
  for (let offset = 0; offset < safeWindow; offset += 1) {
    const date = addDaysISO(windowStart, offset);
    const total = totals.get(date) ?? { minutes: 0, sessions: 0 };
    days.push({
      date,
      minutes: total.minutes,
      sessions: total.sessions,
      level: minutesToHeatmapLevel(total.minutes),
    });
  }

  const activeDays = days.filter((day) => day.sessions > 0).length;
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);

  return { days, activeDays, totalMinutes, windowStart, windowEnd };
}

/** Grade GitHub: colunas = semanas; linhas = Seg…Dom. `null` = padding fora da janela. */
export function buildHeatmapWeekGrid(
  days: readonly HeatmapDay[],
): Array<Array<HeatmapDay | null>> {
  if (days.length === 0) return [];

  const first = days[0];
  const padStart = weekdayMondayFirst(first.date);
  const cells: Array<HeatmapDay | null> = [
    ...Array.from({ length: padStart }, () => null),
    ...days,
  ];
  const padEnd = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < padEnd; i += 1) cells.push(null);

  const weekCount = cells.length / 7;
  const grid: Array<Array<HeatmapDay | null>> = [];
  for (let week = 0; week < weekCount; week += 1) {
    const column: Array<HeatmapDay | null> = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      column.push(cells[week * 7 + weekday] ?? null);
    }
    grid.push(column);
  }
  return grid;
}

export function heatmapDayLabel(day: HeatmapDay): string {
  const dateLabel = formatDateBR(day.date);
  if (day.sessions === 0) return `${dateLabel}: sem sessão`;
  const minutesLabel = Math.round(day.minutes).toLocaleString("pt-BR");
  const sessionLabel = day.sessions === 1 ? "1 sessão" : `${day.sessions} sessões`;
  return `${dateLabel}: ${sessionLabel}, ~${minutesLabel} min`;
}
