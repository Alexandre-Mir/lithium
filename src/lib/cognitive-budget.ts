import { daysBetweenISO, todayISO } from "@/lib/dates";
import { DEFAULT_PAGES_PER_DAY, DEFAULT_SPEED_PPH } from "@/lib/speed";

/** Tempo médio estimado por revisão ativa (Tier 1) no orçamento do dia. */
export const REVIEW_ESTIMATE_MINUTES = 15;

export interface CognitiveTier2Reading {
  id: string;
  target_pages: number;
  pages_read: number;
  deadline: string | null;
  is_read?: boolean;
  current_speed_pph?: number;
}

/** Cota diária de páginas (mesma regra da recomendação) sem importar recommendation.ts. */
function suggestedPagesToday(
  reading: CognitiveTier2Reading,
  userPace: number,
  today: string,
): number {
  const targetPages = Number.isFinite(reading.target_pages) ? reading.target_pages : 0;
  const pagesRead = Number.isFinite(reading.pages_read) ? reading.pages_read : 0;
  const pagesRemaining = Math.max(0, targetPages - pagesRead);
  if (reading.is_read || pagesRemaining === 0) return 0;

  const pace = Number.isFinite(userPace) && userPace > 0 ? userPace : DEFAULT_PAGES_PER_DAY;
  const suggested = reading.deadline
    ? Math.ceil(pagesRemaining / Math.max(1, daysBetweenISO(today, reading.deadline)))
    : Math.ceil(pace);

  return Math.min(pagesRemaining, Math.max(0, suggested));
}

export interface CognitiveBudgetInput {
  budgetMinutes: number;
  reviewCount: number;
  tier2Readings: readonly CognitiveTier2Reading[];
  userPace: number;
  today?: string;
}

export interface CognitiveBudgetResult {
  budgetMinutes: number;
  tier1Minutes: number;
  tier2Minutes: number;
  demandedMinutes: number;
  isOverloaded: boolean;
  overloadMinutes: number;
  /** Minutos ainda disponíveis para leitura após reservar Tier 1. */
  availableAfterReviewsMinutes: number;
}

function safeMinutes(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function safeSpeed(speedPph: number | undefined): number {
  return Number.isFinite(speedPph) && (speedPph as number) > 0
    ? (speedPph as number)
    : DEFAULT_SPEED_PPH;
}

/** Converte páginas em minutos de esforço à velocidade dada. */
export function pagesToMinutes(pages: number, speedPph: number): number {
  const safePages = Number.isFinite(pages) ? Math.max(0, pages) : 0;
  if (safePages === 0) return 0;
  return (safePages / safeSpeed(speedPph)) * 60;
}

/** Converte minutos disponíveis em páginas inteiras à velocidade dada. */
export function minutesToPages(minutes: number, speedPph: number): number {
  const safe = safeMinutes(minutes);
  if (safe === 0) return 0;
  return Math.floor((safe / 60) * safeSpeed(speedPph));
}

/** Estima os minutos de cota de hoje para uma leitura de Tier 2. */
export function estimateTier2MinutesToday(
  reading: CognitiveTier2Reading,
  userPace: number,
  today: string = todayISO(),
): number {
  const pages = suggestedPagesToday(reading, userPace, today);
  return pagesToMinutes(pages, reading.current_speed_pph ?? DEFAULT_SPEED_PPH);
}

/**
 * Soma a carga cognitiva diária: revisões Tier 1 + cotas de Tier 2 (zona de perigo).
 * O orçamento costuma ser a meta diária de leitura (`daily_goal_minutes`).
 */
export function computeCognitiveBudget(input: CognitiveBudgetInput): CognitiveBudgetResult {
  const today = input.today ?? todayISO();
  const budgetMinutes = safeMinutes(input.budgetMinutes);
  const reviewCount = Number.isFinite(input.reviewCount)
    ? Math.max(0, Math.floor(input.reviewCount))
    : 0;
  const tier1Minutes = reviewCount * REVIEW_ESTIMATE_MINUTES;
  const tier2Minutes = input.tier2Readings.reduce(
    (sum, reading) => sum + estimateTier2MinutesToday(reading, input.userPace, today),
    0,
  );
  const demandedMinutes = tier1Minutes + tier2Minutes;
  const overloadMinutes = Math.max(0, demandedMinutes - budgetMinutes);

  return {
    budgetMinutes,
    tier1Minutes,
    tier2Minutes,
    demandedMinutes,
    isOverloaded: demandedMinutes > budgetMinutes,
    overloadMinutes,
    availableAfterReviewsMinutes: Math.max(0, budgetMinutes - tier1Minutes),
  };
}

/**
 * Limita a meta de páginas para caber no orçamento após reservar revisões
 * e as demais cotas de Tier 2 (exceto a leitura recomendada, se for T2).
 */
export function capSuggestedPagesToBudget(options: {
  suggestedPages: number;
  speedPph: number;
  budgetMinutes: number;
  reservedMinutes: number;
}): number {
  const suggested = Number.isFinite(options.suggestedPages)
    ? Math.max(0, Math.floor(options.suggestedPages))
    : 0;
  if (suggested === 0) return 0;

  const available = Math.max(
    0,
    safeMinutes(options.budgetMinutes) - safeMinutes(options.reservedMinutes),
  );
  const maxPages = minutesToPages(available, options.speedPph);
  return Math.min(suggested, maxPages);
}

/** Minutos reservados por T1 + T2, opcionalmente excluindo uma leitura (a recomendada). */
export function reservedMinutesExcludingReading(
  budget: CognitiveBudgetResult,
  tier2Readings: readonly CognitiveTier2Reading[],
  userPace: number,
  excludeReadingId: string | null,
  today: string = todayISO(),
): number {
  if (!excludeReadingId) {
    return budget.tier1Minutes + budget.tier2Minutes;
  }
  const othersMinutes = tier2Readings
    .filter((reading) => reading.id !== excludeReadingId)
    .reduce(
      (sum, reading) => sum + estimateTier2MinutesToday(reading, userPace, today),
      0,
    );
  return budget.tier1Minutes + othersMinutes;
}
