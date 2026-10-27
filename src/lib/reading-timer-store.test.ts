import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelPendingTimerStart,
  clearReadingTimer,
  completeReadingSprint,
  confirmPendingTimerStart,
  getPendingTimerStart,
  getReadingTimerSnapshot,
  pauseReadingTimer,
  remainingSprintSeconds,
  SPRINT_DURATION_SEC,
  sprintProgressPercent,
  startReadingTimer,
} from "@/lib/reading-timer-store";
import { elapsedSeconds } from "@/lib/reading-timer";

afterEach(() => {
  clearReadingTimer();
  vi.useRealTimers();
});

describe("sprint countdown", () => {
  it("counts down from 25 minutes and never goes below zero", () => {
    expect(SPRINT_DURATION_SEC).toBe(1_500);
    expect(remainingSprintSeconds(0)).toBe(1_500);
    expect(remainingSprintSeconds(600)).toBe(900);
    expect(remainingSprintSeconds(1_500)).toBe(0);
    expect(remainingSprintSeconds(1_700)).toBe(0);
  });

  it("reports sprint progress from zero through 100 percent", () => {
    expect(sprintProgressPercent(0)).toBe(0);
    expect(sprintProgressPercent(600)).toBe(40);
    expect(sprintProgressPercent(1_500)).toBe(100);
    expect(sprintProgressPercent(1_700)).toBe(100);
  });

  it("usa duração dinâmica em contagem regressiva e progresso", () => {
    expect(remainingSprintSeconds(600, 3_600)).toBe(3_000);
    expect(sprintProgressPercent(600, 3_600)).toBeCloseTo(16.67, 1);
  });

  it("conclui cronômetros longos no limite dinâmico, não em 25 minutos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T12:00:00.000Z"));
    startReadingTimer("reading-1", "Livro", undefined, 3_600);
    vi.setSystemTime(new Date("2026-10-27T13:10:00.000Z"));

    completeReadingSprint();

    const timer = getReadingTimerSnapshot();
    expect(timer?.durationSeconds).toBe(3_600);
    expect(timer && elapsedSeconds(timer)).toBe(3_600);
    expect(remainingSprintSeconds(timer ? elapsedSeconds(timer) : 0, timer?.durationSeconds)).toBe(0);
  });

  it("pauses the completed sprint at exactly 25 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T12:00:00.000Z"));
    startReadingTimer("reading-1", "Livro");
    vi.setSystemTime(new Date("2026-10-27T12:25:08.000Z"));

    completeReadingSprint();

    const timer = getReadingTimerSnapshot();
    expect(timer?.status).toBe("paused");
    expect(timer && elapsedSeconds(timer)).toBe(SPRINT_DURATION_SEC);
  });

  it("preserves an early manual finish at the measured elapsed time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T12:00:00.000Z"));
    startReadingTimer("reading-1", "Livro");
    vi.setSystemTime(new Date("2026-10-27T12:10:00.000Z"));

    pauseReadingTimer();

    const timer = getReadingTimerSnapshot();
    expect(timer?.status).toBe("paused");
    expect(timer && elapsedSeconds(timer)).toBe(600);
    expect(remainingSprintSeconds(600)).toBe(900);
  });

  it("asks before replacing an active timer and starts the requested one after confirmation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T12:00:00.000Z"));
    startReadingTimer("reading-1", "Livro atual");
    vi.setSystemTime(new Date("2026-10-27T12:10:00.000Z"));

    startReadingTimer("reading-2", "Novo livro", undefined, 3_600);

    expect(getReadingTimerSnapshot()?.readingId).toBe("reading-1");
    expect(getPendingTimerStart()).toMatchObject({
      readingId: "reading-2",
      readingTitle: "Novo livro",
      durationSeconds: 3_600,
    });

    cancelPendingTimerStart();
    expect(getReadingTimerSnapshot()?.readingId).toBe("reading-1");
    expect(getPendingTimerStart()).toBeNull();

    startReadingTimer("reading-2", "Novo livro", undefined, 3_600);

    expect(confirmPendingTimerStart()).toBe(true);
    expect(getReadingTimerSnapshot()).toMatchObject({
      readingId: "reading-2",
      readingTitle: "Novo livro",
      durationSeconds: 3_600,
    });
    expect(getPendingTimerStart()).toBeNull();
  });
});
