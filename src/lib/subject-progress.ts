export interface ReadingPageTotals {
  pagesRead: number;
  targetPages: number;
}

export interface SubjectPageProgress {
  totalPagesRead: number;
  totalTargetPages: number;
  progressPercent: number;
}

export function computeSubjectPageProgress(
  readings: readonly ReadingPageTotals[],
): SubjectPageProgress {
  const totalPagesRead = readings.reduce(
    (sum, reading) => sum + Math.max(0, Number(reading.pagesRead) || 0),
    0,
  );
  const totalTargetPages = readings.reduce(
    (sum, reading) => sum + Math.max(0, Number(reading.targetPages) || 0),
    0,
  );
  const progressPercent = totalTargetPages > 0
    ? Math.min(100, Math.round((totalPagesRead / totalTargetPages) * 100))
    : 0;

  return { totalPagesRead, totalTargetPages, progressPercent };
}
