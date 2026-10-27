export type DeadlineTone = "danger" | "warning" | "neutral";

export const DEADLINE_WARNING_DAYS = 7;

export function getDeadlineTone(daysUntilDeadline: number | null): DeadlineTone {
  if (daysUntilDeadline === null) return "neutral";
  if (daysUntilDeadline < 0) return "danger";
  if (daysUntilDeadline <= DEADLINE_WARNING_DAYS) return "warning";
  return "neutral";
}
