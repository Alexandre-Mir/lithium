"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Deliverable, Reading, ReadingSession, SpacedReview, Subject } from "@/types/database";
import { markReadingAsRead, markReadingAsUnread, refreshReadingMetadata } from "@/app/actions";
import { ReadingSessionModal } from "@/components/reading-session-modal";
import { computeProjection } from "@/lib/projection";
import { daysUntil, formatDateBR, formatDateTimeBR, todayISO } from "@/lib/dates";
import { findLinkedDeliverable } from "@/lib/cascade";
import { ReadingCover } from "@/components/library/reading-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { metadataAttemptsSummary } from "@/lib/metadata-labels";
import { ArrowLeft, Calendar, Clock, RefreshCw } from "lucide-react";

interface Props { reading: Reading & { subject: Subject }; sessions: ReadingSession[]; reviews: SpacedReview[]; deliverables: Deliverable[]; globalAverageSpeed: number; }

export function ReadingDetailView({ reading: initialReading, sessions, reviews, deliverables, globalAverageSpeed }: Props) {
  const router = useRouter();
  const [isRead, setIsRead] = useState(initialReading.is_read);
  const [modalOpen, setModalOpen] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataResult, setMetadataResult] = useState<string | null>(null);
  const reading = initialReading;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setIsRead(reading.is_read), [reading.is_read]);
  const projection = computeProjection(reading, sessions);
  const subject = reading.subject;
  const linked = findLinkedDeliverable(deliverables, reading.deadline);
  const days = daysUntil(reading.deadline);
  const speed = sessions.reduce((sum, session) => sum + session.pages_read, 0) / Math.max(1, sessions.reduce((sum, session) => sum + session.duration_minutes, 0)) * 60;
  const calibratedSpeed = sessions.length ? speed : reading.current_speed_pph;

  const toggleRead = async () => {
    const next = !isRead;
    setIsRead(next);
    try { if (next) await markReadingAsRead(reading.id); else await markReadingAsUnread(reading.id); router.refresh(); }
    catch { setIsRead(!next); }
  };
  const updateMetadata = async () => {
    setMetadataLoading(true);
    try { const result = await refreshReadingMetadata(reading.id, { force: true }); setMetadataResult(result.status === "ok" ? "Metadados atualizados." : result.status === "not_found" ? "Sem resultado." : result.status === "error" ? `Erro: ${metadataAttemptsSummary(result.attempts)}` : "Metadados já consultados."); router.refresh(); }
    catch { setMetadataResult("Erro ao atualizar metadados."); }
    finally { setMetadataLoading(false); }
  };
  const chart = sessions.length >= 2 ? sessions.slice().reverse() : [];
  const chartPoints = chart.map((session, index) => `${index * 100 / Math.max(1, chart.length - 1)},${50 - Math.min(45, (session.pages_read / session.duration_minutes) * 60 / 4)}`).join(" ");

  return <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
    <Link href="/library" className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Biblioteca</Link>
    <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col md:flex-row gap-5">
        <ReadingCover reading={reading} themeColor={subject.theme_color} size="detail" />
        <div className="flex-1 space-y-2"><div className="flex flex-wrap gap-1.5"><Badge variant="outline">{reading.type === "book" ? "Livro" : "Artigo"}</Badge><span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ color: subject.theme_color, backgroundColor: `${subject.theme_color}15` }}>{subject.name}</span><Badge variant="outline">{isRead ? "Lida" : "Pendente"}</Badge></div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reading.title}</h1>{reading.chapter_title && <p className="text-xs">↳ {reading.chapter_title}</p>}{reading.author && <p className="text-xs italic text-gray-500">por {reading.author}</p>}<p className={`text-xs font-mono ${days <= 2 ? "text-red-600 font-bold" : "text-gray-500"}`}><Calendar className="inline w-3.5 h-3.5 mr-1" />Prazo: {formatDateBR(reading.deadline)} {days < 0 ? "(Atrasado)" : `(${days}d)`}</p>{linked && <p className="text-xs text-gray-600">→ {linked.title}, em {daysUntil(linked.date)}d</p>}</div>
        <div className="flex flex-wrap items-start gap-2"><Button size="sm" onClick={() => setModalOpen(true)}><Clock className="w-3.5 h-3.5 mr-1" />Registrar sessão</Button><Button size="sm" variant="outline" onClick={toggleRead}>{isRead ? "Desmarcar" : "Marcar como lida"}</Button>{(reading.isbn || reading.doi) && <Button size="sm" variant="outline" onClick={updateMetadata} disabled={metadataLoading}><RefreshCw className={`w-3.5 h-3.5 mr-1 ${metadataLoading ? "animate-spin" : ""}`} />Atualizar metadados</Button>}</div>
      </div>
    </section>{metadataResult && <p className="text-xs text-gray-500">{metadataResult}</p>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[["Páginas", `${projection.pagesRead}/${reading.target_pages}p`], ["Tempo total", `${sessions.reduce((sum, session) => sum + session.duration_minutes, 0)} min`], ["Velocidade", `${calibratedSpeed.toFixed(1)} p/h`], ["Restante", `${projection.hoursRemaining.toFixed(1)}h · ${projection.hoursPerDay.toFixed(1)}h/d`]].map(([label, value]) => <div key={label} className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"><span className="block text-[10px] uppercase text-gray-500">{label}</span><span className="font-mono text-lg font-bold">{value}</span>{label === "Velocidade" && <span className="block text-[10px] text-gray-500">média geral: {globalAverageSpeed.toFixed(1)} p/h</span>}</div>)}</div>
    {!sessions.length && <p className="text-xs text-gray-500">Sem sessões: velocidade estimada de {reading.current_speed_pph.toFixed(1)} p/h. Registre uma sessão para calibrar.</p>}
    <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><div className="flex justify-between text-xs font-mono mb-2"><span>Progresso</span><span>{projection.progressPercent}% {projection.overTarget > 0 && `(+${projection.overTarget} páginas além da meta)`}</span></div><div className="h-2 bg-gray-100 dark:bg-gray-800"><div className="h-full" style={{ width: `${projection.progressPercent}%`, backgroundColor: subject.theme_color }} /></div>{projection.pagesRead >= reading.target_pages && !isRead && <div className="mt-3 flex items-center justify-between border border-gray-200 p-2 text-xs"><span>Meta atingida: marcar como lida?</span><Button size="sm" onClick={toggleRead}>Marcar como lida</Button></div>}</section>
    <section className="rounded-md border border-gray-200 bg-white overflow-hidden dark:border-gray-800 dark:bg-gray-900"><h2 className="p-3 text-sm font-bold">Histórico de sessões</h2><table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-gray-800/50"><tr><th className="p-2 text-left">Data/hora</th><th className="p-2 text-left">Páginas</th><th className="p-2 text-left">Tempo</th><th className="p-2 text-left">Velocidade</th></tr></thead><tbody>{sessions.length ? sessions.map((session) => <tr key={session.id} className="border-t border-gray-100 dark:border-gray-800"><td className="p-2 font-mono">{formatDateTimeBR(session.created_at)}</td><td className="p-2">{session.pages_read}</td><td className="p-2">{session.duration_minutes} min</td><td className="p-2 font-mono">{((session.pages_read / session.duration_minutes) * 60).toFixed(1)} p/h</td></tr>) : <tr><td colSpan={4} className="p-6 text-center text-gray-500">Nenhuma sessão registrada.</td></tr>}</tbody></table>{chart.length >= 2 && <svg viewBox="0 0 100 55" className="m-4 h-20 w-full" role="img" aria-label="Velocidade por sessão"><polyline points={chartPoints} fill="none" stroke={subject.theme_color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>}</section>
    <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><h2 className="text-sm font-bold mb-3">Revisões espaçadas</h2>{isRead ? <div className="flex flex-wrap gap-2">{reviews.map((review, index) => { const state = review.status === "done" ? "Concluída" : review.review_date < todayISO() ? "Atrasada" : review.review_date === todayISO() ? "Hoje" : "Pendente"; return <div key={review.id} className="rounded border border-gray-200 p-2 text-xs"><b>D+{[1, 7, 21][index] ?? "?"}</b> {formatDateBR(review.review_date)} <Badge variant="outline" className="ml-1">{state}</Badge></div>; })}</div> : <p className="text-xs text-gray-500">As revisões são geradas ao concluir a leitura.</p>}</section>
    <section className="rounded-md border border-gray-200 bg-white p-4 text-xs dark:border-gray-800 dark:bg-gray-900"><h2 className="text-sm font-bold mb-3">Informações</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-2"><span>ISBN: {reading.isbn || "—"}</span><span>DOI: {reading.doi ? <a className="text-indigo-600" href={`https://doi.org/${reading.doi}`} target="_blank" rel="noopener noreferrer">{reading.doi}</a> : "—"}</span><span>Editora: {reading.publisher || "—"}</span><span>Ano: {reading.published_year || "—"}</span><span>Páginas do livro: {reading.full_book_pages || "—"}</span><span>{reading.read_full_book ? "Livro inteiro" : "Trecho"}</span><span>Disciplina: {subject.name}</span><span>Professor: {subject.professor || "—"}</span></div></section>
    <ReadingSessionModal reading={reading} isOpen={modalOpen} onClose={() => setModalOpen(false)} onSuccess={() => { setModalOpen(false); router.refresh(); }} />
  </div>;
}
