import { describe, expect, it } from "vitest";
import { validateReadingUpdate } from "@/lib/reading-validation";

describe("validateReadingUpdate", () => {
  it("aceita campos válidos e datas de calendário existentes", () => {
    expect(
      validateReadingUpdate({ title: "Livro", target_pages: 1, deadline: "2028-02-29" }),
    ).toBeNull();
  });

  it("aceita null como ausência de prazo fixo", () => {
    expect(validateReadingUpdate({ deadline: null })).toBeNull();
  });

  it("rejeita título vazio", () => {
    expect(validateReadingUpdate({ title: "   " })).toBe("O título da leitura é obrigatório.");
  });

  it("rejeita meta menor que um ou não inteira", () => {
    expect(validateReadingUpdate({ target_pages: 0 })).toContain("pelo menos 1");
    expect(validateReadingUpdate({ target_pages: 1.5 })).toContain("número inteiro");
  });

  it("rejeita prazos fora do formato ou inexistentes", () => {
    expect(validateReadingUpdate({ deadline: "2026-02-29" })).toContain("prazo válido");
    expect(validateReadingUpdate({ deadline: "24/10/2026" })).toContain("AAAA-MM-DD");
  });
});
