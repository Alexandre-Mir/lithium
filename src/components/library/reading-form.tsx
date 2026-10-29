"use client";

import { useReducer, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Book,
  Check,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createReading,
  lookupArticleByDoi,
  lookupBookByIsbn,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { metadataAttemptsSummary } from "@/lib/metadata-labels";
import { getReadingCreateErrors } from "@/lib/reading-validation";
import { parseRawTocToMilestones } from "@/lib/toc-parser";
import type { Reading, ReadingMilestone, ReadingType, Subject } from "@/types/database";

type ReadingFormStep = 1 | 2 | 3 | 4;

interface MetadataNotice {
  kind: "not_found" | "error";
  text: string;
  type: "ISBN" | "DOI";
}

export interface ReadingFormState {
  step: ReadingFormStep;
  type: ReadingType;
  subjectId: string;
  title: string;
  chapterTitle: string;
  author: string;
  isbn: string;
  doi: string;
  fullBookPages: number | "";
  readFullBook: boolean;
  targetPages: number | "";
  deadline: string;
  hasDeadline: boolean;
  tocText: string;
  showTocEntry: boolean;
  milestones: ReadingMilestone[];
  tocMessage: string | null;
  coverUrl: string | null;
  publisher: string;
  publishedYear: string;
  metadataSource: string | null;
  lookedUpIsbn: string;
  lookedUpDoi: string;
  metadataNotice: MetadataNotice | null;
  validationAttemptedFor: ReadingFormStep | null;
  formError: string | null;
}

type ReadingFormAction =
  | { type: "patch"; values: Partial<ReadingFormState> }
  | { type: "reset"; subjectId: string };

function initialReadingFormState(subjectId: string): ReadingFormState {
  return {
    step: 1,
    type: "book",
    subjectId,
    title: "",
    chapterTitle: "",
    author: "",
    isbn: "",
    doi: "",
    fullBookPages: "",
    readFullBook: false,
    targetPages: 30,
    deadline: "",
    hasDeadline: true,
    tocText: "",
    showTocEntry: false,
    milestones: [],
    tocMessage: null,
    coverUrl: null,
    publisher: "",
    publishedYear: "",
    metadataSource: null,
    lookedUpIsbn: "",
    lookedUpDoi: "",
    metadataNotice: null,
    validationAttemptedFor: null,
    formError: null,
  };
}

function readingFormReducer(state: ReadingFormState, action: ReadingFormAction): ReadingFormState {
  if (action.type === "reset") return initialReadingFormState(action.subjectId);
  return { ...state, ...action.values };
}

function MilestoneEditor({
  milestones,
  onChange,
}: {
  milestones: ReadingMilestone[];
  onChange: (milestones: ReadingMilestone[]) => void;
}) {
  if (!milestones.length) {
    return <p className="text-[11px] text-gray-500">Os marcos gerados aparecerão aqui para revisão.</p>;
  }

  return (
    <div className="space-y-2 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
      {milestones.map((milestone, index) => (
        <div key={`${milestone.page}-${index}`} className="grid grid-cols-[minmax(0,1fr)_80px_32px] items-center gap-2">
          <Input
            value={milestone.title}
            onChange={(event) => onChange(milestones.map((item, itemIndex) =>
              itemIndex === index ? { ...item, title: event.target.value } : item
            ))}
            aria-label={`Título do marco ${index + 1}`}
            className="h-8 rounded text-xs"
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
            className="h-8 rounded font-mono text-xs"
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Remover marco ${index + 1}`}
            onClick={() => onChange(milestones.filter((_, itemIndex) => itemIndex !== index))}
            className="text-gray-500 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">{children}</p>;
}

export function ReadingForm({
  subjects,
  onCreated,
}: {
  subjects: Subject[];
  onCreated: (reading: Reading) => void;
}) {
  const [state, dispatch] = useReducer(readingFormReducer, initialReadingFormState(subjects[0]?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const patch = (values: Partial<ReadingFormState>) => dispatch({ type: "patch", values });

  const includeTocStep = state.type === "book" && state.tocText.trim().length > 0;
  const stepCount = includeTocStep ? 4 : 3;
  const effectiveTargetPages = state.readFullBook && state.type === "book"
    ? state.fullBookPages
    : state.targetPages;
  const createErrors = getReadingCreateErrors({
    title: state.title,
    subject_id: state.subjectId,
    target_pages: effectiveTargetPages,
    full_book_pages: state.type === "book" ? state.fullBookPages : null,
    deadline: state.deadline,
    hasDeadline: state.hasDeadline,
  });
  const showDetailsErrors = state.validationAttemptedFor === 2;
  const showSetupErrors = state.validationAttemptedFor === 3;
  const currentStepName = state.step === 1
    ? "Identificação"
    : state.step === 2
      ? "Dados bibliográficos"
      : state.step === 3
        ? "Configuração"
        : "Sumário e marcos";

  const handleIsbnBlur = async (force = false) => {
    const cleanIsbn = state.isbn.replace(/[^0-9X]/gi, "");
    if (!cleanIsbn || cleanIsbn.length < 10 || (!force && cleanIsbn === state.lookedUpIsbn) || fetchingMetadata) return;

    try {
      setFetchingMetadata(true);
      const result = await lookupBookByIsbn(cleanIsbn);
      if (result.status === "ok") {
        patch({
          lookedUpIsbn: cleanIsbn,
          metadataNotice: null,
          title: state.title || result.data.title,
          author: state.author || result.data.authors,
          fullBookPages: state.fullBookPages || result.data.pageCount || "",
          coverUrl: result.data.coverUrl,
          publisher: state.publisher || result.data.publisher || "",
          publishedYear: state.publishedYear || (result.data.publishedYear ? String(result.data.publishedYear) : ""),
          metadataSource: result.data.source,
        });
      } else if (result.status === "not_found") {
        patch({
          lookedUpIsbn: cleanIsbn,
          metadataNotice: {
            kind: "not_found",
            text: "Nenhum resultado para este ISBN. Preencha manualmente.",
            type: "ISBN",
          },
        });
      } else {
        patch({
          metadataNotice: {
            kind: "error",
            text: `Sem resposta dos provedores (${metadataAttemptsSummary(result.attempts)}). Preencha manualmente ou tente de novo.`,
            type: "ISBN",
          },
        });
      }
    } catch {
      patch({
        metadataNotice: {
          kind: "error",
          text: "Sem resposta dos provedores. Preencha manualmente ou tente de novo.",
          type: "ISBN",
        },
      });
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleDoiBlur = async (force = false) => {
    const cleanDoi = state.doi.trim().replace(/^https?:\/\/doi\.org\//i, "");
    if (!cleanDoi || cleanDoi.length < 5 || (!force && cleanDoi === state.lookedUpDoi) || fetchingMetadata) return;

    try {
      setFetchingMetadata(true);
      const result = await lookupArticleByDoi(cleanDoi);
      if (result.status === "ok") {
        patch({
          lookedUpDoi: cleanDoi,
          metadataNotice: null,
          title: state.title || result.data.title,
          author: state.author || result.data.authors,
          publisher: state.publisher || result.data.publisher || "",
          publishedYear: state.publishedYear || (result.data.publishedYear ? String(result.data.publishedYear) : ""),
          metadataSource: result.data.source,
        });
      } else if (result.status === "not_found") {
        patch({
          lookedUpDoi: cleanDoi,
          metadataNotice: {
            kind: "not_found",
            text: "Nenhum resultado para este DOI. Preencha manualmente.",
            type: "DOI",
          },
        });
      } else {
        patch({
          metadataNotice: {
            kind: "error",
            text: `Sem resposta dos provedores (${metadataAttemptsSummary(result.attempts)}). Preencha manualmente ou tente de novo.`,
            type: "DOI",
          },
        });
      }
    } catch {
      patch({
        metadataNotice: {
          kind: "error",
          text: "Sem resposta dos provedores. Preencha manualmente ou tente de novo.",
          type: "DOI",
        },
      });
    } finally {
      setFetchingMetadata(false);
    }
  };

  const validateCurrentStep = (): boolean => {
    if (state.step === 2) {
      if (createErrors.title || createErrors.target_pages || createErrors.full_book_pages) {
        patch({ validationAttemptedFor: 2 });
        return false;
      }
    }

    if (state.step === 3) {
      if (createErrors.subject_id || createErrors.deadline || createErrors.target_pages) {
        patch({ validationAttemptedFor: 3 });
        return false;
      }
    }

    return true;
  };

  const handleCreate = async () => {
    const firstError = Object.values(createErrors)[0];
    if (firstError) {
      const invalidStep = createErrors.title || createErrors.target_pages || createErrors.full_book_pages ? 2 : 3;
      patch({ step: invalidStep, validationAttemptedFor: invalidStep });
      return;
    }

    const validSubjectId = subjects.some((subject) => subject.id === state.subjectId)
      ? state.subjectId
      : subjects[0]?.id ?? "";
    try {
      setSaving(true);
      patch({ formError: null });
      const created = await createReading({
        subject_id: validSubjectId,
        title: state.title.trim(),
        chapter_title: state.type === "book" ? state.chapterTitle.trim() || null : null,
        author: state.author.trim() || null,
        type: state.type,
        isbn: state.type === "book" ? state.isbn.trim() || null : null,
        doi: state.type === "article" ? state.doi.trim() || null : null,
        full_book_pages: state.type === "book" && typeof state.fullBookPages === "number"
          ? state.fullBookPages
          : null,
        target_pages: effectiveTargetPages as number,
        read_full_book: state.type === "book" && state.readFullBook,
        deadline: state.hasDeadline ? state.deadline : null,
        is_read: false,
        cover_url: state.coverUrl,
        publisher: state.publisher.trim() || null,
        published_year: state.publishedYear.trim() ? Number(state.publishedYear) : null,
        metadata_source: state.metadataSource,
        metadata_fetched_at: null,
        milestones: state.type === "book" ? state.milestones : [],
      });

      onCreated(created as Reading);
      dispatch({ type: "reset", subjectId: validSubjectId });
    } catch (error) {
      patch({ formError: error instanceof Error ? error.message : "Não foi possível cadastrar a leitura." });
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = async () => {
    if (!validateCurrentStep()) return;
    if (state.step === 1) {
      patch({ step: 2, validationAttemptedFor: null, formError: null });
    } else if (state.step === 2) {
      patch({ step: 3, validationAttemptedFor: null, formError: null });
    } else if (state.step === 3 && includeTocStep) {
      patch({ step: 4, validationAttemptedFor: null, formError: null });
    } else {
      await handleCreate();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleAdvance();
  };

  const generateMilestones = () => {
    const generated = parseRawTocToMilestones(state.tocText);
    if (!generated.length) {
      patch({ tocMessage: "Não encontrei títulos com número de página. Revise o texto do sumário." });
      return;
    }
    patch({
      milestones: generated,
      tocMessage: `${generated.length} marco(s) gerado(s). Você pode revisar títulos e páginas antes de cadastrar.`,
    });
  };

  const currentSubjectId = subjects.some((subject) => subject.id === state.subjectId)
    ? state.subjectId
    : subjects[0]?.id ?? "";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mb-4 flex flex-col gap-3 border-b border-gray-100 pb-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Adicionar leitura</h2>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            Preencha em etapas; os dados do ISBN ou DOI podem completar o cadastro automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-1.5" aria-label={`Etapa ${state.step} de ${stepCount}: ${currentStepName}`}>
          {Array.from({ length: stepCount }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 w-7 rounded-full ${index < state.step ? "bg-gray-900 dark:bg-gray-100" : "bg-gray-200 dark:bg-gray-700"}`}
            />
          ))}
          <span className="ml-1 text-[10px] font-mono text-gray-500">{state.step}/{stepCount}</span>
        </div>
      </div>

      {state.formError && (
        <div role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          {state.formError}
        </div>
      )}

      {state.step === 1 && (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400">O que você vai ler?</p>
            <div className="grid grid-cols-2 gap-2">
              {(["book", "article"] as const).map((type) => {
                const selected = state.type === type;
                const Icon = type === "book" ? Book : FileText;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => patch({
                      type,
                      step: 1,
                      metadataNotice: null,
                      lookedUpIsbn: "",
                      lookedUpDoi: "",
                      coverUrl: null,
                      publisher: "",
                      publishedYear: "",
                      metadataSource: null,
                      ...(state.metadataSource ? { fullBookPages: "" as const } : {}),
                      ...(type === "article" ? { tocText: "", milestones: [], showTocEntry: false } : {}),
                    })}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded border px-3 text-xs font-semibold transition-colors ${selected ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900" : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {type === "book" ? "Livro" : "Artigo"}
                  </button>
                );
              })}
            </div>
          </div>

          {state.type === "book" ? (
            <div className="space-y-1.5">
              <label htmlFor="reading-form-isbn" className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                ISBN <span className="font-normal text-gray-500">(opcional · busca os dados do livro)</span>
              </label>
              <div className="relative">
                <Input
                  id="reading-form-isbn"
                  placeholder="Ex.: 9788539003839"
                  value={state.isbn}
                  onChange={(event) => {
                    const value = event.target.value;
                    const clean = value.replace(/[^0-9X]/gi, "");
                    patch({
                      isbn: value,
                      ...(clean !== state.lookedUpIsbn ? {
                        lookedUpIsbn: "",
                        metadataNotice: null,
                        coverUrl: null,
                        publisher: "",
                        publishedYear: "",
                        metadataSource: null,
                        ...(state.metadataSource ? { fullBookPages: "" as const } : {}),
                      } : {}),
                    });
                  }}
                  onBlur={() => void handleIsbnBlur()}
                  className="h-10 rounded pr-9 font-mono text-xs"
                />
                {fetchingMetadata && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-gray-500" />}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="reading-form-doi" className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                DOI <span className="font-normal text-gray-500">(opcional · busca os dados do artigo)</span>
              </label>
              <div className="relative">
                <Input
                  id="reading-form-doi"
                  placeholder="Ex.: 10.1037/0033-295X.101.2.346"
                  value={state.doi}
                  onChange={(event) => {
                    const value = event.target.value;
                    const clean = value.trim().replace(/^https?:\/\/doi\.org\//i, "");
                    patch({
                      doi: value,
                      ...(clean !== state.lookedUpDoi ? {
                        lookedUpDoi: "",
                        metadataNotice: null,
                        coverUrl: null,
                        publisher: "",
                        publishedYear: "",
                        metadataSource: null,
                      } : {}),
                    });
                  }}
                  onBlur={() => void handleDoiBlur()}
                  className="h-10 rounded pr-9 font-mono text-xs"
                />
                {fetchingMetadata && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-gray-500" />}
              </div>
            </div>
          )}

          {state.metadataNotice && (
            <div className={`flex flex-col gap-2 border px-3 py-2 text-[11px] sm:flex-row sm:items-center sm:justify-between ${state.metadataNotice.kind === "error" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200" : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"}`}>
              <span>{state.metadataNotice.text}</span>
              {state.metadataNotice.kind === "error" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 w-fit text-[11px]"
                  onClick={() => void (state.metadataNotice?.type === "ISBN" ? handleIsbnBlur(true) : handleDoiBlur(true))}
                >
                  Tentar de novo
                </Button>
              )}
            </div>
          )}
          {state.metadataSource && (
            <p className="text-[10px] text-gray-500">Dados encontrados; revise as informações na próxima etapa.</p>
          )}
        </div>
      )}

      {state.step === 2 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="reading-form-title" className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              Título *
            </label>
            <Input
              id="reading-form-title"
              autoFocus
              value={state.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder={state.type === "book" ? "Título do livro" : "Título do artigo"}
              aria-invalid={Boolean(showDetailsErrors && createErrors.title)}
              className="h-10 rounded text-sm"
            />
            {showDetailsErrors && <FieldError>{createErrors.title}</FieldError>}
          </div>

          {state.type === "book" && (
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="reading-form-chapter" className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                Capítulo ou trecho <span className="font-normal text-gray-500">(opcional)</span>
              </label>
              <Input
                id="reading-form-chapter"
                value={state.chapterTitle}
                onChange={(event) => patch({ chapterTitle: event.target.value })}
                placeholder="Ex.: Cap. 3 — Carga Cognitiva"
                className="h-10 rounded text-sm"
              />
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="reading-form-author" className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              Autor(es) <span className="font-normal text-gray-500">(opcional)</span>
            </label>
            <Input
              id="reading-form-author"
              value={state.author}
              onChange={(event) => patch({ author: event.target.value })}
              placeholder="Nome do autor"
              className="h-10 rounded text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="reading-form-publisher" className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              Editora <span className="font-normal text-gray-500">(opcional)</span>
            </label>
            <Input
              id="reading-form-publisher"
              value={state.publisher}
              onChange={(event) => patch({ publisher: event.target.value })}
              placeholder="Editora ou periódico"
              className="h-10 rounded text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="reading-form-year" className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              Ano <span className="font-normal text-gray-500">(opcional)</span>
            </label>
            <Input
              id="reading-form-year"
              type="number"
              min={1000}
              max={9999}
              value={state.publishedYear}
              onChange={(event) => patch({ publishedYear: event.target.value })}
              placeholder="2026"
              className="h-10 rounded font-mono text-sm"
            />
          </div>

          {state.type === "book" && (
            <div className="space-y-1">
              <label htmlFor="reading-form-full-pages" className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                Total de páginas do livro <span className="font-normal text-gray-500">(opcional)</span>
              </label>
              <Input
                id="reading-form-full-pages"
                type="number"
                min={1}
                step={1}
                value={state.fullBookPages}
                onChange={(event) => patch({ fullBookPages: event.target.value ? Number(event.target.value) : "" })}
                placeholder="Ex.: 350"
                className="h-10 rounded font-mono text-sm"
              />
              {showDetailsErrors && <FieldError>{createErrors.full_book_pages}</FieldError>}
            </div>
          )}

          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="reading-form-target-pages" className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              Páginas da leitura *
            </label>
            <Input
              id="reading-form-target-pages"
              type="number"
              min={1}
              step={1}
              value={state.targetPages}
              onChange={(event) => patch({ targetPages: event.target.value ? Number(event.target.value) : "" })}
              aria-invalid={Boolean(showDetailsErrors && createErrors.target_pages)}
              className="h-10 rounded font-mono text-sm"
            />
            <FieldError>{showDetailsErrors && createErrors.target_pages ? "Informe o total de páginas do livro ou uma meta de páginas válida." : undefined}</FieldError>
          </div>
        </div>
      )}

      {state.step === 3 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reading-form-subject" className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              Disciplina *
            </label>
            {subjects.length > 0 ? (
              <select
                id="reading-form-subject"
                value={currentSubjectId}
                onChange={(event) => patch({ subjectId: event.target.value })}
                aria-invalid={Boolean(showSetupErrors && createErrors.subject_id)}
                className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
              >
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            ) : (
              <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Cadastre uma disciplina antes de adicionar uma leitura.
              </p>
            )}
            {showSetupErrors && <FieldError>{createErrors.subject_id}</FieldError>}
          </div>

          {state.type === "book" && (
            <div className="rounded border border-gray-200 p-3 dark:border-gray-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Escopo da leitura</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {state.readFullBook ? "A meta será o total de páginas do livro." : `${state.targetPages || 0} páginas selecionadas.`}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  <Switch
                    checked={state.readFullBook}
                    onCheckedChange={(checked) => patch({ readFullBook: checked })}
                  />
                  Livro inteiro
                </label>
              </div>
              {showSetupErrors && state.readFullBook && createErrors.target_pages && (
                <FieldError>Informe o total de páginas na etapa anterior ou desative “Livro inteiro”.</FieldError>
              )}
            </div>
          )}

          <div className="space-y-2 rounded border border-gray-200 p-3 dark:border-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Prazo</p>
                <p className="text-[11px] text-gray-500">Pode deixar sem prazo fixo.</p>
              </div>
              <label className="flex items-center gap-2 text-[11px] font-medium text-gray-700 dark:text-gray-300">
                <Switch checked={state.hasDeadline} onCheckedChange={(checked) => patch({ hasDeadline: checked })} />
                Possui prazo fixo?
              </label>
            </div>
            {state.hasDeadline && (
              <div className="max-w-xs">
                <label htmlFor="reading-form-deadline" className="mb-1 block text-[10px] text-gray-500">Data de término</label>
                <Input
                  id="reading-form-deadline"
                  type="date"
                  value={state.deadline}
                  onChange={(event) => patch({ deadline: event.target.value })}
                  aria-invalid={Boolean(showSetupErrors && createErrors.deadline)}
                  className="h-10 rounded font-mono text-sm"
                />
                {showSetupErrors && <FieldError>{createErrors.deadline}</FieldError>}
              </div>
            )}
          </div>

          {state.type === "book" && (
            <div className="rounded border border-gray-200 p-3 dark:border-gray-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Acompanhar capítulos</p>
                  <p className="text-[11px] text-gray-500">Opcional: cole um sumário para criar marcos.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => patch({ showTocEntry: !state.showTocEntry })}
                  className="h-8 w-fit text-[11px]"
                >
                  {state.showTocEntry ? "Ocultar campo" : "Adicionar sumário"}
                </Button>
              </div>
              {state.showTocEntry && (
                <div className="mt-3 space-y-2">
                  <label htmlFor="reading-form-toc-step3" className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
                    Cole o sumário
                  </label>
                  <textarea
                    id="reading-form-toc-step3"
                    value={state.tocText}
                    onChange={(event) => patch({ tocText: event.target.value, tocMessage: null })}
                    placeholder={"Introdução ........ 9\nCapítulo 1 — A origem — pág. 15"}
                    rows={3}
                    className="w-full resize-y rounded border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-950"
                  />
                  {includeTocStep && <p className="text-[10px] text-gray-500">Ao continuar, você poderá revisar os marcos identificados.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {state.step === 4 && includeTocStep && (
        <div className="space-y-3">
          <div>
            <label htmlFor="reading-form-toc" className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              Sumário colado
            </label>
            <textarea
              id="reading-form-toc"
              autoFocus
              value={state.tocText}
              onChange={(event) => {
                const value = event.target.value;
                patch({
                  tocText: value,
                  tocMessage: null,
                  ...(value.trim() ? {} : { step: 3 as const, milestones: [] }),
                });
              }}
              rows={4}
              className="w-full resize-y rounded border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-950"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-gray-500">Gere e revise títulos e páginas antes de salvar.</p>
            <Button type="button" size="sm" variant="outline" onClick={generateMilestones} className="h-8 w-fit text-xs">
              Gerar marcos
            </Button>
          </div>
          {state.tocMessage && (
            <p role="status" className="border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
              {state.tocMessage}
            </p>
          )}
          <MilestoneEditor milestones={state.milestones} onChange={(milestones) => patch({ milestones })} />
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-gray-100 pt-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        {state.step > 1 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => patch({ step: (state.step - 1) as ReadingFormStep, validationAttemptedFor: null })}
            className="w-full justify-center text-xs sm:w-fit"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
        ) : <span className="hidden text-[10px] text-gray-500 sm:block">Campos com * são obrigatórios.</span>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {fetchingMetadata && <span className="inline-flex items-center justify-center gap-1 text-[10px] text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Buscando dados</span>}
          <Button
            type="submit"
            disabled={saving || fetchingMetadata || subjects.length === 0}
            className="w-full bg-gray-900 text-xs text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 sm:w-fit"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state.step === stepCount ? <Plus className="h-3.5 w-3.5" /> : state.step === 3 && includeTocStep ? <ArrowRight className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {saving ? "Salvando..." : state.step === stepCount ? "Cadastrar leitura" : state.step === 3 && includeTocStep ? "Revisar marcos" : state.step === 3 ? "Cadastrar leitura" : "Continuar"}
          </Button>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">Etapa {state.step} de {stepCount}: {currentStepName}</div>
    </form>
  );
}
