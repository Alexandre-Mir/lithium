// ============================================================
// Lithium — Regras do Motor Cognitivo e Efeito Cascata
// ============================================================

/**
 * Regra Cronológica de Vínculo:
 * Uma leitura vincula-se à primeira entrega cujo prazo satisfaça:
 * deadline <= entrega.date E deadline > data da entrega anterior.
 *
 * @param entregasOrdenadasPorDataAsc Entregas da mesma matéria, ordenadas por data crescente.
 * @param deadline Data limite da leitura ("YYYY-MM-DD").
 */
export function findLinkedDeliverable<T extends { date: string }>(
  entregasOrdenadasPorDataAsc: T[],
  deadline: string
): T | null {
  for (let i = 0; i < entregasOrdenadasPorDataAsc.length; i++) {
    const entrega = entregasOrdenadasPorDataAsc[i];
    const previousDate =
      i > 0 ? entregasOrdenadasPorDataAsc[i - 1].date : "1970-01-01";

    if (deadline <= entrega.date && deadline > previousDate) {
      return entrega;
    }
  }
  return null;
}
