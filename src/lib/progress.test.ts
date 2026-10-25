import { describe, expect, it } from "vitest";
import { computeRemaining } from "@/lib/progress";

describe("computeRemaining", () => {
  it("usa 20 p/h quando ainda não há sessões", () => {
    expect(computeRemaining({ targetPages: 100, pagesRead: 0, speedPph: 0 })).toEqual({
      pagesRemaining: 100,
      hoursRemaining: 5,
      progressPercent: 0,
      overTarget: 0,
      goalReached: false,
    });
  });

  it("desconta as páginas já lidas", () => {
    expect(computeRemaining({ targetPages: 30, pagesRead: 20, speedPph: 20 })).toEqual({
      pagesRemaining: 10,
      hoursRemaining: 0.5,
      progressPercent: 67,
      overTarget: 0,
      goalReached: false,
    });
  });

  it("marca a meta atingida sem carga restante", () => {
    expect(computeRemaining({ targetPages: 30, pagesRead: 30, speedPph: 15 })).toEqual({
      pagesRemaining: 0,
      hoursRemaining: 0,
      progressPercent: 100,
      overTarget: 0,
      goalReached: true,
    });
  });

  it("limita o progresso a 100% e informa o excedente", () => {
    expect(computeRemaining({ targetPages: 30, pagesRead: 35, speedPph: 20 })).toEqual({
      pagesRemaining: 0,
      hoursRemaining: 0,
      progressPercent: 100,
      overTarget: 5,
      goalReached: true,
    });
  });

  it("usa a velocidade de referência quando a velocidade é zero", () => {
    expect(computeRemaining({ targetPages: 30, pagesRead: 20, speedPph: 0 }).hoursRemaining).toBe(0.5);
  });
});
