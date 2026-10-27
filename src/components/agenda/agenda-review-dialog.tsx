"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeReview } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgendaReviewEvent } from "@/lib/agenda";

export function AgendaReviewDialog({ review }: { review: AgendaReviewEvent }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pending) return;
    setOpen(nextOpen);
  };

  const handleComplete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await completeReview(review.id);
        setOpen(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Não foi possível concluir a revisão.");
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 rounded-sm text-[11px]"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Revisar Agora
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="rounded-md border border-gray-300 bg-white shadow-none dark:border-gray-700 dark:bg-gray-950 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Revisão {review.reviewType}</DialogTitle>
            <DialogDescription className="text-xs">
              {review.bookTitle} · {review.milestoneTitle} · página {review.milestonePage}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto whitespace-pre-wrap border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
            {review.summaryContent?.trim() || "Este resumo não tem conteúdo salvo."}
          </div>
          {error && (
            <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          )}
          <DialogFooter className="rounded-none border-t-0 bg-transparent p-0">
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button disabled={pending} onClick={handleComplete}>
              {pending ? "Salvando…" : "Marcar Revisão como Concluída"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
