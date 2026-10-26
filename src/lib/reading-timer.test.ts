import { describe, expect, it } from "vitest";
import {
  elapsedSeconds,
  parse,
  pauseTimer,
  resumeTimer,
  serialize,
  startTimer,
} from "@/lib/reading-timer";

const base = new Date("2026-10-25T12:00:00.000Z");

describe("reading-timer", () => {
  it("inicia um cronômetro com o segmento ativo", () => {
    const timer = startTimer("reading-1", "Livro", base);
    expect(timer).toEqual({
      readingId: "reading-1",
      readingTitle: "Livro",
      startedAt: base.toISOString(),
      status: "running",
      accumulatedMs: 0,
      segmentStartedAt: base.toISOString(),
    });
    expect(elapsedSeconds(timer, new Date(base.getTime() + 12_000))).toBe(12);
  });

  it("pausa e mantém o tempo acumulado estável", () => {
    const running = startTimer("reading-1", "Livro", base);
    const paused = pauseTimer(running, new Date(base.getTime() + 20_500));
    expect(paused.status).toBe("paused");
    expect(paused.accumulatedMs).toBe(20_500);
    expect(paused.segmentStartedAt).toBeNull();
    expect(elapsedSeconds(paused, new Date(base.getTime() + 90_000))).toBe(20);
  });

  it("retoma sem contar o intervalo pausado", () => {
    const paused = pauseTimer(startTimer("reading-1", "Livro", base), new Date(base.getTime() + 10_000));
    const resumedAt = new Date(base.getTime() + 60_000);
    const resumed = resumeTimer(paused, resumedAt);
    expect(resumed.status).toBe("running");
    expect(elapsedSeconds(resumed, new Date(resumedAt.getTime() + 5_000))).toBe(15);
  });

  it("não devolve tempo negativo se o relógio andar para trás", () => {
    const timer = startTimer("reading-1", "Livro", base);
    expect(elapsedSeconds(timer, new Date(base.getTime() - 5_000))).toBe(0);
    expect(pauseTimer(timer, new Date(base.getTime() - 5_000)).accumulatedMs).toBe(0);
  });

  it("serializa e rejeita JSON ou formatos inválidos", () => {
    const timer = startTimer("reading-1", "Livro", base);
    expect(parse(serialize(timer))).toEqual(timer);
    expect(parse("{")).toBeNull();
    expect(parse(JSON.stringify({ readingId: "x", status: "running" }))).toBeNull();
    expect(parse(null)).toBeNull();
  });
});
