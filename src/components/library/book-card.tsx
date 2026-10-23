"use client";

import { useState, useEffect } from "react";
import { Reading, Subject } from "@/types/database";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
  ExternalLink,
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
  const [loadingCover, setLoadingCover] = useState(false);
  const [isRead, setIsRead] = useState(reading.is_read);

  // Fetch da API do Google Books se for livro com ISBN
  useEffect(() => {
    if (reading.type === "book" && reading.isbn) {
      const cleanIsbn = reading.isbn.replace(/[^0-9X]/gi, "");
      if (!cleanIsbn) return;

      let isMounted = true;
      setLoadingCover(true);

      fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`)
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          const item = data.items?.[0];
          if (item?.volumeInfo) {
            const v = item.volumeInfo;
            const img = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail;
            // Trocar http por https para evitar mixed content
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
          console.error("Erro ao buscar no Google Books:", err);
        })
        .finally(() => {
          if (isMounted) setLoadingCover(false);
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

  // Cálculo da estimativa de horas
  const speed = Number(reading.current_speed_pph) || 20;
  const estimatedHours =
    speed > 0 ? (reading.target_pages / speed).toFixed(1) : "0";

  const themeColor = subject?.theme_color || "#6366f1";

  return (
    <Card className="flex flex-col overflow-hidden transition-all duration-200 hover:shadow-lg border-slate-200 dark:border-slate-800 bg-card">
      {/* Header Visual: Se type=book com capa, exibe capa. Se article ou sem capa, usa theme_color */}
      <div
        className="relative h-44 w-full flex items-center justify-center overflow-hidden border-b"
        style={{
          backgroundColor:
            reading.type === "article" || !bookData?.thumbnail
              ? `${themeColor}15`
              : undefined,
        }}
      >
        {reading.type === "book" && bookData?.thumbnail ? (
          <div className="relative h-full w-full flex items-center justify-center p-3 bg-slate-900/5 dark:bg-slate-900/40">
            {/* Imagem de fundo desfocada para profundidade */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bookData.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-md opacity-25 scale-110"
            />
            {/* Imagem nítida do livro */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bookData.thumbnail}
              alt={reading.title}
              className="relative z-10 h-36 max-w-[110px] object-contain rounded shadow-md transition-transform duration-300 hover:scale-105"
            />
          </div>
        ) : (
          // Visual de Artigo ou Fallback com theme_color
          <div
            className="flex flex-col items-center justify-center text-center p-6 w-full h-full relative"
            style={{
              background: `linear-gradient(135deg, ${themeColor}20 0%, ${themeColor}08 100%)`,
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2 shadow-sm text-white"
              style={{ backgroundColor: themeColor }}
            >
              {reading.type === "article" ? (
                <FileText className="w-7 h-7" />
              ) : (
                <BookOpen className="w-7 h-7" />
              )}
            </div>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: themeColor }}
            >
              {reading.type === "article" ? "Artigo Científico" : "Livro sem Capa"}
            </span>
          </div>
        )}

        {/* Badges superiores flutuantes */}
        <div className="absolute top-2 left-2 z-20 flex gap-1">
          <Badge
            variant="secondary"
            className="text-[10px] uppercase font-bold backdrop-blur-md bg-background/80 shadow-xs"
          >
            {reading.type === "book" ? "Livro" : "Artigo"}
          </Badge>
          {subject && (
            <Badge
              variant="outline"
              className="text-[10px] font-semibold backdrop-blur-md bg-background/80"
              style={{ borderColor: `${themeColor}60`, color: themeColor }}
            >
              {subject.name}
            </Badge>
          )}
        </div>

        <div className="absolute top-2 right-2 z-20">
          <button
            type="button"
            onClick={handleToggleRead}
            className={`p-1.5 rounded-full backdrop-blur-md transition-all shadow-xs ${
              isRead
                ? "bg-emerald-500 text-white"
                : "bg-background/80 text-muted-foreground hover:text-foreground"
            }`}
            title={isRead ? "Leitura concluída!" : "Marcar como lida"}
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conteúdo do Card */}
      <CardContent className="flex-1 p-4 space-y-3">
        <div>
          <h3
            className={`font-bold text-base line-clamp-2 ${
              isRead ? "line-through text-muted-foreground" : "text-slate-900 dark:text-slate-100"
            }`}
            title={reading.title}
          >
            {reading.title}
          </h3>
          {reading.author && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">
              por {reading.author}
            </p>
          )}
        </div>

        {/* Métricas Cognitivas */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>
              <strong>{reading.target_pages}</strong> págs
              {reading.full_book_pages && (
                <span className="text-muted-foreground text-[10px]"> / {reading.full_book_pages}</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              <strong>{Number(reading.current_speed_pph).toFixed(1)}</strong> p/h
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-violet-500 shrink-0" />
            <span>
              ~<strong>{estimatedHours}</strong>h total
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="font-mono text-[11px]">
              {new Date(reading.deadline + "T00:00:00").toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          </div>
        </div>

        {reading.isbn && (
          <div className="text-[10px] text-muted-foreground font-mono truncate">
            ISBN: {reading.isbn}
          </div>
        )}
      </CardContent>

      {/* Footer com Ações */}
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          onClick={() => onOpenSessionModal?.(reading)}
          disabled={isRead}
          size="sm"
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Sessão de Leitura
        </Button>
      </CardFooter>
    </Card>
  );
}
