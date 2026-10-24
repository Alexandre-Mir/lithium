import { daysUntil } from "@/lib/dates";
import type { Reading, ReadingSession } from "@/types/database";

export function computeProjection(reading: Reading, sessions: ReadingSession[]) {
  const pagesRead = sessions.reduce((sum, session) => sum + session.pages_read, 0);
  const totalMinutes = sessions.reduce((sum, session) => sum + session.duration_minutes, 0);
  const speed = totalMinutes > 0 ? (pagesRead / totalMinutes) * 60 : 20;
  const pagesRemaining = Math.max(0, reading.target_pages - pagesRead);
  const overTarget = Math.max(0, pagesRead - reading.target_pages);
  const progressPercent = reading.target_pages > 0
    ? Math.min(100, Math.round((pagesRead / reading.target_pages) * 100))
    : 0;
  const hoursRemaining = speed > 0 ? pagesRemaining / speed : 0;
  const daysRemaining = Math.max(0, daysUntil(reading.deadline));
  return {
    pagesRead,
    pagesRemaining,
    progressPercent,
    overTarget,
    hoursRemaining,
    daysRemaining,
    hoursPerDay: daysRemaining > 0 ? hoursRemaining / daysRemaining : hoursRemaining,
    isOverdue: daysUntil(reading.deadline) < 0,
  };
}
