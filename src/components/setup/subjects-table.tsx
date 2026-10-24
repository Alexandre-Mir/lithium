"use client";

import { useState } from "react";
import { Subject } from "@/types/database";
import { createSubject, updateSubject, deleteSubject, validateClassDays } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Check, FileText, AlertCircle } from "lucide-react";

interface SubjectsTableProps {
  initialSubjects: Subject[];
  onRefresh?: () => void;
}

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function SubjectsTable({ initialSubjects, onRefresh }: SubjectsTableProps) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inserção rápida
  const [newName, setNewName] = useState("");
  const [newProfessor, setNewProfessor] = useState("");
  const [newIsAutonomous, setNewIsAutonomous] = useState(false);
  const [newClassDays, setNewClassDays] = useState<string[]>([]);
  const [newThemeColor, setNewThemeColor] = useState("#4f46e5");

  // Campos pedagógicos opcionais (Ementa, Objetivos, etc.)
  const [newSyllabus, setNewSyllabus] = useState("");
  const [newObjectives, setNewObjectives] = useState("");
  const [newMethodology, setNewMethodology] = useState("");
  const [newAssessment, setNewAssessment] = useState("");
  const [showPedagogicalModal, setShowPedagogicalModal] = useState(false);

  // Edição inline rápida
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Subject>>({});

  // Modal de visualização de detalhes pedagógicos
  const [viewingSubject, setViewingSubject] = useState<Subject | null>(null);

  const toggleDay = (day: string, currentDays: string[], onChange: (days: string[]) => void) => {
    if (currentDays.includes(day)) {
      onChange(currentDays.filter((d) => d !== day));
    } else {
      onChange([...currentDays, day]);
    }
  };

  const handleCreate = async () => {
    setErrorMessage(null);
    if (!newName.trim()) {
      setErrorMessage("O nome da disciplina é obrigatório.");
      return;
    }
    if (!newProfessor.trim()) {
      setErrorMessage("O nome do professor é obrigatório.");
      return;
    }

    // Regra A: Validação de no máximo 2 disciplinas por dia selecionado
    // Checagem local imediata no estado existente
    for (const day of newClassDays) {
      const count = subjects.filter((s) => s.class_days?.includes(day)).length;
      if (count >= 2) {
        setErrorMessage(`Limite de 2 disciplinas por dia atingido (o dia ${day} já possui ${count} disciplinas cadastradas).`);
        return;
      }
    }

    try {
      setLoading(true);
      // Validação no servidor também
      const validation = await validateClassDays(newClassDays);
      if (!validation.valid) {
        setErrorMessage(`Limite de 2 disciplinas por dia atingido (o dia ${validation.exceededDay} já possui 2 disciplinas).`);
        setLoading(false);
        return;
      }

      const newSub = await createSubject({
        name: newName.trim(),
        professor: newProfessor.trim(),
        syllabus: newSyllabus.trim() || null,
        objectives: newObjectives.trim() || null,
        methodology: newMethodology.trim() || null,
        assessment: newAssessment.trim() || null,
        is_autonomous: newIsAutonomous,
        class_days: newClassDays,
        theme_color: newThemeColor,
      });

      if (newSub) {
        setSubjects((prev) => [...prev, newSub]);
        setNewName("");
        setNewProfessor("");
        setNewClassDays([]);
        setNewIsAutonomous(false);
        setNewSyllabus("");
        setNewObjectives("");
        setNewMethodology("");
        setNewAssessment("");
        setShowPedagogicalModal(false);
        onRefresh?.();
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Erro ao cadastrar disciplina.");
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
      setSubjects((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, is_autonomous: sub.is_autonomous } : s))
      );
    }
  };

  const handleUpdate = async (id: string) => {
    setErrorMessage(null);
    try {
      setLoading(true);
      if (editValues.class_days) {
        const validation = await validateClassDays(editValues.class_days, id);
        if (!validation.valid) {
          setErrorMessage(`Limite de 2 disciplinas por dia atingido (dia: ${validation.exceededDay}).`);
          setLoading(false);
          return;
        }
      }

      const updated = await updateSubject(id, editValues);
      if (updated) {
        setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
        setEditingId(null);
        setEditValues({});
        onRefresh?.();
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Erro ao atualizar disciplina.");
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

  return (
    <div className="space-y-4">
      {/* Alerta de Erro de Validação */}
      {errorMessage && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 dark:text-red-300 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick Add Row - Flat Design */}
      <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase">
            Cadastrar Disciplina (Planilha)
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPedagogicalModal(true)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 h-7"
          >
            <FileText className="w-3.5 h-3.5 mr-1" />
            {newSyllabus || newObjectives ? "Ementa preenchida ✓" : "+ Ementa / Objetivos (Opcional)"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          <div className="md:col-span-3">
            <Input
              placeholder="Nome da Disciplina *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-xs bg-white dark:bg-gray-950 rounded border-gray-300 dark:border-gray-700"
            />
          </div>

          <div className="md:col-span-3">
            <Input
              placeholder="Professor(a) *"
              value={newProfessor}
              onChange={(e) => setNewProfessor(e.target.value)}
              className="h-8 text-xs bg-white dark:bg-gray-950 rounded border-gray-300 dark:border-gray-700"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 h-8">
            <Switch
              id="new-autonomous"
              checked={newIsAutonomous}
              onCheckedChange={setNewIsAutonomous}
            />
            <label
              htmlFor="new-autonomous"
              className="text-[11px] font-medium cursor-pointer text-gray-700 dark:text-gray-300"
            >
              {newIsAutonomous ? "Autônomo" : "Faculdade"}
            </label>
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-1 items-center">
            {WEEK_DAYS.map((day) => {
              const active = newClassDays.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day, newClassDays, setNewClassDays)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    active
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-transparent font-medium"
                      : "bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="md:col-span-1 flex items-center justify-center">
            <input
              type="color"
              value={newThemeColor}
              onChange={(e) => setNewThemeColor(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-gray-300 dark:border-gray-700 p-0 bg-transparent"
              title="Cor"
            />
          </div>

          <div className="md:col-span-1">
            <Button
              onClick={handleCreate}
              disabled={loading || !newName.trim() || !newProfessor.trim()}
              size="sm"
              className="w-full h-8 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold rounded shadow-none"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela de Disciplinas - Flat Design */}
      <div className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
            <TableRow className="border-b border-gray-200 dark:border-gray-800">
              <TableHead className="w-[30px] p-2 text-center">Cor</TableHead>
              <TableHead className="min-w-[170px] p-2 text-xs">Disciplina</TableHead>
              <TableHead className="min-w-[150px] p-2 text-xs">Professor(a)</TableHead>
              <TableHead className="w-[120px] p-2 text-xs">Tipo</TableHead>
              <TableHead className="w-[170px] p-2 text-xs">Dias de Aula</TableHead>
              <TableHead className="w-[90px] p-2 text-xs">Ementa</TableHead>
              <TableHead className="w-[90px] p-2 text-right text-xs">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-gray-500 text-xs">
                  Nenhuma disciplina cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              subjects.map((sub) => {
                const isEditing = editingId === sub.id;
                return (
                  <TableRow
                    key={sub.id}
                    className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <TableCell className="p-2 text-center">
                      {isEditing ? (
                        <input
                          type="color"
                          value={editValues.theme_color ?? sub.theme_color}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, theme_color: e.target.value }))
                          }
                          className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                        />
                      ) : (
                        <div
                          className="w-3.5 h-3.5 rounded-full mx-auto"
                          style={{ backgroundColor: sub.theme_color }}
                        />
                      )}
                    </TableCell>

                    <TableCell className="p-2">
                      {isEditing ? (
                        <Input
                          value={editValues.name ?? sub.name}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, name: e.target.value }))
                          }
                          className="h-7 text-xs rounded"
                        />
                      ) : (
                        <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                          {sub.name}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="p-2">
                      {isEditing ? (
                        <Input
                          value={editValues.professor ?? sub.professor}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, professor: e.target.value }))
                          }
                          className="h-7 text-xs rounded"
                        />
                      ) : (
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          {sub.professor || "—"}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="p-2">
                      <div className="flex items-center gap-1.5">
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
                        <span className="text-[11px]">
                          {(isEditing ? editValues.is_autonomous ?? sub.is_autonomous : sub.is_autonomous) ? (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 border-gray-300 text-gray-700 dark:text-gray-300">
                              Autônomo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 border-gray-300 text-gray-700 dark:text-gray-300">
                              Faculdade
                            </Badge>
                          )}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="p-2">
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
                                className={`text-[10px] px-1 py-0.2 rounded border ${
                                  active
                                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-transparent"
                                    : "bg-white text-gray-600 border-gray-200"
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
                                className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono"
                              >
                                {d}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="p-2">
                      {sub.syllabus || sub.objectives || sub.methodology || sub.assessment ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewingSubject(sub)}
                          className="h-6 text-[11px] px-2 text-indigo-600 dark:text-indigo-400"
                        >
                          Ver detalhes
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>

                    <TableCell className="p-2 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleUpdate(sub.id)}
                            className="text-emerald-600 hover:text-emerald-700 h-6 w-6"
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
                              setEditingId(sub.id);
                              setEditValues({
                                name: sub.name,
                                professor: sub.professor,
                                is_autonomous: sub.is_autonomous,
                                class_days: sub.class_days,
                                theme_color: sub.theme_color,
                              });
                            }}
                            className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 h-6 px-1.5"
                          >
                            Editar
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDelete(sub.id)}
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

      {/* Modal para Adicionar Ementa, Objetivos, Metodologia e Avaliação */}
      <Dialog open={showPedagogicalModal} onOpenChange={setShowPedagogicalModal}>
        <DialogContent className="sm:max-w-lg rounded-md border border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Ementa e Planejamento Pedagógico
            </DialogTitle>
            <DialogDescription className="text-xs">
              Campos complementares para a disciplina {newName ? `"${newName}"` : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
                Ementa (Syllabus)
              </label>
              <Textarea
                placeholder="Conteúdo programático da disciplina..."
                value={newSyllabus}
                onChange={(e) => setNewSyllabus(e.target.value)}
                className="text-xs h-18 rounded border-gray-300 dark:border-gray-700"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
                Objetivos de Aprendizagem
              </label>
              <Textarea
                placeholder="Competências e objetivos a serem desenvolvidos..."
                value={newObjectives}
                onChange={(e) => setNewObjectives(e.target.value)}
                className="text-xs h-16 rounded border-gray-300 dark:border-gray-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
                  Metodologia
                </label>
                <Input
                  placeholder="Ex: Aulas expositivas e seminários"
                  value={newMethodology}
                  onChange={(e) => setNewMethodology(e.target.value)}
                  className="text-xs h-8 rounded border-gray-300 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
                  Critérios de Avaliação
                </label>
                <Input
                  placeholder="Ex: P1 (40%) + P2 (40%) + Trab (20%)"
                  value={newAssessment}
                  onChange={(e) => setNewAssessment(e.target.value)}
                  className="text-xs h-8 rounded border-gray-300 dark:border-gray-700"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setShowPedagogicalModal(false)}
              className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold h-8 rounded"
            >
              Salvar & Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Visualizar Detalhes Pedagógicos de Disciplina Existente */}
      <Dialog open={!!viewingSubject} onOpenChange={(open) => !open && setViewingSubject(null)}>
        <DialogContent className="sm:max-w-md rounded-md border border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: viewingSubject?.theme_color }}
              />
              {viewingSubject?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Professor(a): {viewingSubject?.professor || "Não informado"}
            </DialogDescription>
          </DialogHeader>

          {viewingSubject && (
            <div className="space-y-3 py-2 text-xs">
              {viewingSubject.syllabus && (
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200">Ementa</h4>
                  <p className="text-gray-600 dark:text-gray-400 mt-0.5 whitespace-pre-wrap">
                    {viewingSubject.syllabus}
                  </p>
                </div>
              )}

              {viewingSubject.objectives && (
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200">Objetivos</h4>
                  <p className="text-gray-600 dark:text-gray-400 mt-0.5 whitespace-pre-wrap">
                    {viewingSubject.objectives}
                  </p>
                </div>
              )}

              {viewingSubject.methodology && (
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200">Metodologia</h4>
                  <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                    {viewingSubject.methodology}
                  </p>
                </div>
              )}

              {viewingSubject.assessment && (
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200">Critérios de Avaliação</h4>
                  <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                    {viewingSubject.assessment}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewingSubject(null)}
              className="text-xs h-8 rounded"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
