"use client";

import { useState } from "react";
import Link from "next/link";
import { SpacedReviewWithReading } from "@/types/database";
import { markReviewAsDone, updateSpacedReview } from "@/app/actions";
import { todayISO, formatDateBR } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { addToast } from "@/lib/toast-store";

interface Tier1CardProps {
  review: SpacedReviewWithReading;
  onRefresh?: () => void;
}

export function Tier1Card({ review, onRefresh }: Tier1CardProps) {
  const [loading, setLoading] = useState(false);
  const [optimisticCompleted, setOptimisticCompleted] = useState<boolean | null>(null);
  const completed = optimisticCompleted ?? (review.status === "done");

  const reading = review.reading;
  const subject = reading?.subject;

  const handleMarkDone = async () => {
    try {
      setLoading(true);
      setOptimisticCompleted(true);
      await markReviewAsDone(review.id);
      onRefresh?.();
      addToast({
        message: `«${reading?.title || "Leitura"}» concluída`,
        actionLabel: "Desfazer",
        onAction: async () => {
          await updateSpacedReview(review.id, { status: "pending" });
          setOptimisticCompleted(null);
          onRefresh?.();
        },
      });
    } catch (err) {
      console.error(err);
      setOptimisticCompleted(null);
      alert("Erro ao marcar revisão como concluída.");
    } finally {
      setLoading(false);
    }
  };

  const todayStr = todayISO();
  const isOverdue = review.review_date < todayStr;

  if (completed) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20 p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <Link href={`/library/${reading?.id}`} className="line-through">{reading?.title || "Revisão"}</Link>
        </div>
        <Badge variant="outline" className="text-[10px] bg-white dark:bg-gray-900 border-emerald-300 text-emerald-800 py-0">
          Revisado
        </Badge>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors hover:border-gray-300 dark:hover:border-gray-700">
      <div className="space-y-1 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-[10px] font-bold uppercase rounded py-0">
            {review.type === "active_recall" ? "Revisão Ativa" : review.type}
          </Badge>

          {isOverdue ? (
            <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-300 py-0">
              Atrasada ({formatDateBR(review.review_date)})
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 py-0 font-mono">
              Hoje
            </Badge>
          )}

          {subject && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: `${subject.theme_color}15`,
                color: subject.theme_color,
              }}
            >
              {subject.name}
            </span>
          )}
        </div>

        <Link href={`/library/${reading?.id}`} className="relative z-10 block"><h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">{reading?.title || "Leitura vinculada"}</h4></Link>

        {reading?.chapter_title && (
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            ↳ {reading.chapter_title}
          </p>
        )}

        {reading?.author && (
          <p className="text-[11px] text-gray-500 italic">
            por {reading.author}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          onClick={handleMarkDone}
          disabled={loading}
          size="sm"
          className="bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold h-8 rounded shadow-none"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Concluir Recall
        </Button>
      </div>
    </div>
  );
}
