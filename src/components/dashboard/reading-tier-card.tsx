"use client";

import { useState } from "react";
import { ReadingWithSubject, Deliverable } from "@/types/database";
import { markReadingAsRead } from "@/app/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Zap,
  Clock,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  FileText,
} from "lucide-react";

interface ReadingTierCardProps {
  reading: ReadingWithSubject;
  tierNumber: 2 | 3 | 4;
  linkedDeliverable?: Deliverable | null;
  onOpenSession: (reading: ReadingWithSubject) => void;
  onRefresh?: () => void;
}

export function ReadingTierCard({
  reading,
  tierNumber,
  linkedDeliverable,
  onOpenSession,
  onRefresh,
}: ReadingTierCardProps) {
  const [loading, setLoading] = useState(false);
  const [isRead, setIsRead] = useState(reading.is_read);

  const subject = reading.subject;
  const themeColor = subject?.theme_color || "#6366f1";

  const speed = Number(reading.current_speed_pph) || 20;
  const estimatedHours = (reading.target_pages / speed).toFixed(1);

  const handleMarkAsRead = async () => {
    try {
      setLoading(true);
      setIsRead(true);
      await markReadingAsRead(reading.id);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setIsRead(false);
      alert("Erro ao concluir leitura.");
    } finally {
      setLoading(false);
    }
  };

  const getDaysLeft = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + "T00:00:00");
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const daysUntilDeadline = getDaysLeft(reading.deadline);

  if (isRead) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="line-through">{reading.title}</span>
        </div>
        <Badge variant="outline" className="text-[10px] text-emerald-800 bg-emerald-100 border-emerald-300">
          Concluído! (Revisões D+1, D+7, D+21 geradas)
        </Badge>
      </div>
    );
  }

  return (
    <Card
      className={`bg-card transition-all hover:shadow-md ${
        tierNumber === 2
          ? "border-rose-300 dark:border-rose-900 shadow-xs ring-1 ring-rose-500/10"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Info Principal */}
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tag da Disciplina */}
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${themeColor}18`,
                color: themeColor,
              }}
            >
              {subject?.name || "Disciplina"}
            </span>

            {/* Badge de Livro ou Artigo */}
            <Badge variant="outline" className="text-[10px] uppercase font-bold">
              {reading.type === "book" ? (
                <span className="flex items-center gap-1">
                  <BookOpen className="w-2.5 h-2.5 text-emerald-600" /> Livro
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5 text-indigo-600" /> Artigo
                </span>
              )}
            </Badge>

            {/* Se Tier 2: Alerta de Prova / Entrega */}
            {tierNumber === 2 && linkedDeliverable && (
              <Badge className="bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                Entrega: {linkedDeliverable.title} (em {getDaysLeft(linkedDeliverable.date)}d)
              </Badge>
            )}

            {/* Prazo da própria leitura */}
            <span
              className={`text-[11px] font-mono flex items-center gap-1 ${
                daysUntilDeadline <= 2
                  ? "text-rose-600 font-bold"
                  : "text-muted-foreground"
              }`}
            >
              <Calendar className="w-3 h-3" />
              Meta: {new Date(reading.deadline + "T00:00:00").toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })}
              {daysUntilDeadline >= 0 ? ` (${daysUntilDeadline}d)` : " (Atrasado)"}
            </span>
          </div>

          <div>
            <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
              {reading.title}
            </h4>
            {reading.author && (
              <p className="text-xs text-muted-foreground italic">
                por {reading.author}
              </p>
            )}
          </div>

          {/* Métricas do Motor Cognitivo */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1 text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                <strong>{reading.target_pages}</strong> páginas
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>
                Velocidade: <strong>{speed.toFixed(1)}</strong> p/h
              </span>
            </div>

            <div className="flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100">
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              <span>Tempo estimado: ~{estimatedHours}h</span>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0">
          <Button
            onClick={() => onOpenSession(reading)}
            size="sm"
            variant="outline"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
            Sessão de Leitura
          </Button>

          <Button
            onClick={handleMarkAsRead}
            disabled={loading}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Concluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
