import { describe, expect, it } from "vitest";
import {
  calculateSuggestedPages,
  calculateSuggestedTimerDurationSeconds,
  getSuggestedReading,
  OVERDUE_URGENCY_SCORE,
  type RecommendationReading,
} from "@/lib/recommendation";

function makeReading(overrides: Partial<RecommendationReading> = {}): RecommendationReading {
  return {
    id: "reading-1",
    title: "Livro de teste",
    target_pages: 200,
    pages_read: 0,
    deadline: null,
    is_read: false,
    created_at: "2026-10-20T12:00:00Z",
    last_session_at: null,
    ...overrides,
  };
}

describe("motor de recomendação", () => {
  it("atribui urgência máxima a uma leitura com prazo vencido", () => {
    const overdue = makeReading({ id: "overdue", deadline: "2026-10-23" });
    const highFutureRatio = makeReading({
      id: "future",
      target_pages: 1_000,
      deadline: "2026-10-25",
    });

    expect(OVERDUE_URGENCY_SCORE).toBeGreaterThan(1_000 + 1_000);
    expect(getSuggestedReading([highFutureRatio, overdue], 15, "2026-10-24")?.id).toBe("overdue");
  });

  it("prioriza o maior volume de páginas por dia entre prazos futuros", () => {
    const urgent = makeReading({
      id: "urgent",
      target_pages: 120,
      deadline: "2026-10-26",
    });
    const lessUrgent = makeReading({
      id: "less-urgent",
      target_pages: 30,
      deadline: "2026-10-27",
    });

    expect(getSuggestedReading([lessUrgent, urgent], 15, "2026-10-24")?.id).toBe("urgent");
  });

  it("usa fila por criação e dá bônus leve às leituras paradas", () => {
    const oldest = makeReading({
      id: "oldest",
      created_at: "2026-10-20T12:00:00Z",
      last_session_at: "2026-10-24T12:00:00Z",
    });
    const second = makeReading({
      id: "second",
      created_at: "2026-10-21T12:00:00Z",
      last_session_at: "2026-10-24T12:00:00Z",
    });
    const paused = makeReading({
      id: "paused",
      created_at: "2026-10-22T12:00:00Z",
      last_session_at: "2026-10-01T12:00:00Z",
    });

    expect(getSuggestedReading([
      oldest,
      second,
      { ...paused, last_session_at: "2026-10-24T12:00:00Z" },
    ], 15, "2026-10-24")?.id).toBe("oldest");
    expect(getSuggestedReading([oldest, second, paused], 15, "2026-10-24")?.id).toBe("paused");
  });

  it("ignora leituras concluídas e metas já atingidas", () => {
    expect(getSuggestedReading([
      makeReading({ id: "done", is_read: true }),
      makeReading({ id: "finished", pages_read: 200 }),
    ], 15)).toBeNull();
  });

  it("calcula páginas do prazo e limita ao restante do livro", () => {
    expect(calculateSuggestedPages(makeReading({
      target_pages: 100,
      pages_read: 20,
      deadline: "2026-10-28",
    }), 15, "2026-10-24")).toBe(20);
    expect(calculateSuggestedPages(makeReading({
      target_pages: 100,
      pages_read: 95,
      deadline: null,
    }), 15, "2026-10-24")).toBe(5);
  });

  it("usa o ritmo informado sem prazo e cai para 15 se ele for inválido", () => {
    const reading = makeReading({ target_pages: 100, pages_read: 20 });
    expect(calculateSuggestedPages(reading, 12)).toBe(12);
    expect(calculateSuggestedPages(reading, 0)).toBe(15);
  });

  it("passa à próxima leitura quando a cota diária da principal foi atingida", () => {
    const first = makeReading({ id: "first", created_at: "2026-10-20T12:00:00Z" });
    const second = makeReading({ id: "second", created_at: "2026-10-21T12:00:00Z" });

    expect(getSuggestedReading([first, second], 15, "2026-10-24", {
      todayPagesByReading: new Map([["first", 15]]),
    })?.id).toBe("second");
  });

  it("não recomenda leitura quando a meta global diária foi concluída", () => {
    expect(getSuggestedReading([makeReading()], 15, "2026-10-24", {
      dailyGoalReached: true,
    })).toBeNull();
  });

  it("calcula o cronômetro pela cota diária e ritmo da leitura", () => {
    expect(calculateSuggestedTimerDurationSeconds(makeReading({
      target_pages: 100,
      pages_read: 0,
      deadline: "2026-10-28",
      current_speed_pph: 50,
    }), 15, "2026-10-24")).toBe(1_800);
  });
});
