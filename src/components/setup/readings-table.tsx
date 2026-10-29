"use client";

import { useState } from "react";
import Link from "next/link";
import { Reading, ReadingMilestone, Subject, Deliverable } from "@/types/database";
import {
  updateReading,
  deleteReading,
  markReadingAsRead,
  markReadingAsUnread,
} from "@/app/actions";
import { formatDateBR, todayISO } from "@/lib/dates";
import { findLinkedDeliverable } from "@/lib/cascade";
import { validateReadingUpdate } from "@/lib/reading-validation";
import { parseRawTocToMilestones } from "@/lib/toc-parser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addToast } from "@/lib/toast-store";
import {
  Trash2,
  Check,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

interface ReadingsTableProps {
  initialReadings: Reading[];
  subjects: Subject[];
  deliverables: Deliverable[];
  onRefresh?: () => void;
}

function compareReadingDeadlines(left: Reading, right: Reading): number {
  if (left.deadline === null && right.deadline !== null) return 1;
  if (left.deadline !== null && right.deadline === null) return -1;
  if (left.deadline && right.deadline) return left.deadline.localeCompare(right.deadline);
  return left.created_at.localeCompare(right.created_at);
}

function MilestoneListEditor({
  milestones,
  onChange,
}: {
  milestones: ReadingMilestone[];
  onChange: (milestones: ReadingMilestone[]) => void;
}) {
  if (!milestones.length) return null;

  return (
    <div className="space-y-1.5 border-l-2 border-gray-200 pl-2 dark:border-gray-700">
      {milestones.map((milestone, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_68px_28px] items-center gap-1">
          <Input
            value={milestone.title}
            onChange={(event) => onChange(milestones.map((item, itemIndex) =>
              itemIndex === index ? { ...item, title: event.target.value } : item
            ))}
            aria-label={`Título do marco ${index + 1}`}
            className="h-7 rounded px-1.5 text-[11px]"
          />
          <Input
            type="number"
            min={1}
            step={1}
            value={milestone.page}
            onChange={(event) => onChange(milestones.map((item, itemIndex) =>
              itemIndex === index ? { ...item, page: Number(event.target.value) } : item
            ))}
            aria-label={`Página do marco ${index + 1}`}
            className="h-7 rounded px-1.5 text-[11px] font-mono"
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Remover marco ${index + 1}`}
            onClick={() => onChange(milestones.filter((_, itemIndex) => itemIndex !== index))}
            className="h-7 w-7 text-gray-500 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
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

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Reading>>({});
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);
  const [editTocText, setEditTocText] = useState("");
  const [editTocMessage, setEditTocMessage] = useState<string | null>(null);
  const [unmarkReadingId, setUnmarkReadingId] = useState<string | null>(null);
  const [deleteReadingId, setDeleteReadingId] = useState<string | null>(null);
  const unmarkReading = readings.find((reading) => reading.id === unmarkReadingId);
  const deleteReadingTarget = readings.find((reading) => reading.id === deleteReadingId);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const generateEditMilestones = () => {
    const generated = parseRawTocToMilestones(editTocText);
    if (!generated.length) {
      setEditTocMessage("Não encontrei títulos com número de página no sumário.");
      return;
    }
    setEditValues((previous) => ({ ...previous, milestones: generated }));
    setEditTocMessage(`${generated.length} marco(s) gerado(s). Revise antes de salvar.`);
  };

  // Agrupamento ordenado de deliverables por matéria para a Regra Cronológica
  const deliverablesBySubject = new Map<string, Deliverable[]>();
  const sortedDeliverables = [...deliverables].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sortedDeliverables) {
    const list = deliverablesBySubject.get(d.subject_id) ?? [];
    list.push(d);
    deliverablesBySubject.set(d.subject_id, list);
  }

  const handleToggleRead = async (reading: Reading) => {
    if (reading.is_read) {
      setUnmarkReadingId(reading.id);
      return;
    }
    setReadings((prev) => prev.map((r) => (r.id === reading.id ? { ...r, is_read: true } : r)));
    try {
      await markReadingAsRead(reading.id);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setReadings((prev) => prev.map((r) => (r.id === reading.id ? { ...r, is_read: false } : r)));
      addToast({ message: "Erro ao alterar status da leitura." });
    }
  };

  const confirmUnmarkReading = async () => {
    if (!unmarkReading) return;
    setReadings((prev) => prev.map((r) => (r.id === unmarkReading.id ? { ...r, is_read: false } : r)));
    try {
      await markReadingAsUnread(unmarkReading.id);
      onRefresh?.();
    } catch (error) {
      setReadings((prev) => prev.map((r) => (r.id === unmarkReading.id ? { ...r, is_read: true } : r)));
      throw error;
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
            .sort(compareReadingDeadlines)
        );
        setEditingId(null);
        setEditValues({});
        setEditTocText("");
        setEditTocMessage(null);
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
      setEditErrorMessage(err instanceof Error ? err.message : "Erro ao atualizar leitura.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteReading = async () => {
    if (!deleteReadingTarget) return;
    try {
      setLoading(true);
      await deleteReading(deleteReadingTarget.id);
      setReadings((prev) => prev.filter((r) => r.id !== deleteReadingTarget.id));
      onRefresh?.();
    } catch (err) {
      console.error(err);
      throw err instanceof Error ? err : new Error("Erro ao excluir leitura.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Adicione novas leituras pela Biblioteca</p>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">O formulário guiado e as capas ficam junto aos seus livros e artigos.</p>
        </div>
        <Link
          href="/library"
          className="inline-flex min-h-8 w-fit items-center gap-1.5 rounded border border-gray-300 px-2.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Adicionar leitura <ArrowRight className="h-3.5 w-3.5" />
        </Link>
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
      <div className="w-full overflow-x-auto">
      <div className="min-w-[900px] rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
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
                  ? editValues.deadline === undefined ? reading.deadline : editValues.deadline
                  : reading.deadline;
                const sub = subjectMap.get(subjectId);
                const subDeliverables = deliverablesBySubject.get(subjectId) || [];
                const linkedDeliverable = deadline
                  ? findLinkedDeliverable(subDeliverables, deadline)
                  : null;

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
                          {reading.type === "book" && (
                            <div className="mt-2 space-y-1.5">
                              <label htmlFor={`edit-toc-${reading.id}`} className="block text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                                Colar Sumário (Opcional)
                              </label>
                              <textarea
                                id={`edit-toc-${reading.id}`}
                                value={editTocText}
                                onChange={(event) => setEditTocText(event.target.value)}
                                rows={3}
                                placeholder="Cole o índice para gerar os marcos"
                                className="w-full resize-y rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-700 dark:bg-gray-950"
                              />
                              <Button type="button" size="sm" variant="outline" onClick={generateEditMilestones} className="h-6 px-2 text-[10px]">
                                Gerar Marcos
                              </Button>
                              {editTocMessage && <p className="text-[10px] text-gray-500">{editTocMessage}</p>}
                              <MilestoneListEditor
                                milestones={editValues.milestones ?? reading.milestones ?? []}
                                onChange={(milestones) => setEditValues((previous) => ({ ...previous, milestones }))}
                              />
                            </div>
                          )}
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
                        <div className="space-y-1">
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
                          {reading.type === "book" && !reading.read_full_book && (
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={editValues.segment_start_page === undefined
                                ? reading.segment_start_page ?? ""
                                : editValues.segment_start_page ?? ""}
                              onChange={(event) =>
                                setEditValues((prev) => ({
                                  ...prev,
                                  segment_start_page: event.target.value ? Number(event.target.value) : null,
                                }))
                              }
                              className="h-7 w-16 rounded px-1 text-xs"
                              aria-label="Página inicial do trecho"
                              placeholder="Pág. inicial"
                              title="Página inicial do trecho no livro"
                            />
                          )}
                        </div>
                      ) : (
                        `${reading.target_pages}p`
                      )}
                    </TableCell>

                    <TableCell className="p-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {Number(reading.current_speed_pph).toFixed(1)} p/h
                    </TableCell>

                    <TableCell className="p-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {isEditing ? (
                        <div className="space-y-1">
                          <label className="flex items-center gap-1 text-[10px]">
                            <input
                              type="checkbox"
                              checked={deadline !== null}
                              onChange={(event) =>
                                setEditValues((prev) => ({
                                  ...prev,
                                  deadline: event.target.checked ? deadline ?? todayISO() : null,
                                }))
                              }
                              className="h-3 w-3 accent-gray-800"
                            />
                            Prazo fixo
                          </label>
                          {deadline !== null ? (
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
                            <span className="text-[10px] text-gray-400">Sem prazo fixo</span>
                          )}
                        </div>
                      ) : reading.deadline ? (
                        formatDateBR(reading.deadline, { day: "2-digit", month: "2-digit" })
                      ) : (
                        <span className="text-[10px] text-gray-400">Sem prazo</span>
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
                            disabled={loading}
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
                              setEditTocText("");
                              setEditTocMessage(null);
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
                                segment_start_page: reading.segment_start_page,
                                deadline: reading.deadline,
                                milestones: reading.milestones ?? [],
                              });
                              setEditTocText("");
                              setEditTocMessage(null);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-900 h-6 px-1.5"
                          >
                            Editar
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setDeleteReadingId(reading.id)}
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
      <ConfirmDialog
        open={Boolean(unmarkReading)}
        onOpenChange={(open) => { if (!open) setUnmarkReadingId(null); }}
        title="Desmarcar leitura?"
        description={unmarkReading
          ? `Desmarcar «${unmarkReading.title}»? As revisões D+1, D+7 e D+21 desta leitura serão apagadas.`
          : ""}
        confirmLabel="Desmarcar"
        onConfirm={confirmUnmarkReading}
      />
      <ConfirmDialog
        open={Boolean(deleteReadingTarget)}
        onOpenChange={(open) => { if (!open) setDeleteReadingId(null); }}
        title="Excluir leitura?"
        description={deleteReadingTarget
          ? `Deseja realmente excluir «${deleteReadingTarget.title}»?`
          : ""}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDeleteReading}
      />
    </div>
  );
}
