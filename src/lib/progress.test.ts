import { describe, expect, it } from "vitest";
import { computeRemaining, sumPendingLoad } from "@/lib/progress";

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

  it("zera a projeção de uma leitura concluída e mantém o excedente", () => {
    expect(computeRemaining({ targetPages: 30, pagesRead: 35, speedPph: 20, isRead: true })).toEqual({
      pagesRemaining: 0,
      hoursRemaining: 0,
      progressPercent: 100,
      overTarget: 5,
      goalReached: true,
    });
  });

  it("mantém a projeção normal quando isRead é false", () => {
    expect(computeRemaining({ targetPages: 30, pagesRead: 20, speedPph: 20, isRead: false })).toEqual({
      pagesRemaining: 10,
      hoursRemaining: 0.5,
      progressPercent: 67,
      overTarget: 0,
      goalReached: false,
    });
  });

  it("soma apenas a carga de leituras pendentes", () => {
    expect(sumPendingLoad([
      { target_pages: 30, pages_read: 20, current_speed_pph: 20, is_read: false },
      { target_pages: 100, pages_read: 0, current_speed_pph: 20, is_read: true },
    ])).toEqual({ pagesRemaining: 10, hoursRemaining: 0.5 });
  });
});
