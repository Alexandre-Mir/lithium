import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetadataAttempt } from "@/lib/book-metadata";

function createResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function loadMetadata() {
  vi.resetModules();
  return import("@/lib/book-metadata");
}

function linkedAttempts(attempts: MetadataAttempt[], provider: MetadataAttempt["provider"]) {
  return attempts.filter((attempt) => attempt.provider === provider);
}

const isbn = "9780306406157";
const openLibraryPayload = {
  [`ISBN:${isbn}`]: {
    title: "Livro da Open Library",
    authors: [{ name: "Pessoa Autora" }],
    number_of_pages: 240,
    publishers: [{ name: "Editora Exemplo" }],
    publish_date: "2020",
    cover: { large: "http://covers.openlibrary.org/b/id/42-L.jpg&edge=curl" },
  },
};

describe("provedores de metadados", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "test-key");
    vi.stubEnv("CONTACT_EMAIL", "contato@example.com");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("normaliza os metadados de uma resposta do Google Books", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValueOnce(
      createResponse({
        items: [
          {
            volumeInfo: {
              title: "Livro do Google",
              authors: ["Ana Silva", "João Souza"],
              pageCount: 320,
              publisher: "Editora Google",
              publishedDate: "2021-04-12",
              imageLinks: {
                thumbnail: "http://books.google.com/cover?zoom=1&edge=curl",
                medium: "https://books.google.com/cover?zoom=1",
                large: "https://books.google.com/cover?zoom=1&source=large",
              },
            },
          },
        ],
      }),
    );
    const metadata = await loadMetadata();

    const result = await metadata.fetchBookMetadata(isbn);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("Esperava sucesso do Google Books");
    expect(result.data).toEqual({
      title: "Livro do Google",
      authors: "Ana Silva, João Souza",
      pageCount: 320,
      coverUrl: "https://books.google.com/cover?zoom=1&source=large",
      publisher: "Editora Google",
      publishedYear: 2021,
      source: "google_books",
    });
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].outcome).toBe("ok");
    expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
  });

  it("usa Open Library depois de uma resposta 429 do Google", async () => {
    const fetchMock = stubFetch();
    fetchMock
      .mockResolvedValueOnce(createResponse({ error: { message: "limite" } }, 429))
      .mockResolvedValueOnce(createResponse(openLibraryPayload));
    const metadata = await loadMetadata();

    const result = await metadata.fetchBookMetadata(isbn);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("Esperava fallback da Open Library");
    expect(result.data.source).toBe("open_library");
    expect(result.data.coverUrl).toBe("https://covers.openlibrary.org/b/id/42-L.jpg");
    expect(linkedAttempts(result.attempts, "google_books")[0].httpStatus).toBe(429);
    expect(String(fetchMock.mock.calls[1][0])).toContain("openlibrary.org/api/books");
  });

  it("preserva no diagnóstico a mensagem HTTP do Google ao usar o fallback", async () => {
    const fetchMock = stubFetch();
    fetchMock
      .mockResolvedValueOnce(
        createResponse({ error: { message: "API key not valid. Please pass a valid key." } }, 403),
      )
      .mockResolvedValueOnce(createResponse(openLibraryPayload));
    const metadata = await loadMetadata();

    const result = await metadata.fetchBookMetadata(isbn);

    expect(result.status).toBe("ok");
    expect(result.attempts[0].detail).toBe("API key not valid. Please pass a valid key.");
  });

  it("retorna not_found somente quando Google e Open Library responderam vazio", async () => {
    const fetchMock = stubFetch();
    fetchMock
      .mockResolvedValueOnce(createResponse({ items: [] }))
      .mockResolvedValueOnce(createResponse({}));
    const metadata = await loadMetadata();

    const result = await metadata.fetchBookMetadata(isbn);

    expect(result.status).toBe("not_found");
    expect(result.attempts.map((attempt) => attempt.outcome)).toEqual(["empty", "empty"]);
  });

  it("mantém erro de rede quando Google falha e Open Library expira", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    const fetchMock = stubFetch();
    fetchMock.mockImplementation((input, init) => {
      if (String(input).includes("googleapis.com")) {
        return Promise.resolve(createResponse({ error: { message: "temporário" } }, 500));
      }

      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("tempo limite", "AbortError")),
          { once: true },
        );
      });
    });
    const metadata = await loadMetadata();
    const resultPromise = metadata.fetchBookMetadata(isbn);

    await vi.advanceTimersByTimeAsync(25000);
    const result = await resultPromise;

    expect(result.status).toBe("error");
    if (result.status !== "error") throw new Error("Esperava erro de rede");
    expect(result.reason).toBe("network");
    expect(linkedAttempts(result.attempts, "google_books")).toHaveLength(2);
    expect(linkedAttempts(result.attempts, "open_library").length).toBeGreaterThanOrEqual(1);
    expect(result.attempts.some((attempt) => attempt.outcome === "timeout")).toBe(true);
  });

  it("repete uma requisição em 5xx uma vez", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    const fetchMock = stubFetch();
    fetchMock
      .mockResolvedValueOnce(createResponse({ error: { message: "temporário" } }, 503))
      .mockResolvedValueOnce(createResponse({
        items: [{ volumeInfo: { title: "Resultado após retry" } }],
      }));
    const metadata = await loadMetadata();
    const resultPromise = metadata.fetchBookMetadata(isbn);

    await vi.advanceTimersByTimeAsync(800);
    const result = await resultPromise;

    expect(result.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.attempts).toHaveLength(2);
  });

  it("não chama provedores para ISBN inválido", async () => {
    const fetchMock = stubFetch();
    const metadata = await loadMetadata();

    const result = await metadata.fetchBookMetadata("livro sem ISBN");

    expect(result.status).toBe("not_found");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("consulta a BrasilAPI antes da Open Library para ISBNs brasileiros", async () => {
    const fetchMock = stubFetch();
    fetchMock
      .mockResolvedValueOnce(createResponse({ items: [] }))
      .mockResolvedValueOnce(createResponse({ message: "ISBN não encontrado" }, 404))
      .mockResolvedValueOnce(
        createResponse({
          "ISBN:9788500000000": {
            title: "Livro brasileiro",
            authors: [{ name: "Autora brasileira" }],
          },
        }),
      );
    const metadata = await loadMetadata();

    const result = await metadata.fetchBookMetadata("9788500000000");

    expect(result.status).toBe("ok");
    expect(String(fetchMock.mock.calls[0][0])).toContain("googleapis.com");
    expect(String(fetchMock.mock.calls[1][0])).toContain("brasilapi.com.br/api/isbn/v1/");
    expect(String(fetchMock.mock.calls[2][0])).toContain("openlibrary.org/api/books");
  });

  it("normaliza o prefixo DOI e extrai dados do Crossref", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValueOnce(
      createResponse({
        message: {
          title: ["Artigo acadêmico"],
          author: [{ given: "Maria", family: "Silva" }],
          publisher: "Editora Científica",
          issued: { "date-parts": [[2022, 5, 10]] },
        },
      }),
    );
    const metadata = await loadMetadata();

    const result = await metadata.fetchArticleMetadata("https://doi.org/10.1000/exemplo");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("Esperava sucesso do Crossref");
    expect(result.data.title).toBe("Artigo acadêmico");
    expect(result.data.authors).toBe("Maria Silva");
    expect(result.data.publishedYear).toBe(2022);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/works/10.1000%2Fexemplo");
    expect(String(fetchMock.mock.calls[0][0])).toContain("mailto=contato%40example.com");
  });

  it("classifica 404 do Crossref como vazio", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValueOnce(createResponse({ message: "não encontrado" }, 404));
    const metadata = await loadMetadata();

    const result = await metadata.fetchArticleMetadata("10.1000/inexistente");

    expect(result.status).toBe("not_found");
    expect(result.attempts[0].outcome).toBe("empty");
  });

  it("classifica 429 do Crossref como rate_limited sem repetir", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValueOnce(createResponse({ message: "limite" }, 429));
    const metadata = await loadMetadata();

    const result = await metadata.fetchArticleMetadata("doi:10.1000/limite");

    expect(result.status).toBe("error");
    if (result.status !== "error") throw new Error("Esperava erro de limite");
    expect(result.reason).toBe("rate_limited");
    expect(result.attempts).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
