"use client";

import { useState } from "react";
import { ReadingSessionWithReading } from "@/types/database";
import { formatDateTimeBR } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface HistoryViewProps {
  initialSessions: ReadingSessionWithReading[];
  truncated?: boolean;
}

export function HistoryView({ initialSessions, truncated = false }: HistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSessions = initialSessions.filter((s) => {
    const title = s.reading?.title || "";
    const author = s.reading?.author || "";
    const subject = s.reading?.subject?.name || "";
    const term = searchTerm.toLowerCase();
    return (
      title.toLowerCase().includes(term) ||
      author.toLowerCase().includes(term) ||
      subject.toLowerCase().includes(term)
    );
  });

  const totalMinutes = initialSessions.reduce(
    (acc, s) => acc + (s.duration_minutes || 0),
    0
  );
  const totalPages = initialSessions.reduce(
    (acc, s) => acc + (s.pages_read || 0),
    0
  );
  const avgSpeed =
    totalMinutes > 0
      ? ((totalPages / totalMinutes) * 60).toFixed(1)
      : "0";

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/"
              className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Histórico de Sessões de Leitura
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Registro de todas as sessões executadas pelo Motor Cognitivo para calibrar a taxa de absorção.
          </p>
        </div>

        {/* Resumo Flat */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
          <div className="rounded-md border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900">
            <span className="text-[10px] font-semibold text-gray-500 uppercase block">Tempo Total</span>
            <span className="text-base font-bold font-mono text-gray-900 dark:text-gray-100">
              {formatHours(totalMinutes)}
            </span>
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900">
            <span className="text-[10px] font-semibold text-gray-500 uppercase block">Páginas</span>
            <span className="text-base font-bold font-mono text-gray-900 dark:text-gray-100">
              {totalPages}p
            </span>
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900">
            <span className="text-[10px] font-semibold text-gray-500 uppercase block">Velocidade Média</span>
            <span className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">
              {avgSpeed} p/h
            </span>
          </div>
        </div>
      </div>

      {truncated && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Dados truncados em 1.000 registros
        </div>
      )}

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
        <Input
          placeholder="Filtrar por título, autor ou disciplina..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-9 pl-9 text-xs rounded-md border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
        />
      </div>

      {/* Tabela de Sessões */}
      <div className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
            <TableRow className="border-b border-gray-200 dark:border-gray-800">
              <TableHead className="w-[140px] p-2 text-xs">Data e Hora</TableHead>
              <TableHead className="min-w-[220px] p-2 text-xs">Leitura / Capítulo</TableHead>
              <TableHead className="w-[140px] p-2 text-xs">Disciplina</TableHead>
              <TableHead className="w-[100px] p-2 text-xs font-mono">Páginas Lidas</TableHead>
              <TableHead className="w-[100px] p-2 text-xs font-mono">Tempo Gasto</TableHead>
              <TableHead className="w-[110px] p-2 text-xs font-mono">Velocidade Calculada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-gray-500">
                  Nenhuma sessão de leitura registrada ainda. Inicie uma sessão no Dashboard ou na Biblioteca!
                </TableCell>
              </TableRow>
            ) : (
              filteredSessions.map((session) => {
                const reading = session.reading;
                const subject = reading?.subject;
                const speed =
                  session.duration_minutes > 0
                    ? ((session.pages_read / session.duration_minutes) * 60).toFixed(1)
                    : "0";

                const dateStr = formatDateTimeBR(session.created_at);

                return (
                  <TableRow
                    key={session.id}
                    className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <TableCell className="p-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {dateStr}
                    </TableCell>

                    <TableCell className="p-2">
                      <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                        <Link href={`/library/${session.reading_id}`} className="hover:underline">{reading?.title || "Leitura"}</Link>
                      </div>
                      {reading?.chapter_title && (
                        <div className="text-[11px] text-gray-500">
                          ↳ {reading.chapter_title}
                        </div>
                      )}
                      {reading?.author && (
                        <div className="text-[10px] text-gray-400 italic">
                          por {reading.author}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="p-2">
                      {subject ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: subject.theme_color || "#4f46e5" }}
                          />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                            {subject.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>

                    <TableCell className="p-2 font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {session.pages_read} páginas
                    </TableCell>

                    <TableCell className="p-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {session.duration_minutes} min
                    </TableCell>

                    <TableCell className="p-2 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                      {speed} p/h
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
