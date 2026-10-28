"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteReadingSession } from "@/app/actions";
import { ReadingSessionWithReading } from "@/types/database";
import { formatDateTimeBR } from "@/lib/dates";
import { formatDuration, pph, sessionSeconds, sessionSourceLabel } from "@/lib/session-time";
import { isUnusualSession } from "@/lib/session-anomaly";
import { pagesBeforeSession } from "@/lib/session-pages";
import { buildConsistencyHeatmap } from "@/lib/consistency-heatmap";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReadingSessionModal } from "@/components/reading-session-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConsistencyHeatmap } from "@/components/consistency-heatmap";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

interface HistoryViewProps {
  initialSessions: ReadingSessionWithReading[];
  truncated?: boolean;
}

export function HistoryView({ initialSessions, truncated = false }: HistoryViewProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const editingSession = initialSessions.find((session) => session.id === editingSessionId);
  const deletingSession = initialSessions.find((session) => session.id === deletingSessionId);
  const sessionsByReading = new Map<string, ReadingSessionWithReading[]>();
  for (const session of initialSessions) {
    const current = sessionsByReading.get(session.reading_id) ?? [];
    current.push(session);
    sessionsByReading.set(session.reading_id, current);
  }

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

  const totalSeconds = initialSessions.reduce(
    (acc, session) => acc + sessionSeconds(session),
    0
  );
  const totalPages = initialSessions.reduce(
    (acc, s) => acc + (s.pages_read || 0),
    0
  );
  const avgSpeed = pph(totalPages, totalSeconds).toFixed(1);
  const consistencyHeatmap = buildConsistencyHeatmap(initialSessions);

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
            Suas sessões ajudam a calibrar a velocidade de leitura.
          </p>
        </div>

        {/* Resumo Flat */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
          <div className="rounded-md border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900">
            <span className="text-[10px] font-semibold text-gray-500 uppercase block">Tempo Total</span>
            <span className="text-base font-bold font-mono text-gray-900 dark:text-gray-100">
              {formatDuration(totalSeconds)}
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

      <ConsistencyHeatmap model={consistencyHeatmap} />

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
        <div className="block space-y-2 p-2 sm:hidden">
          {filteredSessions.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              Nenhuma sessão de leitura registrada ainda. Inicie uma sessão no Dashboard ou na Biblioteca!
            </div>
          ) : (
            filteredSessions.map((session) => {
              const reading = session.reading;
              const subject = reading?.subject;
              const speed = pph(session.pages_read, sessionSeconds(session)).toFixed(1);
              const sameReadingSessions = sessionsByReading.get(session.reading_id) ?? [];
              const dateStr = formatDateTimeBR(session.started_at ?? session.created_at);

              return (
                <article
                  key={session.id}
                  className="space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <time className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                      {dateStr}
                    </time>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {sessionSourceLabel(session.source)}
                    </Badge>
                  </div>

                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <Link href={`/library/${session.reading_id}`} className="hover:underline">
                        {reading?.title || "Leitura"}
                      </Link>
                    </div>
                    {reading?.chapter_title && (
                      <div className="mt-0.5 break-words text-[11px] text-gray-500">
                        ↳ {reading.chapter_title}
                      </div>
                    )}
                    {reading?.author && (
                      <div className="text-[10px] italic text-gray-400">por {reading.author}</div>
                    )}
                  </div>

                  {subject ? (
                    <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: subject.theme_color || "#4f46e5" }}
                      />
                      <span className="truncate">{subject.name}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-400">Sem disciplina</span>
                  )}

                  <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                    <div>
                      <div className="text-[9px] font-semibold uppercase text-gray-500">Páginas</div>
                      <div className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {session.pages_read} p
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-semibold uppercase text-gray-500">Tempo</div>
                      <div className="font-mono text-xs text-gray-700 dark:text-gray-300">
                        {formatDuration(sessionSeconds(session))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-semibold uppercase text-gray-500">Velocidade</div>
                      <div className="flex flex-wrap items-center gap-1 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        <span>{speed} p/h</span>
                        {isUnusualSession(session, sameReadingSessions) && (
                          <Badge variant="outline" className="px-1 py-0 text-[9px]">incomum</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-gray-100 pt-1 dark:border-gray-800">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar sessão"
                      title="Editar sessão"
                      onClick={() => setEditingSessionId(session.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Excluir sessão"
                      title="Excluir sessão"
                      onClick={() => setDeletingSessionId(session.id)}
                      className="text-gray-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="hidden sm:block">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
              <TableRow className="border-b border-gray-200 dark:border-gray-800">
                <TableHead className="w-[140px] p-2 text-xs">Data e Hora</TableHead>
                <TableHead className="min-w-[220px] p-2 text-xs">Leitura / Capítulo</TableHead>
                <TableHead className="w-[140px] p-2 text-xs">Disciplina</TableHead>
                <TableHead className="w-[100px] p-2 text-xs font-mono">Páginas Lidas</TableHead>
                <TableHead className="w-[100px] p-2 text-xs font-mono">Tempo Gasto</TableHead>
                <TableHead className="w-[110px] p-2 text-xs font-mono">Velocidade Calculada</TableHead>
                <TableHead className="w-[100px] p-2 text-xs">Origem</TableHead>
                <TableHead className="w-[76px] p-2 text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-gray-500">
                    Nenhuma sessão de leitura registrada ainda. Inicie uma sessão no Dashboard ou na Biblioteca!
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions.map((session) => {
                  const reading = session.reading;
                  const subject = reading?.subject;
                  const numericSpeed = pph(session.pages_read, sessionSeconds(session));
                  const speed = numericSpeed.toFixed(1);
                  const sameReadingSessions = sessionsByReading.get(session.reading_id) ?? [];

                  const dateStr = formatDateTimeBR(session.started_at ?? session.created_at);

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
                        {formatDuration(sessionSeconds(session))}
                      </TableCell>

                      <TableCell className="p-2 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                        <span>{speed} p/h</span>
                        {isUnusualSession(session, sameReadingSessions) && (
                          <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">incomum</Badge>
                        )}
                      </TableCell>
                      <TableCell className="p-2 text-[11px] text-gray-600 dark:text-gray-400">
                        <Badge variant="outline" className="text-[10px]">
                          {sessionSourceLabel(session.source)}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-2 text-right">
                        <div className="inline-flex items-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Editar sessão"
                            title="Editar sessão"
                            onClick={() => setEditingSessionId(session.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Excluir sessão"
                            title="Excluir sessão"
                            onClick={() => setDeletingSessionId(session.id)}
                            className="text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ReadingSessionModal
        reading={editingSession ? {
          id: editingSession.reading_id,
          title: editingSession.reading?.title || "Leitura",
          currentPage: pagesBeforeSession(sessionsByReading.get(editingSession.reading_id) ?? [], editingSession.id),
          totalPages: editingSession.reading?.full_book_pages ?? editingSession.reading?.target_pages ?? null,
        } : null}
        session={editingSession ?? null}
        isOpen={Boolean(editingSession)}
        mode="edit"
        onClose={() => setEditingSessionId(null)}
        onSuccess={() => {
          setEditingSessionId(null);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingSession)}
        onOpenChange={(open) => { if (!open) setDeletingSessionId(null); }}
        title="Excluir sessão?"
        description={deletingSession
          ? `Excluir a sessão de ${deletingSession.pages_read} páginas em ${formatDuration(sessionSeconds(deletingSession))}, de ${formatDateTimeBR(deletingSession.started_at ?? deletingSession.created_at)}? A velocidade da leitura será recalculada.`
          : ""}
        confirmLabel="Excluir sessão"
        destructive
        onConfirm={async () => {
          if (!deletingSession) return;
          await deleteReadingSession(deletingSession.id);
          setDeletingSessionId(null);
          router.refresh();
        }}
      />
    </div>
  );
}
