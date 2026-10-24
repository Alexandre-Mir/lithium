export type MetadataProvider = "google_books" | "open_library" | "brasilapi" | "crossref";
export type AttemptOutcome = "ok" | "empty" | "http_error" | "timeout" | "network" | "parse_error";

export interface MetadataAttempt {
  provider: MetadataProvider;
  outcome: AttemptOutcome;
  httpStatus?: number;
  ms: number;
  detail?: string;
}

export interface BookMetadata {
  title: string;
  authors: string;
  pageCount: number | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedYear: number | null;
  source: MetadataProvider;
}

export interface ArticleMetadata extends Omit<BookMetadata, "source"> {
  source: "crossref";
}

export type MetadataResult<T> =
  | { status: "ok"; data: T; attempts: MetadataAttempt[] }
  | { status: "not_found"; attempts: MetadataAttempt[] }
  | {
      status: "error";
      reason: "rate_limited" | "network" | "unknown";
      attempts: MetadataAttempt[];
    };

interface RequestResult {
  body?: unknown;
  status?: number;
  outcome?: AttemptOutcome;
}

interface OpenLibraryItem {
  title?: string;
  authors?: Array<{ name?: string }>;
  number_of_pages?: number;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  cover?: { large?: string; medium?: string };
}

let openQueue: Promise<void> = Promise.resolve();
let lastOpenRequestAt = 0;
let warnedMissingGoogleKey = false;

function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.replace(/^http:\/\//i, "https://").replace(/&edge=curl/g, "");
}

function extractYear(value: unknown): number | null {
  const match = String(value ?? "").match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
}

function requestHeaders(): HeadersInit {
  const contact = process.env.CONTACT_EMAIL;
  return {
    "User-Agent": contact ? `Lithium/0.3 (${contact})` : "Lithium/0.3",
  };
}

function isBrazilianIsbn(isbn: string): boolean {
  return /^(?:978(?:85|65)\d{8}|(?:85|65)\d{7}[\dX])$/.test(isbn);
}

function isValidIsbn(isbn: string): boolean {
  return /^(?:\d{9}[\dX]|\d{13})$/.test(isbn);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function exceptionDetail(error: unknown): string {
  if (error instanceof Error && error.cause && typeof error.cause === "object" && "code" in error.cause) {
    return String(error.cause.code);
  }
  return error instanceof Error ? error.name : "unknown";
}

function redactApiKey(detail: string): string {
  return detail.replace(/([?&]key=)[^&\s"']+/gi, "$1[redacted]");
}

function logFailure(identifier: string, attempts: MetadataAttempt[]): void {
  const summary = attempts
    .map((attempt) => {
      const status = attempt.httpStatus ? ` ${attempt.httpStatus}` : "";
      const detail = attempt.detail ? ` "${redactApiKey(attempt.detail)}"` : "";
      return `${attempt.provider}: ${attempt.outcome}${status}${detail} (${attempt.ms}ms)`;
    })
    .join(" | ");

  console.warn(`[metadata] ${identifier} ${summary}`.trimEnd());
}

function finish<T>(
  identifier: string,
  attempts: MetadataAttempt[],
  budgetExpired = false,
): MetadataResult<T> {
  if (!budgetExpired && attempts.every((attempt) => attempt.outcome === "empty")) {
    logFailure(identifier, attempts);
    return { status: "not_found", attempts };
  }

  const reason = attempts.some((attempt) => attempt.httpStatus === 429)
    ? "rate_limited"
    : attempts.some((attempt) => attempt.outcome === "timeout" || attempt.outcome === "network")
      ? "network"
      : "unknown";

  logFailure(identifier, attempts);
  return { status: "error", reason, attempts };
}

async function waitForOpenLibrarySlot(): Promise<void> {
  let release!: () => void;
  const previous = openQueue;
  openQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  const waitMs = Math.max(0, 1100 - (Date.now() - lastOpenRequestAt));
  if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  lastOpenRequestAt = Date.now();
  release();
}

async function request(
  url: string,
  provider: MetadataProvider,
  timeoutMs: number,
  deadline: number,
  attempts: MetadataAttempt[],
  headers?: HeadersInit,
): Promise<RequestResult> {
  for (let retry = 0; retry < 2 && Date.now() < deadline; retry += 1) {
    const attempt: MetadataAttempt = { provider, outcome: "network", ms: 0 };
    attempts.push(attempt);
    const startedAt = Date.now();
    const controller = new AbortController();
    const remainingMs = deadline - Date.now();
    const timer = setTimeout(
      () => controller.abort(),
      Math.min(timeoutMs, Math.max(1, remainingMs)),
    );

    try {
      const response = await fetch(url, { signal: controller.signal, headers });
      attempt.httpStatus = response.status;
      const responseText = await response.text();
      attempt.ms = Date.now() - startedAt;

      if (!response.ok) {
        attempt.outcome = "http_error";
        if (provider === "google_books") {
          try {
            const payload = JSON.parse(responseText) as { error?: { message?: string } };
            attempt.detail = payload.error?.message?.slice(0, 140);
          } catch {
            // O corpo de erro pode não ser JSON.
          }
        }

        const canRetry = response.status >= 500;
        if (canRetry && retry === 0 && Date.now() + 800 < deadline) {
          await new Promise<void>((resolve) => setTimeout(resolve, 800));
          continue;
        }

        return { status: response.status, outcome: "http_error" };
      }

      try {
        const body = JSON.parse(responseText) as unknown;
        attempt.outcome = "ok";
        return { body, status: response.status, outcome: "ok" };
      } catch {
        attempt.outcome = "parse_error";
        return { status: response.status, outcome: "parse_error" };
      }
    } catch (error) {
      attempt.ms = Date.now() - startedAt;
      attempt.outcome = isAbortError(error) ? "timeout" : "network";
      attempt.detail = exceptionDetail(error);

      if (retry === 0 && Date.now() + 800 < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, 800));
        continue;
      }

      return { status: attempt.httpStatus, outcome: attempt.outcome };
    } finally {
      clearTimeout(timer);
    }
  }

  return { outcome: attempts.at(-1)?.outcome };
}

function googleErrorDetailIsSafeToLog(attempt: MetadataAttempt): void {
  if (attempt.detail) attempt.detail = redactApiKey(attempt.detail).slice(0, 140);
}

async function fetchOpenLibrary(
  isbn: string,
  deadline: number,
  attempts: MetadataAttempt[],
): Promise<BookMetadata | null> {
  await waitForOpenLibrarySlot();
  if (Date.now() >= deadline) return null;

  const result = await request(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    "open_library",
    12000,
    deadline,
    attempts,
    requestHeaders(),
  );
  const payload = result.body as Record<string, OpenLibraryItem | undefined> | undefined;
  const item = payload?.[`ISBN:${isbn}`];

  if (!item?.title) {
    if (result.outcome === "ok") attempts.at(-1)!.outcome = "empty";
    return null;
  }

  return {
    title: item.title,
    authors: (item.authors ?? []).map((author) => author.name).filter(Boolean).join(", "),
    pageCount: item.number_of_pages ?? null,
    coverUrl: cleanUrl(item.cover?.large ?? item.cover?.medium),
    publisher: item.publishers?.[0]?.name ?? null,
    publishedYear: extractYear(item.publish_date),
    source: "open_library",
  };
}

async function fetchBrasilApi(
  isbn: string,
  deadline: number,
  attempts: MetadataAttempt[],
): Promise<BookMetadata | null> {
  const result = await request(
    `https://brasilapi.com.br/api/isbn/v1/${isbn}?providers=cbl,mercado-editorial`,
    "brasilapi",
    8000,
    deadline,
    attempts,
  );

  if (result.status === 404) {
    attempts.at(-1)!.outcome = "empty";
    return null;
  }

  const item = result.body as
    | {
        title?: string;
        subtitle?: string;
        authors?: string[];
        publisher?: string;
        year?: number;
        page_count?: number;
        cover_url?: string | null;
      }
    | undefined;

  if (!item?.title) {
    if (result.outcome === "ok") attempts.at(-1)!.outcome = "empty";
    return null;
  }

  return {
    title: item.subtitle ? `${item.title}: ${item.subtitle}` : item.title,
    authors: item.authors?.join(", ") ?? "",
    pageCount: item.page_count ?? null,
    coverUrl: cleanUrl(item.cover_url),
    publisher: item.publisher ?? null,
    publishedYear: item.year ?? null,
    source: "brasilapi",
  };
}

export async function fetchBookMetadata(rawIsbn: string): Promise<MetadataResult<BookMetadata>> {
  const isbn = rawIsbn.replace(/[^0-9X]/gi, "").toUpperCase();
  const attempts: MetadataAttempt[] = [];
  if (!isValidIsbn(isbn)) return finish(`isbn=${isbn}`, attempts);

  if (!process.env.GOOGLE_BOOKS_API_KEY && !warnedMissingGoogleKey) {
    warnedMissingGoogleKey = true;
    console.warn("[metadata] GOOGLE_BOOKS_API_KEY ausente; Google Books será consultado sem chave.");
  }

  const deadline = Date.now() + 20000;
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const keyQuery = key ? `&key=${encodeURIComponent(key)}` : "";
  const google = await request(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1${keyQuery}`,
    "google_books",
    8000,
    deadline,
    attempts,
  );
  const volume = (
    google.body as
      | {
          items?: Array<{
            volumeInfo?: {
              title?: string;
              authors?: string[];
              pageCount?: number;
              imageLinks?: {
                small?: string;
                medium?: string;
                large?: string;
                thumbnail?: string;
              };
              publisher?: string;
              publishedDate?: string;
            };
          }>;
        }
      | undefined
  )?.items?.[0]?.volumeInfo;

  if (volume?.title) {
    return {
      status: "ok",
      data: {
        title: volume.title,
        authors: volume.authors?.join(", ") ?? "",
        pageCount: volume.pageCount ?? null,
        coverUrl: cleanUrl(
          volume.imageLinks?.large ??
            volume.imageLinks?.medium ??
            volume.imageLinks?.small ??
            volume.imageLinks?.thumbnail,
        ),
        publisher: volume.publisher ?? null,
        publishedYear: extractYear(volume.publishedDate),
        source: "google_books",
      },
      attempts,
    };
  }

  if (google.outcome === "ok") attempts.at(-1)!.outcome = "empty";
  googleErrorDetailIsSafeToLog(attempts[0]);

  if (isBrazilianIsbn(isbn) && Date.now() < deadline) {
    const brasilApi = await fetchBrasilApi(isbn, deadline, attempts);
    if (brasilApi) return { status: "ok", data: brasilApi, attempts };
  }

  if (Date.now() < deadline) {
    const openLibrary = await fetchOpenLibrary(isbn, deadline, attempts);
    if (openLibrary) return { status: "ok", data: openLibrary, attempts };
  }

  return finish(`isbn=${isbn}`, attempts, Date.now() >= deadline);
}

export async function fetchArticleMetadata(rawDoi: string): Promise<MetadataResult<ArticleMetadata>> {
  const doi = rawDoi
    .trim()
    .replace(/^(?:https?:\/\/(?:doi\.org|dx\.doi\.org)\/|doi:)/i, "");
  const attempts: MetadataAttempt[] = [];
  const mailto = process.env.CONTACT_EMAIL
    ? `?mailto=${encodeURIComponent(process.env.CONTACT_EMAIL)}`
    : "";
  const deadline = Date.now() + 20000;
  const result = await request(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}${mailto}`,
    "crossref",
    8000,
    deadline,
    attempts,
  );
  const message = (
    result.body as
      | {
          message?: {
            title?: string[];
            author?: Array<{ given?: string; family?: string }>;
            publisher?: string;
            issued?: { "date-parts"?: number[][] };
          };
        }
      | undefined
  )?.message;

  if (message?.title?.[0]) {
    return {
      status: "ok",
      data: {
        title: message.title[0],
        authors: (message.author ?? [])
          .map((author) => [author.given, author.family].filter(Boolean).join(" "))
          .filter(Boolean)
          .join(", "),
        pageCount: null,
        coverUrl: null,
        publisher: message.publisher ?? null,
        publishedYear: message.issued?.["date-parts"]?.[0]?.[0] ?? null,
        source: "crossref",
      },
      attempts,
    };
  }

  if (result.status === 404 || result.outcome === "ok") attempts.at(-1)!.outcome = "empty";
  return finish(`doi=${doi}`, attempts, Date.now() >= deadline);
}
