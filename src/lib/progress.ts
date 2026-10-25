export const DEFAULT_SPEED_PPH = 20;

export interface RemainingProgressInput {
  targetPages: number;
  pagesRead: number;
  speedPph: number;
}

export function computeRemaining({
  targetPages,
  pagesRead,
  speedPph,
}: RemainingProgressInput) {
  const safeTargetPages = Number.isFinite(targetPages) ? Math.max(0, targetPages) : 0;
  const safePagesRead = Number.isFinite(pagesRead) ? Math.max(0, pagesRead) : 0;
  const speed = Number.isFinite(speedPph) && speedPph > 0 ? speedPph : DEFAULT_SPEED_PPH;
  const pagesRemaining = Math.max(0, safeTargetPages - safePagesRead);
  const progressPercent = safeTargetPages > 0
    ? Math.min(100, Math.round((safePagesRead / safeTargetPages) * 100))
    : 0;

  return {
    pagesRemaining,
    hoursRemaining: pagesRemaining / speed,
    progressPercent,
    overTarget: Math.max(0, safePagesRead - safeTargetPages),
    goalReached: safePagesRead >= safeTargetPages,
  };
}
