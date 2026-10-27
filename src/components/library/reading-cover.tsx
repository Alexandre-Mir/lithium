"use client";

import { useState } from "react";
import type { ReadingType } from "@/types/database";
import { coverUrlHiRes } from "@/lib/cover-url";
import { getReadableTextColor } from "@/lib/colors";

interface ReadingCoverProps {
  reading: {
    title: string;
    type: ReadingType;
    author: string | null;
    cover_url: string | null;
  };
  themeColor: string;
  size: "card" | "detail";
}

export function ReadingCover({ reading, themeColor, size }: ReadingCoverProps) {
  const original = reading.cover_url;
  const highResolution = coverUrlHiRes(original);

  const [lastCoverUrl, setLastCoverUrl] = useState(original);
  const [fallbackToOriginal, setFallbackToOriginal] = useState(false);
  const [failed, setFailed] = useState(false);

  if (lastCoverUrl !== original) {
    setLastCoverUrl(original);
    setFallbackToOriginal(false);
    setFailed(false);
  }

  const src = fallbackToOriginal ? original : highResolution;

  const handleError = () => {
    if (!fallbackToOriginal && original && highResolution !== original) {
      setFallbackToOriginal(true);
    } else {
      setFailed(true);
    }
  };

  const textColor = getReadableTextColor(themeColor);
  const initials = reading.title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toLocaleUpperCase("pt-BR") || "L";

  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden ${
        size === "detail" ? "w-32 shrink-0" : "w-full"
      }`}
    >
      {!failed && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={reading.title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={handleError}
        />
      ) : (
        <div
          className="relative flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center"
          style={{ backgroundColor: themeColor, color: textColor }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/15" />
          <span aria-hidden="true" className="relative font-mono text-3xl font-bold tracking-tight">
            {initials}
          </span>
          <span className="relative line-clamp-4 text-xs font-bold">{reading.title}</span>
          {reading.author && (
            <span className="relative line-clamp-1 text-[10px]">{reading.author}</span>
          )}
          <span className="relative text-[9px] font-bold uppercase tracking-wider">
            {reading.type === "book" ? "Livro" : "Artigo"}
          </span>
        </div>
      )}
    </div>
  );
}
