"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Pencil, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateDailyGoalMinutes } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeDailyGoalProjection } from "@/lib/projection";

const GOAL_SAVE_DEBOUNCE_MS = 600;

interface DailyGoalCardProps {
  todayReadingMinutes: number;
  goalMinutes: number;
  averageSpeedPph: number;
}

function formatMinutes(minutes: number): string {
  return minutes.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function DailyGoalCard({ todayReadingMinutes, goalMinutes, averageSpeedPph }: DailyGoalCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "debouncing" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSaveTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const saveGoal = useCallback(
    async (minutes: number, closeEditor: boolean) => {
      clearSaveTimer();
      setStatus("saving");
      setError(null);
      try {
        const savedMinutes = await updateDailyGoalMinutes(minutes);
        setDraft(String(savedMinutes));
        setStatus("saved");
        router.refresh();
        if (closeEditor) setEditing(false);
      } catch (saveError: unknown) {
        setStatus("idle");
        setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a meta.");
      }
    },
    [clearSaveTimer, router],
  );

  useEffect(() => clearSaveTimer, [clearSaveTimer]);

  const progressPercent = Math.min(100, (todayReadingMinutes / goalMinutes) * 100);
  const goalReached = todayReadingMinutes >= goalMinutes;
  const goalProjection = computeDailyGoalProjection(todayReadingMinutes, goalMinutes, averageSpeedPph);
  const parsedDraft = Number(draft);
  const draftIsValid = Number.isInteger(parsedDraft) && parsedDraft >= 1 && parsedDraft <= 1440;

  const handleGoalChange = (value: string) => {
    setDraft(value);
    setError(null);
    setStatus("idle");
    clearSaveTimer();

    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return;

    setStatus("debouncing");
    timerRef.current = setTimeout(() => {
      void saveGoal(minutes, false);
    }, GOAL_SAVE_DEBOUNCE_MS);
  };

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Target className={`h-4 w-4 ${goalReached ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-600 dark:text-indigo-400"}`} />
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
              Meta / orçamento cognitivo diário
            </h2>
            {goalReached && (
              <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                <Check className="h-3 w-3" />
                Meta atingida
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
            <span className={`text-xl font-bold ${goalReached ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-gray-100"}`}>
              {formatMinutes(todayReadingMinutes)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">/ {goalMinutes} min</span>
          </div>

          <div
            className="h-2 w-full overflow-hidden rounded-sm border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
            role="progressbar"
            aria-label="Progresso da meta diária de leitura"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
          >
            <div
              className={`h-full transition-[width] ${goalReached ? "bg-emerald-600" : "bg-indigo-600"}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {!goalReached && (
            <p className="text-[11px] text-gray-600 dark:text-gray-400">
              Faltam aprox. {Math.ceil(goalProjection.estimatedMinutesRemaining)} min para bater a meta
              <span className="ml-1 text-gray-500 dark:text-gray-500">
                (~{goalProjection.pagesRemaining} págs. a {averageSpeedPph.toFixed(1)} p/h)
              </span>
            </p>
          )}
        </div>

        <div className="shrink-0">
          {!editing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setDraft(String(goalMinutes));
                setError(null);
                setStatus("idle");
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar Meta
            </Button>
          ) : (
            <div className="w-full space-y-1.5 sm:w-56">
              <label htmlFor="daily-reading-goal" className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                Meta em minutos (1–1.440)
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="daily-reading-goal"
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  value={draft}
                  disabled={status === "saving"}
                  onChange={(event) => handleGoalChange(event.target.value)}
                  className="h-8 font-mono text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!draftIsValid || status === "saving"}
                  onClick={() => void saveGoal(parsedDraft, true)}
                >
                  {status === "saving" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                </Button>
              </div>
              <div className="flex min-h-4 items-center justify-between gap-2 text-[10px]">
                <span className="text-gray-500 dark:text-gray-400" aria-live="polite">
                  {status === "debouncing" && "Salvando após a pausa…"}
                  {status === "saving" && "Salvando…"}
                  {status === "saved" && "Meta salva."}
                </span>
                <button
                  type="button"
                  className="font-semibold text-gray-600 underline-offset-2 hover:underline dark:text-gray-300"
                  disabled={status === "saving"}
                  onClick={() => {
                    clearSaveTimer();
                    setStatus("idle");
                    setEditing(false);
                  }}
                >
                  Fechar
                </button>
              </div>
              {error && <p className="text-[10px] text-red-700 dark:text-red-300">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
