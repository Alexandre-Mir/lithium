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
  SubjectStat,
} from "@/types/database";

// ============================================================
// VALIDAÇÃO DE DIAS DE AULA
// ============================================================

/**
 * Verifica se qualquer um dos class_days já possui 2 ou mais disciplinas.
 */
export async function validateClassDays(
  classDays: string[],
  excludeSubjectId?: string
): Promise<{ valid: boolean; exceededDay?: string }> {
  if (!classDays || classDays.length === 0) return { valid: true };

  const { data: allSubjects, error } = await supabase
    .from("subjects")
    .select("id, class_days");

  if (error) {
    console.warn("Aviso ao validar class_days:", error.message);
    return { valid: true }; // Não bloqueia caso o banco ainda esteja sincronizando
  }

  // Contar disciplinas por dia
  const dayCounts: Record<string, number> = {};

  for (const s of allSubjects || []) {
    if (excludeSubjectId && s.id === excludeSubjectId) continue;
    for (const day of s.class_days || []) {
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
  }

  for (const day of classDays) {
    if ((dayCounts[day] || 0) >= 2) {
      return { valid: false, exceededDay: day };
    }
  }

  return { valid: true };
}

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
  // Validação: limite de 2 disciplinas por dia
  const validation = await validateClassDays(input.class_days || []);
  if (!validation.valid) {
    throw new Error(`Limite de 2 disciplinas por dia atingido (dia: ${validation.exceededDay}).`);
  }

  const { data, error } = await supabase
    .from("subjects")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/setup");
  return data;
}

export async function updateSubject(id: string, input: SubjectUpdate) {
  if (input.class_days) {
    const validation = await validateClassDays(input.class_days, id);
    if (!validation.valid) {
      throw new Error(`Limite de 2 disciplinas por dia atingido (dia: ${validation.exceededDay}).`);
    }
  }

  const { data, error } = await supabase
    .from("subjects")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/setup");
  return data;
}

export async function deleteSubject(id: string) {
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/setup");
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
  revalidatePath("/setup");
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
  revalidatePath("/setup");
  return data;
}

export async function deleteDeliverable(id: string) {
  const { error } = await supabase.from("deliverables").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/setup");
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
  revalidatePath("/setup");
  revalidatePath("/library");
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
  revalidatePath("/setup");
  revalidatePath("/library");
  return data;
}

export async function deleteReading(id: string) {
  const { error } = await supabase.from("readings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/setup");
  revalidatePath("/library");
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

export async function getAllReadingSessions() {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("*, reading:readings(title, chapter_title, author, type, subject:subjects(name, theme_color))")
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
  const { data: session, error: sessionError } = await supabase
    .from("reading_sessions")
    .insert(input)
    .select()
    .single();
  if (sessionError) throw new Error(sessionError.message);

  // Recalcular velocidade com base em TODAS as sessões
  const { data: allSessions, error: sessionsError } = await supabase
    .from("reading_sessions")
    .select("pages_read, duration_minutes")
    .eq("reading_id", input.reading_id);
  if (sessionsError) throw new Error(sessionsError.message);

  const totalPages = allSessions.reduce((sum, s) => sum + s.pages_read, 0);
  const totalMinutes = allSessions.reduce((sum, s) => sum + s.duration_minutes, 0);

  const newSpeedPph =
    totalMinutes > 0
      ? Math.round((totalPages / totalMinutes) * 60 * 100) / 100
      : 20.0;

  const { error: updateError } = await supabase
    .from("readings")
    .update({ current_speed_pph: newSpeedPph })
    .eq("id", input.reading_id);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/history");
  return { session, newSpeedPph };
}

// ============================================================
// MARCAR LEITURA COMO CONCLUÍDA + REPETIÇÃO ESPAÇADA
// ============================================================

export async function markReadingAsRead(readingId: string) {
  const { error: updateError } = await supabase
    .from("readings")
    .update({ is_read: true })
    .eq("id", readingId);
  if (updateError) throw new Error(updateError.message);

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

  const { error: reviewError } = await supabase
    .from("spaced_reviews")
    .insert(reviews);
  if (reviewError) throw new Error(reviewError.message);

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/setup");
}

export async function markReadingAsUnread(readingId: string) {
  const { error: updateError } = await supabase
    .from("readings")
    .update({ is_read: false })
    .eq("id", readingId);
  if (updateError) throw new Error(updateError.message);

  const { error: deleteError } = await supabase
    .from("spaced_reviews")
    .delete()
    .eq("reading_id", readingId)
    .eq("status", "pending");
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/setup");
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
// MÉTRICAS POR DISCIPLINA (Histórico e Dashboard Gamificado)
// ============================================================

export async function getSubjectStats(): Promise<SubjectStat[]> {
  try {
    const { data: subjects, error: e1 } = await supabase
      .from("subjects")
      .select("*")
      .order("name");
    if (e1) {
      console.warn("Aviso ao carregar subjects para stats:", e1.message);
      return [];
    }

    const { data: readings, error: e2 } = await supabase
      .from("readings")
      .select("id, subject_id, is_read");
    if (e2) {
      console.warn("Aviso ao carregar readings para stats:", e2.message);
      return [];
    }

    const { data: sessions, error: e3 } = await supabase
      .from("reading_sessions")
      .select("reading_id, duration_minutes, pages_read");
    if (e3) {
      console.warn("Aviso ao carregar sessions para stats:", e3.message);
      return [];
    }

    // Mapa de reading_id -> subject_id
    const readingToSubject = new Map<string, string>();
    for (const r of readings || []) {
      readingToSubject.set(r.id, r.subject_id);
    }

    // Agregar estatísticas por disciplina
    const stats: SubjectStat[] = (subjects || []).map((sub: any) => {
      const subReadings = (readings || []).filter((r: any) => r.subject_id === sub.id);
      const totalReadings = subReadings.length;
      const completedReadings = subReadings.filter((r: any) => r.is_read).length;
      const progressPercent =
        totalReadings > 0 ? Math.round((completedReadings / totalReadings) * 100) : 0;

      // Somar sessões das leituras desta disciplina
      const subReadingIds = new Set(subReadings.map((r: any) => r.id));
      const subSessions = (sessions || []).filter((s: any) =>
        subReadingIds.has(s.reading_id)
      );

      const totalMinutes = subSessions.reduce(
        (acc: number, s: any) => acc + (s.duration_minutes || 0),
        0
      );
      const totalPages = subSessions.reduce(
        (acc: number, s: any) => acc + (s.pages_read || 0),
        0
      );

      return {
        id: sub.id,
        name: sub.name,
        professor: sub.professor || "",
        theme_color: sub.theme_color || "#6366f1",
        is_autonomous: sub.is_autonomous,
        totalReadings,
        completedReadings,
        progressPercent,
        totalMinutes,
        totalPages,
      };
    });

    return stats;
  } catch (err) {
    console.warn("Erro ao calcular subject stats:", err);
    return [];
  }
}

// ============================================================
// DASHBOARD — EFEITO CASCATA (Hierarquia de Execução)
// ============================================================

export async function getDashboardData() {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDaysStr = sevenDaysFromNow.toISOString().split("T")[0];

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

  const urgentSubjectIds = new Set(
    urgentDeliverables?.map((d) => d.subject_id) ?? []
  );

  const readingDeliverableMap = new Map<string, string>();
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

  const tier2: any[] = [];
  const tier3: any[] = [];
  const tier4: any[] = [];

  for (const reading of allPendingReadings ?? []) {
    const subject = reading.subject;
    if (!subject || Array.isArray(subject)) continue;

    if (subject.is_autonomous) {
      tier4.push(reading);
    } else if (urgentSubjectIds.has(reading.subject_id)) {
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

export async function getReadingProjection(readingId: string) {
  const { data: reading, error: readingError } = await supabase
    .from("readings")
    .select("*")
    .eq("id", readingId)
    .single();
  if (readingError) throw new Error(readingError.message);

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

  const today = new Date();
  const deadline = new Date(reading.deadline);
  const daysRemaining = Math.max(
    0,
    Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );

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
