export const SUPABASE_ROW_LIMIT = 1_000;

export function warnIfTruncated<T>(rows: readonly T[], label: string): boolean {
  const truncated = rows.length >= SUPABASE_ROW_LIMIT;
  if (truncated) {
    console.warn(`[truncation] ${label}: resposta atingiu o limite de 1.000 registros do Supabase.`);
  }
  return truncated;
}
