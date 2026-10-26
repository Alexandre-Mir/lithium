export type TimerStatus = "running" | "paused";

export interface TimerState {
  readingId: string;
  readingTitle: string;
  startedAt: string;
  status: TimerStatus;
  accumulatedMs: number;
  segmentStartedAt: string | null;
}

function timestamp(now: Date): string {
  return now.toISOString();
}

function elapsedSegmentMs(startedAt: string | null, now: Date): number {
  if (!startedAt) return 0;
  return Math.max(0, now.getTime() - Date.parse(startedAt));
}

export function startTimer(
  readingId: string,
  readingTitle: string,
  now: Date = new Date(),
): TimerState {
  const startedAt = timestamp(now);
  return {
    readingId,
    readingTitle,
    startedAt,
    status: "running",
    accumulatedMs: 0,
    segmentStartedAt: startedAt,
  };
}

export function pauseTimer(state: TimerState, now: Date = new Date()): TimerState {
  if (state.status === "paused") return state;
  return {
    ...state,
    status: "paused",
    accumulatedMs: Math.max(0, state.accumulatedMs) + elapsedSegmentMs(state.segmentStartedAt, now),
    segmentStartedAt: null,
  };
}

export function resumeTimer(state: TimerState, now: Date = new Date()): TimerState {
  if (state.status === "running") return state;
  return {
    ...state,
    status: "running",
    segmentStartedAt: timestamp(now),
  };
}

export function elapsedSeconds(state: TimerState, now: Date = new Date()): number {
  const accumulatedMs = Number.isFinite(state.accumulatedMs)
    ? Math.max(0, state.accumulatedMs)
    : 0;
  const runningMs = state.status === "running"
    ? elapsedSegmentMs(state.segmentStartedAt, now)
    : 0;
  return Math.max(0, Math.floor((accumulatedMs + runningMs) / 1000));
}

export function serialize(state: TimerState): string {
  return JSON.stringify(state);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

function isTimerState(value: unknown): value is TimerState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.readingId !== "string" || record.readingId.length === 0) return false;
  if (typeof record.readingTitle !== "string") return false;
  if (!isIsoTimestamp(record.startedAt)) return false;
  if (record.status !== "running" && record.status !== "paused") return false;
  if (typeof record.accumulatedMs !== "number" || !Number.isInteger(record.accumulatedMs) || record.accumulatedMs < 0) return false;

  if (record.status === "running") return isIsoTimestamp(record.segmentStartedAt);
  return record.segmentStartedAt === null;
}

export function parse(serialized: string | null): TimerState | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    return isTimerState(value) ? value : null;
  } catch {
    return null;
  }
}
