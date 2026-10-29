import { describe, expect, it } from "vitest";
import {
  getCurrentMilestone,
  milestonesForSegment,
  parseRawTocToMilestones,
} from "@/lib/toc-parser";

describe("parseRawTocToMilestones", () => {
  it("lê pontos líderes e títulos simples seguidos pela página", () => {
    expect(parseRawTocToMilestones("Introdução ........ 9\nCapítulo 1 ........ 15")).toEqual([
      { title: "Introdução", page: 9 },
      { title: "Capítulo 1", page: 15 },
    ]);
  });

  it("lê numeração, hífen e rótulos de página", () => {
    expect(parseRawTocToMilestones("1. A Origem - pág. 23\n2. O Caminho — página 41")).toEqual([
      { title: "1. A Origem", page: 23 },
      { title: "2. O Caminho", page: 41 },
    ]);
  });

  it("tolera espaços, bullets e ordena os marcos por página", () => {
    expect(parseRawTocToMilestones("• Capítulo final   80\n\n  Capítulo inicial 12")).toEqual([
      { title: "Capítulo inicial", page: 12 },
      { title: "Capítulo final", page: 80 },
    ]);
  });

  it("ignora linhas sem título ou página válida", () => {
    expect(parseRawTocToMilestones("Sumário\n15\nCapítulo sem página\nIntrodução — pág. 0")).toEqual([]);
  });
});

describe("getCurrentMilestone", () => {
  const milestones = parseRawTocToMilestones("Introdução 9\nCapítulo 1 15\nCapítulo 2 42");

  it("retorna null antes do primeiro marco", () => {
    expect(getCurrentMilestone(8, milestones)).toBeNull();
  });

  describe("milestonesForSegment", () => {
    const milestones = parseRawTocToMilestones(
      "Capítulo anterior 120\nCapítulo do trecho 150\nCapítulo seguinte 165\nFinal 181",
    );

    it("converte marcos absolutos para páginas relativas e mantém o capítulo iniciado antes do trecho", () => {
      expect(milestonesForSegment(milestones, 150, 30)).toEqual([
        { title: "Capítulo anterior", page: 0, originalPage: 120 },
        { title: "Capítulo do trecho", page: 0, originalPage: 150 },
        { title: "Capítulo seguinte", page: 15, originalPage: 165 },
      ]);
    });

    it("preserva a numeração original quando a página inicial não foi informada", () => {
      expect(milestonesForSegment(milestones, null, 30)).toEqual(milestones);
    });
  });

  it("retorna o marco atual, inclusive no início exato", () => {
    expect(getCurrentMilestone(15, milestones)).toEqual({ title: "Capítulo 1", page: 15 });
    expect(getCurrentMilestone(20, milestones)).toEqual({ title: "Capítulo 1", page: 15 });
  });

  it("aceita listas fora de ordem", () => {
    expect(getCurrentMilestone(50, [...milestones].reverse())).toEqual({
      title: "Capítulo 2",
      page: 42,
    });
  });
});
