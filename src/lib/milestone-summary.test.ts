import { describe, expect, it } from "vitest";
import {
  nextMilestoneSummaryStatus,
  validateMilestoneSummaryContent,
} from "@/lib/milestone-summary";

describe("milestone summary workflow", () => {
  it("avança pendente para revisão e revisão para concluído", () => {
    expect(nextMilestoneSummaryStatus("pending")).toBe("review");
    expect(nextMilestoneSummaryStatus("review")).toBe("completed");
    expect(nextMilestoneSummaryStatus("completed")).toBeNull();
  });

  it("valida conteúdo não vazio e limita payloads muito grandes", () => {
    expect(validateMilestoneSummaryContent("   ")).toContain("Escreva o resumo");
    expect(validateMilestoneSummaryContent("Resumo do capítulo")).toBeNull();
    expect(validateMilestoneSummaryContent("x".repeat(100_001))).toContain("100.000");
  });
});
