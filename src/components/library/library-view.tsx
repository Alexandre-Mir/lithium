"use client";

import { useState } from "react";
import { Reading, Subject } from "@/types/database";
import { BookCard } from "./book-card";
import { ReadingSessionModal } from "@/components/reading-session-modal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  BookOpen,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface LibraryViewProps {
  initialReadings: Reading[];
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

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  // Filtros
  const filteredReadings = initialReadings.filter((r) => {
    // Busca textual por título ou autor
    const matchesSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.author && r.author.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filtro por disciplina
    const matchesSubject =
      selectedSubject === "all" || r.subject_id === selectedSubject;

    // Filtro por tipo
    const matchesType =
      selectedType === "all" || r.type === selectedType;

    // Filtro por status
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2.5">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            Biblioteca de Textos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualização em cards com integração ao Google Books para capas e temas coloridos para artigos.
          </p>
        </div>

        {/* Badges de Resumo */}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="px-2.5 py-1 font-mono">
            <strong>{initialReadings.length}</strong> Total
          </Badge>
          <Badge variant="outline" className="px-2.5 py-1 text-emerald-700 bg-emerald-50 border-emerald-200">
            <strong>{totalBooks}</strong> Livros
          </Badge>
          <Badge variant="outline" className="px-2.5 py-1 text-indigo-700 bg-indigo-50 border-indigo-200">
            <strong>{totalArticles}</strong> Artigos
          </Badge>
          <Badge variant="outline" className="px-2.5 py-1 text-slate-700 bg-slate-100">
            <strong>{totalRead}</strong> Concluídos
          </Badge>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <Input
              placeholder="Buscar por título ou autor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring"
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
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">Todos os Tipos</option>
              <option value="book">Apenas Livros</option>
              <option value="article">Apenas Artigos</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as "all" | "pending" | "read")}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring"
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
        <div className="py-16 text-center rounded-2xl border border-dashed bg-card/50">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">
            Nenhuma leitura encontrada
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchTerm || selectedSubject !== "all" || selectedType !== "all" || selectedStatus !== "all"
              ? "Tente ajustar os filtros acima para encontrar o que procura."
              : "Cadastre suas leituras na aba Setup para começar a acompanhar seu progresso."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
