import type { ReadingType } from "@/types/database";

export interface BookMetadata {
  title: string;
  authors: string;
  pageCount: number | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedYear: number | null;
  source: "google_books" | "open_library";
}

export interface ArticleMetadata {
  title: string;
  authors: string;
  pageCount: number | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedYear: number | null;
  source: "crossref";
}

export type MetadataResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_found" }
  | { status: "error"; reason: "rate_limited" | "network" | "unknown" };

const OPEN_LIBRARY_INTERVAL = 1100;
let openLibraryQueue: Promise<void> = Promise.resolve();
let lastOpenLibraryRequest = 0;

function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.replace(/^http:\/\//i, "https://").replace(/&edge=curl/g, "");
}

function yearFrom(value: unknown): number | null {
  const match = String(value ?? "").match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
}

function contactHeaders(): HeadersInit {
  const email = process.env.CONTACT_EMAIL;
  return { "User-Agent": email ? `Lithium/0.3 (${email})` : "Lithium/0.3" };
}

async function fetchJson(url: string, timeoutMs = 8000, headers?: HeadersInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForOpenLibrarySlot() {
  let release!: () => void;
  const previous = openLibraryQueue;
  openLibraryQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const delay = Math.max(0, OPEN_LIBRARY_INTERVAL - (Date.now() - lastOpenLibraryRequest));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  lastOpenLibraryRequest = Date.now();
  release();
}

async function fetchOpenLibrary(isbn: string): Promise<MetadataResult<BookMetadata>> {
  await waitForOpenLibrarySlot();
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const response = await fetchJson(url, 8000, contactHeaders());
    if (response.status === 429) return { status: "error", reason: "rate_limited" };
    if (!response.ok) return { status: "error", reason: response.status >= 500 ? "network" : "unknown" };
    const json = (await response.json()) as Record<string, {
      title?: string;
      authors?: Array<{ name?: string }>;
      number_of_pages?: number;
      publishers?: Array<{ name?: string }>;
      publish_date?: string;
      cover?: { medium?: string; large?: string };
    }>;
    const item = json[`ISBN:${isbn}`];
    if (!item) return { status: "not_found" };
    return {
      status: "ok",
      data: {
        title: item.title ?? "",
        authors: (item.authors ?? []).map((author) => author.name).filter(Boolean).join(", "),
        pageCount: item.number_of_pages ?? null,
        coverUrl: cleanUrl(item.cover?.medium ?? item.cover?.large),
        publisher: item.publishers?.[0]?.name ?? null,
        publishedYear: yearFrom(item.publish_date),
        source: "open_library",
      },
    };
  } catch (error) {
    return { status: "error", reason: error instanceof DOMException && error.name === "AbortError" ? "network" : "network" };
  }
}

export async function fetchBookMetadata(isbn: string): Promise<MetadataResult<BookMetadata>> {
  const cleanIsbn = isbn.replace(/[^0-9X]/gi, "").toUpperCase();
  if (![10, 13].includes(cleanIsbn.length)) return { status: "not_found" };
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&maxResults=1${key ? `&key=${encodeURIComponent(key)}` : ""}`;
  try {
    const response = await fetchJson(googleUrl);
    if (response.ok) {
      const json = (await response.json()) as { items?: Array<{ volumeInfo?: { title?: string; authors?: string[]; pageCount?: number; imageLinks?: { thumbnail?: string; smallThumbnail?: string }; publisher?: string; publishedDate?: string } }> };
      const volume = json.items?.[0]?.volumeInfo;
      if (volume) {
        return { status: "ok", data: { title: volume.title ?? "", authors: volume.authors?.join(", ") ?? "", pageCount: volume.pageCount ?? null, coverUrl: cleanUrl(volume.imageLinks?.thumbnail ?? volume.imageLinks?.smallThumbnail), publisher: volume.publisher ?? null, publishedYear: yearFrom(volume.publishedDate), source: "google_books" } };
      }
    } else if (response.status === 429) {
      return fetchOpenLibrary(cleanIsbn);
    } else if (response.status >= 500) {
      return fetchOpenLibrary(cleanIsbn);
    }
  } catch {
    return fetchOpenLibrary(cleanIsbn);
  }
  return fetchOpenLibrary(cleanIsbn);
}

export async function fetchArticleMetadata(doi: string): Promise<MetadataResult<ArticleMetadata>> {
  const cleanDoi = doi.trim().replace(/^(?:https?:\/\/(?:doi\.org|dx\.doi\.org)\/|doi:)/i, "");
  if (!cleanDoi) return { status: "not_found" };
  const mailto = process.env.CONTACT_EMAIL ? `?mailto=${encodeURIComponent(process.env.CONTACT_EMAIL)}` : "";
  try {
    const response = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}${mailto}`);
    if (response.status === 429) return { status: "error", reason: "rate_limited" };
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return { status: "error", reason: response.status >= 500 ? "network" : "unknown" };
    const message = (await response.json() as { message?: { title?: string[]; author?: Array<{ given?: string; family?: string }>; publisher?: string; issued?: { "date-parts"?: number[][] } } }).message;
    if (!message) return { status: "not_found" };
    return { status: "ok", data: { title: message.title?.[0] ?? "", authors: (message.author ?? []).map((author) => [author.given, author.family].filter(Boolean).join(" ")).filter(Boolean).join(", "), pageCount: null, coverUrl: null, publisher: message.publisher ?? null, publishedYear: message.issued?.["date-parts"]?.[0]?.[0] ?? null, source: "crossref" } };
  } catch {
    return { status: "error", reason: "network" };
  }
}

export type ReadingMetadataType = ReadingType;
