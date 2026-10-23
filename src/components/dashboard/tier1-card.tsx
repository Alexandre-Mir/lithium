"use client";

import { useState } from "react";
import { SpacedReviewWithReading } from "@/types/database";
import { markReviewAsDone } from "@/app/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RotateCw, Sparkles, BookOpen } from "lucide-react";

interface Tier1CardProps {
  review: SpacedReviewWithReading;
  onRefresh?: () => void;
}

export function Tier1Card({ review, onRefresh }: Tier1CardProps) {
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(review.status === "done");

  const reading = review.reading;
  const subject = reading?.subject;

  const handleMarkDone = async () => {
    try {
      setLoading(true);
      setCompleted(true);
      await markReviewAsDone(review.id);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setCompleted(false);
      alert("Erro ao marcar revisão como concluída.");
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const isOverdue = review.review_date < todayStr;

  if (completed) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 flex items-center justify-between transition-all">
        <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="line-through">{reading?.title || "Revisão"}</span>
        </div>
        <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">
          Revisado!
        </Badge>
      </div>
    );
  }

  return (
    <Card className="border-indigo-200 dark:border-indigo-900 bg-card hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider">
              {review.type === "active_recall" ? "Active Recall" : review.type}
            </Badge>

            {isOverdue ? (
              <Badge variant="destructive" className="text-[10px] font-semibold animate-pulse">
                Atrasada ({new Date(review.review_date + "T00:00:00").toLocaleDateString("pt-BR")})
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] font-mono">
                Agendada para hoje
              </Badge>
            )}

            {subject && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${subject.theme_color}18`,
                  color: subject.theme_color,
                }}
              >
                {subject.name}
              </span>
            )}
          </div>

          <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
            {reading?.title || "Leitura vinculada"}
          </h4>

          {reading?.author && (
            <p className="text-xs text-muted-foreground italic">
              Autor: {reading.author}
            </p>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Dedique 5 a 10 minutos para reconstruir mentalmente os tópicos principais sem consultar o texto.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleMarkDone}
            disabled={loading}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Concluir Recall
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
