import { connection } from "next/server";
import { getReadings, getSubjects } from "@/app/actions";
import { LibraryView } from "@/components/library/library-view";
import { Reading, Subject } from "@/types/database";

export const instant = false;

export default async function LibraryPage() {
  await connection();
  let readings: Reading[] = [];
  let subjects: Subject[] = [];
  let connectionError: string | null = null;

  try {
    const [reads, subs] = await Promise.all([getReadings(), getSubjects()]);
    readings = reads || [];
    subjects = subs || [];
  } catch (err: unknown) {
    console.error("Erro ao carregar leituras da biblioteca:", err);
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
      <LibraryView initialReadings={readings} subjects={subjects} />
    </div>
  );
}
