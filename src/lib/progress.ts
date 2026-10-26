export const DEFAULT_SPEED_PPH = 20;

export interface RemainingProgressInput {
  targetPages: number;
  pagesRead: number;
  speedPph: number;
  isRead?: boolean;
}

export function computeRemaining({
  targetPages,
  pagesRead,
  speedPph,
  isRead,
}: RemainingProgressInput) {
  const safeTargetPages = Number.isFinite(targetPages) ? Math.max(0, targetPages) : 0;
  const safePagesRead = Number.isFinite(pagesRead) ? Math.max(0, pagesRead) : 0;
  const speed = Number.isFinite(speedPph) && speedPph > 0 ? speedPph : DEFAULT_SPEED_PPH;
  if (isRead) {
    return {
      pagesRemaining: 0,
      hoursRemaining: 0,
      progressPercent: 100,
      overTarget: Math.max(0, safePagesRead - safeTargetPages),
      goalReached: true,
    };
  }
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

export interface ReadingLoadInput {
  target_pages: number;
  pages_read: number;
  current_speed_pph: number;
  is_read: boolean;
}

export function sumPendingLoad(readings: readonly ReadingLoadInput[]) {
  return readings.reduce(
    (total, reading) => {
      const remaining = computeRemaining({
        targetPages: reading.target_pages,
        pagesRead: reading.pages_read,
        speedPph: reading.current_speed_pph,
        isRead: reading.is_read,
      });
      return {
        pagesRemaining: total.pagesRemaining + remaining.pagesRemaining,
        hoursRemaining: total.hoursRemaining + remaining.hoursRemaining,
      };
    },
    { pagesRemaining: 0, hoursRemaining: 0 },
  );
}
