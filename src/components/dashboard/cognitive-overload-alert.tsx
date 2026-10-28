import { AlertTriangle } from "lucide-react";

export interface CognitiveBudgetSummary {
  budgetMinutes: number;
  demandedMinutes: number;
  tier1Minutes: number;
  tier2Minutes: number;
  isOverloaded: boolean;
  overloadMinutes: number;
  pagesCapped: boolean;
}

interface CognitiveOverloadAlertProps {
  budget: CognitiveBudgetSummary;
  recommendedPages: number;
}

function formatMinutes(minutes: number): string {
  return Math.round(minutes).toLocaleString("pt-BR");
}

export function CognitiveOverloadAlert({
  budget,
  recommendedPages,
}: CognitiveOverloadAlertProps) {
  if (!budget.isOverloaded) return null;

  return (
    <section
      role="status"
      className="rounded-md border border-amber-400 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-xs font-bold uppercase tracking-wide">
            Sobrecarga cognitiva
          </h2>
          <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            Revisões (Tier 1: ~{formatMinutes(budget.tier1Minutes)} min) e prazos em zona de
            perigo (Tier 2: ~{formatMinutes(budget.tier2Minutes)} min) somam{" "}
            <span className="font-mono font-semibold">
              ~{formatMinutes(budget.demandedMinutes)} min
            </span>
            , acima do orçamento diário de{" "}
            <span className="font-mono font-semibold">{formatMinutes(budget.budgetMinutes)} min</span>
            {" "}(+{formatMinutes(budget.overloadMinutes)} min).
          </p>
          {budget.pagesCapped && (
            <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
              Meta de páginas da recomendação ajustada para{" "}
              <span className="font-mono">{recommendedPages}</span> pág.
              {recommendedPages === 0
                ? " — orçamento reservado para revisões e prazos."
                : " para não exceder o limite cognitivo do dia."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
