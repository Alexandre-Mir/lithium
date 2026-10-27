"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReadingWithSubject } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { startReadingTimer } from "@/lib/reading-timer-store";
import { Play, Sparkles } from "lucide-react";

interface QuickSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier2: ReadingWithSubject[];
  tier3: ReadingWithSubject[];
  tier4: ReadingWithSubject[];
  lastSessionReadingId: string | null;
  initialReadingId?: string | null;
  onRegisterSession: (reading: ReadingWithSubject) => void;
}

export function QuickSessionDialog({
  open,
  onOpenChange,
  tier2,
  tier3,
  tier4,
  lastSessionReadingId,
  initialReadingId = null,
  onRegisterSession,
}: QuickSessionDialogProps) {
  const [selectedReadingId, setSelectedReadingId] = useState<string | null>(null);
  const prioritized = [...tier2, ...tier3, ...tier4];
  const pending = new Map(prioritized.map((reading) => [reading.id, reading]));
  const preferredId = initialReadingId && pending.has(initialReadingId)
    ? initialReadingId
    : lastSessionReadingId && pending.has(lastSessionReadingId)
      ? lastSessionReadingId
      : prioritized[0]?.id ?? "";
  const activeReading = pending.get(selectedReadingId ?? preferredId) ?? null;

  const renderOptions = (readings: ReadingWithSubject[]) => readings.map((reading) => {
    const chapter = reading.chapter_title ? ` (↳ ${reading.chapter_title})` : "";
    return (
      <option key={reading.id} value={reading.id}>
        {reading.subject.name} — {reading.title}{chapter}
      </option>
    );
  });

  const startTimer = () => {
    if (!activeReading) return;
    if (startReadingTimer(activeReading.id, activeReading.title)) onOpenChange(false);
  };

  const registerSession = () => {
    if (!activeReading) return;
    onRegisterSession(activeReading);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-md border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Sessão Rápida</DialogTitle>
          <DialogDescription className="text-xs">
            Escolha uma leitura pendente e como deseja registrar o tempo.
          </DialogDescription>
        </DialogHeader>

        {prioritized.length > 0 ? (
          <div className="space-y-1.5">
            <label htmlFor="quick-session-reading" className="text-xs font-semibold">
              Leitura
            </label>
            <select
              id="quick-session-reading"
              value={activeReading?.id ?? ""}
              onChange={(event) => setSelectedReadingId(event.target.value)}
              className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              {tier2.length > 0 && <optgroup label="Zona de Perigo">{renderOptions(tier2)}</optgroup>}
              {tier3.length > 0 && <optgroup label="Leituras Regulares">{renderOptions(tier3)}</optgroup>}
              {tier4.length > 0 && <optgroup label="Estudos Autônomos">{renderOptions(tier4)}</optgroup>}
            </select>
          </div>
        ) : (
          <div className="border border-gray-200 px-3 py-4 text-center text-xs text-gray-600 dark:border-gray-800 dark:text-gray-300">
            <p>Nenhuma leitura pendente para registrar uma sessão.</p>
            <Link href="/setup" className="mt-2 inline-block font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              Cadastrar leituras
            </Link>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 rounded text-xs"
          >
            Fechar
          </Button>
          {activeReading && (
            <>
              <Button type="button" variant="outline" onClick={registerSession} className="h-8 rounded text-xs">
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Registrar sessão manual
              </Button>
              <Button type="button" onClick={startTimer} className="h-8 rounded bg-gray-900 text-xs text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                <Play className="mr-1 h-3.5 w-3.5" /> Iniciar cronômetro
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
