"use client";

import { useState } from "react";
import { Deliverable, Subject } from "@/types/database";
import { createDeliverable, updateDeliverable, deleteDeliverable } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Check, AlertTriangle, Calendar } from "lucide-react";

interface DeliverablesTableProps {
  initialDeliverables: Deliverable[];
  subjects: Subject[];
  onRefresh?: () => void;
}

export function DeliverablesTable({
  initialDeliverables,
  subjects,
  onRefresh,
}: DeliverablesTableProps) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>(initialDeliverables);
  const [loading, setLoading] = useState(false);

  // Inserção rápida
  const [newSubjectId, setNewSubjectId] = useState(subjects[0]?.id || "");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");

  // Edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Deliverable>>({});

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const isDangerZone = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + "T00:00:00");
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  const getDaysLeft = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + "T00:00:00");
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDate || !newSubjectId) return;
    try {
      setLoading(true);
      const created = await createDeliverable({
        subject_id: newSubjectId,
        title: newTitle.trim(),
        date: newDate,
      });
      if (created) {
        setDeliverables((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
        setNewTitle("");
        setNewDate("");
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar entrega/prova.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      setLoading(true);
      const updated = await updateDeliverable(id, editValues);
      if (updated) {
        setDeliverables((prev) =>
          prev.map((d) => (d.id === id ? { ...d, ...updated } : d)).sort((a, b) => a.date.localeCompare(b.date))
        );
        setEditingId(null);
        setEditValues({});
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar entrega.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta entrega?")) return;
    try {
      setLoading(true);
      await deleteDeliverable(id);
      setDeliverables((prev) => prev.filter((d) => d.id !== id));
      onRefresh?.();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir entrega.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Add Row */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-violet-500" />
          Inserção Rápida de Entrega / Prova (Hard/Soft Deadline)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-3">
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} {sub.is_autonomous ? "(Autônomo)" : "(Faculdade)"}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5">
            <Input
              placeholder="Título da Entrega (ex: P1 de Cálculo, Entrega Artigo Final...)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="bg-background text-sm"
            />
          </div>

          <div className="md:col-span-3">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="bg-background text-sm"
            />
          </div>

          <div className="md:col-span-1">
            <Button
              onClick={handleCreate}
              disabled={loading || !newTitle.trim() || !newDate || !newSubjectId}
              size="sm"
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>
      </div>

      {/* Deliverables Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[180px]">Disciplina</TableHead>
              <TableHead className="min-w-[220px]">Título da Entrega / Prova</TableHead>
              <TableHead className="w-[150px]">Data Limite</TableHead>
              <TableHead className="w-[160px]">Status Temporal</TableHead>
              <TableHead className="w-[100px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliverables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma entrega cadastrada. Adicione uma prova ou trabalho acima.
                </TableCell>
              </TableRow>
            ) : (
              deliverables.map((deliv) => {
                const isEditing = editingId === deliv.id;
                const sub = subjectMap.get(deliv.subject_id);
                const danger = isDangerZone(deliv.date);
                const daysLeft = getDaysLeft(deliv.date);

                return (
                  <TableRow key={deliv.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      {isEditing ? (
                        <select
                          value={editValues.subject_id ?? deliv.subject_id}
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
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: sub?.theme_color || "#6366f1" }}
                          />
                          <span className="text-xs font-semibold">{sub?.name || "Disciplina"}</span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editValues.title ?? deliv.title}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, title: e.target.value }))
                          }
                          className="h-8 text-sm"
                        />
                      ) : (
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {deliv.title}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editValues.date ?? deliv.date}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, date: e.target.value }))
                          }
                          className="h-8 text-xs font-mono"
                        />
                      ) : (
                        <span className="font-mono text-xs">
                          {new Date(deliv.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {danger ? (
                        <Badge className="bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1 w-fit text-[11px] font-semibold animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Zona de Perigo ({daysLeft <= 0 ? "Hoje!" : `${daysLeft}d`})
                        </Badge>
                      ) : daysLeft < 0 ? (
                        <Badge variant="outline" className="text-slate-400 border-slate-300 text-[11px]">
                          Encerrado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[11px] font-normal">
                          Em {daysLeft} dias
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleUpdate(deliv.id)}
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
                              setEditingId(deliv.id);
                              setEditValues({
                                subject_id: deliv.subject_id,
                                title: deliv.title,
                                date: deliv.date,
                              });
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Editar
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDelete(deliv.id)}
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
