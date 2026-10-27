import { describe, expect, it } from "vitest";
import { getCrossedMilestones } from "@/lib/milestone-crossing";

const milestones = [
  { title: "Capítulo 3", page: 50 },
  { title: "Capítulo 1", page: 10 },
  { title: "Capítulo 2", page: 30 },
  { title: "Capítulo 4", page: 70 },
];

describe("getCrossedMilestones", () => {
  it("retorna todos os marcos cruzados, em ordem de página", () => {
    expect(getCrossedMilestones(milestones, 10, 50)).toEqual([
      { title: "Capítulo 2", page: 30 },
      { title: "Capítulo 3", page: 50 },
    ]);
  });

  it("inclui a página de chegada e exclui a página de partida", () => {
    expect(getCrossedMilestones(milestones, 30, 70)).toEqual([
      { title: "Capítulo 3", page: 50 },
      { title: "Capítulo 4", page: 70 },
    ]);
  });

  it("retorna vazio quando a leitura não avança ou não cruza marcos", () => {
    expect(getCrossedMilestones(milestones, 50, 50)).toEqual([]);
    expect(getCrossedMilestones(milestones, 70, 40)).toEqual([]);
    expect(getCrossedMilestones(milestones, 10, 20)).toEqual([]);
  });
});
