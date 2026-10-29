import { describe, expect, it } from "vitest";
import { toTitleCaseBR } from "@/lib/text";

describe("toTitleCaseBR", () => {
  it("capitaliza palavras simples", () => {
    expect(toTitleCaseBR("psicologia")).toBe("Psicologia");
  });

  it("mantém partículas em minúscula, exceto no início", () => {
    expect(toTitleCaseBR("a história da ciência e do conhecimento"))
      .toBe("A História da Ciência e do Conhecimento");
  });

  it("preserva as siglas ISBN e DOI", () => {
    expect(toTitleCaseBR("isbn e doi")).toBe("ISBN e DOI");
  });

  it("capitaliza nomes compostos e palavras após hífen ou apóstrofo", () => {
    expect(toTitleCaseBR("ana maria d'ávila e jean-luc"))
      .toBe("Ana Maria D'Ávila e Jean-Luc");
  });

  it("mantém textos já formatados e preserva pontuação e espaços", () => {
    expect(toTitleCaseBR("  Aprendizagem ao Longo da Vida! "))
      .toBe("  Aprendizagem ao Longo da Vida! ");
  });
});
