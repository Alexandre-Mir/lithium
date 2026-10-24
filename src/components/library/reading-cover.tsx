"use client";

import { useState } from "react";
import { BookOpen, FileText } from "lucide-react";
import type { ReadingType } from "@/types/database";
import { coverUrlHiRes } from "@/lib/cover-url";
import { getReadableTextColor } from "@/lib/colors";

interface ReadingCoverProps {
  reading: { title: string; type: ReadingType; author: string | null; cover_url: string | null };
  themeColor: string;
  size: "card" | "detail";
}

export function ReadingCover({ reading, themeColor, size }: ReadingCoverProps) {
  const original = reading.cover_url;
  const highResolution = coverUrlHiRes(original);
  const [src, setSrc] = useState(highResolution);
  const [failed, setFailed] = useState(false);
  const handleError = () => {
    if (src !== original && original) setSrc(original);
    else setFailed(true);
  };
  const Icon = reading.type === "book" ? BookOpen : FileText;
  const textColor = getReadableTextColor(themeColor);
  return <div className={`relative aspect-[2/3] overflow-hidden ${size === "detail" ? "w-32 shrink-0" : "w-full"}`}>
    {!failed && src ? <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={reading.title} className="h-full w-full object-cover" loading="lazy" decoding="async" onError={handleError} />
    </> : <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center" style={{ backgroundColor: themeColor, color: textColor }}><Icon className="h-7 w-7 shrink-0" /><span className="line-clamp-4 text-xs font-bold">{reading.title}</span>{reading.author && <span className="line-clamp-1 text-[10px]">{reading.author}</span>}<span className="text-[9px] font-bold uppercase tracking-wider">{reading.type === "book" ? "Livro" : "Artigo"}</span></div>}
  </div>;
}
