import { connection } from "next/server";
import { getSubjects, getDeliverables, getReadings } from "@/app/actions";
import { SetupView } from "@/components/setup/setup-view";
import { Subject, Deliverable, Reading } from "@/types/database";

export const instant = false;

export default async function SetupPage() {
  await connection();
  let subjects: Subject[] = [];
  let deliverables: Deliverable[] = [];
  let readings: Reading[] = [];
  let connectionError: string | null = null;

  try {
    const [subs, dels, reads] = await Promise.all([
      getSubjects(),
      getDeliverables(),
      getReadings(),
    ]);
    subjects = subs || [];
    deliverables = dels || [];
    readings = reads || [];
  } catch (err: unknown) {
    console.error("Erro ao carregar dados do Supabase:", err);
    connectionError = err instanceof Error ? err.message : "Falha na conexão com o banco.";
  }

  return (
    <div>
      {connectionError && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs px-4 py-2.5 text-center">
          <strong>Aviso de Banco:</strong> Conectando ao Supabase ({connectionError}). Verifique suas chaves em{" "}
          <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono">.env.local</code>.
        </div>
      )}
      <SetupView
        initialSubjects={subjects}
        initialDeliverables={deliverables}
        initialReadings={readings}
      />
    </div>
  );
}
