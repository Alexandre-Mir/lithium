import { describe, expect, it } from "vitest";
import { pickInitialSpeed } from "@/lib/speed";
import type { ReadingSpeedStat } from "@/types/database";

function stat(
  reading_type: ReadingSpeedStat["reading_type"],
  sessions: number,
  total_pages: number,
  total_minutes: number,
): ReadingSpeedStat {
  return { reading_type, sessions, total_pages, total_minutes };
}

describe("pickInitialSpeed", () => {
  it("usa a média do tipo quando há sessões e minutos suficientes", () => {
    expect(pickInitialSpeed([stat("article", 3, 50, 45)], "article")).toBe(66.7);
  });

  it("usa a média global quando o tipo ainda não atingiu o mínimo", () => {
    const stats = [stat("article", 2, 20, 30), stat("book", 2, 25, 30)];
    expect(pickInitialSpeed(stats, "article")).toBe(45);
  });

  it("usa a velocidade padrão quando não há dados suficientes", () => {
    expect(pickInitialSpeed([stat("book", 2, 30, 40)], "article")).toBe(20);
  });

  it("não divide por zero quando os minutos acumulados são zero", () => {
    expect(pickInitialSpeed([stat("article", 3, 30, 0)], "article")).toBe(20);
  });
});
