import { describe, expect, it } from "vitest";
import { metadataAttemptLabel, metadataAttemptsSummary } from "./metadata-labels";
import type { MetadataAttempt } from "./book-metadata";

describe("metadataAttemptLabel", () => {
  it("formata status 429 como limite atingido", () => {
    const attempt: MetadataAttempt = {
      provider: "google_books",
      outcome: "http_error",
      httpStatus: 429,
      ms: 120,
    };
    expect(metadataAttemptLabel(attempt)).toBe("limite atingido (429)");
  });

  it("formata erro http genérico com o código http", () => {
    const attempt: MetadataAttempt = {
      provider: "open_library",
      outcome: "http_error",
      httpStatus: 500,
      ms: 200,
    };
    expect(metadataAttemptLabel(attempt)).toBe("http 500");
  });

  it("formata erro http sem código como http ?", () => {
    const attempt: MetadataAttempt = {
      provider: "crossref",
      outcome: "http_error",
      ms: 150,
    };
    expect(metadataAttemptLabel(attempt)).toBe("http ?");
  });

  it("formata timeout como tempo esgotado", () => {
    const attempt: MetadataAttempt = {
      provider: "google_books",
      outcome: "timeout",
      ms: 5000,
    };
    expect(metadataAttemptLabel(attempt)).toBe("tempo esgotado");
  });

  it("formata network como sem conexão", () => {
    const attempt: MetadataAttempt = {
      provider: "google_books",
      outcome: "network",
      ms: 80,
    };
    expect(metadataAttemptLabel(attempt)).toBe("sem conexão");
  });

  it("formata parse_error como resposta inválida", () => {
    const attempt: MetadataAttempt = {
      provider: "crossref",
      outcome: "parse_error",
      ms: 90,
    };
    expect(metadataAttemptLabel(attempt)).toBe("resposta inválida");
  });

  it("formata empty como sem resultado", () => {
    const attempt: MetadataAttempt = {
      provider: "open_library",
      outcome: "empty",
      ms: 110,
    };
    expect(metadataAttemptLabel(attempt)).toBe("sem resultado");
  });
});

describe("metadataAttemptsSummary", () => {
  it("retorna string vazia para array vazio", () => {
    expect(metadataAttemptsSummary([])).toBe("");
  });

  it("formata e concatena tentativas de múltiplos provedores substituindo underscore por espaço", () => {
    const attempts: MetadataAttempt[] = [
      {
        provider: "google_books",
        outcome: "timeout",
        ms: 5000,
      },
      {
        provider: "open_library",
        outcome: "empty",
        ms: 150,
      },
    ];

    expect(metadataAttemptsSummary(attempts)).toBe(
      "google books: tempo esgotado · open library: sem resultado"
    );
  });
});
