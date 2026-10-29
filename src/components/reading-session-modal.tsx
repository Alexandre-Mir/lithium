"use client";

import { useState } from "react";
import { createReadingSession, updateReadingSession } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { elapsedSeconds, type TimerState } from "@/lib/reading-timer";
import { formatDuration, pph, sessionSeconds } from "@/lib/session-time";
import { absolutePageAtProgress, pagesReadFromEndPage } from "@/lib/session-pages";
import { validateSessionInput } from "@/lib/session-validation";
import { remainingSprintSeconds } from "@/lib/reading-timer-store";
import type { ReadingSession, ReadingSessionSource } from "@/types/database";
import { Check, Zap } from "lucide-react";

export interface ReadingSessionTarget {
  id: string;
  title: string;
  currentPage: number;
  totalPages: number | null;
  segmentStartPage?: number | null;
}

type SessionMode = "manual" | "timer" | "edit";

interface ReadingSessionModalProps {
  reading: ReadingSessionTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: SessionMode;
  session?: ReadingSession | null;
  timerState?: TimerState | null;
  endedAt?: string | null;
  onDiscardTimer?: () => void;
}

function formatTimerInput(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function parseTimerInput(value: string): number | null {
  const match = /^(\d{1,4}):(\d{2})$/.exec(value.trim());
  if (!match || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function ReadingSessionModalContent({
  reading,
  mode,
  session,
  timerState,
  endedAt,
  currentPage,
  totalPages,
  segmentStartPage,
  onClose,
  onSuccess,
  onDiscardTimer,
  onBusyChange,
}: {
  reading: ReadingSessionTarget;
  mode: SessionMode;
  session: ReadingSession | null;
  timerState: TimerState | null;
  endedAt: string | null;
  currentPage: number;
  totalPages: number | null;
  segmentStartPage?: number | null;
  onClose: () => void;
  onSuccess?: () => void;
  onDiscardTimer?: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const measuredSeconds = mode === "timer" && timerState ? elapsedSeconds(timerState) : 0;
  const initialSeconds = mode === "edit" && session
    ? sessionSeconds(session)
    : measuredSeconds;
  const remainingSeconds = remainingSprintSeconds(measuredSeconds, timerState?.durationSeconds);
  const [durationMinutes, setDurationMinutes] = useState("25");
  const [timerInput, setTimerInput] = useState(() => formatTimerInput(initialSeconds));
  const initialEndPage = absolutePageAtProgress(currentPage + (session?.pages_read ?? 10), segmentStartPage ?? null);
  const [pageInputMode, setPageInputMode] = useState<"count" | "end">("count");
  const [pageCountInput, setPageCountInput] = useState(String(session?.pages_read ?? 10));
  const [endPageInput, setEndPageInput] = useState(String(initialEndPage));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationSeconds = mode === "manual"
    ? (/^\d+$/.test(durationMinutes) ? Number(durationMinutes) * 60 : 0)
    : (parseTimerInput(timerInput) ?? 0);
  const endPage = /^\d+$/.test(endPageInput) ? Number(endPageInput) : null;
  const requestedPageCount = /^\d+$/.test(pageCountInput) ? Number(pageCountInput) : null;
  const calculatedPagesRead = pageInputMode === "count"
    ? requestedPageCount !== null &&
      requestedPageCount > 0 &&
      (totalPages === null || currentPage + requestedPageCount <= totalPages)
      ? requestedPageCount
      : null
    : endPage === null
      ? null
      : pagesReadFromEndPage(currentPage, endPage, totalPages, segmentStartPage ?? null);
  const pagesRead = calculatedPagesRead ?? 0;
  const previewSpeed = durationSeconds > 0 && pagesRead > 0
    ? pph(pagesRead, durationSeconds)
    : null;
  const source: ReadingSessionSource = mode === "manual"
    ? "manual"
    : mode === "edit" && session
      ? session.source
      : Math.abs(durationSeconds - measuredSeconds) > 5
      ? "timer_adjusted"
      : "timer";
  const durationWarning = mode === "timer" && measuredSeconds > 10_800;
  const tooShortToSave = mode === "timer" && measuredSeconds < 30;

  const validationInput = {
    pages_read: pagesRead,
    duration_seconds: durationSeconds,
    source,
    started_at: mode === "timer" ? timerState?.startedAt ?? null : mode === "edit" ? session?.started_at : null,
    ended_at: mode === "timer" ? endedAt : mode === "edit" ? session?.ended_at : null,
  };
  const currentAbsolutePage = absolutePageAtProgress(currentPage, segmentStartPage ?? null);
  const pageValidationMessage = pageInputMode === "count"
    ? requestedPageCount === null || requestedPageCount < 1
      ? "Informe uma quantidade positiva de páginas lidas."
      : totalPages !== null && currentPage + requestedPageCount > totalPages
        ? `A quantidade não pode passar das ${totalPages} páginas da leitura.`
        : null
    : endPage === null
      ? "Informe a página final da leitura."
      : endPage <= currentAbsolutePage
        ? `A página final deve ser maior que a página atual (${currentAbsolutePage}).`
        : totalPages !== null && endPage > absolutePageAtProgress(totalPages, segmentStartPage ?? null)
          ? `A página final não pode passar da última página (${absolutePageAtProgress(totalPages, segmentStartPage ?? null)}).`
          : null;
  const validationMessage = pageValidationMessage ?? validateSessionInput(validationInput);

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
    if (mode === "edit" && !session) {
      setError("Não foi possível recuperar a sessão para edição.");
      return;
    }

    try {
      setLoading(true);
      onBusyChange(true);
      if (mode === "edit" && session) {
        await updateReadingSession(session.id, {
          pages_read: pagesRead,
          duration_seconds: durationSeconds,
        });
      } else {
        await createReadingSession({
          reading_id: reading.id,
          pages_read: pagesRead,
          duration_seconds: durationSeconds,
          started_at: mode === "timer" ? timerState?.startedAt : null,
          ended_at: mode === "timer" ? endedAt : null,
          source,
        });
      }
      onSuccess?.();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao registrar sessão de leitura.");
    } finally {
      setLoading(false);
      onBusyChange(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md rounded-md border border-gray-200 dark:border-gray-800">
      <DialogHeader>
        <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[11px] uppercase tracking-wider mb-1">
          <Zap className="w-3.5 h-3.5 text-indigo-500" />
          Sessão de leitura
        </div>
        <DialogTitle className="text-base font-bold">
          {mode === "timer" ? "Finalizar sessão cronometrada" : mode === "edit" ? "Editar sessão" : "Registrar Sessão de Leitura"}
        </DialogTitle>
        <DialogDescription className="line-clamp-1 text-xs">{reading.title}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Como informar o progresso?</Label>
          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              size="sm"
              variant={pageInputMode === "count" ? "default" : "outline"}
              aria-pressed={pageInputMode === "count"}
              onClick={() => setPageInputMode("count")}
              className="h-8 text-[11px]"
            >
              Quantidade lida
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pageInputMode === "end" ? "default" : "outline"}
              aria-pressed={pageInputMode === "end"}
              onClick={() => setPageInputMode("end")}
              className="h-8 text-[11px]"
            >
              Página final
            </Button>
          </div>
        </div>
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
              <Label htmlFor="pages-read" className="text-xs font-semibold">
                {pageInputMode === "count"
                  ? "Páginas lidas"
                  : segmentStartPage ? "Página final no livro" : "Página final da leitura"}
              </Label>
              <Input
                id="pages-read"
                type="number"
                min={pageInputMode === "count" ? 1 : currentAbsolutePage + 1}
                max={pageInputMode === "count"
                  ? totalPages === null ? undefined : Math.max(0, totalPages - currentPage)
                  : totalPages === null ? undefined : absolutePageAtProgress(totalPages, segmentStartPage ?? null)}
                step="1"
                required
                value={pageInputMode === "count" ? pageCountInput : endPageInput}
                onChange={(event) =>
                  pageInputMode === "count"
                    ? setPageCountInput(event.target.value)
                    : setEndPageInput(event.target.value)
                }
                className="font-mono text-xs h-8 rounded border-gray-300 dark:border-gray-700"
              />
            </div>
          </div>
        ) : (
          <>
            {mode === "timer" && (
              <div className="flex items-center justify-between border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs dark:border-gray-800 dark:bg-gray-950">
                <span className="text-gray-600 dark:text-gray-400">
                  {remainingSeconds === 0 ? "Cota estimada concluída" : "Tempo estimado restante"}
                </span>
                <span className="font-mono font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {formatTimerInput(remainingSeconds)}
                </span>
              </div>
            )}
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
                {mode === "timer" && <p className="text-[10px] text-gray-500">Medido: {formatDuration(measuredSeconds)}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="timer-pages-read" className="text-xs font-semibold">
                  {pageInputMode === "count"
                    ? "Páginas lidas"
                    : segmentStartPage ? "Página final no livro" : "Página final da leitura"}
                </Label>
                <Input
                  id="timer-pages-read"
                  type="number"
                  min={pageInputMode === "count" ? 1 : currentAbsolutePage + 1}
                  max={pageInputMode === "count"
                    ? totalPages === null ? undefined : Math.max(0, totalPages - currentPage)
                    : totalPages === null ? undefined : absolutePageAtProgress(totalPages, segmentStartPage ?? null)}
                  step="1"
                  required
                  value={pageInputMode === "count" ? pageCountInput : endPageInput}
                  onChange={(event) =>
                    pageInputMode === "count"
                      ? setPageCountInput(event.target.value)
                      : setEndPageInput(event.target.value)
                  }
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

        <p className="text-[10px] text-gray-500">
          Progresso registrado: {currentPage}{totalPages !== null ? ` de ${totalPages}` : ""} páginas
          {segmentStartPage ? ` (página impressa ${currentAbsolutePage})` : ""}.
        </p>
        {totalPages !== null && currentPage >= totalPages && (
          <p className="text-xs text-gray-500">
            Todas as páginas já estão registradas para esta leitura.
          </p>
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
            {loading ? "Salvando..." : <><Check className="mr-1 h-3.5 w-3.5" /> {mode === "edit" ? "Salvar alterações" : "Salvar sessão"}</>}
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
  session = null,
  timerState = null,
  endedAt = null,
  onDiscardTimer,
}: ReadingSessionModalProps) {
  const [saving, setSaving] = useState(false);
  if (!reading) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      {isOpen && (
        <ReadingSessionModalContent
          key={`${reading.id}:${mode}:${session?.id ?? ""}:${timerState?.startedAt ?? ""}`}
          reading={reading}
          mode={mode}
          session={session}
          timerState={timerState}
          endedAt={endedAt}
          currentPage={reading.currentPage}
          totalPages={reading.totalPages}
          segmentStartPage={reading.segmentStartPage}
          onClose={onClose}
          onSuccess={onSuccess}
          onDiscardTimer={onDiscardTimer}
          onBusyChange={setSaving}
        />
      )}
    </Dialog>
  );
}
