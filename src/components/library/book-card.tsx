"use client";

import { useState } from "react";
import Link from "next/link";
import { Reading, Subject } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markReadingAsRead, markReadingAsUnread } from "@/app/actions";
import { formatDateBR } from "@/lib/dates";
import { ReadingCover } from "@/components/library/reading-cover";
import {
  Clock,
  Zap,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

interface BookCardProps {
  reading: Reading;
  subject?: Subject;
  onOpenSessionModal?: (reading: Reading) => void;
  onRefresh?: () => void;
}

export function BookCard({
  reading,
  subject,
  onOpenSessionModal,
  onRefresh,
}: BookCardProps) {
  const [isRead, setIsRead] = useState(reading.is_read);

  const handleToggleRead = async () => {
    const nextVal = !isRead;
    setIsRead(nextVal);
    try {
      if (nextVal) {
        await markReadingAsRead(reading.id);
      } else {
        await markReadingAsUnread(reading.id);
      }
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setIsRead(!nextVal);
    }
  };

  const speed = Number(reading.current_speed_pph) || 20;
  const estimatedHours =
    speed > 0 ? (reading.target_pages / speed).toFixed(1) : "0";

  const themeColor = subject?.theme_color || "#4f46e5";

  return (
    <div className="relative flex flex-col rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-colors hover:border-gray-300 dark:hover:border-gray-700">
      {/* Header Visual Flat */}
      <div className="relative border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        <Link href={`/library/${reading.id}`} className="relative z-10 block">
          <ReadingCover reading={reading} themeColor={themeColor} size="card" />
        </Link>

        {/* Badges superiores flutuantes */}
        <div className="absolute top-2 left-2 z-10 flex gap-1">
          <Badge
            variant="outline"
            className="text-[10px] uppercase font-bold bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 py-0"
          >
            {reading.type === "book" ? "Livro" : "Artigo"}
          </Badge>
          {subject && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
              style={{ color: themeColor }}
            >
              {subject.name}
            </span>
          )}
        </div>

        <div className="absolute top-2 right-2 z-10">
          <button
            type="button"
            onClick={handleToggleRead}
            className={`p-1 rounded border transition-colors ${
              isRead
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-900"
            }`}
            title={isRead ? "Concluído" : "Marcar como lida"}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-3.5 space-y-2.5">
        <div>
            <Link href={`/library/${reading.id}`} className="relative z-10 block">
            <h3
            className={`font-bold text-xs line-clamp-2 ${
              isRead ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"
            }`}
            title={reading.title}
          >
            {reading.title}
            </h3></Link>
          {reading.chapter_title && (
            <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium mt-0.5 line-clamp-1">
              ↳ {reading.chapter_title}
            </p>
          )}
          {reading.author && (
            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1 italic">
              por {reading.author}
            </p>
          )}
        </div>

        {/* Métricas Flat */}
        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-600 dark:text-gray-400 font-mono">
          <div className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-gray-400" />
            <span>{reading.target_pages}p</span>
          </div>

          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-gray-400" />
            <span>{Number(reading.current_speed_pph).toFixed(1)} p/h</span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>~{estimatedHours}h</span>
          </div>

          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span>
              {formatDateBR(reading.deadline, {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          </div>
        </div>

        {reading.isbn && (
          <div className="text-[10px] text-gray-400 font-mono truncate">
            ISBN: {reading.isbn}
          </div>
        )}
        {reading.doi && (
          <div className="text-[10px] text-indigo-500 font-mono truncate">
            DOI: {reading.doi}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3.5 pt-0">
        <Button
          onClick={() => onOpenSessionModal?.(reading)}
          disabled={isRead}
          size="sm"
          className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold h-8 rounded shadow-none"
        >
          <Sparkles className="w-3 h-3 mr-1.5" />
          Sessão de Leitura
        </Button>
      </div>
    </div>
  );
}
