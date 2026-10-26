"use client";

import { useState } from "react";
import { createReadingSession } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { elapsedSeconds, type TimerState } from "@/lib/reading-timer";
import { formatDuration, pph } from "@/lib/session-time";
import { validateSessionInput } from "@/lib/session-validation";
import type { ReadingSessionSource } from "@/types/database";
import { Check, Zap } from "lucide-react";

export interface ReadingSessionTarget {
  id: string;
  title: string;
}

type SessionMode = "manual" | "timer";

interface ReadingSessionModalProps {
  reading: ReadingSessionTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: SessionMode;
  timerState?: TimerState | null;
  endedAt?: string | null;
  onDiscardTimer?: () => void;
}

function formatTimerInput(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function parseTimerInput(value: string): number | null {
  const match = /^(\d{1,4}):(\d{2})$/.exec(value.trim());
  if (!match || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function ReadingSessionModalContent({
  reading,
  mode,
  timerState,
  endedAt,
  onClose,
  onSuccess,
  onDiscardTimer,
}: {
  reading: ReadingSessionTarget;
  mode: SessionMode;
  timerState: TimerState | null;
  endedAt: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  onDiscardTimer?: () => void;
}) {
  const measuredSeconds = mode === "timer" && timerState ? elapsedSeconds(timerState) : 0;
  const [durationMinutes, setDurationMinutes] = useState("25");
  const [timerInput, setTimerInput] = useState(() => formatTimerInput(measuredSeconds));
  const [pagesInput, setPagesInput] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationSeconds = mode === "manual"
    ? (/^\d+$/.test(durationMinutes) ? Number(durationMinutes) * 60 : 0)
    : (parseTimerInput(timerInput) ?? 0);
  const pagesRead = /^\d+$/.test(pagesInput) ? Number(pagesInput) : 0;
  const previewSpeed = durationSeconds > 0 && pagesRead > 0
    ? pph(pagesRead, durationSeconds)
    : null;
  const source: ReadingSessionSource = mode === "manual"
    ? "manual"
    : Math.abs(durationSeconds - measuredSeconds) > 5
      ? "timer_adjusted"
      : "timer";
  const durationWarning = mode === "timer" && measuredSeconds > 10_800;
  const tooShortToSave = mode === "timer" && measuredSeconds < 30;

  const validationInput = {
    pages_read: pagesRead,
    duration_seconds: durationSeconds,
    source,
    started_at: mode === "timer" ? timerState?.startedAt ?? null : null,
    ended_at: mode === "timer" ? endedAt : null,
  };
  const validationMessage = validateSessionInput(validationInput);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    if (mode === "timer" && !timerState) {
      setError("Não foi possível recuperar o cronômetro desta sessão.");
      return;
    }

    try {
      setLoading(true);
      await createReadingSession({
        reading_id: reading.id,
        pages_read: pagesRead,
        duration_seconds: durationSeconds,
        started_at: mode === "timer" ? timerState?.startedAt : null,
        ended_at: mode === "timer" ? endedAt : null,
        source,
      });
      onSuccess?.();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao registrar sessão de leitura.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md rounded-md border border-gray-200 dark:border-gray-800">
      <DialogHeader>
        <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[11px] uppercase tracking-wider mb-1">
          <Zap className="w-3.5 h-3.5 text-indigo-500" />
          Calibração Cognitiva
        </div>
        <DialogTitle className="text-base font-bold">
          {mode === "timer" ? "Finalizar sessão cronometrada" : "Registrar Sessão de Leitura"}
        </DialogTitle>
        <DialogDescription className="line-clamp-1 text-xs">{reading.title}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {mode === "manual" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="duration-minutes" className="text-xs font-semibold">Tempo (minutos)</Label>
              <Input
                id="duration-minutes"
                type="number"
                min="1"
                max="720"
                step="1"
                required
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                className="font-mono text-xs h-8 rounded border-gray-300 dark:border-gray-700"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pages-read" className="text-xs font-semibold">Páginas lidas</Label>
              <Input
                id="pages-read"
                type="number"
                min="1"
                step="1"
                required
                value={pagesInput}
                onChange={(event) => setPagesInput(event.target.value)}
                className="font-mono text-xs h-8 rounded border-gray-300 dark:border-gray-700"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="timer-duration" className="text-xs font-semibold">Tempo (mm:ss)</Label>
                <Input
                  id="timer-duration"
                  inputMode="numeric"
                  required
                  value={timerInput}
                  onChange={(event) => setTimerInput(event.target.value)}
                  aria-invalid={parseTimerInput(timerInput) === null}
                  className="font-mono text-xs h-8 rounded border-gray-300 dark:border-gray-700"
                />
                <p className="text-[10px] text-gray-500">Medido: {formatDuration(measuredSeconds)}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="timer-pages-read" className="text-xs font-semibold">Páginas lidas</Label>
                <Input
                  id="timer-pages-read"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={pagesInput}
                  onChange={(event) => setPagesInput(event.target.value)}
                  className="font-mono text-xs h-8 rounded border-gray-300 dark:border-gray-700"
                />
              </div>
            </div>
            {durationWarning && (
              <p className="border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">Cronômetro aberto há mais de 3 h; confirme o tempo.</p>
            )}
            {tooShortToSave && (
              <div className="border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 flex items-center justify-between gap-2">
                <span>Menos de 30 s medidos. Descarte este cronômetro em vez de salvar.</span>
                <Button type="button" variant="outline" size="sm" onClick={onDiscardTimer}>Descartar</Button>
              </div>
            )}
          </>
        )}

        {previewSpeed !== null && (
          <div className="rounded border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950 px-2.5 py-1.5 text-xs flex items-center justify-between font-mono">
            <span>Velocidade desta sessão:</span>
            <span className="font-bold">{previewSpeed.toFixed(1)} p/h</span>
          </div>
        )}
        {previewSpeed !== null && (previewSpeed > 300 || previewSpeed < 2) && (
          <p className="text-xs text-amber-700">Velocidade incomum; confira páginas e tempo.</p>
        )}
        {(error || validationMessage) && <p role="alert" className="border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">{error || validationMessage}</p>}

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="h-8 text-xs rounded">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading || tooShortToSave || Boolean(validationMessage) || !pagesRead}
            className="bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold h-8 rounded shadow-none"
          >
            {loading ? "Salvando..." : <><Check className="mr-1 h-3.5 w-3.5" /> Salvar sessão</>}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function ReadingSessionModal({
  reading,
  isOpen,
  onClose,
  onSuccess,
  mode = "manual",
  timerState = null,
  endedAt = null,
  onDiscardTimer,
}: ReadingSessionModalProps) {
  if (!reading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen && (
        <ReadingSessionModalContent
          key={`${reading.id}:${mode}:${timerState?.startedAt ?? ""}`}
          reading={reading}
          mode={mode}
          timerState={timerState}
          endedAt={endedAt}
          onClose={onClose}
          onSuccess={onSuccess}
          onDiscardTimer={onDiscardTimer}
        />
      )}
    </Dialog>
  );
}
