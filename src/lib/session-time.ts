import type { ReadingSession, ReadingSessionSource } from "@/types/database";
import { addDaysISO, startOfDayUtcISO, todayISO, timestampToDateISO } from "@/lib/dates";

type SessionDuration = Pick<ReadingSession, "duration_minutes"> &
  Partial<Pick<ReadingSession, "duration_seconds">>;

type SessionWithTimestamps = SessionDuration & {
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
};

type SessionPages = Pick<ReadingSession, "pages_read"> & SessionWithTimestamps;

export function sessionSeconds(session: SessionDuration): number {
  // Compatibilidade com sessões anteriores à coluna duration_seconds.
  return session.duration_seconds ?? session.duration_minutes * 60;
}

/** Retorna a fração da sessão que ocorreu em uma data local. */
export function sessionFractionOnDate(
  session: SessionWithTimestamps,
  date: string,
): number {
  const startedAt = session.started_at ? Date.parse(session.started_at) : Number.NaN;
  const endedAt = session.ended_at ? Date.parse(session.ended_at) : Number.NaN;

  if (Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt > startedAt) {
    const dayStart = Date.parse(startOfDayUtcISO(date));
    const dayEnd = Date.parse(startOfDayUtcISO(addDaysISO(date, 1)));
    const overlap = Math.max(0, Math.min(endedAt, dayEnd) - Math.max(startedAt, dayStart));
    return overlap / (endedAt - startedAt);
  }

  const assignedDate =
    timestampToDateISO(session.started_at) ??
    timestampToDateISO(session.ended_at) ??
    timestampToDateISO(session.created_at);
  return assignedDate === date ? 1 : 0;
}

export function sessionSecondsOnDate(
  session: SessionWithTimestamps,
  date: string,
): number {
  return sessionSeconds(session) * sessionFractionOnDate(session, date);
}

export function sessionPagesOnDate(session: SessionPages, date: string): number {
  return session.pages_read * sessionFractionOnDate(session, date);
}

/** Soma os segundos ocorridos hoje no fuso America/Sao_Paulo. */
export function getTodayTotalReadingTime(sessions: readonly SessionWithTimestamps[]): number {
  const today = todayISO();
  const totalSeconds = sessions.reduce(
    (total, session) => total + sessionSecondsOnDate(session, today),
    0,
  );

  return totalSeconds / 60;
}

export function pph(pages: number, seconds: number): number {
  if (!Number.isFinite(pages) || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return (pages / seconds) * 3600;
}

export function secondsToMinutes(seconds: number): number {
  const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
  return Math.max(1, Math.round(safeSeconds / 60));
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  if (safeSeconds < 60) return `${safeSeconds} s`;

  const totalMinutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  if (safeSeconds < 3600) {
    return remainingSeconds === 0
      ? `${totalMinutes} min`
      : `${totalMinutes} min ${String(remainingSeconds).padStart(2, "0")} s`;
  }

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

export function sessionSourceLabel(source: ReadingSessionSource): string {
  if (source === "timer") return "cronômetro";
  if (source === "timer_adjusted") return "ajustado";
  return "manual";
}
