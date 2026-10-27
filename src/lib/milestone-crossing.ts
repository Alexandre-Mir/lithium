import type { ReadingMilestone } from "@/types/database";

export function getCrossedMilestones(
  milestones: readonly ReadingMilestone[],
  previousPage: number,
  nextPage: number,
): ReadingMilestone[] {
  return milestones
    .filter((milestone) => milestone.page > previousPage && milestone.page <= nextPage)
    .slice()
    .sort((left, right) => left.page - right.page);
}
