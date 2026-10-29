import { describe, expect, it } from "vitest";
import {
  absolutePageAtProgress,
  pagesBeforeSession,
  pagesReadFromEndPage,
  type SessionPageRecord,
} from "@/lib/session-pages";

const sessions: SessionPageRecord[] = [
  { id: "later", pages_read: 4, started_at: "2026-10-27T12:00:00.000Z", created_at: "2026-10-27T12:30:00.000Z" },
  { id: "first", pages_read: 8, started_at: null, created_at: "2026-10-27T10:00:00.000Z" },
  { id: "middle", pages_read: 3, started_at: "2026-10-27T11:00:00.000Z", created_at: "2026-10-27T11:30:00.000Z" },
];

describe("pagesBeforeSession", () => {
  it("soma as páginas registradas antes da sessão escolhida", () => {
    expect(pagesBeforeSession(sessions, "middle")).toBe(8);
    expect(pagesBeforeSession(sessions, "later")).toBe(11);
  });

  it("retorna zero para a primeira sessão ou uma sessão ausente", () => {
    expect(pagesBeforeSession(sessions, "first")).toBe(0);
    expect(pagesBeforeSession(sessions, "missing")).toBe(0);
  });
});

describe("pagesReadFromEndPage", () => {
  it("calcula o delta e permite parar exatamente na última página", () => {
    expect(pagesReadFromEndPage(20, 30, 30)).toBe(10);
    expect(pagesReadFromEndPage(29, 30, 30)).toBe(1);
  });

  it("rejeita uma página final fora do intervalo", () => {
    expect(pagesReadFromEndPage(20, 20, 30)).toBeNull();
    expect(pagesReadFromEndPage(20, 31, 30)).toBeNull();
  });

  it("converte páginas finais impressas em progresso relativo do trecho", () => {
    expect(pagesReadFromEndPage(0, 165, 30, 150)).toBe(15);
    expect(pagesReadFromEndPage(15, 170, 30, 150)).toBe(5);
    expect(pagesReadFromEndPage(15, 181, 30, 150)).toBeNull();
    expect(pagesReadFromEndPage(15, 165, 30, 150)).toBeNull();
  });

  it("calcula a página impressa atual ou mantém o progresso relativo sem início de trecho", () => {
    expect(absolutePageAtProgress(15, 150)).toBe(165);
    expect(absolutePageAtProgress(15, null)).toBe(15);
  });
});
