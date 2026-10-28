"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeReview, markReviewAsDone } from "@/app/actions";
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
        if (review.source === "milestone") {
          await completeReview(review.id);
        } else {
          await markReviewAsDone(review.id);
        }
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
            <DialogTitle className="text-sm font-semibold">
              {review.source === "milestone" ? `Revisão Ativa ${review.reviewType}` : review.reviewType === "active_recall" ? "Revisão Ativa" : `Revisão ${review.reviewType}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {review.source === "milestone"
                ? `${review.bookTitle} · ${review.milestoneTitle} · página ${review.milestonePage}`
                : `${review.bookTitle}${review.chapterTitle ? ` · ${review.chapterTitle}` : ""}`}
            </DialogDescription>
          </DialogHeader>
          {review.source === "milestone" ? (
            <div className="max-h-80 overflow-y-auto whitespace-pre-wrap border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
              {review.summaryContent?.trim() || "Este resumo não tem conteúdo salvo."}
            </div>
          ) : (
            <p className="border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
              Tente recuperar mentalmente os pontos principais desta leitura antes de consultá-la.
            </p>
          )}
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
              {pending ? "Salvando…" : review.source === "milestone" ? "Marcar Revisão como Concluída" : "Concluir revisão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
