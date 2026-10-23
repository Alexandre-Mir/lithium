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
import { Zap, Play, Pause, RotateCcw, Clock, BookOpen, Check } from "lucide-react";

interface ReadingSessionModalProps {
  reading: Reading | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReadingSessionModal({
  reading,
  isOpen,
  onClose,
  onSuccess,
}: ReadingSessionModalProps) {
  const [durationMinutes, setDurationMinutes] = useState<number | "">(25);
  const [pagesRead, setPagesRead] = useState<number | "">(10);
  const [loading, setLoading] = useState(false);
  const [newSpeedResult, setNewSpeedResult] = useState<number | null>(null);

  // Timer embutido (Pomodoro / Cronômetro opcional)
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => {
          const next = prev + 1;
          // Atualiza durationMinutes a cada minuto
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

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setDurationMinutes(25);
      setPagesRead(10);
      setNewSpeedResult(null);
      setTimerRunning(false);
      setSecondsElapsed(0);
    }
  }, [isOpen]);

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
    if (!reading) return;

    const duration = typeof durationMinutes === "number" ? durationMinutes : 0;
    const pages = typeof pagesRead === "number" ? pagesRead : 0;

    if (duration <= 0 || pages <= 0) {
      alert("Por favor, preencha valores válidos de duração e páginas lidas.");
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
      }, 1600);
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar sessão de leitura.");
    } finally {
      setLoading(false);
    }
  };

  if (!reading) return null;

  // Cálculo prévio da velocidade instantânea desta sessão
  const previewSpeed =
    typeof durationMinutes === "number" &&
    typeof pagesRead === "number" &&
    durationMinutes > 0
      ? ((pagesRead / durationMinutes) * 60).toFixed(1)
      : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs tracking-wider uppercase mb-1">
            <Zap className="w-4 h-4 text-amber-500" />
            Sessão de Calibração Cognitiva
          </div>
          <DialogTitle className="text-xl font-bold">
            Registrar Sessão de Leitura
          </DialogTitle>
          <DialogDescription className="line-clamp-1 text-xs">
            {reading.title}
          </DialogDescription>
        </DialogHeader>

        {newSpeedResult !== null ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center animate-bounce">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-emerald-900 dark:text-emerald-100 text-lg">
              Velocidade Calibrada!
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-xs">
              Nova taxa calculada:{" "}
              <strong className="font-mono text-base">{newSpeedResult} páginas/hora</strong>.
              As projeções do seu Dashboard e Biblioteca foram atualizadas em tempo real.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Cronômetro Opcional */}
            <div className="rounded-xl border bg-muted/30 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-mono text-2xl font-black text-slate-800 dark:text-slate-100 tracking-wider">
                  {formatTimer(secondsElapsed)}
                </div>
                <span className="text-xs text-muted-foreground">Cronômetro</span>
              </div>

              <div className="flex items-center gap-1.5">
                {!timerRunning ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTimerRunning(true)}
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" /> Iniciar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={handleStopAndFill}
                  >
                    <Pause className="w-3.5 h-3.5 mr-1" /> Pausar & Usar
                  </Button>
                )}
                {secondsElapsed > 0 && !timerRunning && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setSecondsElapsed(0)}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Inputs de Duração e Páginas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="duration" className="text-xs font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  Tempo Gasto (minutos)
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
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pages" className="text-xs font-semibold flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
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
                  className="font-mono"
                />
              </div>
            </div>

            {/* Prévia da Calibração */}
            {previewSpeed && (
              <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 p-3 text-xs flex items-center justify-between text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Velocidade desta sessão:</span>
                </div>
                <span className="font-mono font-bold text-sm">
                  {previewSpeed} p/h
                </span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !durationMinutes || !pagesRead}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                {loading ? "Calibrando..." : "Salvar & Calibrar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
