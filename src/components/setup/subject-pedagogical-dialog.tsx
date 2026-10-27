"use client";

import { useId, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface SubjectPedagogicalValues {
  syllabus: string;
  objectives: string;
  methodology: string;
  assessment: string;
}

export const EMPTY_PEDAGOGICAL_VALUES: SubjectPedagogicalValues = {
  syllabus: "",
  objectives: "",
  methodology: "",
  assessment: "",
};

interface SubjectPedagogicalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  initialValues: SubjectPedagogicalValues;
  onSave: (values: SubjectPedagogicalValues) => void | Promise<void>;
}

export function SubjectPedagogicalDialog({
  open,
  onOpenChange,
  subjectName,
  initialValues,
  onSave,
}: SubjectPedagogicalDialogProps) {
  const fieldId = useId();
  const nextInitialValuesKey = JSON.stringify(initialValues);
  const [initialValuesKey, setInitialValuesKey] = useState(nextInitialValuesKey);
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (initialValuesKey !== nextInitialValuesKey) {
    setInitialValuesKey(nextInitialValuesKey);
    setValues(initialValues);
    setErrorMessage(null);
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (saving && !nextOpen) return;
    if (!nextOpen) {
      setValues(initialValues);
      setErrorMessage(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    setErrorMessage(null);
    setSaving(true);
    try {
      await onSave(values);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao salvar planejamento pedagógico.");
    } finally {
      setSaving(false);
    }
  };

  const updateValue = (field: keyof SubjectPedagogicalValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-md border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Planejamento da disciplina</DialogTitle>
          <DialogDescription className="text-xs">
            Ementa, objetivos e avaliação{subjectName ? ` · ${subjectName}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div>
            <label htmlFor={`${fieldId}-syllabus`} className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
              Ementa
            </label>
            <Textarea
              id={`${fieldId}-syllabus`}
              placeholder="Conteúdo programático da disciplina..."
              value={values.syllabus}
              onChange={(event) => updateValue("syllabus", event.target.value)}
              disabled={saving}
              className="text-xs h-18 rounded border-gray-300 dark:border-gray-700"
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-objectives`} className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
              Objetivos de Aprendizagem
            </label>
            <Textarea
              id={`${fieldId}-objectives`}
              placeholder="Competências e objetivos a serem desenvolvidos..."
              value={values.objectives}
              onChange={(event) => updateValue("objectives", event.target.value)}
              disabled={saving}
              className="text-xs h-16 rounded border-gray-300 dark:border-gray-700"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor={`${fieldId}-methodology`} className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
                Metodologia
              </label>
              <Input
                id={`${fieldId}-methodology`}
                placeholder="Ex: Aulas expositivas e seminários"
                value={values.methodology}
                onChange={(event) => updateValue("methodology", event.target.value)}
                disabled={saving}
                className="text-xs h-8 rounded border-gray-300 dark:border-gray-700"
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-assessment`} className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
                Critérios de Avaliação
              </label>
              <Input
                id={`${fieldId}-assessment`}
                placeholder="Ex: P1 (40%) + P2 (40%) + Trab (20%)"
                value={values.assessment}
                onChange={(event) => updateValue("assessment", event.target.value)}
                disabled={saving}
                className="text-xs h-8 rounded border-gray-300 dark:border-gray-700"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold h-8 rounded"
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
