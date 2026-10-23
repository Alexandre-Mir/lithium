"use client";

import { useState } from "react";
import { Reading, Subject, Deliverable, ReadingType } from "@/types/database";
import {
  createReading,
  updateReading,
  deleteReading,
  markReadingAsRead,
  markReadingAsUnread,
} from "@/app/actions";
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
  Calendar,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  ArrowRight,
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
  const [loading, setLoading] = useState(false);

  // Quick Add Row state
  const [newSubjectId, setNewSubjectId] = useState(subjects[0]?.id || "");
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newType, setNewType] = useState<ReadingType>("book");
  const [newIsbn, setNewIsbn] = useState("");
  const [newFullPages, setNewFullPages] = useState<number | "">("");
  const [newReadFull, setNewReadFull] = useState(false);
  const [newTargetPages, setNewTargetPages] = useState<number | "">(30);
  const [newDeadline, setNewDeadline] = useState("");

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Reading>>({});

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  // Agrupamento ordenado de deliverables por matéria para a Regra Cronológica
  const deliverablesBySubject = new Map<string, Deliverable[]>();
  const sortedDeliverables = [...deliverables].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sortedDeliverables) {
    const list = deliverablesBySubject.get(d.subject_id) ?? [];
    list.push(d);
    deliverablesBySubject.set(d.subject_id, list);
  }

  // Regra Cronológica de Vínculo:
  // reading.deadline <= deliverable.date E reading.deadline > data do deliverable anterior
  const findLinkedDeliverable = (subjectId: string, deadline: string): Deliverable | null => {
    const subDeliverables = deliverablesBySubject.get(subjectId);
    if (!subDeliverables || subDeliverables.length === 0) return null;

    for (let i = 0; i < subDeliverables.length; i++) {
      const cur = subDeliverables[i];
      const prevDate = i > 0 ? subDeliverables[i - 1].date : "1970-01-01";
      if (deadline <= cur.date && deadline > prevDate) {
        return cur;
      }
    }
    // Se for anterior ao primeiro deliverable
    if (deadline <= subDeliverables[0].date) {
      return subDeliverables[0];
    }
    return null;
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
        author: newAuthor.trim() || null,
        type: newType,
        isbn: newIsbn.trim() || null,
        full_book_pages: fullP,
        target_pages: targetP,
        read_full_book: newReadFull,
        deadline: newDeadline,
        is_read: false,
        current_speed_pph: 20.0,
      });

      if (created) {
        setReadings((prev) =>
          [...prev, created].sort((a, b) => a.deadline.localeCompare(b.deadline))
        );
        setNewTitle("");
        setNewAuthor("");
        setNewIsbn("");
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
    // Otimista
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
      // Reverter
      setReadings((prev) =>
        prev.map((r) => (r.id === reading.id ? { ...r, is_read: reading.is_read } : r))
      );
      alert("Erro ao alterar status da leitura.");
    }
  };

  const handleUpdate = async (id: string) => {
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
      alert("Erro ao atualizar leitura.");
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
      {/* Quick Add Row */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-2 mb-3">
          <Book className="w-4 h-4 text-emerald-500" />
          Inserção Rápida de Leitura (Livro ou Artigo)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Disciplina
            </label>
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:ring-1 focus-visible:ring-ring"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Título
            </label>
            <Input
              placeholder="Ex: Cap. 4 - Atenção e Memória"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Autor
            </label>
            <Input
              placeholder="Ex: Daniel Kahneman"
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Tipo
            </label>
            <div className="flex rounded-md border p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setNewType("book")}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs font-medium transition-colors ${
                  newType === "book"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Book className="w-3 h-3" /> Livro
              </button>
              <button
                type="button"
                onClick={() => setNewType("article")}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs font-medium transition-colors ${
                  newType === "article"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="w-3 h-3" /> Artigo
              </button>
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              ISBN (se livro)
            </label>
            <Input
              placeholder="Ex: 9788539003839"
              value={newIsbn}
              onChange={(e) => setNewIsbn(e.target.value)}
              disabled={newType !== "book"}
              className="h-9 text-xs font-mono"
            />
          </div>

          {/* Segunda linha de opções de páginas e data */}
          <div className="md:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
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
              className="h-9 text-xs font-mono"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-lg border h-9">
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
              className="text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300"
            >
              Ler livro completo
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Meta Páginas
            </label>
            <Input
              type="number"
              placeholder="Ex: 40"
              value={newTargetPages}
              onChange={(e) =>
                setNewTargetPages(e.target.value ? parseInt(e.target.value) : "")
              }
              className="h-9 text-xs font-mono"
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Deadline da Leitura
            </label>
            <Input
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="h-9 text-xs font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <Button
              onClick={handleCreate}
              disabled={loading || !newTitle.trim() || !newDeadline || !newSubjectId}
              size="sm"
              className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[50px]">Lido?</TableHead>
              <TableHead className="w-[140px]">Disciplina</TableHead>
              <TableHead className="min-w-[200px]">Título / Autor</TableHead>
              <TableHead className="w-[90px]">Tipo</TableHead>
              <TableHead className="w-[110px]">Páginas</TableHead>
              <TableHead className="w-[100px]">Velocidade</TableHead>
              <TableHead className="w-[130px]">Deadline</TableHead>
              <TableHead className="min-w-[170px]">Vínculo Cronológico</TableHead>
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {readings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma leitura cadastrada. Adicione sua primeira leitura acima.
                </TableCell>
              </TableRow>
            ) : (
              readings.map((reading) => {
                const isEditing = editingId === reading.id;
                const sub = subjectMap.get(reading.subject_id);
                const linkedDeliverable = findLinkedDeliverable(
                  reading.subject_id,
                  reading.deadline
                );

                return (
                  <TableRow
                    key={reading.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      reading.is_read ? "opacity-60 bg-muted/10" : ""
                    }`}
                  >
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleRead(reading)}
                        className={`rounded-full p-1 transition-colors ${
                          reading.is_read
                            ? "text-emerald-600 hover:text-emerald-700"
                            : "text-slate-300 hover:text-slate-500"
                        }`}
                        title={
                          reading.is_read
                            ? "Concluído (gatilhos D+1, D+7, D+21 gerados)"
                            : "Marcar como lido"
                        }
                      >
                        <CheckCircle2
                          className={`w-5 h-5 ${reading.is_read ? "fill-emerald-100" : ""}`}
                        />
                      </button>
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <select
                          value={editValues.subject_id ?? reading.subject_id}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, subject_id: e.target.value }))
                          }
                          className="h-8 w-full rounded border px-2 text-xs bg-background"
                        >
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: sub?.theme_color || "#6366f1" }}
                          />
                          <span className="text-xs font-semibold truncate max-w-[110px]">
                            {sub?.name || "Disciplina"}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <div className="space-y-1">
                          <Input
                            value={editValues.title ?? reading.title}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, title: e.target.value }))
                            }
                            placeholder="Título"
                            className="h-7 text-xs"
                          />
                          <Input
                            value={editValues.author ?? reading.author ?? ""}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, author: e.target.value }))
                            }
                            placeholder="Autor"
                            className="h-7 text-xs"
                          />
                        </div>
                      ) : (
                        <div>
                          <div
                            className={`font-semibold text-sm ${
                              reading.is_read ? "line-through text-muted-foreground" : ""
                            }`}
                          >
                            {reading.title}
                          </div>
                          {reading.author && (
                            <div className="text-xs text-muted-foreground italic">
                              por {reading.author}
                            </div>
                          )}
                          {reading.isbn && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              ISBN: {reading.isbn}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-semibold ${
                          reading.type === "book"
                            ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                            : "border-indigo-200 text-indigo-700 bg-indigo-50"
                        }`}
                      >
                        {reading.type === "book" ? "Livro" : "Artigo"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editValues.target_pages ?? reading.target_pages}
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              target_pages: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="h-8 text-xs font-mono w-20"
                        />
                      ) : (
                        <div className="font-mono text-xs">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {reading.target_pages}p
                          </span>
                          {reading.full_book_pages && (
                            <span className="text-muted-foreground text-[10px] ml-1">
                              / {reading.full_book_pages}p
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>{Number(reading.current_speed_pph).toFixed(1)} p/h</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editValues.deadline ?? reading.deadline}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, deadline: e.target.value }))
                          }
                          className="h-8 text-xs font-mono"
                        />
                      ) : (
                        <div className="font-mono text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span>
                            {new Date(reading.deadline + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    {/* Vínculo Cronológico (Regra de Negócio 4) */}
                    <TableCell>
                      {linkedDeliverable ? (
                        <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border">
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                            {linkedDeliverable.title}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            ({new Date(linkedDeliverable.date + "T00:00:00").toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                            })})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          Sem entrega vinculada
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleUpdate(reading.id)}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setEditValues({});
                            }}
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
                              setEditingId(reading.id);
                              setEditValues({
                                subject_id: reading.subject_id,
                                title: reading.title,
                                author: reading.author,
                                target_pages: reading.target_pages,
                                deadline: reading.deadline,
                              });
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Editar
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDelete(reading.id)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
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
