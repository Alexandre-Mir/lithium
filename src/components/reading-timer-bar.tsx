"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ReadingSessionModal } from "@/components/reading-session-modal";
import { Button } from "@/components/ui/button";
import { clearReadingTimer, getReadingTimerSnapshot, pauseReadingTimer, resumeReadingTimer, useReadingTimer } from "@/lib/reading-timer-store";
import { elapsedSeconds, type TimerState } from "@/lib/reading-timer";
import { Pause, Play, Square, Trash2 } from "lucide-react";

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function ReadingTimerBar() {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useReadingTimer();
  const [now, setNow] = useState(0);
  const [finishingTimer, setFinishingTimer] = useState<TimerState | null>(null);
  const [finishingEndedAt, setFinishingEndedAt] = useState<string | null>(null);
  const previousTitle = useRef<string | null>(null);
  const elapsed = timer ? elapsedSeconds(timer, new Date(now)) : 0;

  useEffect(() => {
    if (!timer || timer.status !== "running") return;
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [timer]);

  useEffect(() => {
    if (timer?.status === "running") {
      if (previousTitle.current === null) previousTitle.current = document.title;
      document.title = `${formatClock(elapsed)} · Lithium`;
      return;
    }
    if (previousTitle.current !== null) {
      document.title = previousTitle.current;
      previousTitle.current = null;
    }
  }, [timer?.status, timer?.startedAt, elapsed, pathname]);

  const handleFinish = () => {
    if (!timer) return;
    if (timer.status === "running") pauseReadingTimer();
    const paused = getReadingTimerSnapshot();
    if (paused) {
      setFinishingTimer(paused);
      setFinishingEndedAt(new Date().toISOString());
    }
  };

  const handleDiscard = () => {
    if (!timer || !window.confirm(`Descartar o cronômetro de «${timer.readingTitle}»?`)) return;
    clearReadingTimer();
    setFinishingTimer(null);
    setFinishingEndedAt(null);
  };

  const handleSaved = () => {
    clearReadingTimer();
    setFinishingTimer(null);
    setFinishingEndedAt(null);
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
            <span className="font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100" aria-live="off">
              {formatClock(elapsed)}
            </span>
            {timer.status === "running" ? (
              <Button size="sm" variant="outline" onClick={pauseReadingTimer} className="h-7 text-xs">
                <Pause className="mr-1 h-3.5 w-3.5" /> Pausar
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={resumeReadingTimer} className="h-7 text-xs">
                <Play className="mr-1 h-3.5 w-3.5" /> Retomar
              </Button>
            )}
            <Button size="sm" onClick={handleFinish} className="h-7 text-xs">
              <Square className="mr-1 h-3 w-3" /> Finalizar
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={handleDiscard} aria-label="Descartar cronômetro" title="Descartar">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
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
        }}
      />
    </>
  );
}

