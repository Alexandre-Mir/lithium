import type { MetadataAttempt } from "@/lib/book-metadata";

export function metadataAttemptLabel(attempt: MetadataAttempt): string {
  if (attempt.httpStatus === 429) return "limite atingido (429)";
  if (attempt.outcome === "http_error") return `http ${attempt.httpStatus ?? "?"}`;
  if (attempt.outcome === "timeout") return "tempo esgotado";
  if (attempt.outcome === "network") return "sem conexão";
  if (attempt.outcome === "parse_error") return "resposta inválida";
  return "sem resultado";
}

export function metadataAttemptsSummary(attempts: MetadataAttempt[]): string {
  return attempts.map((attempt) => `${attempt.provider.replace("_", " ")}: ${metadataAttemptLabel(attempt)}`).join(" · ");
}
