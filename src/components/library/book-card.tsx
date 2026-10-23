"use client";

import { useState, useEffect } from "react";
import { Reading, Subject } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markReadingAsRead, markReadingAsUnread } from "@/app/actions";
import {
  BookOpen,
  FileText,
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

interface GoogleBookData {
  thumbnail?: string;
  description?: string;
  publishedDate?: string;
  pageCount?: number;
}

export function BookCard({
  reading,
  subject,
  onOpenSessionModal,
  onRefresh,
}: BookCardProps) {
  const [bookData, setBookData] = useState<GoogleBookData | null>(null);
  const [isRead, setIsRead] = useState(reading.is_read);

  useEffect(() => {
    if (reading.type === "book" && reading.isbn) {
      const cleanIsbn = reading.isbn.replace(/[^0-9X]/gi, "");
      if (!cleanIsbn) return;

      let isMounted = true;
      fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`)
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          const item = data.items?.[0];
          if (item?.volumeInfo) {
            const v = item.volumeInfo;
            const img = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail;
            const secureImg = img?.replace(/^http:\/\//i, "https://");
            setBookData({
              thumbnail: secureImg,
              description: v.description,
              publishedDate: v.publishedDate,
              pageCount: v.pageCount,
            });
          }
        })
        .catch((err) => {
          console.warn("Erro ao buscar no Google Books:", err);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [reading.type, reading.isbn]);

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
    <div className="flex flex-col rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-colors hover:border-gray-300 dark:hover:border-gray-700">
      {/* Header Visual Flat */}
      <div
        className="relative h-40 w-full flex items-center justify-center border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
      >
        {reading.type === "book" && bookData?.thumbnail ? (
          <div className="relative h-full w-full flex items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bookData.thumbnail}
              alt={reading.title}
              className="h-32 max-w-[90px] object-contain rounded border border-gray-200 dark:border-gray-800"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-4 w-full h-full">
            <div
              className="w-10 h-10 rounded flex items-center justify-center mb-1.5 text-white"
              style={{ backgroundColor: themeColor }}
            >
              {reading.type === "article" ? (
                <FileText className="w-5 h-5" />
              ) : (
                <BookOpen className="w-5 h-5" />
              )}
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: themeColor }}
            >
              {reading.type === "article" ? "Artigo Científico" : "Livro"}
            </span>
          </div>
        )}

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
          <h3
            className={`font-bold text-xs line-clamp-2 ${
              isRead ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"
            }`}
            title={reading.title}
          >
            {reading.title}
          </h3>
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
              {new Date(reading.deadline + "T00:00:00").toLocaleDateString("pt-BR", {
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
