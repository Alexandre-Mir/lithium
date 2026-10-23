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
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
      {/* Top Header Flat */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Setup & Cadastro em Planilha
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Cadastre disciplinas, datas de provas/entregas e leituras com edição inline.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
          Sincronizar
        </button>
      </div>

      {/* Tabs Flat */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md h-9 p-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <TabsTrigger value="readings" className="flex items-center gap-1.5 text-xs font-medium rounded">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Leituras</span>
            <span className="text-[10px] font-mono opacity-70">
              ({initialReadings.length})
            </span>
          </TabsTrigger>

          <TabsTrigger value="deliverables" className="flex items-center gap-1.5 text-xs font-medium rounded">
            <Calendar className="w-3.5 h-3.5" />
            <span>Entregas</span>
            <span className="text-[10px] font-mono opacity-70">
              ({initialDeliverables.length})
            </span>
          </TabsTrigger>

          <TabsTrigger value="subjects" className="flex items-center gap-1.5 text-xs font-medium rounded">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Disciplinas</span>
            <span className="text-[10px] font-mono opacity-70">
              ({initialSubjects.length})
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
