import type { ReadingMilestone } from "@/types/database";

export function getCrossedMilestones(
  milestones: readonly ReadingMilestone[],
  previousPage: number,
  nextPage: number,
  targetPages: number,
): ReadingMilestone[] {
  if (!Number.isFinite(previousPage) || !Number.isFinite(nextPage) || nextPage <= previousPage) {
    return [];
  }

  const ordered = milestones
    .filter((milestone) => Number.isInteger(milestone.page) && milestone.page > 0)
    .slice()
    .sort((left, right) => left.page - right.page);
  if (ordered.length === 0) return [];

  const completedIndexes = new Set<number>();
  ordered.forEach((milestone, index) => {
    const boundaryReached = milestone.page > previousPage && milestone.page <= nextPage;
    if (boundaryReached && index > 0) completedIndexes.add(index - 1);
  });

  const completedTarget = Number.isInteger(targetPages) && targetPages > 0 && nextPage >= targetPages;
  if (completedTarget) completedIndexes.add(ordered.length - 1);

  return ordered.filter((_, index) => completedIndexes.has(index));
}
