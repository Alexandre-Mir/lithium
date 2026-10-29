import { describe, expect, it } from "vitest";
import { getCrossedMilestones } from "@/lib/milestone-crossing";

const milestones = [
  { title: "Capítulo 3", page: 50 },
  { title: "Capítulo 1", page: 10 },
  { title: "Capítulo 2", page: 30 },
  { title: "Capítulo 4", page: 70 },
];

describe("getCrossedMilestones", () => {
  it("ao alcançar um novo marco, retorna o marco anterior que acabou de ser lido", () => {
    expect(getCrossedMilestones([
      { title: "Parte 1", page: 1 },
      { title: "Parte 2", page: 50 },
    ], 0, 50, 200)).toEqual([
      { title: "Parte 1", page: 1 },
    ]);
  });

  it("mantém o marco anterior ao trecho como referência ao cruzar o primeiro marco interno", () => {
    expect(getCrossedMilestones([
      { title: "Capítulo em andamento", page: 0 },
      { title: "Capítulo seguinte", page: 15 },
    ], 0, 15, 30)).toEqual([
      { title: "Capítulo em andamento", page: 0 },
    ]);
  });

  it("inclui o marco imediatamente anterior a cada transição, em ordem de página", () => {
    expect(getCrossedMilestones(milestones, 10, 70, 100)).toEqual([
      { title: "Capítulo 1", page: 10 },
      { title: "Capítulo 2", page: 30 },
      { title: "Capítulo 3", page: 50 },
    ]);
  });

  it("ao concluir a meta total, também retorna o último marco", () => {
    expect(getCrossedMilestones(milestones, 30, 70, 70)).toEqual([
      { title: "Capítulo 2", page: 30 },
      { title: "Capítulo 3", page: 50 },
      { title: "Capítulo 4", page: 70 },
    ]);
  });

  it("conclui o último marco mesmo sem cruzar uma transição de capítulo", () => {
    expect(getCrossedMilestones(milestones, 70, 100, 100)).toEqual([
      { title: "Capítulo 4", page: 70 },
    ]);
  });

  it("retorna vazio quando a leitura não avança ou não cruza marcos", () => {
    expect(getCrossedMilestones(milestones, 50, 50, 100)).toEqual([]);
    expect(getCrossedMilestones(milestones, 70, 40, 100)).toEqual([]);
    expect(getCrossedMilestones(milestones, 10, 20, 100)).toEqual([]);
  });
});
