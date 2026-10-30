import { describe, expect, it } from "vitest";
import {
  getReadingCreateErrors,
  validateReadingUpdate,
  validateTargetPagesAgainstProgress,
} from "@/lib/reading-validation";

describe("validateTargetPagesAgainstProgress", () => {
  it("permite uma meta igual ou superior ao progresso e rejeita uma meta inferior", () => {
    expect(validateTargetPagesAgainstProgress(80, 80)).toBeNull();
    expect(validateTargetPagesAgainstProgress(100, 80)).toBeNull();
    expect(validateTargetPagesAgainstProgress(79, 80)).toContain("progresso atual (80 páginas)");
  });
});

describe("validateReadingUpdate", () => {
  it("aceita campos válidos e datas de calendário existentes", () => {
    expect(
      validateReadingUpdate({ title: "Livro", target_pages: 1, deadline: "2028-02-29" }),
    ).toBeNull();
  });

  it("aceita null como ausência de prazo fixo", () => {
    expect(validateReadingUpdate({ deadline: null })).toBeNull();
  });

  it("valida página inicial do trecho em atualizações", () => {
    expect(validateReadingUpdate({ segment_start_page: 150 })).toBeNull();
    expect(validateReadingUpdate({ segment_start_page: 0 })).toContain("página inicial");
    expect(validateReadingUpdate({ segment_start_page: null })).toBeNull();
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

  it("aceita e valida marcos da leitura", () => {
    expect(validateReadingUpdate({ milestones: [{ title: "Introdução", page: 1 }] })).toBeNull();
    expect(validateReadingUpdate({ milestones: [{ title: "", page: 1 }] })).toContain("título e uma página");
    expect(validateReadingUpdate({ milestones: [{ title: "Capítulo", page: 0 }] })).toContain("página válida");
    expect(validateReadingUpdate({ milestones: "sumário" })).toContain("marcos da leitura");
  });
});

describe("getReadingCreateErrors", () => {
  it("exige título, disciplina e uma meta inteira positiva", () => {
    expect(getReadingCreateErrors({ title: " ", subject_id: "", target_pages: 0 })).toEqual({
      title: "Informe o título da leitura.",
      subject_id: "Escolha uma disciplina.",
      target_pages: "Informe um número inteiro de páginas (mínimo: 1).",
    });
  });

  it("exige um prazo válido apenas quando o usuário escolhe prazo fixo", () => {
    expect(
      getReadingCreateErrors({
        title: "Livro",
        subject_id: "subject-id",
        target_pages: 20,
        hasDeadline: true,
        deadline: "",
      }),
    ).toEqual({ deadline: "Informe uma data válida para o prazo." });

    expect(
      getReadingCreateErrors({
        title: "Livro",
        subject_id: "subject-id",
        target_pages: 20,
        hasDeadline: false,
      }),
    ).toEqual({});
  });

  it("valida o total do livro quando informado", () => {
    expect(
      getReadingCreateErrors({
        title: "Livro",
        subject_id: "subject-id",
        target_pages: 20,
        full_book_pages: 1.5,
        hasDeadline: false,
      }),
    ).toEqual({ full_book_pages: "O total do livro deve ser um número inteiro de pelo menos 1 página." });
  });

  it("valida a página inicial impressa do trecho quando informada", () => {
    const base = { title: "Livro", subject_id: "subject-id", target_pages: 30, hasDeadline: false };
    expect(getReadingCreateErrors({ ...base, segment_start_page: 150 })).toEqual({});
    expect(getReadingCreateErrors({ ...base, segment_start_page: 0 })).toEqual({
      segment_start_page: "A página inicial do trecho deve ser um número inteiro positivo.",
    });
  });
});
