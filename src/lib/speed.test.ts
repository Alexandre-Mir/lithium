import { describe, expect, it } from "vitest";
import { globalAverageSpeedPph, pickInitialSpeed, pickUserPacePagesPerDay, speedFromTotals } from "@/lib/speed";
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

  it.each([
    { sessions: 1, pages_read: 10, total_seconds: 0 },
    { sessions: 1, pages_read: 0, total_seconds: 600 },
  ])("ignora totais inválidos ou sem duração útil", (totals) => {
    expect(speedFromTotals(totals, [], "book")).toBe(20);
  });

  it("usa a referência de 20 p/h quando não há sessões nem estatísticas suficientes", () => {
    expect(speedFromTotals(null, [], "book")).toBe(20);
  });
});

describe("pickUserPacePagesPerDay", () => {
  it("converte a média histórica p/h para páginas por dia", () => {
    expect(pickUserPacePagesPerDay([stat("book", 3, 60, 7_200)])).toBe(30);
  });

  it("usa 15 páginas por dia quando não há histórico aproveitável", () => {
    expect(pickUserPacePagesPerDay([])).toBe(15);
    expect(pickUserPacePagesPerDay([stat("article", 2, 0, 0)])).toBe(15);
  });
});

describe("globalAverageSpeedPph", () => {
  it("calcula a média ponderada entre tipos de leitura", () => {
    expect(globalAverageSpeedPph([
      stat("book", 2, 20, 3_600),
      stat("article", 1, 30, 3_600),
    ])).toBe(25);
  });

  it("usa 20 p/h quando não há segundos úteis", () => {
    expect(globalAverageSpeedPph([stat("book", 1, 20, 0)])).toBe(20);
  });
});
