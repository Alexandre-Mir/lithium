"use client";

import { useState } from "react";
import { Subject, SubjectInsert } from "@/types/database";
import { createSubject, updateSubject, deleteSubject } from "@/app/actions";
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
import { Plus, Trash2, Check, BookOpen, GraduationCap, Sparkles } from "lucide-react";

interface SubjectsTableProps {
  initialSubjects: Subject[];
  onRefresh?: () => void;
}

const COLOR_PALETTES = [
  { label: "Índigo", value: "#6366f1" },
  { label: "Esmeralda", value: "#10b981" },
  { label: "Âmbar", value: "#f59e0b" },
  { label: "Rosa", value: "#f43f5e" },
  { label: "Ciano", value: "#06b6d4" },
  { label: "Violeta", value: "#8b5cf6" },
  { label: "Laranja", value: "#f97316" },
];

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function SubjectsTable({ initialSubjects, onRefresh }: SubjectsTableProps) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [loading, setLoading] = useState(false);

  // Linha de adição rápida
  const [newName, setNewName] = useState("");
  const [newIsAutonomous, setNewIsAutonomous] = useState(false);
  const [newClassDays, setNewClassDays] = useState<string[]>([]);
  const [newThemeColor, setNewThemeColor] = useState("#6366f1");

  // Edição inline rápida de uma linha
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Subject>>({});

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setLoading(true);
      const newSub = await createSubject({
        name: newName.trim(),
        is_autonomous: newIsAutonomous,
        class_days: newClassDays,
        theme_color: newThemeColor,
      });
      if (newSub) {
        setSubjects((prev) => [...prev, newSub]);
        setNewName("");
        setNewClassDays([]);
        setNewIsAutonomous(false);
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar disciplina.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickToggleAutonomous = async (sub: Subject) => {
    const updatedVal = !sub.is_autonomous;
    setSubjects((prev) =>
      prev.map((s) => (s.id === sub.id ? { ...s, is_autonomous: updatedVal } : s))
    );
    try {
      await updateSubject(sub.id, { is_autonomous: updatedVal });
      onRefresh?.();
    } catch (err) {
      console.error(err);
      // Reverter se der erro
      setSubjects((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, is_autonomous: sub.is_autonomous } : s))
      );
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      setLoading(true);
      const updated = await updateSubject(id, editValues);
      if (updated) {
        setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
        setEditingId(null);
        setEditValues({});
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar disciplina.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta disciplina e todos os seus vínculos?")) return;
    try {
      setLoading(true);
      await deleteSubject(id);
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      onRefresh?.();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir disciplina.");
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: string, currentDays: string[], onChange: (days: string[]) => void) => {
    if (currentDays.includes(day)) {
      onChange(currentDays.filter((d) => d !== day));
    } else {
      onChange([...currentDays, day]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Inserção Rápida de Disciplina (Planilha)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4">
            <Input
              placeholder="Nome da Disciplina (ex: Neurociência, Teoria Geral...)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="bg-background text-sm"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-lg border">
            <Switch
              id="new-autonomous"
              checked={newIsAutonomous}
              onCheckedChange={setNewIsAutonomous}
            />
            <label
              htmlFor="new-autonomous"
              className="text-xs font-medium cursor-pointer flex items-center gap-1.5"
            >
              {newIsAutonomous ? (
                <>
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-700 font-semibold">Autônomo (Prazos Elásticos)</span>
                </>
              ) : (
                <>
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-indigo-700 font-semibold">Faculdade (Ativo)</span>
                </>
              )}
            </label>
          </div>

          <div className="md:col-span-3 flex flex-wrap gap-1 items-center">
            {WEEK_DAYS.map((day) => {
              const active = newClassDays.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day, newClassDays, setNewClassDays)}
                  className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                    active
                      ? "bg-indigo-600 text-white font-medium"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="md:col-span-1 flex items-center gap-1.5">
            <input
              type="color"
              value={newThemeColor}
              onChange={(e) => setNewThemeColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
              title="Cor do Tema"
            />
          </div>

          <div className="md:col-span-1">
            <Button
              onClick={handleCreate}
              disabled={loading || !newName.trim()}
              size="sm"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[40px]">Cor</TableHead>
              <TableHead className="min-w-[200px]">Nome</TableHead>
              <TableHead className="w-[180px]">Modo de Estudo</TableHead>
              <TableHead className="w-[200px]">Dias de Aula</TableHead>
              <TableHead className="w-[100px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma disciplina cadastrada. Adicione uma disciplina acima.
                </TableCell>
              </TableRow>
            ) : (
              subjects.map((sub) => {
                const isEditing = editingId === sub.id;
                return (
                  <TableRow key={sub.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      {isEditing ? (
                        <input
                          type="color"
                          value={editValues.theme_color ?? sub.theme_color}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, theme_color: e.target.value }))
                          }
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                      ) : (
                        <div
                          className="w-4 h-4 rounded-full ring-2 ring-background shadow-xs"
                          style={{ backgroundColor: sub.theme_color }}
                        />
                      )}
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editValues.name ?? sub.name}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, name: e.target.value }))
                          }
                          className="h-8 text-sm"
                        />
                      ) : (
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {sub.name}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={
                            isEditing
                              ? (editValues.is_autonomous ?? sub.is_autonomous)
                              : sub.is_autonomous
                          }
                          onCheckedChange={(val) => {
                            if (isEditing) {
                              setEditValues((prev) => ({ ...prev, is_autonomous: val }));
                            } else {
                              handleQuickToggleAutonomous(sub);
                            }
                          }}
                        />
                        <span className="text-xs">
                          {(isEditing ? editValues.is_autonomous ?? sub.is_autonomous : sub.is_autonomous) ? (
                            <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                              Autônomo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-indigo-700 bg-indigo-50 border-indigo-200">
                              Faculdade
                            </Badge>
                          )}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <div className="flex flex-wrap gap-1">
                          {WEEK_DAYS.map((day) => {
                            const cur = editValues.class_days ?? sub.class_days;
                            const active = cur.includes(day);
                            return (
                              <button
                                type="button"
                                key={day}
                                onClick={() =>
                                  toggleDay(day, cur, (days) =>
                                    setEditValues((prev) => ({ ...prev, class_days: days }))
                                  )
                                }
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  active
                                    ? "bg-indigo-600 text-white font-medium"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {sub.class_days.length > 0 ? (
                            sub.class_days.map((d) => (
                              <span
                                key={d}
                                className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono"
                              >
                                {d}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleUpdate(sub.id)}
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
                              setEditingId(sub.id);
                              setEditValues({
                                name: sub.name,
                                is_autonomous: sub.is_autonomous,
                                class_days: sub.class_days,
                                theme_color: sub.theme_color,
                              });
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Editar
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDelete(sub.id)}
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
