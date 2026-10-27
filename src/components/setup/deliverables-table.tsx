"use client";

import { useState } from "react";
import { Deliverable, Subject } from "@/types/database";
import { createDeliverable, updateDeliverable, deleteDeliverable } from "@/app/actions";
import { daysUntil, formatDateBR } from "@/lib/dates";
import { getDeadlineTone } from "@/lib/deadline-tone";
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
import { Plus, Trash2, Check, AlertTriangle } from "lucide-react";

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
  const [prevInitialDeliverables, setPrevInitialDeliverables] = useState(initialDeliverables);

  if (prevInitialDeliverables !== initialDeliverables) {
    setPrevInitialDeliverables(initialDeliverables);
    setDeliverables(initialDeliverables);
  }
  const [loading, setLoading] = useState(false);

  // Inserção rápida
  const [newSubjectId, setNewSubjectId] = useState(subjects[0]?.id || "");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");

  // Edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Deliverable>>({});

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

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
      {/* Quick Add Row Flat */}
      <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-3">
          Cadastrar Entrega / Prova
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          <div className="md:col-span-3">
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

          <div className="md:col-span-5">
            <Input
              placeholder="Título da Prova ou Trabalho *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-8 text-xs rounded border-gray-300 dark:border-gray-700"
            />
          </div>

          <div className="md:col-span-3">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-8 text-xs font-mono rounded border-gray-300 dark:border-gray-700"
            />
          </div>

          <div className="md:col-span-1">
            <Button
              onClick={handleCreate}
              disabled={loading || !newTitle.trim() || !newDate || !newSubjectId}
              size="sm"
              className="w-full h-8 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold rounded shadow-none"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </div>

      {/* Deliverables Table Flat */}
      {deliverables.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white px-4 py-5 text-center text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          Nenhuma entrega cadastrada. Adicione provas ou trabalhos para liberar o rastreamento de Metas (Tier 2).
        </div>
      ) : (
      <div className="w-full overflow-x-auto">
      <div className="min-w-[760px] rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
            <TableRow className="border-b border-gray-200 dark:border-gray-800">
              <TableHead className="w-[180px] p-2 text-xs">Disciplina</TableHead>
              <TableHead className="min-w-[220px] p-2 text-xs">Título da Entrega / Prova</TableHead>
              <TableHead className="w-[130px] p-2 text-xs">Data</TableHead>
              <TableHead className="w-[150px] p-2 text-xs">Status Temporal</TableHead>
              <TableHead className="w-[90px] p-2 text-right text-xs">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliverables.map((deliv) => {
                const isEditing = editingId === deliv.id;
                const sub = subjectMap.get(deliv.subject_id);
                const daysLeft = daysUntil(deliv.date);
                const deadlineTone = getDeadlineTone(daysLeft);

                return (
                  <TableRow
                    key={deliv.id}
                    className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <TableCell className="p-2">
                      {isEditing ? (
                        <select
                          value={editValues.subject_id ?? deliv.subject_id}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, subject_id: e.target.value }))
                          }
                          className="h-7 w-full rounded border px-2 text-xs"
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
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: sub?.theme_color || "#4f46e5" }}
                          />
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                            {sub?.name || "Disciplina"}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="p-2">
                      {isEditing ? (
                        <Input
                          value={editValues.title ?? deliv.title}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, title: e.target.value }))
                          }
                          className="h-7 text-xs rounded"
                        />
                      ) : (
                        <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                          {deliv.title}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="p-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editValues.date ?? deliv.date}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, date: e.target.value }))
                          }
                          className="h-7 text-xs font-mono rounded"
                        />
                      ) : (
                        formatDateBR(deliv.date)
                      )}
                    </TableCell>

                    <TableCell className="p-2">
                      {deadlineTone === "danger" ? (
                        <Badge className="w-fit rounded bg-red-600 py-0 text-[10px] font-bold text-white">
                          <AlertTriangle className="w-3 h-3" />
                          Atrasado há {Math.abs(daysLeft)}d
                        </Badge>
                      ) : deadlineTone === "warning" ? (
                        <Badge className="w-fit rounded border border-amber-300 bg-amber-50 py-0 text-[10px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          {daysLeft === 0 ? "Vence Hoje" : `Em ${daysLeft}d`}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-gray-600 dark:text-gray-400 font-mono">
                          Em {daysLeft} dias
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="p-2 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleUpdate(deliv.id)}
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
                              setEditingId(deliv.id);
                              setEditValues({
                                subject_id: deliv.subject_id,
                                title: deliv.title,
                                date: deliv.date,
                              });
                            }}
                            className="text-xs text-gray-500 hover:text-gray-900 h-6 px-1.5"
                          >
                            Editar
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDelete(deliv.id)}
                            className="text-red-500 hover:text-red-700 h-6 w-6"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
      </div>
      )}
    </div>
  );
}
