"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Deliverable, Reading, ReadingSession, SpacedReview, Subject } from "@/types/database";
import { deleteReadingSession, markReadingAsRead, markReadingAsUnread, refreshReadingMetadata } from "@/app/actions";
import { ReadingSessionModal } from "@/components/reading-session-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { computeProjection } from "@/lib/projection";
import { daysUntil, formatDateBR, formatDateTimeBR, todayISO } from "@/lib/dates";
import { getDeadlineTone } from "@/lib/deadline-tone";
import { findLinkedDeliverable } from "@/lib/cascade";
import { ReadingCover } from "@/components/library/reading-cover";
import { startReadingTimer } from "@/lib/reading-timer-store";
import { calculateSuggestedTimerDurationSeconds } from "@/lib/recommendation";
import { formatDuration, pph, sessionSeconds, sessionSourceLabel } from "@/lib/session-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { metadataAttemptsSummary } from "@/lib/metadata-labels";
import { isUnusualSession } from "@/lib/session-anomaly";
import { pagesBeforeSession } from "@/lib/session-pages";
import { getCurrentMilestone } from "@/lib/toc-parser";
import { ArrowLeft, ArrowRight, Calendar, Clock, Pencil, Play, RefreshCw, Trash2 } from "lucide-react";

interface Props {
  reading: Reading & { subject: Subject };
  sessions: ReadingSession[];
  reviews: SpacedReview[];
  deliverables: Deliverable[];
  globalAverageSpeed: number;
  suggestedDeadline?: string | null;
}

export function ReadingDetailView({
  reading,
  sessions,
  reviews,
  deliverables,
  globalAverageSpeed,
  suggestedDeadline = null,
}: Props) {
  const router = useRouter();
  const [optimisticIsRead, setOptimisticIsRead] = useState<boolean | null>(null);
  const isRead = optimisticIsRead ?? reading.is_read;

  const [modalOpen, setModalOpen] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataResult, setMetadataResult] = useState<string | null>(null);
  const [unmarkConfirmOpen, setUnmarkConfirmOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const editingSession = sessions.find((session) => session.id === editingSessionId);
  const deletingSession = sessions.find((session) => session.id === deletingSessionId);

  const projection = computeProjection({ ...reading, is_read: isRead }, sessions, suggestedDeadline);
  const subject = reading.subject;
  const linked = reading.deadline ? findLinkedDeliverable(deliverables, reading.deadline) : null;
  const displayedDeadline = reading.deadline ?? suggestedDeadline;
  const isSuggestedDeadline = !reading.deadline && Boolean(suggestedDeadline);
  const days = displayedDeadline ? daysUntil(displayedDeadline) : null;
  const deadlineTone = isSuggestedDeadline ? "neutral" : getDeadlineTone(days);
  const linkedDays = linked ? daysUntil(linked.date) : null;
  const linkedTone = getDeadlineTone(linkedDays);

  const totalPagesRead = sessions.reduce((sum, session) => sum + session.pages_read, 0);
  const totalSecondsSpent = sessions.reduce((sum, session) => sum + sessionSeconds(session), 0);
  const speed = pph(totalPagesRead, totalSecondsSpent);
  const calibratedSpeed = sessions.length > 0 ? speed : reading.current_speed_pph;
  const milestones = (reading.milestones ?? []).slice().sort((left, right) => left.page - right.page);
  const totalBookPages = reading.full_book_pages ?? reading.target_pages;
  const currentMilestone = getCurrentMilestone(projection.pagesRead, milestones);
  const currentMilestoneIndex = currentMilestone
    ? milestones.findIndex((milestone) => milestone === currentMilestone)
    : -1;
  const nextMilestonePage = currentMilestoneIndex >= 0
    ? milestones[currentMilestoneIndex + 1]?.page
    : undefined;
  const currentChapterEnd = currentMilestoneIndex < 0
    ? null
    : nextMilestonePage === undefined
      ? reading.read_full_book
        ? reading.full_book_pages ?? reading.target_pages
        : reading.target_pages
      : nextMilestonePage - 1;
  const pagesUntilCurrentChapterEnd = currentChapterEnd === null
    ? null
    : Math.max(0, currentChapterEnd - projection.pagesRead);

  const markAsRead = async () => {
    setOptimisticIsRead(true);
    try {
      await markReadingAsRead(reading.id);
      router.refresh();
    } catch {
      setOptimisticIsRead(null);
    }
  };

  const toggleRead = () => {
    if (isRead) {
      setUnmarkConfirmOpen(true);
      return;
    }
    void markAsRead();
  };

  const unmarkAsRead = async () => {
    setOptimisticIsRead(false);
    try {
      await markReadingAsUnread(reading.id);
      router.refresh();
    } catch (error) {
      setOptimisticIsRead(null);
      throw error;
    }
  };

  const updateMetadata = async () => {
    setMetadataLoading(true);
    try {
      const result = await refreshReadingMetadata(reading.id, { force: true });
      const message =
        result.status === "ok"
          ? "Metadados atualizados."
          : result.status === "not_found"
            ? "Sem resultado."
            : result.status === "error"
              ? `Erro: ${metadataAttemptsSummary(result.attempts)}`
              : "Metadados já consultados.";
      setMetadataResult(message);
      router.refresh();
    } catch {
      setMetadataResult("Erro ao atualizar metadados.");
    } finally {
      setMetadataLoading(false);
    }
  };

  const chart = sessions.length >= 2 ? sessions.slice().reverse() : [];
  const chartPoints = chart
    .map(
      (session, index) =>
        `${(index * 100) / Math.max(1, chart.length - 1)},${
          50 - Math.min(45, pph(session.pages_read, sessionSeconds(session)) / 4)
        }`,
    )
    .join(" ");

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
      <Link
        href="/library"
        className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Biblioteca
      </Link>

      {/* Header do Livro / Artigo */}
      <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col md:flex-row gap-5">
          <ReadingCover reading={reading} themeColor={subject.theme_color} size="detail" />

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{reading.type === "book" ? "Livro" : "Artigo"}</Badge>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded"
                style={{
                  color: subject.theme_color,
                  backgroundColor: `${subject.theme_color}15`,
                }}
              >
                {subject.name}
              </span>
              <Badge variant="outline">{isRead ? "Lida" : "Pendente"}</Badge>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reading.title}</h1>

            {reading.chapter_title && <p className="text-xs">↳ {reading.chapter_title}</p>}

            {reading.author && <p className="text-xs italic text-gray-500">por {reading.author}</p>}

            <p className={`text-xs font-mono ${
              isSuggestedDeadline
                ? "italic text-indigo-700 dark:text-indigo-300"
                : deadlineTone === "danger"
                  ? "text-red-600 font-bold"
                  : deadlineTone === "warning"
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-gray-500"
            }`}>
              <Calendar className="inline w-3.5 h-3.5 mr-1" />
              {displayedDeadline ? (
                <>
                  {isSuggestedDeadline ? "Prazo sugerido: " : "Prazo: "}
                  {formatDateBR(displayedDeadline)}
                  {days !== null && (isSuggestedDeadline
                    ? ` (estimativa: ${days}d)`
                    : days < 0 ? ` (Atrasado há ${Math.abs(days)}d)` : days === 0 ? " (Vence hoje)" : ` (${days}d)`)}
                </>
              ) : "Sem prazo fixo"}
            </p>

            {linked && (
              <p className={`flex items-center gap-1 text-xs ${
                linkedTone === "danger"
                  ? "text-red-700 dark:text-red-300"
                  : linkedTone === "warning"
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-gray-600 dark:text-gray-400"
              }`}>
                <ArrowRight className="h-3 w-3 shrink-0" />
                Prazo vinculado à entrega: {linked.title}
                {linkedDays === 0 ? " · vence hoje" : linkedDays !== null && linkedDays < 0 ? ` · atrasada há ${Math.abs(linkedDays)}d` : linkedDays !== null ? ` · em ${linkedDays}d` : ""}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <Button size="sm" onClick={() => startReadingTimer(reading.id, reading.title, {
              currentPage: projection.pagesRead,
              totalPages: reading.full_book_pages ?? reading.target_pages,
            }, calculateSuggestedTimerDurationSeconds({
              ...reading,
              pages_read: projection.pagesRead,
            }, Number(reading.current_speed_pph) || 20))} aria-label="Iniciar cronômetro">
              <Play className="w-3.5 h-3.5 mr-1" /> Iniciar Cronômetro
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setModalOpen(true)}>
              <Clock className="w-3.5 h-3.5 mr-1" />
              Registro Manual
            </Button>
            <Button size="sm" variant="outline" onClick={toggleRead}>
              {isRead ? "Desmarcar" : "Marcar como lida"}
            </Button>
            {(reading.isbn || reading.doi) && (
              <Button
                size="sm"
                variant="outline"
                onClick={updateMetadata}
                disabled={metadataLoading}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1 ${metadataLoading ? "animate-spin" : ""}`}
                />
                Atualizar metadados
              </Button>
            )}
          </div>
        </div>
      </section>

      {metadataResult && <p className="text-xs text-gray-500">{metadataResult}</p>}

      {/* Grid de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Páginas", `${projection.pagesRead}/${reading.target_pages}p`],
          ["Tempo real acumulado", formatDuration(totalSecondsSpent)],
          ["Velocidade", `${calibratedSpeed.toFixed(1)} p/h`],
          ["Restante estimado", isRead ? "Concluída" : `${projection.hoursRemaining.toFixed(1)}h · ${projection.hoursPerDay.toFixed(1)}h/d`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
          >
            <span className="block text-[10px] uppercase text-gray-500">{label}</span>
            <span className="font-mono text-lg font-bold">{value}</span>
            {label === "Velocidade" && (
              <span className="block text-[10px] text-gray-500">
                média geral: {globalAverageSpeed.toFixed(1)} p/h
              </span>
            )}
          </div>
        ))}
      </div>

      {!isRead && projection.pagesRemaining > 0 && displayedDeadline && (
        <p className="text-xs italic text-indigo-700 dark:text-indigo-300">
          Ritmo diário estimado: ~{projection.pagesPerDay} páginas/dia
          {isSuggestedDeadline ? " até o prazo sugerido" : " até o prazo"}.
        </p>
      )}

      {!sessions.length && (
        <p className="text-xs text-gray-500">
          Sem sessões: velocidade estimada de {reading.current_speed_pph.toFixed(1)} p/h. Registre uma sessão para calibrar.
        </p>
      )}

      {/* Barra de Progresso */}
      <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex justify-between text-xs font-mono mb-2">
          <span>Progresso</span>
          <span>
            {isRead ? "Concluída" : <>{projection.progressPercent}%{" "}
              {projection.overTarget > 0 && `(+${projection.overTarget} páginas além da meta)`}</>}
          </span>
        </div>
        <div className="relative h-2 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full"
            style={{
              width: `${projection.progressPercent}%`,
              backgroundColor: subject.theme_color,
            }}
          />
          {milestones.map((milestone, index) => {
            const position = Math.min(100, Math.max(0, (milestone.page / totalBookPages) * 100));
            return (
              <span
                key={`${milestone.page}-${index}`}
                title={milestone.title}
                aria-label={`${milestone.title}, página ${milestone.page}`}
                className="absolute top-0 z-10 h-full w-0.5 -translate-x-1/2 bg-gray-900 dark:bg-gray-100"
                style={{ left: `${position}%` }}
              />
            );
          })}
        </div>
        {projection.pagesRead >= reading.target_pages && !isRead && (
          <div className="mt-3 flex items-center justify-between border border-gray-200 p-2 text-xs">
            <span>Meta atingida: marcar como lida?</span>
            <Button size="sm" onClick={toggleRead}>
              Marcar como lida
            </Button>
          </div>
        )}
      </section>

      {milestones.length > 0 && (
        <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-bold">Próximos Marcos</h2>
          {currentMilestone && pagesUntilCurrentChapterEnd !== null ? (
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-300">
              Faltam <span className="font-mono font-semibold">{pagesUntilCurrentChapterEnd}</span> páginas para terminar o capítulo atual.
            </p>
          ) : (
            <p className="mb-3 text-xs text-gray-500">
              O primeiro marco começa na página {milestones[0].page}.
            </p>
          )}
          <ol className="space-y-0 border-l border-gray-200 dark:border-gray-700">
            {milestones.map((milestone, index) => {
              const isCurrent = index === currentMilestoneIndex;
              const isCompleted = milestone.completed === true || isRead || (currentMilestoneIndex >= 0 && index < currentMilestoneIndex);
              return (
                <li key={`${milestone.page}-${index}`} className="relative pl-4 pb-3 last:pb-0">
                  <span
                    className={`absolute -left-[4px] top-1 h-2 w-2 rounded-full border ${
                      isCurrent
                        ? "border-gray-900 bg-gray-900 dark:border-gray-100 dark:bg-gray-100"
                        : isCompleted
                          ? "border-gray-400 bg-gray-400"
                          : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"
                    }`}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className={isCurrent ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"}>
                      {milestone.title}
                    </span>
                    <span className="inline-flex items-center gap-2 font-mono text-[10px] text-gray-500">
                      p. {milestone.page}
                      <span>{isCurrent ? "Atual" : isCompleted ? "Concluído" : "Próximo"}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Histórico de Sessões */}
      <section className="rounded-md border border-gray-200 bg-white overflow-hidden dark:border-gray-800 dark:bg-gray-900">
        <h2 className="p-3 text-sm font-bold">Histórico de sessões</h2>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="p-2 text-left">Data/hora</th>
              <th className="p-2 text-left">Páginas</th>
              <th className="p-2 text-left">Tempo</th>
              <th className="p-2 text-left">Velocidade</th>
              <th className="p-2 text-left">Origem</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length ? (
              sessions.map((session) => {
                const sessionSpeed = pph(session.pages_read, sessionSeconds(session));
                return (
                  <tr key={session.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="p-2 font-mono">{formatDateTimeBR(session.started_at ?? session.created_at)}</td>
                    <td className="p-2">{session.pages_read}</td>
                    <td className="p-2">{formatDuration(sessionSeconds(session))}</td>
                    <td className="p-2 font-mono">
                      {sessionSpeed.toFixed(1)} p/h
                      {isUnusualSession(session, sessions) && (
                        <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">incomum</Badge>
                      )}
                    </td>
                    <td className="p-2"><Badge variant="outline">{sessionSourceLabel(session.source)}</Badge></td>
                    <td className="p-2 text-right">
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
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  Nenhuma sessão registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {chart.length >= 2 && (
          <svg viewBox="0 0 100 55" className="m-4 h-20 w-full" role="img" aria-label="Velocidade por sessão">
            <polyline
              points={chartPoints}
              fill="none"
              stroke={subject.theme_color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </section>

      {/* Revisões Espaçadas */}
      <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-bold mb-3">Revisões espaçadas</h2>
        {isRead ? (
          <div className="flex flex-wrap gap-2">
            {reviews.map((review, index) => {
              const state =
                review.status === "done"
                  ? "Concluída"
                  : review.review_date < todayISO()
                    ? "Atrasada"
                    : review.review_date === todayISO()
                      ? "Hoje"
                      : "Pendente";
              return (
                <div key={review.id} className="rounded border border-gray-200 p-2 text-xs">
                  <b>D+{[1, 7, 21][index] ?? "?"}</b> {formatDateBR(review.review_date)}{" "}
                  <Badge variant="outline" className="ml-1">
                    {state}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            As revisões são geradas ao concluir a leitura.
          </p>
        )}
      </section>

      {/* Informações Complementares */}
      <section className="rounded-md border border-gray-200 bg-white p-4 text-xs dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-bold mb-3">Informações</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <span>ISBN: {reading.isbn || "—"}</span>
          <span>
            DOI:{" "}
            {reading.doi ? (
              <a
                className="text-indigo-600 hover:underline"
                href={`https://doi.org/${reading.doi}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {reading.doi}
              </a>
            ) : (
              "—"
            )}
          </span>
          <span>Editora: {reading.publisher || "—"}</span>
          <span>Ano: {reading.published_year || "—"}</span>
          <span>Páginas do livro: {reading.full_book_pages || "—"}</span>
          <span>{reading.read_full_book ? "Livro inteiro" : "Trecho"}</span>
          <span>Disciplina: {subject.name}</span>
          <span>Professor: {subject.professor || "—"}</span>
        </div>
      </section>

      <ReadingSessionModal
        reading={{
          id: reading.id,
          title: reading.title,
          currentPage: projection.pagesRead,
          totalPages: reading.full_book_pages ?? reading.target_pages,
        }}
        isOpen={modalOpen}
        mode="manual"
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false);
          router.refresh();
        }}
      />
      <ReadingSessionModal
        reading={editingSession ? {
          id: reading.id,
          title: reading.title,
          currentPage: pagesBeforeSession(sessions, editingSession.id),
          totalPages: reading.full_book_pages ?? reading.target_pages,
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
      <ConfirmDialog
        open={unmarkConfirmOpen}
        onOpenChange={setUnmarkConfirmOpen}
        title="Desmarcar leitura?"
        description={`Desmarcar «${reading.title}»? As revisões D+1, D+7 e D+21 desta leitura serão apagadas.`}
        confirmLabel="Desmarcar"
        onConfirm={unmarkAsRead}
      />
    </div>
  );
}
