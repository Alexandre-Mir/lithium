import type { ReadingSession, ReadingSessionSource } from "@/types/database";
import { APP_TIMEZONE, todayISO } from "@/lib/dates";

type SessionDuration = Pick<ReadingSession, "duration_minutes"> &
  Partial<Pick<ReadingSession, "duration_seconds">>;

type SessionWithTimestamps = SessionDuration &
  Partial<Pick<ReadingSession, "started_at" | "ended_at" | "created_at">>;

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function timestampDateInAppTimezone(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : localDateFormatter.format(date);
}

export function sessionSeconds(session: SessionDuration): number {
  // Compatibilidade com sessões anteriores à coluna duration_seconds.
  return session.duration_seconds ?? session.duration_minutes * 60;
}

/** Soma em minutos as sessões cujo início ou fim caiu hoje em São Paulo. */
export function getTodayTotalReadingTime(sessions: readonly SessionWithTimestamps[]): number {
  const today = todayISO();
  const totalSeconds = sessions.reduce((total, session) => {
    const startedToday = timestampDateInAppTimezone(session.started_at) === today;
    const endedToday = timestampDateInAppTimezone(session.ended_at) === today;
    const legacyManualSession =
      !session.started_at &&
      !session.ended_at &&
      timestampDateInAppTimezone(session.created_at) === today;

    return startedToday || endedToday || legacyManualSession
      ? total + sessionSeconds(session)
      : total;
  }, 0);

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
