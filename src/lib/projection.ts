import { addDaysISO, daysUntil, todayISO } from "@/lib/dates";
import { computeRemaining } from "@/lib/progress";
import { pph, sessionSeconds } from "@/lib/session-time";
import { DEFAULT_PAGES_PER_DAY, DEFAULT_SPEED_PPH } from "@/lib/speed";
import type { Reading, ReadingSession } from "@/types/database";

export interface SuggestedDeadlineInput {
  target_pages: number;
  pages_read: number;
  is_read?: boolean;
}

export interface QueueReadingInput extends SuggestedDeadlineInput {
  id: string;
  created_at: string;
  deadline?: string | null;
}

export type QueuedReading<T extends QueueReadingInput> = T & {
  suggestedDeadline: string;
};

export interface DailyGoalProjection {
  pagesRemaining: number;
  estimatedMinutesRemaining: number;
}

/** Converte o tempo restante da meta em páginas inteiras e estima o esforço. */
export function computeDailyGoalProjection(
  minutesRead: number,
  goalMinutes: number,
  speedPph: number,
): DailyGoalProjection {
  const safeRead = Number.isFinite(minutesRead) ? Math.max(0, minutesRead) : 0;
  const safeGoal = Number.isFinite(goalMinutes) ? Math.max(0, goalMinutes) : 0;
  const safeSpeed = Number.isFinite(speedPph) && speedPph > 0
    ? speedPph
    : DEFAULT_SPEED_PPH;
  const remainingMinutes = Math.max(0, safeGoal - safeRead);
  const pagesRemaining = remainingMinutes === 0
    ? 0
    : Math.ceil((remainingMinutes / 60) * safeSpeed);

  return {
    pagesRemaining,
    estimatedMinutesRemaining: pagesRemaining === 0
      ? 0
      : (pagesRemaining / safeSpeed) * 60,
  };
}

export function calculateSuggestedDeadline(
  reading: SuggestedDeadlineInput,
  userPace: number,
  queueStartDate: string,
): string {
  const safePace = Number.isFinite(userPace) && userPace > 0
    ? userPace
    : DEFAULT_PAGES_PER_DAY;
  const pagesRemaining = reading.is_read
    ? 0
    : Math.max(0, (Number.isFinite(reading.target_pages) ? reading.target_pages : 0) -
      (Number.isFinite(reading.pages_read) ? reading.pages_read : 0));
  const daysNeeded = Math.ceil(pagesRemaining / safePace);
  return addDaysISO(queueStartDate, daysNeeded);
}

export function projectReadingQueue<T extends QueueReadingInput>(
  readings: readonly T[],
  userPace: number,
  queueStartDate: string = todayISO(),
): Array<QueuedReading<T>> {
  const queue = readings
    .filter((reading) => !reading.is_read && !reading.deadline)
    .slice()
    .sort((left, right) =>
      left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
    );

  let nextStartDate = queueStartDate;
  return queue.map((reading) => {
    const suggestedDeadline = calculateSuggestedDeadline(reading, userPace, nextStartDate);
    nextStartDate = suggestedDeadline;
    return { ...reading, suggestedDeadline };
  });
}

export function computeProjection(
  reading: Reading,
  sessions: ReadingSession[],
  suggestedDeadline?: string | null,
) {
  const pagesRead = sessions.reduce((sum, session) => sum + session.pages_read, 0);
  const totalSeconds = sessions.reduce((sum, session) => sum + sessionSeconds(session), 0);
  const speed = totalSeconds > 0 ? pph(pagesRead, totalSeconds) : reading.current_speed_pph;
  const remaining = computeRemaining({
    targetPages: reading.target_pages,
    pagesRead,
    speedPph: speed,
    isRead: reading.is_read,
  });
  const effectiveDeadline = reading.deadline ?? suggestedDeadline ?? null;
  const daysRemaining = reading.is_read || !effectiveDeadline
    ? 0
    : Math.max(0, daysUntil(effectiveDeadline));
  const pagesPerDay = reading.is_read || remaining.pagesRemaining === 0
    ? 0
    : daysRemaining > 0
      ? Math.ceil(remaining.pagesRemaining / daysRemaining)
      : remaining.pagesRemaining;
  return {
    pagesRead,
    pagesRemaining: remaining.pagesRemaining,
    progressPercent: remaining.progressPercent,
    overTarget: remaining.overTarget,
    hoursRemaining: remaining.hoursRemaining,
    daysRemaining,
    pagesPerDay,
    hoursPerDay: reading.is_read ? 0 : daysRemaining > 0
      ? remaining.hoursRemaining / daysRemaining
      : remaining.hoursRemaining,
    isOverdue: !reading.is_read && reading.deadline !== null && daysUntil(reading.deadline) < 0,
  };
}
