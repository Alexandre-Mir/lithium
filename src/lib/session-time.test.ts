import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDuration,
  getTodayTotalReadingTime,
  pph,
  sessionPagesOnDate,
  secondsToMinutes,
  sessionSeconds,
} from "@/lib/session-time";

describe("session-time", () => {
  afterEach(() => vi.useRealTimers());

  it("usa segundos novos e faz fallback para minutos legados", () => {
    expect(sessionSeconds({ duration_seconds: 75, duration_minutes: 2 })).toBe(75);
    expect(sessionSeconds({ duration_seconds: null, duration_minutes: 2 })).toBe(120);
  });

  it("calcula páginas por hora a partir de segundos", () => {
    expect(pph(10, 1800)).toBe(20);
    expect(pph(10, 0)).toBe(0);
  });

  it("arredonda segundos para minutos de exibição, com mínimo de um", () => {
    expect(secondsToMinutes(1)).toBe(1);
    expect(secondsToMinutes(89)).toBe(1);
    expect(secondsToMinutes(90)).toBe(2);
  });

  it.each([
    [0, "0 s"],
    [45, "45 s"],
    [60, "1 min"],
    [750, "12 min 30 s"],
    [3600, "1 h 00 min"],
    [3900, "1 h 05 min"],
  ])("formata %i segundos como %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("divide o tempo de sessões que cruzam a meia-noite de São Paulo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    expect(
      getTodayTotalReadingTime([
        {
          duration_minutes: 20,
          duration_seconds: 1_200,
          started_at: "2026-10-24T02:50:00Z",
          ended_at: "2026-10-24T03:10:00Z",
        },
        {
          duration_minutes: 5,
          duration_seconds: 300,
          started_at: "2026-10-24T03:00:00Z",
          ended_at: "2026-10-24T03:05:00Z",
        },
        {
          duration_minutes: 4,
          duration_seconds: 240,
          started_at: "2026-10-23T15:00:00Z",
          ended_at: "2026-10-23T15:04:00Z",
        },
      ]),
    ).toBe(15);
  });

  it("distribui as páginas da sessão entre os dias locais atravessados", () => {
    const session = {
      pages_read: 10,
      duration_minutes: 20,
      duration_seconds: 1_200,
      started_at: "2026-10-24T02:50:00Z",
      ended_at: "2026-10-24T03:10:00Z",
    };

    expect(sessionPagesOnDate(session, "2026-10-23")).toBe(5);
    expect(sessionPagesOnDate(session, "2026-10-24")).toBe(5);
  });

  it("usa created_at para sessões manuais legadas sem início e fim", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    expect(
      getTodayTotalReadingTime([
        {
          duration_minutes: 7,
          duration_seconds: null,
          started_at: null,
          ended_at: null,
          created_at: "2026-10-24T02:59:00Z",
        },
        {
          duration_minutes: 12,
          duration_seconds: null,
          started_at: null,
          ended_at: null,
          created_at: "2026-10-24T03:00:00Z",
        },
      ]),
    ).toBe(12);
  });
});
