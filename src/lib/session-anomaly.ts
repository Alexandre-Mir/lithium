import { pph, sessionSeconds } from "@/lib/session-time";
import type { ReadingSession } from "@/types/database";

export type SessionSpeedSample = Pick<
  ReadingSession,
  "pages_read" | "duration_minutes" | "duration_seconds"
>;

export function isUnusualSession(
  session: SessionSpeedSample,
  readingSessions: readonly SessionSpeedSample[],
): boolean {
  const speed = pph(session.pages_read, sessionSeconds(session));
  if (speed > 300) return true;
  if (readingSessions.length < 3) return false;

  const totalPages = readingSessions.reduce((sum, item) => sum + item.pages_read, 0);
  const totalSeconds = readingSessions.reduce((sum, item) => sum + sessionSeconds(item), 0);
  const averageSpeed = pph(totalPages, totalSeconds);
  if (averageSpeed <= 0) return false;

  return speed > averageSpeed * 3 || speed < averageSpeed / 3;
}
