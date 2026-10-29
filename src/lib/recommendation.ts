import { daysBetweenISO, timestampToDateISO, todayISO } from "@/lib/dates";
import { projectReadingQueue } from "@/lib/projection";
import { DEFAULT_PAGES_PER_DAY } from "@/lib/speed";
import { estimateTimerDurationSeconds } from "@/lib/reading-timer";
import {
  capSuggestedPagesToBudget,
  computeCognitiveBudget,
  reservedMinutesExcludingReading,
  type CognitiveTier2Reading,
} from "@/lib/cognitive-budget";

export interface RecommendationReading {
  id: string;
  title: string;
  target_pages: number;
  pages_read: number;
  deadline: string | null;
  is_read: boolean;
  created_at: string;
  last_session_at?: string | null;
  current_speed_pph?: number;
}

export interface RecommendationProgress {
  todayPagesByReading?: ReadonlyMap<string, number>;
  dailyGoalReached?: boolean;
}

export const OVERDUE_URGENCY_SCORE = Number.MAX_SAFE_INTEGER;
const DEADLINE_PRIORITY_SCORE = 1_000;
const QUEUE_PRIORITY_WEIGHT = 2;
const INACTIVITY_BONUS_PER_DAY = 0.1;
const MAX_INACTIVITY_BONUS = 2.5;
const MAX_INACTIVITY_DAYS = MAX_INACTIVITY_BONUS / INACTIVITY_BONUS_PER_DAY;

function remainingPages(reading: RecommendationReading): number {
  const targetPages = Number.isFinite(reading.target_pages) ? reading.target_pages : 0;
  const pagesRead = Number.isFinite(reading.pages_read) ? reading.pages_read : 0;
  return Math.max(0, targetPages - pagesRead);
}

function safeUserPace(userPace: number): number {
  return Number.isFinite(userPace) && userPace > 0 ? userPace : DEFAULT_PAGES_PER_DAY;
}

/** Escolhe a próxima leitura pendente por prazo, fila e inatividade. */
export function getSuggestedReading<T extends RecommendationReading>(
  readings: readonly T[],
  userPace: number,
  today: string = todayISO(),
  progress: RecommendationProgress = {},
): T | null {
  if (progress.dailyGoalReached) return null;

  const activeReadings = readings.filter((reading) => !reading.is_read && remainingPages(reading) > 0);
  if (activeReadings.length === 0) return null;

  const candidates = progress.todayPagesByReading
    ? activeReadings.filter((reading) => {
      const quota = calculateSuggestedPages(reading, userPace, today);
      const pagesReadToday = progress.todayPagesByReading?.get(reading.id) ?? 0;
      return pagesReadToday < quota;
    })
    : activeReadings;
  if (candidates.length === 0) return null;

  const queue = projectReadingQueue(
    candidates.filter((reading) => !reading.deadline),
    safeUserPace(userPace),
    today,
  );
  const queueRank = new Map(queue.map((reading, index) => [reading.id, index]));

  let suggested: T | null = null;
  let highestScore = Number.NEGATIVE_INFINITY;

  for (const reading of candidates) {
    let urgencyScore: number;
    if (reading.deadline) {
      const daysRemaining = daysBetweenISO(today, reading.deadline);
      urgencyScore = daysRemaining < 0
        ? OVERDUE_URGENCY_SCORE
        : DEADLINE_PRIORITY_SCORE + (daysRemaining === 0 ? 1 : 0);
    } else {
      const rank = queueRank.get(reading.id) ?? queue.length;
      const activityTimestamp = reading.last_session_at ?? reading.created_at;
      const activityDate = timestampToDateISO(activityTimestamp);
      const daysSinceActivity = activityDate
        ? Math.max(0, daysBetweenISO(activityDate, today))
        : 0;
      const inactivityBonus = Math.min(daysSinceActivity, MAX_INACTIVITY_DAYS) * INACTIVITY_BONUS_PER_DAY;
      urgencyScore = QUEUE_PRIORITY_WEIGHT / (rank + 1) + inactivityBonus;
    }

    let winsTie = false;
    if (urgencyScore === highestScore && suggested) {
      if (reading.deadline && suggested.deadline) {
        const deadlineOrder = reading.deadline.localeCompare(suggested.deadline);
        const readingDailyWorkload = remainingPages(reading) /
          Math.max(1, daysBetweenISO(today, reading.deadline));
        const suggestedDailyWorkload = remainingPages(suggested) /
          Math.max(1, daysBetweenISO(today, suggested.deadline));
        winsTie = deadlineOrder < 0 ||
          (deadlineOrder === 0 && readingDailyWorkload > suggestedDailyWorkload) ||
          (deadlineOrder === 0 && readingDailyWorkload === suggestedDailyWorkload &&
            reading.id.localeCompare(suggested.id) < 0);
      } else {
        winsTie = reading.id.localeCompare(suggested.id) < 0;
      }
    }

    if (urgencyScore > highestScore || winsTie) {
      suggested = reading;
      highestScore = urgencyScore;
    }
  }

  return suggested;
}

/** Calcula a meta de páginas de hoje e limita ao que falta para concluir. */
export function calculateSuggestedPages(
  reading: Pick<RecommendationReading, "target_pages" | "pages_read" | "deadline"> &
    Partial<Pick<RecommendationReading, "is_read">>,
  userPace: number,
  today: string = todayISO(),
): number {
  const targetPages = Number.isFinite(reading.target_pages) ? reading.target_pages : 0;
  const pagesRead = Number.isFinite(reading.pages_read) ? reading.pages_read : 0;
  const pagesRemaining = Math.max(0, targetPages - pagesRead);
  if (reading.is_read || pagesRemaining === 0) return 0;

  const suggestedPages = reading.deadline
    ? Math.ceil(pagesRemaining / Math.max(1, daysBetweenISO(today, reading.deadline)))
    : Math.ceil(safeUserPace(userPace));

  return Math.min(pagesRemaining, Math.max(0, suggestedPages));
}

/** Estima o tempo para concluir a cota de hoje desta leitura. */
export function calculateSuggestedTimerDurationSeconds(
  reading: Pick<RecommendationReading, "target_pages" | "pages_read" | "deadline" | "current_speed_pph"> &
    Partial<Pick<RecommendationReading, "is_read">>,
  userPace: number,
  today: string = todayISO(),
): number {
  const suggestedPages = calculateSuggestedPages(reading, userPace, today);
  return estimateTimerDurationSeconds(suggestedPages, reading.current_speed_pph ?? 0);
}

/**
 * Meta de páginas da recomendação limitada ao orçamento cognitivo diário
 * (após reservar revisões Tier 1 e demais cotas Tier 2).
 */
export function calculateBudgetAwareSuggestedPages(options: {
  reading: RecommendationReading & { current_speed_pph?: number };
  userPace: number;
  budgetMinutes: number;
  reviewCount: number;
  tier2Readings: readonly CognitiveTier2Reading[];
  today?: string;
}): { pages: number; uncappedPages: number; budget: ReturnType<typeof computeCognitiveBudget> } {
  const today = options.today ?? todayISO();
  const budget = computeCognitiveBudget({
    budgetMinutes: options.budgetMinutes,
    reviewCount: options.reviewCount,
    tier2Readings: options.tier2Readings,
    userPace: options.userPace,
    today,
  });
  const uncappedPages = calculateSuggestedPages(options.reading, options.userPace, today);
  const pages = capSuggestedPagesToBudget({
    suggestedPages: uncappedPages,
    speedPph: options.reading.current_speed_pph ?? 0,
    budgetMinutes: options.budgetMinutes,
    reservedMinutes: reservedMinutesExcludingReading(
      budget,
      options.tier2Readings,
      options.userPace,
      options.reading.id,
      today,
    ),
  });
  return { pages, uncappedPages, budget };
}
