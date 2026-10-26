import type { ReadingSession, ReadingSessionSource } from "@/types/database";

type SessionDuration = Pick<ReadingSession, "duration_minutes"> &
  Partial<Pick<ReadingSession, "duration_seconds">>;

export function sessionSeconds(session: SessionDuration): number {
  // Compatibilidade com sessões anteriores à coluna duration_seconds.
  return session.duration_seconds ?? session.duration_minutes * 60;
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
