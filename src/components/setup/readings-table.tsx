"use client";

import { useState } from "react";
import Link from "next/link";
import { Reading, Subject, Deliverable, ReadingType } from "@/types/database";
import {
  createReading,
  updateReading,
  deleteReading,
  markReadingAsRead,
  markReadingAsUnread,
  lookupBookByIsbn,
  lookupArticleByDoi,
} from "@/app/actions";
import { formatDateBR } from "@/lib/dates";
import { findLinkedDeliverable } from "@/lib/cascade";
import { validateReadingUpdate } from "@/lib/reading-validation";
import { metadataAttemptsSummary } from "@/lib/metadata-labels";
import type { MetadataAttempt } from "@/lib/book-metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Check,
  Book,
  FileText,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ReadingsTableProps {
  initialReadings: Reading[];
  subjects: Subject[];
  deliverables: Deliverable[];
  onRefresh?: () => void;
}

export function ReadingsTable({
  initialReadings,
  subjects,
  deliverables,
  onRefresh,
}: ReadingsTableProps) {
  const [readings, setReadings] = useState<Reading[]>(initialReadings);
  const [prevInitialReadings, setPrevInitialReadings] = useState(initialReadings);

  if (prevInitialReadings !== initialReadings) {
    setPrevInitialReadings(initialReadings);
    setReadings(initialReadings);
  }
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  // Quick Add Row state
  const [newSubjectId, setNewSubjectId] = useState(subjects[0]?.id || "");
  const [newType, setNewType] = useState<ReadingType>("book");
  const [newTitle, setNewTitle] = useState("");
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newIsbn, setNewIsbn] = useState("");
  const [newDoi, setNewDoi] = useState("");
  const [newFullPages, setNewFullPages] = useState<number | "">("");
  const [newReadFull, setNewReadFull] = useState(false);
  const [newTargetPages, setNewTargetPages] = useState<number | "">(30);
  const [newDeadline, setNewDeadline] = useState("");
  const [newCover, setNewCover] = useState<string | null>(null);
  const [newPublisher, setNewPublisher] = useState<string | null>(null);
  const [newPublishedYear, setNewPublishedYear] = useState<number | null>(null);
  const [newMetadataSource, setNewMetadataSource] = useState<string | null>(null);
  const [lookedUpIsbn, setLookedUpIsbn] = useState("");
  const [lookedUpDoi, setLookedUpDoi] = useState("");
  const [metadataNotice, setMetadataNotice] = useState<{ kind: "not_found" | "error"; text: string; attempts: MetadataAttempt[]; type: "ISBN" | "DOI" } | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Reading>>({});
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  // Agrupamento ordenado de deliverables por matéria para a Regra Cronológica
  const deliverablesBySubject = new Map<string, Deliverable[]>();
  const sortedDeliverables = [...deliverables].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sortedDeliverables) {
    const list = deliverablesBySubject.get(d.subject_id) ?? [];
    list.push(d);
    deliverablesBySubject.set(d.subject_id, list);
  }

  // ============================================================
  // FETCH AUTOMÁTICO: GOOGLE BOOKS API (onBlur do ISBN)
  // ============================================================
  const handleIsbnBlur = async () => {
    const cleanIsbn = newIsbn.replace(/[^0-9X]/gi, "");
    if (!cleanIsbn || cleanIsbn.length < 10 || cleanIsbn === lookedUpIsbn) return;

    try {
      setFetchingMetadata(true);
      const result = await lookupBookByIsbn(cleanIsbn);
      if (result.status === "ok") {
        setLookedUpIsbn(cleanIsbn);
        setMetadataNotice(null);
        if (result.data.title && !newTitle) setNewTitle(result.data.title);
        if (result.data.authors && !newAuthor) setNewAuthor(result.data.authors);
        if (result.data.pageCount && !newFullPages) setNewFullPages(result.data.pageCount);
        setNewCover(result.data.coverUrl);
        setNewPublisher(result.data.publisher);
        setNewPublishedYear(result.data.publishedYear);
        setNewMetadataSource(result.data.source);
      } else if (result.status === "not_found") {
        setLookedUpIsbn(cleanIsbn);
        setMetadataNotice({ kind: "not_found", text: "Nenhum resultado para este ISBN. Preencha manualmente.", attempts: result.attempts, type: "ISBN" });
      } else {
        setMetadataNotice({ kind: "error", text: `Sem resposta dos provedores (${metadataAttemptsSummary(result.attempts)}). Preencha manualmente ou tente de novo.`, attempts: result.attempts, type: "ISBN" });
      }
    } catch {
      setMetadataNotice({ kind: "error", text: "Sem resposta dos provedores. Preencha manualmente ou tente de novo.", attempts: [], type: "ISBN" });
    } finally {
      setFetchingMetadata(false);
    }
  };

  // ============================================================
  // FETCH AUTOMÁTICO: CROSSREF API (onBlur do DOI)
  // ============================================================
  const handleDoiBlur = async () => {
    const cleanDoi = newDoi.trim().replace(/^https?:\/\/doi\.org\//i, "");
    if (!cleanDoi || cleanDoi.length < 5 || cleanDoi === lookedUpDoi) return;

    try {
      setFetchingMetadata(true);
      const result = await lookupArticleByDoi(cleanDoi);
      if (result.status === "ok") {
        setLookedUpDoi(cleanDoi);
        setMetadataNotice(null);
        if (result.data.title && !newTitle) setNewTitle(result.data.title);
        if (result.data.authors && !newAuthor) setNewAuthor(result.data.authors);
        setNewPublisher(result.data.publisher);
        setNewPublishedYear(result.data.publishedYear);
        setNewMetadataSource(result.data.source);
      } else if (result.status === "not_found") {
        setLookedUpDoi(cleanDoi);
        setMetadataNotice({ kind: "not_found", text: "Nenhum resultado para este DOI. Preencha manualmente.", attempts: result.attempts, type: "DOI" });
      } else {
        setMetadataNotice({ kind: "error", text: `Sem resposta dos provedores (${metadataAttemptsSummary(result.attempts)}). Preencha manualmente ou tente de novo.`, attempts: result.attempts, type: "DOI" });
      }
    } catch {
      setMetadataNotice({ kind: "error", text: "Sem resposta dos provedores. Preencha manualmente ou tente de novo.", attempts: [], type: "DOI" });
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newSubjectId || !newDeadline) return;
    try {
      setLoading(true);
      const targetP = typeof newTargetPages === "number" ? newTargetPages : 0;
      const fullP = typeof newFullPages === "number" ? newFullPages : null;

      const created = await createReading({
        subject_id: newSubjectId,
        title: newTitle.trim(),
        chapter_title: newType === "book" ? newChapterTitle.trim() || null : null,
        author: newAuthor.trim() || null,
        type: newType,
        isbn: newType === "book" ? newIsbn.trim() || null : null,
        doi: newType === "article" ? newDoi.trim() || null : null,
        full_book_pages: fullP,
        target_pages: targetP,
        read_full_book: newReadFull,
        deadline: newDeadline,
        is_read: false,
        cover_url: newCover,
        publisher: newPublisher,
        published_year: newPublishedYear,
        metadata_source: newMetadataSource,
        metadata_fetched_at: null,
      });

      if (created) {
        setReadings((prev) =>
          [...prev, created].sort((a, b) => a.deadline.localeCompare(b.deadline))
        );
        setNewTitle("");
        setNewChapterTitle("");
        setNewAuthor("");
        setNewIsbn("");
        setNewDoi("");
        setNewCover(null);
        setNewPublisher(null);
        setNewPublishedYear(null);
        setNewMetadataSource(null);
        setLookedUpIsbn("");
        setLookedUpDoi("");
        setNewFullPages("");
        setNewReadFull(false);
        setNewTargetPages(30);
        setNewDeadline("");
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar leitura.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRead = async (reading: Reading) => {
    const nextStatus = !reading.is_read;
    setReadings((prev) =>
      prev.map((r) => (r.id === reading.id ? { ...r, is_read: nextStatus } : r))
    );
    try {
      if (nextStatus) {
        await markReadingAsRead(reading.id);
      } else {
        await markReadingAsUnread(reading.id);
      }
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setReadings((prev) =>
        prev.map((r) => (r.id === reading.id ? { ...r, is_read: reading.is_read } : r))
      );
      alert("Erro ao alterar status da leitura.");
    }
  };

  const handleUpdate = async (id: string) => {
    setEditErrorMessage(null);
    const validationError = validateReadingUpdate(editValues);
    if (validationError) {
      setEditErrorMessage(validationError);
      return;
    }

    try {
      setLoading(true);
      const updated = await updateReading(id, editValues);
      if (updated) {
        setReadings((prev) =>
          prev
            .map((r) => (r.id === id ? { ...r, ...updated } : r))
            .sort((a, b) => a.deadline.localeCompare(b.deadline))
        );
        setEditingId(null);
        setEditValues({});
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
      setEditErrorMessage(err instanceof Error ? err.message : "Erro ao atualizar leitura.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta leitura?")) return;
    try {
      setLoading(true);
      await deleteReading(id);
      setReadings((prev) => prev.filter((r) => r.id !== id));
      onRefresh?.();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir leitura.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Formulário Dinâmico de Inserção - Flat Design */}
      <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2">
            Inserção Rápida de Leitura
            {fetchingMetadata && (
              <span className="inline-flex items-center gap-1 text-[11px] font-normal text-indigo-600 dark:text-indigo-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Buscando metadados...
              </span>
            )}
          </h3>

          {/* Seletor Dinâmico de Tipo: Livro vs Artigo */}
          <div className="flex rounded border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950">
            <button
              type="button"
              onClick={() => setNewType("book")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                newType === "book"
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <Book className="w-3 h-3" /> Livro
            </button>
            <button
              type="button"
              onClick={() => setNewType("article")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                newType === "article"
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <FileText className="w-3 h-3" /> Artigo
            </button>
          </div>
        </div>

        {/* Linha 1: Campos Específicos por Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
          <div className="md:col-span-3">
            <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
              Disciplina
            </label>
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              className="w-full h-8 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-xs"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {newType === "book" ? (
            <>
              {/* LIVRO: ISBN com onBlur, Título do Livro, Título do Capítulo */}
              <div className="md:col-span-2">
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  ISBN (auto-preenche)
                </label>
                <Input
                  placeholder="Ex: 9788539003839"
                  value={newIsbn}
                  onChange={(e) => {
                    setNewIsbn(e.target.value);
                    if (e.target.value.replace(/[^0-9X]/gi, "") !== lookedUpIsbn) {
                      setLookedUpIsbn("");
                      setNewCover(null);
                      setNewPublisher(null);
                      setNewPublishedYear(null);
                      setNewMetadataSource(null);
                    }
                  }}
                  onBlur={handleIsbnBlur}
                  className="h-8 text-xs font-mono rounded border-gray-300 dark:border-gray-700"
                />
              </div>

              <div className="md:col-span-4">
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  Título do Livro *
                </label>
                <Input
                  placeholder="Nome do Livro"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 text-xs rounded border-gray-300 dark:border-gray-700"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  Título do Capítulo (Opcional)
                </label>
                <Input
                  placeholder="Ex: Cap. 3 - Carga Cognitiva"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  className="h-8 text-xs rounded border-gray-300 dark:border-gray-700"
                />
              </div>
            </>
          ) : (
            <>
              {/* ARTIGO: DOI com onBlur, Título do Artigo */}
              <div className="md:col-span-3">
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  DOI (auto-preenche)
                </label>
                <Input
                  placeholder="Ex: 10.1037/0033-295X.101.2.346"
                  value={newDoi}
                  onChange={(e) => {
                    setNewDoi(e.target.value);
                    if (e.target.value.trim() !== lookedUpDoi) {
                      setLookedUpDoi("");
                      setNewPublisher(null);
                      setNewPublishedYear(null);
                      setNewMetadataSource(null);
                    }
                  }}
                  onBlur={handleDoiBlur}
                  className="h-8 text-xs font-mono rounded border-gray-300 dark:border-gray-700"
                />
              </div>

              <div className="md:col-span-6">
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  Título do Artigo *
                </label>
                <Input
                  placeholder="Nome do Artigo Científico"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 text-xs rounded border-gray-300 dark:border-gray-700"
                />
              </div>
            </>
          )}
        </div>

        {metadataNotice && (
          <div className={`md:col-span-12 mt-2 flex items-center justify-between gap-2 border p-2 text-[11px] ${metadataNotice.kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
            <span>{metadataNotice.text}</span>
            {metadataNotice.kind === "error" && <Button type="button" size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => { if (metadataNotice.type === "ISBN") { setLookedUpIsbn(""); void handleIsbnBlur(); } else { setLookedUpDoi(""); void handleDoiBlur(); } }}>Tentar de novo</Button>}
          </div>
        )}

        {/* Linha 2: Autor, Páginas, Deadline e Botão */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800">
          <div className="md:col-span-3">
            <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
              Autor(es)
            </label>
            <Input
              placeholder="Ex: John Sweller"
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              className="h-8 text-xs rounded border-gray-300 dark:border-gray-700"
            />
          </div>

          {newType === "book" && (
            <>
              <div className="md:col-span-2">
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  Total Livro (Págs)
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 350"
                  value={newFullPages}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : "";
                    setNewFullPages(val);
                    if (newReadFull && typeof val === "number") {
                      setNewTargetPages(val);
                    }
                  }}
                  className="h-8 text-xs font-mono rounded border-gray-300 dark:border-gray-700"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/60 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 h-8">
                <Switch
                  id="new-full-book"
                  checked={newReadFull}
                  onCheckedChange={(checked) => {
                    setNewReadFull(checked);
                    if (checked && typeof newFullPages === "number") {
                      setNewTargetPages(newFullPages);
                    }
                  }}
                />
                <label
                  htmlFor="new-full-book"
                  className="text-[11px] font-medium cursor-pointer text-gray-700 dark:text-gray-300 truncate"
                >
                  Livro inteiro
                </label>
              </div>
            </>
          )}

          <div className={newType === "book" ? "md:col-span-2" : "md:col-span-3"}>
            <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
              Meta Páginas *
            </label>
            <Input
              type="number"
              value={newTargetPages}
              onChange={(e) =>
                setNewTargetPages(e.target.value ? parseInt(e.target.value) : "")
              }
              className="h-8 text-xs font-mono rounded border-gray-300 dark:border-gray-700"
            />
          </div>

          <div className={newType === "book" ? "md:col-span-2" : "md:col-span-4"}>
            <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
              Deadline *
            </label>
            <Input
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="h-8 text-xs font-mono rounded border-gray-300 dark:border-gray-700"
            />
          </div>

          <div className={newType === "book" ? "md:col-span-1" : "md:col-span-2"}>
            <Button
              onClick={handleCreate}
              disabled={loading || !newTitle.trim() || !newDeadline || !newSubjectId}
              size="sm"
              className="w-full h-8 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold rounded shadow-none"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      </div>

      {editErrorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span className="font-medium">{editErrorMessage}</span>
          <button
            type="button"
            onClick={() => setEditErrorMessage(null)}
            className="ml-auto text-xs font-bold text-red-700 dark:text-red-300"
            aria-label="Fechar mensagem de erro"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabela de Leituras - Flat Design */}
      <div className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
            <TableRow className="border-b border-gray-200 dark:border-gray-800">
              <TableHead className="w-[30px] p-2 text-center">Status</TableHead>
              <TableHead className="w-[120px] p-2 text-xs">Disciplina</TableHead>
              <TableHead className="min-w-[200px] p-2 text-xs">Título / Identificador</TableHead>
              <TableHead className="w-[80px] p-2 text-xs">Tipo</TableHead>
              <TableHead className="w-[80px] p-2 text-xs">Págs</TableHead>
              <TableHead className="w-[90px] p-2 text-xs">Velocidade</TableHead>
              <TableHead className="w-[100px] p-2 text-xs">Prazo</TableHead>
              <TableHead className="min-w-[150px] p-2 text-xs">Vínculo</TableHead>
              <TableHead className="w-[90px] p-2 text-right text-xs">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {readings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-6 text-gray-500 text-xs">
                  Nenhuma leitura cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              readings.map((reading) => {
                const isEditing = editingId === reading.id;
                const subjectId = isEditing
                  ? editValues.subject_id ?? reading.subject_id
                  : reading.subject_id;
                const deadline = isEditing
                  ? editValues.deadline ?? reading.deadline
                  : reading.deadline;
                const sub = subjectMap.get(subjectId);
                const subDeliverables = deliverablesBySubject.get(subjectId) || [];
                const linkedDeliverable = findLinkedDeliverable(
                  subDeliverables,
                  deadline
                );

                return (
                  <TableRow
                    key={reading.id}
                    className={`border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${
                      reading.is_read ? "opacity-60 bg-gray-50/50 dark:bg-gray-900/50" : ""
                    }`}
                  >
                    <TableCell className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleRead(reading)}
                        className={`transition-colors ${
                          reading.is_read
                            ? "text-emerald-600"
                            : "text-gray-300 hover:text-gray-500"
                        }`}
                        title={reading.is_read ? "Concluído (D+1, D+7, D+21 gerados)" : "Marcar como lido"}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </TableCell>

                    <TableCell className="p-2">
                      {isEditing ? (
                        <select
                          value={subjectId}
                          onChange={(event) =>
                            setEditValues((prev) => ({ ...prev, subject_id: event.target.value }))
                          }
                          className="h-7 w-full rounded border border-gray-300 bg-white px-1 text-[11px] dark:border-gray-700 dark:bg-gray-950"
                          aria-label="Disciplina da leitura"
                        >
                          {subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>{subject.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: sub?.theme_color || "#4f46e5" }}
                          />
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[100px]">
                            {sub?.name || "Disciplina"}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="p-2">
                      {isEditing ? (
                        <div className="space-y-1">
                          <Input
                            value={editValues.title ?? reading.title}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, title: e.target.value }))
                            }
                            className="h-6 text-xs rounded"
                          />
                          {reading.type === "book" && (
                            <Input
                              value={editValues.chapter_title ?? ""}
                              onChange={(e) =>
                                setEditValues((prev) => ({ ...prev, chapter_title: e.target.value || null }))
                              }
                              placeholder="Capítulo"
                              className="h-6 text-xs rounded"
                            />
                          )}
                          <Input
                            value={editValues.author ?? reading.author ?? ""}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, author: e.target.value }))
                            }
                            placeholder="Autor"
                            className="h-6 text-xs rounded"
                          />
                        </div>
                      ) : (
                        <div>
                          <div
                            className={`font-semibold text-xs ${
                              reading.is_read ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"
                            }`}
                          >
                            <Link href={`/library/${reading.id}`} className="text-indigo-600 hover:underline">{reading.title}</Link>
                          </div>
                          {reading.chapter_title && (
                            <div className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">
                              ↳ {reading.chapter_title}
                            </div>
                          )}
                          {reading.author && (
                            <div className="text-[10px] text-gray-500 italic">
                              por {reading.author}
                            </div>
                          )}
                          {reading.isbn && (
                            <span className="text-[9px] font-mono text-gray-400 block">
                              ISBN: {reading.isbn}
                            </span>
                          )}
                          {reading.doi && (
                            <span className="text-[9px] font-mono text-indigo-500 block truncate max-w-[240px]">
                              DOI: {reading.doi}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="p-2">
                      <Badge
                        variant="outline"
                        className="text-[9px] py-0 px-1 border-gray-300 text-gray-700 dark:text-gray-300"
                      >
                        {reading.type === "book" ? "Livro" : "Artigo"}
                      </Badge>
                    </TableCell>

                    <TableCell className="p-2 font-mono text-xs">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={editValues.target_pages ?? reading.target_pages}
                          onChange={(event) =>
                            setEditValues((prev) => ({ ...prev, target_pages: Number(event.target.value) }))
                          }
                          className="h-7 w-16 rounded px-1 text-xs"
                          aria-label="Meta de páginas"
                        />
                      ) : (
                        `${reading.target_pages}p`
                      )}
                    </TableCell>

                    <TableCell className="p-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {Number(reading.current_speed_pph).toFixed(1)} p/h
                    </TableCell>

                    <TableCell className="p-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {isEditing ? (
                        <Input
                          type="date"
                          value={deadline}
                          onChange={(event) =>
                            setEditValues((prev) => ({ ...prev, deadline: event.target.value }))
                          }
                          className="h-7 w-[125px] rounded px-1 text-[11px]"
                          aria-label="Prazo da leitura"
                        />
                      ) : (
                        formatDateBR(reading.deadline, { day: "2-digit", month: "2-digit" })
                      )}
                    </TableCell>

                    <TableCell className="p-2">
                      {linkedDeliverable ? (
                        <div className="flex items-center gap-1 text-[11px] text-gray-700 dark:text-gray-300">
                          <ArrowRight className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {linkedDeliverable.title}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </TableCell>

                    <TableCell className="p-2 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleUpdate(reading.id)}
                            className="text-emerald-600 h-6 w-6"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setEditValues({});
                              setEditErrorMessage(null);
                            }}
                            className="h-6 w-6"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditErrorMessage(null);
                              setEditingId(reading.id);
                              setEditValues({
                                subject_id: reading.subject_id,
                                title: reading.title,
                                chapter_title: reading.chapter_title,
                                author: reading.author,
                                target_pages: reading.target_pages,
                                deadline: reading.deadline,
                              });
                            }}
                            className="text-xs text-gray-500 hover:text-gray-900 h-6 px-1.5"
                          >
                            Editar
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDelete(reading.id)}
                            className="text-red-500 hover:text-red-700 h-6 w-6"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
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
