import type { ReadingSessionSource } from "@/types/database";

export interface SessionValidationInput {
  pages_read: number;
  duration_seconds: number;
  source: string;
  started_at?: string | null;
  ended_at?: string | null;
}

const SESSION_SOURCES: readonly ReadingSessionSource[] = ["manual", "timer", "timer_adjusted"];

export function validateSessionInput(input: SessionValidationInput): string | null {
  if (!Number.isInteger(input.pages_read) || input.pages_read < 1) {
    return "As páginas lidas devem ser um número inteiro maior ou igual a 1.";
  }
  if (!Number.isInteger(input.duration_seconds) || input.duration_seconds < 1 || input.duration_seconds > 43_200) {
    return "A duração deve ser um número inteiro entre 1 segundo e 12 horas.";
  }
  if (!SESSION_SOURCES.includes(input.source as ReadingSessionSource)) {
    return "A origem da sessão é inválida.";
  }

  if (input.started_at && input.ended_at) {
    const startedAt = Date.parse(input.started_at);
    const endedAt = Date.parse(input.ended_at);
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
      return "As datas de início e fim da sessão são inválidas.";
    }
    if (endedAt < startedAt) return "O fim da sessão não pode ser anterior ao início.";
  }

  return null;
}
