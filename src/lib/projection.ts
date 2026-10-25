import { daysUntil } from "@/lib/dates";
import { computeRemaining } from "@/lib/progress";
import type { Reading, ReadingSession } from "@/types/database";

export function computeProjection(reading: Reading, sessions: ReadingSession[]) {
  const pagesRead = sessions.reduce((sum, session) => sum + session.pages_read, 0);
  const totalMinutes = sessions.reduce((sum, session) => sum + session.duration_minutes, 0);
  const speed = totalMinutes > 0 ? (pagesRead / totalMinutes) * 60 : reading.current_speed_pph;
  const remaining = computeRemaining({
    targetPages: reading.target_pages,
    pagesRead,
    speedPph: speed,
  });
  const daysRemaining = Math.max(0, daysUntil(reading.deadline));
  return {
    pagesRead,
    pagesRemaining: remaining.pagesRemaining,
    progressPercent: remaining.progressPercent,
    overTarget: remaining.overTarget,
    hoursRemaining: remaining.hoursRemaining,
    daysRemaining,
    hoursPerDay: daysRemaining > 0
      ? remaining.hoursRemaining / daysRemaining
      : remaining.hoursRemaining,
    isOverdue: daysUntil(reading.deadline) < 0,
  };
}
