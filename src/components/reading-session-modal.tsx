"use client";

import { useState, useEffect } from "react";
import { Reading } from "@/types/database";
import { createReadingSession } from "@/app/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Play, Pause, RotateCcw, Check } from "lucide-react";

interface ReadingSessionModalProps {
  reading: Reading | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function ReadingSessionModalContent({
  reading,
  onClose,
  onSuccess,
}: {
  reading: Reading;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [durationMinutes, setDurationMinutes] = useState<number | "">(25);
  const [pagesRead, setPagesRead] = useState<number | "">(10);
  const [loading, setLoading] = useState(false);
  const [newSpeedResult, setNewSpeedResult] = useState<number | null>(null);

  // Timer embutido
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => {
          const next = prev + 1;
          if (next % 60 === 0) {
            setDurationMinutes(Math.max(1, Math.floor(next / 60)));
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStopAndFill = () => {
    setTimerRunning(false);
    const calculatedMinutes = Math.max(1, Math.round(secondsElapsed / 60));
    setDurationMinutes(calculatedMinutes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const duration = typeof durationMinutes === "number" ? durationMinutes : 0;
    const pages = typeof pagesRead === "number" ? pagesRead : 0;

    if (duration <= 0 || pages <= 0) {
      alert("Preencha valores válidos de duração e páginas.");
      return;
    }

    try {
      setLoading(true);
      const res = await createReadingSession({
        reading_id: reading.id,
        duration_minutes: duration,
        pages_read: pages,
      });

      setNewSpeedResult(res.newSpeedPph);
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar sessão de leitura.");
    } finally {
      setLoading(false);
    }
  };

  const previewSpeed =
    typeof durationMinutes === "number" &&
    typeof pagesRead === "number" &&
    durationMinutes > 0
      ? ((pagesRead / durationMinutes) * 60).toFixed(1)
      : null;

  return (
    <DialogContent className="sm:max-w-md rounded-md border border-gray-200 dark:border-gray-800">
      <DialogHeader>
        <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[11px] uppercase tracking-wider mb-1">
          <Zap className="w-3.5 h-3.5 text-indigo-500" />
          Calibração Cognitiva
        </div>
        <DialogTitle className="text-base font-bold">
          Registrar Sessão de Leitura
        </DialogTitle>
        <DialogDescription className="line-clamp-1 text-xs">
          {reading.title}
        </DialogDescription>
      </DialogHeader>

      {newSpeedResult !== null ? (
        <div className="py-4 flex flex-col items-center justify-center text-center space-y-2 bg-emerald-50 dark:bg-emerald-950/40 rounded border border-emerald-200 dark:border-emerald-800">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
            <Check className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-100">
            Velocidade Atualizada!
          </h4>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Nova velocidade média calibrada:{" "}
            <strong className="font-mono">{newSpeedResult} p/h</strong>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Cronômetro Flat */}
          <div className="rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="font-mono text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatTimer(secondsElapsed)}
              </div>
              <span className="text-[11px] text-gray-500 font-mono">Cronômetro</span>
            </div>

            <div className="flex items-center gap-1">
              {!timerRunning ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setTimerRunning(true)}
                  className="h-7 text-xs rounded border-gray-300 dark:border-gray-700"
                >
                  <Play className="w-3 h-3 mr-1 text-emerald-600" /> Iniciar
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleStopAndFill}
                  className="h-7 text-xs rounded"
                >
                  <Pause className="w-3 h-3 mr-1" /> Usar tempo
                </Button>
              )}
              {secondsElapsed > 0 && !timerRunning && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setSecondsElapsed(0)}
                  className="h-7 w-7"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Inputs de Duração e Páginas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="duration" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Tempo (minutos)
              </Label>
              <Input
                id="duration"
                type="number"
                min="1"
                required
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(e.target.value ? parseInt(e.target.value) : "")
                }
                className="font-mono text-xs h-8 rounded border-gray-300 dark:border-gray-700"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pages" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Páginas Lidas
              </Label>
              <Input
                id="pages"
                type="number"
                min="1"
                required
                value={pagesRead}
                onChange={(e) =>
                  setPagesRead(e.target.value ? parseInt(e.target.value) : "")
                }
                className="font-mono text-xs h-8 rounded border-gray-300 dark:border-gray-700"
              />
            </div>
          </div>

          {previewSpeed && (
            <div className="rounded bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 text-xs flex items-center justify-between font-mono text-gray-700 dark:text-gray-300">
              <span>Taxa desta sessão:</span>
              <span className="font-bold">{previewSpeed} p/h</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="h-8 text-xs rounded"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !durationMinutes || !pagesRead}
              className="bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold h-8 rounded shadow-none"
            >
              {loading ? "Salvando..." : "Salvar & Calibrar"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}

export function ReadingSessionModal({
  reading,
  isOpen,
  onClose,
  onSuccess,
}: ReadingSessionModalProps) {
  if (!reading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen && (
        <ReadingSessionModalContent
          reading={reading}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  );
}
