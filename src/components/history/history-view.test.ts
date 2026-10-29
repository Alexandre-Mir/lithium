import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ReadingSessionWithReading } from "@/types/database";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/app/actions", () => ({ deleteReadingSession: vi.fn() }));
vi.mock("@/components/reading-session-modal", () => ({
  ReadingSessionModal: () => null,
}));
vi.mock("@/components/confirm-dialog", () => ({ ConfirmDialog: () => null }));

import { HistoryView } from "@/components/history/history-view";

const session: ReadingSessionWithReading = {
  id: "session-1",
  reading_id: "reading-1",
  duration_minutes: 45,
  duration_seconds: 2700,
  started_at: "2026-10-27T12:00:00.000Z",
  ended_at: "2026-10-27T12:45:00.000Z",
  source: "manual",
  pages_read: 12,
  created_at: "2026-10-27T12:45:00.000Z",
  reading: {
    title: "A leitura de teste",
    chapter_title: "Capítulo 2",
    author: "Autora Exemplo",
    type: "book",
    target_pages: 120,
    full_book_pages: 120,
    segment_start_page: null,
    subject: { name: "História", theme_color: "#123456" },
  },
};

describe("HistoryView responsivo", () => {
  it("mostra cards compactos no mobile e mantém a tabela em telas maiores", () => {
    const html = renderToStaticMarkup(
      createElement(HistoryView, { initialSessions: [session] })
    );

    expect(html).toContain("Consistência — últimos 28 dias");
    expect(html).toContain("sm:hidden");
    expect(html).toContain("hidden sm:block");
    expect(html.split("A leitura de teste").length - 1).toBe(2);
    expect(html).toContain("12 p");
    expect(html).toContain("12 páginas");
    expect(html).toContain("Tempo</div>");
    expect(html).toContain("Tempo Gasto");
    expect(html).toContain("Velocidade Calculada");
    expect(html.split("aria-label=\"Editar sessão\"").length - 1).toBe(2);
    expect(html.split("aria-label=\"Excluir sessão\"").length - 1).toBe(2);
  });
});
