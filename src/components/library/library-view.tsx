"use client";

import { useState } from "react";
import { Reading, ReadingWithProgress, Subject } from "@/types/database";
import { BookCard } from "./book-card";
import { ReadingSessionModal } from "@/components/reading-session-modal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { backfillMissingMetadata } from "@/app/actions";
import { Loader2 } from "lucide-react";

interface LibraryViewProps {
  initialReadings: ReadingWithProgress[];
  subjects: Subject[];
}

export function LibraryView({ initialReadings, subjects }: LibraryViewProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<"all" | "book" | "article">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "pending" | "read">("all");

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [activeReadingForSession, setActiveReadingForSession] = useState<Reading | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillSummary, setBackfillSummary] = useState<string | null>(null);

  const pendingMetadataCount = initialReadings.filter(
    (reading) => (reading.isbn || reading.doi) && !reading.metadata_fetched_at
  ).length;

  const handleBackfill = async () => {
    setBackfillLoading(true);
    setBackfillSummary(null);
    try {
      const result = await backfillMissingMetadata();
      setBackfillSummary(`Atualizados: ${result.updated} · Não encontrados: ${result.notFound} · Falhas: ${result.failed} · Restantes: ${result.remaining}`);
      router.refresh();
    } finally {
      setBackfillLoading(false);
    }
  };

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const filteredReadings = initialReadings.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.chapter_title && r.chapter_title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.author && r.author.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSubject =
      selectedSubject === "all" || r.subject_id === selectedSubject;

    const matchesType =
      selectedType === "all" || r.type === selectedType;

    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "read" ? r.is_read : !r.is_read);

    return matchesSearch && matchesSubject && matchesType && matchesStatus;
  });

  const handleOpenSession = (reading: Reading) => {
    setActiveReadingForSession(reading);
    setSessionModalOpen(true);
  };

  const handleRefresh = () => {
    router.refresh();
  };

  const totalBooks = initialReadings.filter((r) => r.type === "book").length;
  const totalArticles = initialReadings.filter((r) => r.type === "article").length;
  const totalRead = initialReadings.filter((r) => r.is_read).length;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Biblioteca de Textos
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Cards flat com capa via metadados persistidos ou tema colorido.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs font-mono items-center">
          <Badge variant="outline" className="border-gray-300 px-2 py-0.5">
            {initialReadings.length} Total
          </Badge>
          <Badge variant="outline" className="border-gray-300 px-2 py-0.5">
            {totalBooks} Livros
          </Badge>
          <Badge variant="outline" className="border-gray-300 px-2 py-0.5">
            {totalArticles} Artigos
          </Badge>
          <Badge variant="outline" className="border-gray-300 px-2 py-0.5">
            {totalRead} Concluídos
          </Badge>
          {pendingMetadataCount > 0 && (
            <button type="button" onClick={handleBackfill} disabled={backfillLoading} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-2 py-1 font-sans font-semibold hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800">
              {backfillLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Buscar capas pendentes ({pendingMetadataCount})
            </button>
          )}
        </div>
      </div>

      {backfillSummary && <p className="text-xs text-gray-600 dark:text-gray-400">{backfillSummary}</p>}

      {/* Barra de Filtros */}
      <div className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-4 relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <Input
              placeholder="Buscar por título, capítulo ou autor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-8 rounded border-gray-300 dark:border-gray-700"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full h-8 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 text-xs"
            >
              <option value="all">Todas as Disciplinas</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as "all" | "book" | "article")}
              className="w-full h-8 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 text-xs"
            >
              <option value="all">Todos os Tipos</option>
              <option value="book">Livros</option>
              <option value="article">Artigos</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as "all" | "pending" | "read")}
              className="w-full h-8 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 text-xs"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Apenas Pendentes</option>
              <option value="read">Apenas Concluídos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid de Cards */}
      {filteredReadings.length === 0 ? (
        <div className="py-12 text-center rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <BookOpen className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300">
            Nenhuma leitura encontrada
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Ajuste os filtros ou adicione textos na aba Setup.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredReadings.map((reading) => (
            <BookCard
              key={reading.id}
              reading={reading}
              subject={subjectMap.get(reading.subject_id)}
              onOpenSessionModal={handleOpenSession}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}

      {/* Modal de Sessão de Leitura */}
      <ReadingSessionModal
        reading={activeReadingForSession}
        isOpen={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
