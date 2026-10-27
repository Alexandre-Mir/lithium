"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReadingSessionModal } from "@/components/reading-session-modal";
import { Button } from "@/components/ui/button";
import { addToast } from "@/lib/toast-store";
import {
  clearReadingTimer,
  completeReadingSprint,
  getReadingTimerSnapshot,
  pauseReadingTimer,
  remainingSprintSeconds,
  resumeReadingTimer,
  sprintProgressPercent,
  useReadingTimer,
} from "@/lib/reading-timer-store";
import { elapsedSeconds, type TimerState } from "@/lib/reading-timer";
import { Check, Pause, Play, Square, Trash2 } from "lucide-react";

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function updateDocumentTitle(title: string) {
  document.title = title;
}

export function ReadingTimerBar() {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useReadingTimer();
  const [now, setNow] = useState(0);
  const [finishingTimer, setFinishingTimer] = useState<TimerState | null>(null);
  const [finishingEndedAt, setFinishingEndedAt] = useState<string | null>(null);
  const [sprintCompletion, setSprintCompletion] = useState<{ startedAt: string; endedAt: string } | null>(null);
  const previousTitle = useRef<string | null>(null);
  const notifiedSprint = useRef<string | null>(null);
  const elapsed = timer ? elapsedSeconds(timer, new Date(now)) : 0;
  const remaining = remainingSprintSeconds(elapsed);
  const progress = sprintProgressPercent(elapsed);
  const sprintEndedAt = timer && sprintCompletion?.startedAt === timer.startedAt
    ? sprintCompletion?.endedAt ?? null
    : null;

  const openFinishDialog = useCallback((completedAt?: string) => {
    let endedAt = completedAt ?? sprintEndedAt;
    const current = getReadingTimerSnapshot();
    if (!current) return;

    if (remainingSprintSeconds(elapsedSeconds(current)) === 0) {
      if (!endedAt) endedAt = new Date().toISOString();
      completeReadingSprint();
      setSprintCompletion({ startedAt: current.startedAt, endedAt });
    } else if (current.status === "running") {
      pauseReadingTimer();
      endedAt = new Date().toISOString();
    } else if (!endedAt) {
      endedAt = new Date().toISOString();
    }

    const paused = getReadingTimerSnapshot();
    if (!paused) return;
    setFinishingTimer(paused);
    setFinishingEndedAt(endedAt);
  }, [sprintEndedAt]);

  useEffect(() => {
    if (!timer || timer.status !== "running") return;

    const tick = () => {
      const tickNow = Date.now();
      setNow(tickNow);
      if (remainingSprintSeconds(elapsedSeconds(timer, new Date(tickNow))) > 0) return;

      const timerKey = timer.startedAt;
      if (notifiedSprint.current === timerKey) return;

      const completedAt = new Date(tickNow).toISOString();
      notifiedSprint.current = timerKey;
      completeReadingSprint();
      setSprintCompletion({ startedAt: timerKey, endedAt: completedAt });
      addToast({
        message: "Sprint concluído! 🎉 Registre as páginas para salvar a sessão.",
        actionLabel: "Registrar páginas",
        onAction: () => openFinishDialog(completedAt),
      });
    };

    const frame = window.requestAnimationFrame(tick);
    const interval = window.setInterval(tick, 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [timer, openFinishDialog]);

  useEffect(() => {
    if (timer?.status === "running") {
      if (previousTitle.current === null) previousTitle.current = document.title;
      updateDocumentTitle(`${formatClock(remaining)} · Lithium`);
      return;
    }
    if (previousTitle.current !== null) {
      updateDocumentTitle(previousTitle.current);
      previousTitle.current = null;
    }
  }, [timer?.status, timer?.startedAt, remaining, pathname]);

  const handleDiscard = () => {
    if (!timer || !window.confirm(`Descartar o cronômetro de «${timer.readingTitle}»?`)) return;
    clearReadingTimer();
    setFinishingTimer(null);
    setFinishingEndedAt(null);
    setSprintCompletion(null);
  };

  const handleSaved = () => {
    clearReadingTimer();
    setFinishingTimer(null);
    setFinishingEndedAt(null);
    setSprintCompletion(null);
    router.refresh();
  };

  return (
    <>
      {timer && (
        <div className="sticky top-14 z-40 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="container mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:px-8">
            <Link href={`/library/${timer.readingId}`} className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-800 hover:underline dark:text-gray-100">
              {timer.readingTitle}
            </Link>
            <span className="font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100" aria-label="Tempo restante do sprint" aria-live="off">
              {formatClock(remaining)}
            </span>
            {timer.status === "running" ? (
              <Button size="sm" variant="outline" onClick={pauseReadingTimer} className="h-7 text-xs">
                <Pause className="mr-1 h-3.5 w-3.5" /> Pausar
              </Button>
            ) : remaining > 0 ? (
              <Button size="sm" variant="outline" onClick={resumeReadingTimer} className="h-7 text-xs">
                <Play className="mr-1 h-3.5 w-3.5" /> Retomar
              </Button>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Sprint concluído</span>
            )}
            <Button size="sm" onClick={() => openFinishDialog()} className="h-7 text-xs">
              {remaining === 0 ? <Check className="mr-1 h-3.5 w-3.5" /> : <Square className="mr-1 h-3 w-3" />}
              {remaining === 0 ? "Registrar páginas" : "Finalizar"}
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={handleDiscard} aria-label="Descartar cronômetro" title="Descartar">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <div
              className="h-1.5 w-full overflow-hidden border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
              role="progressbar"
              aria-label="Progresso do sprint"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div className="h-full bg-gray-900 dark:bg-gray-100" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}
      <ReadingSessionModal
        reading={finishingTimer ? { id: finishingTimer.readingId, title: finishingTimer.readingTitle } : null}
        isOpen={finishingTimer !== null}
        mode="timer"
        timerState={finishingTimer}
        endedAt={finishingEndedAt}
        onClose={() => {
          setFinishingTimer(null);
          setFinishingEndedAt(null);
        }}
        onSuccess={handleSaved}
        onDiscardTimer={() => {
          clearReadingTimer();
          setFinishingTimer(null);
          setFinishingEndedAt(null);
          setSprintCompletion(null);
        }}
      />
    </>
  );
}

