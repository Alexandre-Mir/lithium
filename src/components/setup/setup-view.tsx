"use client";

import { useState } from "react";
import { Subject, Deliverable, Reading } from "@/types/database";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubjectsTable } from "./subjects-table";
import { DeliverablesTable } from "./deliverables-table";
import { ReadingsTable } from "./readings-table";
import { GraduationCap, Calendar, BookOpen, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface SetupViewProps {
  initialSubjects: Subject[];
  initialDeliverables: Deliverable[];
  initialReadings: Reading[];
}

export function SetupView({
  initialSubjects,
  initialDeliverables,
  initialReadings,
}: SetupViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("readings");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            Setup & Cadastro em Planilha
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre e edite rapidamente Disciplinas, Entregas/Provas e Leituras com Inline Editing.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border bg-background hover:bg-muted transition-colors shadow-xs w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
          Sincronizar Dados
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 max-w-md h-11 p-1 bg-muted/60">
          <TabsTrigger value="readings" className="flex items-center gap-2 text-xs font-semibold">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>Leituras</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded-full font-mono">
              {initialReadings.length}
            </span>
          </TabsTrigger>

          <TabsTrigger value="deliverables" className="flex items-center gap-2 text-xs font-semibold">
            <Calendar className="w-4 h-4 text-violet-600" />
            <span>Entregas</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded-full font-mono">
              {initialDeliverables.length}
            </span>
          </TabsTrigger>

          <TabsTrigger value="subjects" className="flex items-center gap-2 text-xs font-semibold">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>Disciplinas</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded-full font-mono">
              {initialSubjects.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="readings" className="space-y-4 focus-visible:outline-none">
          <ReadingsTable
            initialReadings={initialReadings}
            subjects={initialSubjects}
            deliverables={initialDeliverables}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="deliverables" className="space-y-4 focus-visible:outline-none">
          <DeliverablesTable
            initialDeliverables={initialDeliverables}
            subjects={initialSubjects}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4 focus-visible:outline-none">
          <SubjectsTable
            initialSubjects={initialSubjects}
            onRefresh={handleRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
