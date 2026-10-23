"use client";

import { useState } from "react";
import { ReadingWithSubject, Deliverable } from "@/types/database";
import { markReadingAsRead } from "@/app/actions";
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
  const themeColor = subject?.theme_color || "#4f46e5";

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
      <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="line-through">{reading.title}</span>
        </div>
        <Badge variant="outline" className="text-[10px] text-emerald-800 bg-white border-emerald-300 py-0">
          Concluído (D+1, D+7, D+21 gerados)
        </Badge>
      </div>
    );
  }

  return (
    <div
      className={`rounded-md bg-white dark:bg-gray-900 p-3.5 transition-colors ${
        tierNumber === 2
          ? "border-2 border-red-300 dark:border-red-900"
          : "border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Info Principal */}
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: `${themeColor}15`,
                color: themeColor,
              }}
            >
              {subject?.name || "Disciplina"}
            </span>

            <Badge variant="outline" className="text-[10px] py-0 px-1 border-gray-300 text-gray-700 dark:text-gray-300 uppercase font-bold">
              {reading.type === "book" ? (
                <span className="flex items-center gap-1">
                  <BookOpen className="w-2.5 h-2.5" /> Livro
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5" /> Artigo
                </span>
              )}
            </Badge>

            {tierNumber === 2 && linkedDeliverable && (
              <Badge className="bg-red-600 text-white text-[10px] font-bold py-0 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Entrega: {linkedDeliverable.title} (em {getDaysLeft(linkedDeliverable.date)}d)
              </Badge>
            )}

            <span
              className={`text-[11px] font-mono flex items-center gap-1 ${
                daysUntilDeadline <= 2 ? "text-red-600 font-bold" : "text-gray-500"
              }`}
            >
              <Calendar className="w-3 h-3" />
              {new Date(reading.deadline + "T00:00:00").toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })}
              {daysUntilDeadline >= 0 ? ` (${daysUntilDeadline}d)` : " (Atrasado)"}
            </span>
          </div>

          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
              {reading.title}
            </h4>
            {reading.chapter_title && (
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                ↳ {reading.chapter_title}
              </p>
            )}
            {reading.author && (
              <p className="text-[11px] text-gray-500 italic">
                por {reading.author}
              </p>
            )}
          </div>

          {/* Métricas Flat */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400 pt-0.5">
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-gray-400" />
              <span>{reading.target_pages} páginas</span>
            </div>

            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-gray-400" />
              <span>{speed.toFixed(1)} p/h</span>
            </div>

            <div className="flex items-center gap-1 font-semibold text-gray-800 dark:text-gray-200">
              <Clock className="w-3 h-3 text-gray-400" />
              <span>~{estimatedHours}h estimadas</span>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t border-gray-100 dark:border-gray-800 md:border-t-0">
          <Button
            onClick={() => onOpenSession(reading)}
            size="sm"
            variant="outline"
            className="text-xs font-semibold h-8 rounded border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-none"
          >
            <Sparkles className="w-3 h-3 mr-1 text-gray-500" />
            Sessão
          </Button>

          <Button
            onClick={handleMarkAsRead}
            disabled={loading}
            size="sm"
            className="bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold h-8 rounded shadow-none"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Concluir
          </Button>
        </div>
      </div>
    </div>
  );
}
