import { describe, expect, it } from "vitest";
import { formatDuration, pph, secondsToMinutes, sessionSeconds } from "@/lib/session-time";

describe("session-time", () => {
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
});
