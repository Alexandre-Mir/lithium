import { describe, expect, it } from "vitest";
import {
  REVIEW_ESTIMATE_MINUTES,
  capSuggestedPagesToBudget,
  computeCognitiveBudget,
  estimateTier2MinutesToday,
  minutesToPages,
  pagesToMinutes,
  reservedMinutesExcludingReading,
} from "@/lib/cognitive-budget";

describe("cognitive-budget", () => {
  it("estima minutos de revisão e de cota Tier 2", () => {
    expect(REVIEW_ESTIMATE_MINUTES).toBe(15);
    // 40 páginas a 40 p/h em 2 dias → 20 págs/dia → 30 min
    expect(estimateTier2MinutesToday({
      id: "a",
      target_pages: 100,
      pages_read: 60,
      deadline: "2026-10-26",
      current_speed_pph: 40,
    }, 15, "2026-10-24")).toBe(30);
  });

  it("converte páginas ↔ minutos com velocidade segura", () => {
    expect(pagesToMinutes(40, 40)).toBe(60);
    expect(minutesToPages(60, 40)).toBe(40);
    expect(pagesToMinutes(20, 0)).toBe(60); // fallback 20 p/h
  });

  it("detecta sobrecarga quando T1 + T2 excedem o orçamento", () => {
    const result = computeCognitiveBudget({
      budgetMinutes: 60,
      reviewCount: 2, // 30 min
      tier2Readings: [{
        id: "urgent",
        target_pages: 100,
        pages_read: 0,
        deadline: "2026-10-25",
        current_speed_pph: 20,
      }], // 100 págs em 1 dia a 20 p/h → 300 min
      userPace: 15,
      today: "2026-10-24",
    });

    expect(result.tier1Minutes).toBe(30);
    expect(result.tier2Minutes).toBe(300);
    expect(result.demandedMinutes).toBe(330);
    expect(result.isOverloaded).toBe(true);
    expect(result.overloadMinutes).toBe(270);
    expect(result.availableAfterReviewsMinutes).toBe(30);
  });

  it("não marca sobrecarga quando a demanda cabe no orçamento", () => {
    const result = computeCognitiveBudget({
      budgetMinutes: 120,
      reviewCount: 1,
      tier2Readings: [{
        id: "light",
        target_pages: 40,
        pages_read: 20,
        deadline: "2026-10-28",
        current_speed_pph: 40,
      }], // 5 págs/dia → 7.5 min
      userPace: 15,
      today: "2026-10-24",
    });

    expect(result.isOverloaded).toBe(false);
    expect(result.overloadMinutes).toBe(0);
    expect(result.demandedMinutes).toBeLessThanOrEqual(120);
  });

  it("limita a meta de páginas ao restante do orçamento cognitivo", () => {
    expect(capSuggestedPagesToBudget({
      suggestedPages: 30,
      speedPph: 30,
      budgetMinutes: 90,
      reservedMinutes: 60, // sobram 30 min → 15 págs a 30 p/h
    })).toBe(15);

    expect(capSuggestedPagesToBudget({
      suggestedPages: 30,
      speedPph: 30,
      budgetMinutes: 60,
      reservedMinutes: 60,
    })).toBe(0);
  });

  it("reserva T1 + demais T2 ao excluir a leitura recomendada", () => {
    const tier2 = [
      {
        id: "keep",
        target_pages: 100,
        pages_read: 0,
        deadline: "2026-10-25",
        current_speed_pph: 20,
      },
      {
        id: "recommended",
        target_pages: 100,
        pages_read: 0,
        deadline: "2026-10-26",
        current_speed_pph: 20,
      },
    ];
    const budget = computeCognitiveBudget({
      budgetMinutes: 90,
      reviewCount: 2,
      tier2Readings: tier2,
      userPace: 15,
      today: "2026-10-24",
    });

    const reserved = reservedMinutesExcludingReading(
      budget,
      tier2,
      15,
      "recommended",
      "2026-10-24",
    );
    // 2 revisões (30) + T2 "keep" (100p/1d a 20p/h = 300 min)
    expect(reserved).toBe(30 + 300);
    expect(reserved).toBeLessThan(budget.tier1Minutes + budget.tier2Minutes);
  });
});
