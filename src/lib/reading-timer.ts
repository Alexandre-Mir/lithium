export type TimerStatus = "running" | "paused";

export const DEFAULT_TIMER_DURATION_SECONDS = 25 * 60;
export const MIN_TIMER_DURATION_SECONDS = 60;

export interface TimerState {
  readingId: string;
  readingTitle: string;
  startedAt: string;
  status: TimerStatus;
  accumulatedMs: number;
  segmentStartedAt: string | null;
  durationSeconds: number;
  currentPage?: number;
  totalPages?: number | null;
  segmentStartPage?: number | null;
}

export interface TimerReadingProgress {
  currentPage: number;
  totalPages: number | null;
  segmentStartPage?: number | null;
}

/** Estima a duração para uma cota; quando o ritmo não é válido, usa 25 min. */
export function estimateTimerDurationSeconds(pages: number, speedPph: number): number {
  const pageCount = Number.isFinite(pages) ? Math.max(0, pages) : 0;
  const validSpeed = Number.isFinite(speedPph) && speedPph > 0;
  const estimatedSeconds = validSpeed
    ? Math.ceil((pageCount / speedPph) * 3_600)
    : DEFAULT_TIMER_DURATION_SECONDS;
  return Math.max(MIN_TIMER_DURATION_SECONDS, estimatedSeconds);
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
  progress?: TimerReadingProgress,
  durationSeconds: number = DEFAULT_TIMER_DURATION_SECONDS,
): TimerState {
  const startedAt = timestamp(now);
  const normalizedDuration = Number.isFinite(durationSeconds)
    ? Math.max(MIN_TIMER_DURATION_SECONDS, Math.ceil(durationSeconds))
    : DEFAULT_TIMER_DURATION_SECONDS;
  return {
    readingId,
    readingTitle,
    startedAt,
    status: "running",
    accumulatedMs: 0,
    segmentStartedAt: startedAt,
    durationSeconds: normalizedDuration,
    ...(progress ?? {}),
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
  if (record.currentPage !== undefined && (!Number.isInteger(record.currentPage) || Number(record.currentPage) < 0)) return false;
  if (record.totalPages !== undefined && record.totalPages !== null && (!Number.isInteger(record.totalPages) || Number(record.totalPages) < 1)) return false;
  if (record.segmentStartPage !== undefined && record.segmentStartPage !== null &&
    (!Number.isInteger(record.segmentStartPage) || Number(record.segmentStartPage) < 1)) return false;
  if (!isIsoTimestamp(record.startedAt)) return false;
  if (record.status !== "running" && record.status !== "paused") return false;
  if (typeof record.accumulatedMs !== "number" || !Number.isInteger(record.accumulatedMs) || record.accumulatedMs < 0) return false;
  if (typeof record.durationSeconds !== "number" || !Number.isInteger(record.durationSeconds) || record.durationSeconds < MIN_TIMER_DURATION_SECONDS) return false;

  if (record.status === "running") return isIsoTimestamp(record.segmentStartedAt);
  return record.segmentStartedAt === null;
}

export function parse(serialized: string | null): TimerState | null {
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const value: unknown = record.durationSeconds === undefined
      ? { ...record, durationSeconds: DEFAULT_TIMER_DURATION_SECONDS }
      : record;
    return isTimerState(value) ? value : null;
  } catch {
    return null;
  }
}
