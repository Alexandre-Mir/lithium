import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMER_DURATION_SECONDS,
  MIN_TIMER_DURATION_SECONDS,
  elapsedSeconds,
  estimateTimerDurationSeconds,
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
      durationSeconds: DEFAULT_TIMER_DURATION_SECONDS,
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

  it("mantém a duração dinâmica no estado e no formato serializado", () => {
    const timer = startTimer("reading-1", "Livro", base, undefined, 5_400);
    expect(timer.durationSeconds).toBe(5_400);
    expect(parse(serialize(timer))?.durationSeconds).toBe(5_400);
  });

  it("preserva a página inicial do trecho ao persistir o cronômetro", () => {
    const timer = startTimer("reading-1", "Trecho", base, {
      currentPage: 15,
      totalPages: 30,
      segmentStartPage: 150,
    });

    expect(parse(serialize(timer))).toMatchObject({
      currentPage: 15,
      totalPages: 30,
      segmentStartPage: 150,
    });
    expect(parse(serialize({ ...timer, segmentStartPage: 0 }))).toBeNull();
  });

  it("migra timers antigos para a duração padrão", () => {
    const legacy = {
      readingId: "reading-1",
      readingTitle: "Livro",
      startedAt: base.toISOString(),
      status: "paused",
      accumulatedMs: 0,
      segmentStartedAt: null,
    };
    expect(parse(JSON.stringify(legacy))?.durationSeconds).toBe(DEFAULT_TIMER_DURATION_SECONDS);
  });

  it("estima a duração da cota, aceita mais de uma hora e aplica os limites", () => {
    expect(estimateTimerDurationSeconds(20, 20)).toBe(3_600);
    expect(estimateTimerDurationSeconds(100, 50)).toBe(7_200);
    expect(estimateTimerDurationSeconds(0, 20)).toBe(MIN_TIMER_DURATION_SECONDS);
    expect(estimateTimerDurationSeconds(10, 0)).toBe(DEFAULT_TIMER_DURATION_SECONDS);
  });
});
