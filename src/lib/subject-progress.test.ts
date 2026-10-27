import { describe, expect, it } from "vitest";
import { computeSubjectPageProgress } from "@/lib/subject-progress";

describe("computeSubjectPageProgress", () => {
  it("calcula páginas lidas sobre a meta total da disciplina", () => {
    expect(computeSubjectPageProgress([
      { pagesRead: 20, targetPages: 30 },
      { pagesRead: 15, targetPages: 20 },
    ])).toEqual({ totalPagesRead: 35, totalTargetPages: 50, progressPercent: 70 });
  });

  it("limita a barra a 100% e trata uma meta vazia", () => {
    expect(computeSubjectPageProgress([{ pagesRead: 12, targetPages: 10 }]).progressPercent).toBe(100);
    expect(computeSubjectPageProgress([])).toEqual({
      totalPagesRead: 0,
      totalTargetPages: 0,
      progressPercent: 0,
    });
  });
});
