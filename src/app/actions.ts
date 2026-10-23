"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import type {
  SubjectInsert,
  SubjectUpdate,
  DeliverableInsert,
  DeliverableUpdate,
  ReadingInsert,
  ReadingUpdate,
  ReadingSessionInsert,
  SpacedReviewUpdate,
} from "@/types/database";

// ============================================================
// SUBJECTS
// ============================================================

export async function getSubjects() {
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function createSubject(input: SubjectInsert) {
  const { data, error } = await supabase
    .from("subjects")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function updateSubject(id: string, input: SubjectUpdate) {
  const { data, error } = await supabase
    .from("subjects")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function deleteSubject(id: string) {
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

// ============================================================
// DELIVERABLES
// ============================================================

export async function getDeliverables(subjectId?: string) {
  let query = supabase
    .from("deliverables")
    .select("*")
    .order("date", { ascending: true });
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function createDeliverable(input: DeliverableInsert) {
  const { data, error } = await supabase
    .from("deliverables")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function updateDeliverable(id: string, input: DeliverableUpdate) {
  const { data, error } = await supabase
    .from("deliverables")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function deleteDeliverable(id: string) {
  const { error } = await supabase.from("deliverables").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

// ============================================================
// READINGS
// ============================================================

export async function getReadings(subjectId?: string) {
  let query = supabase
    .from("readings")
    .select("*, subject:subjects(*)")
    .order("deadline", { ascending: true });
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getReadingById(id: string) {
  const { data, error } = await supabase
    .from("readings")
    .select("*, subject:subjects(*)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createReading(input: ReadingInsert) {
  const { data, error } = await supabase
    .from("readings")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function updateReading(id: string, input: ReadingUpdate) {
  const { data, error } = await supabase
    .from("readings")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function deleteReading(id: string) {
  const { error } = await supabase.from("readings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

// ============================================================
// READING SESSIONS + CALIBRAÇÃO
// ============================================================

export async function getReadingSessions(readingId: string) {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("*")
    .eq("reading_id", readingId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Cria uma sessão de leitura e executa a CALIBRAÇÃO:
 * - Calcula a velocidade real: (pages_read / duration_minutes) * 60
 * - Atualiza current_speed_pph na leitura correspondente
 */
export async function createReadingSession(input: ReadingSessionInsert) {
  // 1. Inserir a sessão
  const { data: session, error: sessionError } = await supabase
    .from("reading_sessions")
    .insert(input)
    .select()
    .single();
  if (sessionError) throw new Error(sessionError.message);

  // 2. CALIBRAÇÃO — recalcular velocidade com base em TODAS as sessões
  const { data: allSessions, error: sessionsError } = await supabase
    .from("reading_sessions")
    .select("pages_read, duration_minutes")
    .eq("reading_id", input.reading_id);
  if (sessionsError) throw new Error(sessionsError.message);

  const totalPages = allSessions.reduce((sum, s) => sum + s.pages_read, 0);
  const totalMinutes = allSessions.reduce((sum, s) => sum + s.duration_minutes, 0);

  // Média ponderada: total de páginas / total de minutos * 60
  const newSpeedPph =
    totalMinutes > 0
      ? Math.round((totalPages / totalMinutes) * 60 * 100) / 100
      : 20.0;

  // 3. Atualizar a velocidade na leitura
  const { error: updateError } = await supabase
    .from("readings")
    .update({ current_speed_pph: newSpeedPph })
    .eq("id", input.reading_id);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/");
  return { session, newSpeedPph };
}

// ============================================================
// MARCAR LEITURA COMO CONCLUÍDA + REPETIÇÃO ESPAÇADA
// ============================================================

/**
 * Marca uma leitura como concluída (is_read = true) e
 * DISPARA o Gatilho de Repetição Espaçada:
 * - D+1  (active_recall)
 * - D+7  (active_recall)
 * - D+21 (active_recall)
 */
export async function markReadingAsRead(readingId: string) {
  // 1. Marcar como lida
  const { error: updateError } = await supabase
    .from("readings")
    .update({ is_read: true })
    .eq("id", readingId);
  if (updateError) throw new Error(updateError.message);

  // 2. Calcular datas de revisão
  const today = new Date();
  const intervals = [1, 7, 21];

  const reviews = intervals.map((days) => {
    const reviewDate = new Date(today);
    reviewDate.setDate(reviewDate.getDate() + days);
    return {
      reading_id: readingId,
      review_date: reviewDate.toISOString().split("T")[0],
      status: "pending" as const,
      type: "active_recall",
    };
  });

  // 3. Inserir os 3 gatilhos de repetição
  const { error: reviewError } = await supabase
    .from("spaced_reviews")
    .insert(reviews);
  if (reviewError) throw new Error(reviewError.message);

  revalidatePath("/");
}

/**
 * Desmarcar leitura como não-lida e remover revisões pendentes
 */
export async function markReadingAsUnread(readingId: string) {
  const { error: updateError } = await supabase
    .from("readings")
    .update({ is_read: false })
    .eq("id", readingId);
  if (updateError) throw new Error(updateError.message);

  // Remover revisões pendentes (manter as que já foram feitas)
  const { error: deleteError } = await supabase
    .from("spaced_reviews")
    .delete()
    .eq("reading_id", readingId)
    .eq("status", "pending");
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/");
}

// ============================================================
// SPACED REVIEWS
// ============================================================

export async function getSpacedReviews(status?: "pending" | "done") {
  let query = supabase
    .from("spaced_reviews")
    .select("*, reading:readings(*, subject:subjects(*))")
    .order("review_date", { ascending: true });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSpacedReview(id: string, input: SpacedReviewUpdate) {
  const { data, error } = await supabase
    .from("spaced_reviews")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function markReviewAsDone(id: string) {
  return updateSpacedReview(id, { status: "done" });
}

// ============================================================
// DASHBOARD — EFEITO CASCATA (Hierarquia de Execução)
// ============================================================

/**
 * Busca e organiza as tarefas do dia na hierarquia do Efeito Cascata:
 *
 * Tier 1: spaced_reviews pendentes com review_date <= hoje
 * Tier 2: readings pendentes de matérias NÃO autônomas com deliverable em <= 7 dias
 * Tier 3: readings pendentes regulares (não autônomas)
 * Tier 4: readings pendentes de matérias autônomas
 */
export async function getDashboardData() {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDaysStr = sevenDaysFromNow.toISOString().split("T")[0];

  // ---- Tier 1: Revisões pendentes (vencidas ou do dia) ----
  let tier1: any[] = [];
  let schemaError: string | null = null;

  try {
    const { data, error: e1 } = await supabase
      .from("spaced_reviews")
      .select("*, reading:readings(*, subject:subjects(*))")
      .eq("status", "pending")
      .lte("review_date", today)
      .order("review_date", { ascending: true });
    if (e1) {
      console.warn("Aviso na busca de spaced_reviews:", e1.message);
      schemaError = e1.message;
    } else {
      tier1 = data || [];
    }
  } catch (err: any) {
    console.warn("Exceção na busca de spaced_reviews:", err?.message);
    schemaError = err?.message;
  }

  // ---- Buscar todas as leituras pendentes com subject ----
  let allPendingReadings: any[] = [];
  try {
    const { data, error: e2 } = await supabase
      .from("readings")
      .select("*, subject:subjects(*)")
      .eq("is_read", false)
      .order("deadline", { ascending: true });
    if (e2) {
      console.warn("Aviso na busca de readings:", e2.message);
      if (!schemaError) schemaError = e2.message;
    } else {
      allPendingReadings = data || [];
    }
  } catch (err: any) {
    console.warn("Exceção na busca de readings:", err?.message);
  }

  // ---- Buscar deliverables na zona de perigo (próximos 7 dias) ----
  let urgentDeliverables: any[] = [];
  try {
    const { data, error: e3 } = await supabase
      .from("deliverables")
      .select("*")
      .lte("date", sevenDaysStr)
      .gte("date", today)
      .order("date", { ascending: true });
    if (e3) {
      console.warn("Aviso na busca de deliverables urgentes:", e3.message);
    } else {
      urgentDeliverables = data || [];
    }
  } catch (err: any) {
    console.warn("Exceção na busca de deliverables:", err?.message);
  }

  // ---- Buscar TODOS os deliverables para a Regra Cronológica ----
  let allDeliverables: any[] = [];
  try {
    const { data, error: e4 } = await supabase
      .from("deliverables")
      .select("*")
      .order("date", { ascending: true });
    if (e4) {
      console.warn("Aviso na busca de allDeliverables:", e4.message);
    } else {
      allDeliverables = data || [];
    }
  } catch (err: any) {
    console.warn("Exceção na busca de allDeliverables:", err?.message);
  }

  // IDs de subjects com deliverables urgentes
  const urgentSubjectIds = new Set(
    urgentDeliverables?.map((d) => d.subject_id) ?? []
  );

  // Regra Cronológica de Vínculo:
  // Uma reading está vinculada a um deliverable se:
  // reading.deadline <= deliverable.date E reading.deadline > data do deliverable anterior da mesma matéria
  const readingDeliverableMap = new Map<string, string>(); // reading_id -> deliverable_id

  // Agrupar deliverables por subject
  const deliverablesBySubject = new Map<string, typeof allDeliverables>();
  for (const d of allDeliverables ?? []) {
    const list = deliverablesBySubject.get(d.subject_id) ?? [];
    list.push(d);
    deliverablesBySubject.set(d.subject_id, list);
  }

  for (const reading of allPendingReadings ?? []) {
    const subjectDeliverables = deliverablesBySubject.get(reading.subject_id);
    if (!subjectDeliverables) continue;

    for (let i = 0; i < subjectDeliverables.length; i++) {
      const deliverable = subjectDeliverables[i];
      const previousDate =
        i > 0 ? subjectDeliverables[i - 1].date : "1970-01-01";

      if (
        reading.deadline <= deliverable.date &&
        reading.deadline > previousDate
      ) {
        readingDeliverableMap.set(reading.id, deliverable.id);
        break;
      }
    }
  }

  // ---- Classificar as leituras pendentes em tiers ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tier2: (typeof allPendingReadings extends (infer T)[] | null ? T : never)[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tier3: typeof tier2 = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tier4: typeof tier2 = [];

  for (const reading of allPendingReadings ?? []) {
    const subject = reading.subject;
    if (!subject) continue;

    if (Array.isArray(subject)) continue; // type guard

    if (subject.is_autonomous) {
      tier4.push(reading);
    } else if (urgentSubjectIds.has(reading.subject_id)) {
      // Verificar se esta reading está vinculada a um deliverable urgente
      const linkedDeliverableId = readingDeliverableMap.get(reading.id);
      const isLinkedToUrgent = urgentDeliverables?.some(
        (d) => d.id === linkedDeliverableId
      );
      if (isLinkedToUrgent) {
        tier2.push(reading);
      } else {
        tier3.push(reading);
      }
    } else {
      tier3.push(reading);
    }
  }

  return {
    tier1: tier1 ?? [],
    tier2,
    tier3,
    tier4,
    readingDeliverableMap: Object.fromEntries(readingDeliverableMap),
    urgentDeliverables: urgentDeliverables ?? [],
    allDeliverables: allDeliverables ?? [],
    schemaError,
  };
}

// ============================================================
// PROJEÇÃO DE TEMPO (utilitário)
// ============================================================

/**
 * Calcula a projeção de horas necessárias para concluir uma leitura,
 * com base na velocidade calibrada e nas sessões já realizadas.
 */
export async function getReadingProjection(readingId: string) {
  const { data: reading, error: readingError } = await supabase
    .from("readings")
    .select("*")
    .eq("id", readingId)
    .single();
  if (readingError) throw new Error(readingError.message);

  // Total de páginas já lidas
  const { data: sessions, error: sessionsError } = await supabase
    .from("reading_sessions")
    .select("pages_read")
    .eq("reading_id", readingId);
  if (sessionsError) throw new Error(sessionsError.message);

  const pagesRead = sessions.reduce((sum, s) => sum + s.pages_read, 0);
  const pagesRemaining = Math.max(0, reading.target_pages - pagesRead);
  const hoursRemaining =
    reading.current_speed_pph > 0
      ? Math.round((pagesRemaining / reading.current_speed_pph) * 100) / 100
      : 0;

  // Dias até a deadline
  const today = new Date();
  const deadline = new Date(reading.deadline);
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  // Horas por dia necessárias
  const hoursPerDay =
    daysRemaining > 0
      ? Math.round((hoursRemaining / daysRemaining) * 100) / 100
      : hoursRemaining;

  return {
    totalPages: reading.target_pages,
    pagesRead,
    pagesRemaining,
    speedPph: reading.current_speed_pph,
    hoursRemaining,
    daysRemaining,
    hoursPerDay,
    isOverdue: daysRemaining === 0 && pagesRemaining > 0,
  };
}
