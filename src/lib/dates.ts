// ============================================================
// Lithium — Utilitários de Datas com Fuso Fixo (America/Sao_Paulo)
// Funções puras, seguras para execução no servidor e no cliente.
// ============================================================

export const APP_TIMEZONE = "America/Sao_Paulo";

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Retorna a data atual no fuso America/Sao_Paulo no formato "YYYY-MM-DD".
 */
export function todayISO(): string {
  return isoFormatter.format(new Date());
}

/**
 * Adiciona `n` dias de calendário a uma string de data "YYYY-MM-DD" via Date.UTC,
 * retornando a nova data no formato "YYYY-MM-DD" sem depender do fuso da máquina.
 */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converte a meia-noite de uma data em São Paulo para um timestamp UTC.
 * Útil para montar intervalos SQL sem assumir o fuso da máquina do servidor.
 */
export function startOfDayUtcISO(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day);
  let timestamp = targetAsUtc;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
    );
    const representedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const adjusted = timestamp + targetAsUtc - representedAsUtc;
    if (adjusted === timestamp) break;
    timestamp = adjusted;
  }

  return new Date(timestamp).toISOString();
}

/**
 * Calcula a diferença em dias de calendário entre duas datas "YYYY-MM-DD" via Date.UTC.
 * Retorna positivo se `ateISO` for posterior a `deISO`.
 */
export function daysBetweenISO(deISO: string, ateISO: string): number {
  const [y1, m1, d1] = deISO.split("-").map(Number);
  const [y2, m2, d2] = ateISO.split("-").map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / MS_PER_DAY);
}

/**
 * Retorna quantos dias faltam de hoje (hoje no fuso America/Sao_Paulo) até a data ISO especificada.
 */
export function daysUntil(iso: string): number {
  return daysBetweenISO(todayISO(), iso);
}

/**
 * Formata data ISO ("YYYY-MM-DD") para padrão pt-BR ("DD/MM/YYYY" ou "DD/MM").
 */
export function formatDateBR(
  iso: string,
  options?: { day?: "2-digit" | "numeric"; month?: "2-digit" | "numeric"; year?: "numeric" }
): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!d || !m || !y) return iso;
  if (options && options.day === "2-digit" && options.month === "2-digit" && !options.year) {
    return `${d}/${m}`;
  }
  return `${d}/${m}/${y}`;
}

/**
 * Formata timestamp (ISO string, Date ou ms) para data/hora pt-BR com timeZone fixo America/Sao_Paulo.
 */
export function formatDateTimeBR(timestamp: string | Date | number): string {
  if (!timestamp) return "";
  const date =
    typeof timestamp === "string" || typeof timestamp === "number"
      ? new Date(timestamp)
      : timestamp;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Formata a data atual por extenso em pt-BR com timeZone fixo America/Sao_Paulo.
 * Evita hydration mismatch entre servidor (ex: UTC no Linux/Vercel) e navegador.
 */
export function formatTodayLongBR(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}
