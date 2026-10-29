import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateSuggestedDeadline,
  computeDailyGoalProjection,
  computeProjection,
  projectReadingQueue,
} from "@/lib/projection";
import type { Reading, ReadingSession } from "@/types/database";

function makeReading(overrides: Partial<Reading> = {}): Reading {
  return {
    id: "reading-1",
    subject_id: "subject-1",
    title: "Livro de teste",
    chapter_title: null,
    author: "Autoria",
    type: "book",
    isbn: null,
    doi: null,
    full_book_pages: null,
    target_pages: 100,
    segment_start_page: null,
    read_full_book: false,
    deadline: "2026-10-29",
    is_read: false,
    current_speed_pph: 20,
    cover_url: null,
    publisher: null,
    published_year: null,
    metadata_source: null,
    metadata_fetched_at: null,
    milestones: [],
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    ...overrides,
  };
}

function makeSession(pagesRead: number, durationSeconds: number): ReadingSession {
  return {
    id: `session-${pagesRead}-${durationSeconds}`,
    reading_id: "reading-1",
    pages_read: pagesRead,
    duration_minutes: Math.round(durationSeconds / 60),
    duration_seconds: durationSeconds,
    started_at: null,
    ended_at: null,
    source: "manual",
    created_at: "2026-10-23T12:00:00Z",
  };
}

describe("computeProjection", () => {
  afterEach(() => vi.useRealTimers());

  it("usa 20 páginas por hora como referência quando não há sessões", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    expect(computeProjection(makeReading(), [])).toEqual({
      pagesRead: 0,
      pagesRemaining: 100,
      progressPercent: 0,
      overTarget: 0,
      hoursRemaining: 5,
      daysRemaining: 5,
      pagesPerDay: 20,
      hoursPerDay: 1,
      isOverdue: false,
    });
  });

  it("projeta páginas e tempo a partir das sessões registradas", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    const projection = computeProjection(makeReading(), [makeSession(30, 5_400), makeSession(20, 3_600)]);
    expect(projection).toEqual({
      pagesRead: 50,
      pagesRemaining: 50,
      progressPercent: 50,
      overTarget: 0,
      hoursRemaining: 2.5,
      daysRemaining: 5,
      pagesPerDay: 10,
      hoursPerDay: 0.5,
      isOverdue: false,
    });
  });

  it("limita o progresso a 100% e informa páginas além da meta", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    const projection = computeProjection(makeReading(), [makeSession(130, 23_400)]);
    expect(projection.progressPercent).toBe(100);
    expect(projection.overTarget).toBe(30);
    expect(projection.pagesRemaining).toBe(0);
  });

  it("marca uma leitura atrasada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    const projection = computeProjection(makeReading({ deadline: "2026-10-23" }), []);
    expect(projection.isOverdue).toBe(true);
    expect(projection.daysRemaining).toBe(0);
  });

  it("zera prazos e carga quando a leitura está concluída mesmo com progresso parcial", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T15:00:00Z"));

    expect(computeProjection(makeReading({ deadline: "2026-10-29", is_read: true }), [makeSession(67, 12_060)])).toEqual({
      pagesRead: 67,
      pagesRemaining: 0,
      progressPercent: 100,
      overTarget: 0,
      hoursRemaining: 0,
      daysRemaining: 0,
      pagesPerDay: 0,
      hoursPerDay: 0,
      isOverdue: false,
    });
  });

  it("mantém a projeção das sessões para uma leitura pendente", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    const projection = computeProjection(makeReading({ is_read: false }), [makeSession(20, 3_600)]);
    expect(projection.pagesRemaining).toBe(80);
    expect(projection.progressPercent).toBe(20);
    expect(projection.hoursRemaining).toBe(4);
  });

  it("usa todo o tempo restante como horas por dia quando o prazo é hoje", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    const projection = computeProjection(makeReading({ deadline: "2026-10-24" }), [makeSession(20, 3_600)]);
    expect(projection.hoursRemaining).toBe(4);
    expect(projection.daysRemaining).toBe(0);
    expect(projection.hoursPerDay).toBe(4);
  });

  it("usa o prazo sugerido para o ritmo diário sem marcar atraso real", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    const projection = computeProjection(makeReading({ deadline: null }), [], "2026-10-29");
    expect(projection.daysRemaining).toBe(5);
    expect(projection.pagesPerDay).toBe(20);
    expect(projection.isOverdue).toBe(false);
  });

  it("não inventa atraso quando a leitura sem prazo ainda não tem projeção", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    const projection = computeProjection(makeReading({ deadline: null }), []);
    expect(projection.daysRemaining).toBe(0);
    expect(projection.isOverdue).toBe(false);
  });
});

describe("computeDailyGoalProjection", () => {
  it("estima páginas e tempo a partir do ritmo global", () => {
    expect(computeDailyGoalProjection(15, 60, 20)).toEqual({
      pagesRemaining: 15,
      estimatedMinutesRemaining: 45,
    });
  });

  it("zera a projeção quando a meta diária já foi batida", () => {
    expect(computeDailyGoalProjection(60, 60, 20)).toEqual({
      pagesRemaining: 0,
      estimatedMinutesRemaining: 0,
    });
  });

  it("usa 20 p/h quando o ritmo estiver inválido", () => {
    expect(computeDailyGoalProjection(0, 30, 0)).toEqual({
      pagesRemaining: 10,
      estimatedMinutesRemaining: 30,
    });
  });
});

describe("calculateSuggestedDeadline", () => {
  it("calcula dias inteiros a partir das páginas restantes e do ritmo diário", () => {
    expect(calculateSuggestedDeadline(
      { target_pages: 100, pages_read: 26 },
      15,
      "2026-10-24",
    )).toBe("2026-10-29");
  });

  it("usa 15 páginas por dia para ritmo inválido e não estende meta concluída", () => {
    expect(calculateSuggestedDeadline(
      { target_pages: 30, pages_read: 0 },
      0,
      "2026-10-24",
    )).toBe("2026-10-26");
    expect(calculateSuggestedDeadline(
      { target_pages: 30, pages_read: 30 },
      15,
      "2026-10-24",
    )).toBe("2026-10-24");
  });
});

describe("projectReadingQueue", () => {
  it("ordena por criação e encadeia as datas sugeridas", () => {
    const queue = projectReadingQueue([
      { id: "b", title: "B", target_pages: 30, pages_read: 0, created_at: "2026-10-02T00:00:00Z", deadline: null },
      { id: "a", title: "A", target_pages: 30, pages_read: 0, created_at: "2026-10-01T00:00:00Z", deadline: null },
    ], 10, "2026-10-24");

    expect(queue.map(({ id, suggestedDeadline }) => [id, suggestedDeadline])).toEqual([
      ["a", "2026-10-27"],
      ["b", "2026-10-30"],
    ]);
  });

  it("ignora leituras concluídas ou com prazo fixo", () => {
    const queue = projectReadingQueue([
      { id: "done", target_pages: 30, pages_read: 30, created_at: "2026-10-01", deadline: null, is_read: true },
      { id: "fixed", target_pages: 30, pages_read: 0, created_at: "2026-10-02", deadline: "2026-11-01" },
    ], 15, "2026-10-24");

    expect(queue).toEqual([]);
  });
});
