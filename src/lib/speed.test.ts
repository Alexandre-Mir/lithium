import { describe, expect, it } from "vitest";
import { pickInitialSpeed, speedFromTotals } from "@/lib/speed";
import type { ReadingSpeedStat } from "@/types/database";

function stat(
  reading_type: ReadingSpeedStat["reading_type"],
  sessions: number,
  total_pages: number,
  total_seconds: number,
): ReadingSpeedStat {
  return { reading_type, sessions, total_pages, total_seconds, total_minutes: Math.round(total_seconds / 60) };
}

describe("pickInitialSpeed", () => {
  it("usa a média do tipo quando há sessões e segundos suficientes", () => {
    expect(pickInitialSpeed([stat("article", 3, 50, 2_700)], "article")).toBe(66.7);
  });

  it("usa a média global quando o tipo ainda não atingiu o mínimo", () => {
    const stats = [stat("article", 2, 20, 1_800), stat("book", 2, 25, 1_800)];
    expect(pickInitialSpeed(stats, "article")).toBe(45);
  });

  it("usa a velocidade padrão quando não há dados suficientes", () => {
    expect(pickInitialSpeed([stat("book", 2, 30, 2_400)], "article")).toBe(20);
  });

  it("não divide por zero quando os segundos acumulados são zero", () => {
    expect(pickInitialSpeed([stat("article", 3, 30, 0)], "article")).toBe(20);
  });
});

describe("speedFromTotals", () => {
  it("calcula a velocidade com precisão de duas casas a partir dos totais", () => {
    expect(speedFromTotals(
      { sessions: 2, pages_read: 5, total_seconds: 900 },
      [],
      "book",
    )).toBe(20);
  });

  it("usa a velocidade inicial do tipo quando não há sessões na leitura", () => {
    expect(speedFromTotals(
      { sessions: 0, pages_read: 0, total_seconds: 0 },
      [stat("article", 3, 50, 2_700)],
      "article",
    )).toBe(66.7);
  });

  it("usa a referência de 20 p/h quando não há sessões nem estatísticas suficientes", () => {
    expect(speedFromTotals(null, [], "book")).toBe(20);
  });
});
