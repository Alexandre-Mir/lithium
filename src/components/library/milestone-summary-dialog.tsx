"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMilestoneSummary } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { MilestoneSummaryWithBook } from "@/types/database";

interface MilestoneSummaryDialogProps {
  summary: MilestoneSummaryWithBook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MilestoneSummaryDialog({
  summary,
  open,
  onOpenChange,
}: MilestoneSummaryDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isPending = summary.status === "pending";
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pending) return;
    onOpenChange(nextOpen);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const content = String(formData.get("content") ?? "");

    startTransition(async () => {
      try {
        await updateMilestoneSummary(summary.id, content);
        onOpenChange(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Não foi possível salvar o resumo.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-md border border-gray-300 bg-white shadow-none dark:border-gray-700 dark:bg-gray-950 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Resumo: {summary.milestone_title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {summary.book.title} · página {summary.milestone_page}
          </DialogDescription>
        </DialogHeader>

        <form key={`${summary.id}:${summary.status}:${summary.updated_at}:${open}`} onSubmit={handleSubmit}>
          <label htmlFor={`summary-${summary.id}`} className="mb-1.5 block text-xs font-medium">
            {isPending ? "Escreva o que você reteve deste marco" : "Revise ou ajuste seu resumo"}
          </label>
          <Textarea
            id={`summary-${summary.id}`}
            name="content"
            defaultValue={isPending ? "" : summary.content ?? ""}
            maxLength={100_000}
            required
            className="min-h-48 resize-y rounded-md text-sm"
            placeholder="Registre as ideias principais, conceitos e dúvidas que ficaram..."
            disabled={pending}
          />
          {error && (
            <p role="alert" className="mt-2 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          )}
          <DialogFooter className="mt-4 rounded-none border-t-0 bg-transparent p-0">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : isPending ? "Enviar para Revisão" : "Concluir Revisão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
