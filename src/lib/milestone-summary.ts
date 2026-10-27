import type { MilestoneSummaryStatus } from "@/types/database";

export function nextMilestoneSummaryStatus(
  status: MilestoneSummaryStatus,
): MilestoneSummaryStatus | null {
  if (status === "pending") return "review";
  if (status === "review") return "completed";
  return null;
}

export function validateMilestoneSummaryContent(content: string): string | null {
  if (!content.trim()) return "Escreva o resumo antes de enviar.";
  if (content.length > 100_000) return "O resumo deve ter no máximo 100.000 caracteres.";
  return null;
}
