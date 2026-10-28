"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { todayISO, addDaysISO, daysUntil, startOfDayUtcISO } from "@/lib/dates";
import { findLinkedDeliverable } from "@/lib/cascade";
import { fetchArticleMetadata, fetchBookMetadata } from "@/lib/book-metadata";
import { globalAverageSpeedPph, pickInitialSpeed, pickUserPacePagesPerDay, speedFromTotals } from "@/lib/speed";
import { projectReadingQueue } from "@/lib/projection";
import { calculateSuggestedPages, getSuggestedReading } from "@/lib/recommendation";
import { validateReadingUpdate } from "@/lib/reading-validation";
import { warnIfTruncated } from "@/lib/warn-if-truncated";
import { computeRemaining } from "@/lib/progress";
import { computeSubjectPageProgress } from "@/lib/subject-progress";
import { getTodayTotalReadingTime, pph, secondsToMinutes, sessionSeconds } from "@/lib/session-time";
import { validateSessionInput } from "@/lib/session-validation";
import { getCrossedMilestones } from "@/lib/milestone-crossing";
import {
  getDueAgendaReviews,
  getReviewScheduleDates,
  mapScheduledReviewToAgendaEvent,
  mapSpacedReviewToAgendaEvent,
  type AgendaDeliverableEvent,
  type AgendaMilestoneReviewEvent,
  type AgendaReviewEvent,
  type ScheduledReviewAgendaRow,
  type SpacedReviewAgendaRow,
} from "@/lib/agenda";
import {
  nextMilestoneSummaryStatus,
  validateMilestoneSummaryContent,
} from "@/lib/milestone-summary";
import { requireSupabaseUser } from "@/lib/supabase/server";
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
  Subject,
  Reading,
  ReadingSession,
  ReadingWithProgress,
  Deliverable,
  ReadingWithSubject,
  SpacedReviewWithReading,
  ReadingSpeedStat,
  MilestoneSummary,
  MilestoneSummaryWithBook,
  ReadingMilestone,
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
  revalidatePath("/library", "layout");
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

interface ReadingProgressSummary {
  pages_read: number;
  sessions: number;
  total_seconds: number;
}

interface ReadingProgressViewRow extends ReadingProgressSummary {
  reading_id: string;
}

type TodayReadingSession = Pick<
  ReadingSession,
  "reading_id" | "pages_read" | "duration_minutes" | "duration_seconds" | "started_at" | "ended_at" | "created_at"
>;

type ReadingQueueSource = Pick<Reading, "id" | "target_pages" | "created_at" | "deadline" | "is_read"> & {
  pages_read: number;
};

function attachSuggestedDeadlines<T extends ReadingQueueSource>(
  readings: readonly T[],
  stats: readonly ReadingSpeedStat[],
): Array<T & { suggested_deadline: string | null }> {
  const queue = projectReadingQueue(readings, pickUserPacePagesPerDay(stats));
  const suggestions = new Map(queue.map((reading) => [reading.id, reading.suggestedDeadline]));
  return readings.map((reading) => ({
    ...reading,
    suggested_deadline: suggestions.get(reading.id) ?? null,
  }));
}

async function getUndatedActiveReadings() {
  const { data, error } = await supabase
    .from("readings")
    .select("id, target_pages, created_at, deadline, is_read")
    .eq("is_read", false)
    .is("deadline", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  warnIfTruncated(rows, "getUndatedActiveReadings");
  return rows as Pick<Reading, "id" | "target_pages" | "created_at" | "deadline" | "is_read">[];
}

async function getReadingProgressMap(): Promise<Map<string, ReadingProgressSummary>> {
  try {
    const { data, error } = await supabase
      .from("reading_progress")
      .select("reading_id, sessions, pages_read, total_seconds");

    if (error) {
      console.warn("Não foi possível consultar reading_progress; páginas lidas serão consideradas zero:", error.message);
      return new Map();
    }

    const rows = (data ?? []) as unknown as ReadingProgressViewRow[];
    warnIfTruncated(rows, "getReadingProgressMap");
    return new Map(rows.map((row) => [
      row.reading_id,
      {
        pages_read: Number(row.pages_read) || 0,
        sessions: Number(row.sessions) || 0,
        total_seconds: Number(row.total_seconds) || 0,
      },
    ]));
  } catch (error: unknown) {
    console.warn(
      "Erro ao consultar reading_progress; páginas lidas serão consideradas zero:",
      error instanceof Error ? error.message : "Falha desconhecida.",
    );
    return new Map();
  }
}

async function getLatestSessionDateMap(
  readings: readonly ReadingWithSubject[],
  progressByReading: ReadonlyMap<string, ReadingProgressSummary>,
): Promise<Map<string, string>> {
  const readingIds = readings
    .filter((reading) => (progressByReading.get(reading.id)?.sessions ?? 0) > 0)
    .map((reading) => reading.id);
  const latestDates = new Map<string, string>();
  if (readingIds.length === 0) return latestDates;

  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("reading_sessions")
      .select("reading_id, started_at, ended_at, created_at")
      .in("reading_id", readingIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.warn("Não foi possível consultar a última sessão por leitura:", error.message);
      return latestDates;
    }

    const rows = (data ?? []) as Array<Pick<ReadingSession, "reading_id" | "started_at" | "ended_at" | "created_at">>;
    for (const session of rows) {
      if (!latestDates.has(session.reading_id)) {
        latestDates.set(
          session.reading_id,
          session.ended_at ?? session.started_at ?? session.created_at,
        );
      }
    }

    if (latestDates.size === readingIds.length || rows.length < pageSize) break;
  }

  return latestDates;
}

export async function getReadings(subjectId?: string) {
  let query = supabase
    .from("readings")
    .select("*, subject:subjects(*)")
    .order("deadline", { ascending: true });
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  warnIfTruncated(rows, "getReadings");
  const [progressByReading, speedStats] = await Promise.all([getReadingProgressMap(), getSpeedStats()]);
  const readingsWithProgress = (rows as unknown as Reading[]).map((reading) => ({
    ...reading,
    pages_read: progressByReading.get(reading.id)?.pages_read ?? 0,
  }));
  return attachSuggestedDeadlines(readingsWithProgress, speedStats) as ReadingWithProgress[];
}

export async function getReadingById(id: string) {
  const { data, error } = await supabase
    .from("readings")
    .select("*, subject:subjects(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSpacedReviewsByReading(readingId: string) {
  const { data, error } = await supabase
    .from("spaced_reviews")
    .select("*")
    .eq("reading_id", readingId)
    .order("review_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getSpeedStats(): Promise<ReadingSpeedStat[]> {
  const { data, error } = await supabase
    .from("reading_speed_stats")
    .select("reading_type, sessions, total_pages, total_minutes, total_seconds");

  if (error) {
    console.warn("Não foi possível consultar reading_speed_stats:", error.message);
    return [];
  }

  return (data ?? []) as unknown as ReadingSpeedStat[];
}

async function getTodayReadingSummary(): Promise<{
  minutes: number;
  pagesByReading: Map<string, number>;
}> {
  const today = todayISO();
  const start = startOfDayUtcISO(today);
  const end = startOfDayUtcISO(addDaysISO(today, 1));
  const pageSize = 1000;
  const sessions: TodayReadingSession[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("reading_sessions")
      .select("reading_id, pages_read, duration_minutes, duration_seconds, started_at, ended_at, created_at")
      .or(
        `and(started_at.gte.${start},started_at.lt.${end}),and(ended_at.gte.${start},ended_at.lt.${end}),and(started_at.is.null,ended_at.is.null,created_at.gte.${start},created_at.lt.${end})`,
      )
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.warn("Não foi possível consultar as sessões de hoje:", error.message);
      return { minutes: 0, pagesByReading: new Map() };
    }

    const rows = (data ?? []) as unknown as TodayReadingSession[];
    sessions.push(...rows);
    if (rows.length < pageSize) break;
  }

  const pagesByReading = new Map<string, number>();
  for (const session of sessions) {
    pagesByReading.set(
      session.reading_id,
      (pagesByReading.get(session.reading_id) ?? 0) + session.pages_read,
    );
  }

  return {
    minutes: getTodayTotalReadingTime(sessions),
    pagesByReading,
  };
}

export async function getDailyGoalMinutes(): Promise<number> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("daily_goal_minutes")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.warn("Não foi possível consultar a meta diária; usando 60 minutos:", error.message);
    return 60;
  }

  return Number(data?.daily_goal_minutes) || 60;
}

export async function updateDailyGoalMinutes(minutes: number): Promise<number> {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error("A meta diária deve ser um número inteiro entre 1 e 1.440 minutos.");
  }

  const { data, error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, daily_goal_minutes: minutes })
    .select("daily_goal_minutes")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/");
  return Number(data.daily_goal_minutes);
}

export async function getReadingDetail(id: string) {
  const reading = await getReadingById(id);
  if (!reading) return null;

  const needsSuggestedDeadline = !reading.is_read && reading.deadline === null;
  const [sessions, reviews, deliverables, speedStats, progressByReading, undatedReadings] = await Promise.all([
    getReadingSessions(id),
    getSpacedReviewsByReading(id),
    getDeliverables(reading.subject_id),
    getSpeedStats(),
    getReadingProgressMap(),
    needsSuggestedDeadline ? getUndatedActiveReadings() : Promise.resolve([]),
  ]);
  const queueWithProgress = undatedReadings.map((queueReading) => ({
    ...queueReading,
    pages_read: progressByReading.get(queueReading.id)?.pages_read ?? 0,
  }));
  const suggestedDeadline = needsSuggestedDeadline
    ? attachSuggestedDeadlines(queueWithProgress, speedStats).find((item) => item.id === id)?.suggested_deadline ?? null
    : null;
  const totalPages = speedStats.reduce((sum, stat) => sum + stat.total_pages, 0);
  const totalSeconds = speedStats.reduce((sum, stat) => sum + stat.total_seconds, 0);
  return {
    reading,
    sessions,
    reviews,
    deliverables,
    suggestedDeadline,
    globalAverageSpeed: pph(totalPages, totalSeconds),
  };
}

export async function createReading(input: ReadingInsert) {
  const validationError = validateReadingUpdate({ deadline: input.deadline, milestones: input.milestones });
  if (validationError) throw new Error(validationError);

  const currentSpeed = input.current_speed_pph ?? pickInitialSpeed(await getSpeedStats(), input.type);
  const insert = {
    ...input,
    current_speed_pph: currentSpeed,
    ...(input.metadata_source ? { metadata_fetched_at: new Date().toISOString() } : {}),
  };
  const { data, error } = await supabase
    .from("readings")
    .insert(insert)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/setup");
  revalidatePath("/library");
  return data;
}

export async function lookupBookByIsbn(isbn: string) {
  return fetchBookMetadata(isbn);
}

export async function lookupArticleByDoi(doi: string) {
  return fetchArticleMetadata(doi);
}

type MetadataFields = {
  cover_url: string | null;
  publisher: string | null;
  published_year: number | null;
  metadata_source: string | null;
  metadata_fetched_at: string;
};

export async function refreshReadingMetadata(readingId: string, options: { force?: boolean } = {}) {
  const { data: reading, error: readingError } = await supabase.from("readings").select("id, type, isbn, doi, cover_url, publisher, published_year, metadata_source, metadata_fetched_at").eq("id", readingId).single();
  if (readingError) throw new Error(readingError.message);
  if (!options.force && reading.metadata_fetched_at) return { status: "skipped" as const };
  const result = reading.type === "book" && reading.isbn ? await fetchBookMetadata(reading.isbn) : reading.type === "article" && reading.doi ? await fetchArticleMetadata(reading.doi) : { status: "not_found" as const };
  if (result.status === "error") return result;
  const fields: MetadataFields = result.status === "not_found"
    ? { cover_url: reading.cover_url, publisher: reading.publisher, published_year: reading.published_year, metadata_source: reading.metadata_source, metadata_fetched_at: new Date().toISOString() }
    : { cover_url: result.data.coverUrl ?? reading.cover_url, publisher: result.data.publisher ?? reading.publisher, published_year: result.data.publishedYear ?? reading.published_year, metadata_source: result.data.source ?? reading.metadata_source, metadata_fetched_at: new Date().toISOString() };
  const { error } = await supabase.from("readings").update(fields).eq("id", readingId);
  if (error) throw new Error(error.message);
  revalidatePath("/library");
  revalidatePath(`/library/${readingId}`);
  return result;
}

export async function backfillMissingMetadata() {
  const { data: readings, error } = await supabase.from("readings").select("id, type, isbn, doi, metadata_fetched_at").is("metadata_fetched_at", null).or("isbn.not.is.null,doi.not.is.null").limit(6);
  if (error) throw new Error(error.message);
  let updated = 0;
  let notFound = 0;
  let failed = 0;
  for (const [index, reading] of (readings ?? []).entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1100));
    const result = await refreshReadingMetadata(reading.id, { force: true });
    if (result.status === "ok") updated++;
    else if (result.status === "not_found") notFound++;
    else if (result.status === "error") {
      failed++;
      if (result.reason === "rate_limited") break;
    }
  }
  const { count } = await supabase.from("readings").select("id", { count: "exact", head: true }).is("metadata_fetched_at", null).or("isbn.not.is.null,doi.not.is.null");
  return { updated, notFound, failed, remaining: count ?? 0 };
}

export async function updateReading(id: string, input: ReadingUpdate) {
  const validationError = validateReadingUpdate(input);
  if (validationError) throw new Error(validationError);

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
  revalidatePath(`/library/${id}`);
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

async function recalculateReadingSpeed(readingId: string) {
  const [readingResult, progressResult, stats] = await Promise.all([
    supabase.from("readings").select("type").eq("id", readingId).maybeSingle(),
    supabase
      .from("reading_progress")
      .select("sessions, pages_read, total_seconds")
      .eq("reading_id", readingId)
      .maybeSingle(),
    getSpeedStats(),
  ]);
  if (readingResult.error) throw new Error(readingResult.error.message);
  if (!readingResult.data) throw new Error("Leitura não encontrada para recalcular a velocidade.");
  if (progressResult.error) throw new Error(progressResult.error.message);

  const progress = progressResult.data;
  const newSpeedPph = speedFromTotals(
    progress
      ? {
          sessions: Number(progress.sessions) || 0,
          pages_read: Number(progress.pages_read) || 0,
          total_seconds: Number(progress.total_seconds) || 0,
        }
      : null,
    stats,
    readingResult.data.type,
  );
  const { error } = await supabase
    .from("readings")
    .update({ current_speed_pph: newSpeedPph })
    .eq("id", readingId);
  if (error) throw new Error(error.message);
  return newSpeedPph;
}

function revalidateReadingSessionPaths(readingId: string) {
  revalidatePath("/");
  revalidatePath("/library", "layout");
  revalidatePath("/history");
  revalidatePath(`/library/${readingId}`);
}

export async function getAllReadingSessions() {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("*, reading:readings(title, chapter_title, author, type, target_pages, full_book_pages, subject:subjects(name, theme_color))")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const sessions = data ?? [];
  const truncated = warnIfTruncated(sessions, "getAllReadingSessions");
  return { sessions, truncated };
}

/**
 * Cria uma sessão de leitura e executa a CALIBRAÇÃO:
 * - Calcula a velocidade real a partir dos segundos agregados em reading_progress.
 * - Atualiza current_speed_pph na leitura correspondente
 */
export async function createReadingSession(input: ReadingSessionInsert) {
  const validationError = validateSessionInput(input);
  if (validationError) throw new Error(validationError);

  const { client: authenticatedClient, user } = await requireSupabaseUser();
  const [readingResult, progressResult] = await Promise.all([
    supabase
      .from("readings")
      .select("milestones")
      .eq("id", input.reading_id)
      .maybeSingle(),
    supabase
      .from("reading_progress")
      .select("pages_read")
      .eq("reading_id", input.reading_id)
      .maybeSingle(),
  ]);
  if (readingResult.error) throw new Error(readingResult.error.message);
  if (!readingResult.data) throw new Error("Leitura não encontrada.");
  if (progressResult.error) throw new Error(progressResult.error.message);

  const previousPage = Number(progressResult.data?.pages_read) || 0;
  const nextPage = previousPage + input.pages_read;
  const crossedMilestones = getCrossedMilestones(
    (readingResult.data.milestones ?? []) as ReadingMilestone[],
    previousPage,
    nextPage,
  );

  const durationSeconds = input.duration_seconds;
  const { data: session, error: sessionError } = await supabase
    .from("reading_sessions")
    .insert({
      ...input,
      duration_minutes: secondsToMinutes(durationSeconds),
      started_at: input.started_at ?? null,
      ended_at: input.ended_at ?? null,
    })
    .select()
    .single();
  if (sessionError) throw new Error(sessionError.message);

  if (crossedMilestones.length > 0) {
    const summaries = crossedMilestones.map((milestone) => ({
      user_id: user.id,
      book_id: input.reading_id,
      milestone_title: milestone.title,
      milestone_page: milestone.page,
      content: null,
      status: "pending" as const,
    }));
    const { error: summaryError } = await authenticatedClient
      .from("milestone_summaries")
      .upsert(summaries, {
        onConflict: "user_id,book_id,milestone_page,milestone_title",
        ignoreDuplicates: true,
      });
    if (summaryError) throw new Error(summaryError.message);
  }

  const newSpeedPph = await recalculateReadingSpeed(input.reading_id);
  revalidateReadingSessionPaths(input.reading_id);
  return { session, newSpeedPph };
}

export async function getMilestoneSummaries(): Promise<MilestoneSummaryWithBook[]> {
  const { client } = await requireSupabaseUser();
  const { data, error } = await client
    .from("milestone_summaries")
    .select("*, book:readings(title, chapter_title)")
    .in("status", ["pending", "review"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MilestoneSummaryWithBook[];
}

export async function updateMilestoneSummary(id: string, content: string) {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Tarefa de Revisão Ativa inválida.");
  }
  if (typeof content !== "string") {
    throw new Error("O conteúdo do resumo é inválido.");
  }
  const validationError = validateMilestoneSummaryContent(content);
  if (validationError) throw new Error(validationError);

  const { client, user } = await requireSupabaseUser();
  const { data: current, error: findError } = await client
    .from("milestone_summaries")
    .select("id, user_id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!current) throw new Error("Tarefa de Revisão Ativa não encontrada.");

  const nextStatus = nextMilestoneSummaryStatus(current.status as MilestoneSummary["status"]);
  if (!nextStatus) throw new Error("Este resumo já foi concluído.");

  if (nextStatus === "completed") {
    const completedDate = todayISO();
    const [reviewD1, reviewD7, reviewD21] = getReviewScheduleDates(completedDate);
    const { error } = await client.rpc("complete_milestone_summary", {
      p_summary_id: id,
      p_content: content.trim(),
      p_completed_date: completedDate,
      p_review_date_1: reviewD1.review_date,
      p_review_date_7: reviewD7.review_date,
      p_review_date_21: reviewD21.review_date,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/agenda");
  } else {
    const { error } = await client
      .from("milestone_summaries")
      .update({ content: content.trim(), status: nextStatus })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/");
  return { status: nextStatus };
}

interface AgendaDeliverableRow {
  id: string;
  title: string;
  date: string;
  subject: { name: string } | null;
}

export async function getAgendaData(from: string, to: string): Promise<{
  deliverables: AgendaDeliverableEvent[];
  reviews: AgendaReviewEvent[];
}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw new Error("Intervalo de datas inválido para a Agenda.");
  }

  const { client, user } = await requireSupabaseUser();
  const pageSize = 1000;
  const deliverableRows: AgendaDeliverableRow[] = [];
  const scheduledReviewRows: ScheduledReviewAgendaRow[] = [];
  const spacedReviewRows: SpacedReviewAgendaRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("deliverables")
      .select("id, title, date, subject:subjects(name)")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as AgendaDeliverableRow[];
    deliverableRows.push(...rows);
    if (rows.length < pageSize) break;
  }

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("scheduled_reviews")
      .select("id, milestone_summary_id, review_date, review_type, status, milestone_summary:milestone_summaries(milestone_title, milestone_page, content, book:readings(id, title, chapter_title))")
      .eq("user_id", user.id)
      .gte("review_date", from)
      .lte("review_date", to)
      .order("review_date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as ScheduledReviewAgendaRow[];
    scheduledReviewRows.push(...rows);
    if (rows.length < pageSize) break;
  }

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("spaced_reviews")
      .select("id, reading_id, review_date, type, status, reading:readings(title, chapter_title, subject:subjects(name))")
      .gte("review_date", from)
      .lte("review_date", to)
      .order("review_date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as SpacedReviewAgendaRow[];
    spacedReviewRows.push(...rows);
    if (rows.length < pageSize) break;
  }

  const deliverables: AgendaDeliverableEvent[] = deliverableRows.map((row) => ({
    kind: "deliverable",
    id: row.id,
    date: row.date,
    title: row.title,
    subjectName: row.subject?.name ?? "Sem disciplina",
  }));
  const reviews: AgendaReviewEvent[] = [
    ...scheduledReviewRows.map(mapScheduledReviewToAgendaEvent),
    ...spacedReviewRows.map(mapSpacedReviewToAgendaEvent),
  ].filter((review): review is AgendaReviewEvent => review !== null);

  return { deliverables, reviews };
}

export async function completeReview(reviewId: string) {
  if (typeof reviewId !== "string" || reviewId.length === 0) {
    throw new Error("Revisão agendada inválida.");
  }
  const { client, user } = await requireSupabaseUser();
  const { data, error } = await client
    .from("scheduled_reviews")
    .update({ status: "completed" })
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Esta revisão não está mais pendente.");
  revalidatePath("/agenda");
  revalidatePath("/");
  return { success: true };
}

export async function updateReadingSession(
  id: string,
  input: { pages_read: number; duration_seconds: number },
) {
  const { data: original, error: findError } = await supabase
    .from("reading_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!original) throw new Error("Sessão não encontrada.");

  const validationError = validateSessionInput({
    ...input,
    source: original.source,
    started_at: original.started_at,
    ended_at: original.ended_at,
  });
  if (validationError) throw new Error(validationError);

  const adjustedSource = original.source !== "manual" &&
    Math.abs(input.duration_seconds - sessionSeconds(original)) > 5
    ? "timer_adjusted"
    : original.source;
  const { data: session, error } = await supabase
    .from("reading_sessions")
    .update({
      pages_read: input.pages_read,
      duration_seconds: input.duration_seconds,
      duration_minutes: secondsToMinutes(input.duration_seconds),
      source: adjustedSource,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  const newSpeedPph = await recalculateReadingSpeed(original.reading_id);
  revalidateReadingSessionPaths(original.reading_id);
  return { session, newSpeedPph };
}

export async function deleteReadingSession(id: string) {
  const { data: original, error: findError } = await supabase
    .from("reading_sessions")
    .select("reading_id")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!original) throw new Error("Sessão não encontrada.");

  const { error } = await supabase.from("reading_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  const newSpeedPph = await recalculateReadingSpeed(original.reading_id);
  revalidateReadingSessionPaths(original.reading_id);
  return { success: true, newSpeedPph };
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

  const today = todayISO();
  const intervals = [1, 7, 21];

  const reviews = intervals.map((days) => ({
    reading_id: readingId,
    review_date: addDaysISO(today, days),
    status: "pending" as const,
    type: "active_recall",
  }));

  const { error: reviewError } = await supabase
    .from("spaced_reviews")
    .upsert(reviews, {
      onConflict: "reading_id,review_date,type",
      ignoreDuplicates: true,
    });
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
    .eq("reading_id", readingId);
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
  revalidatePath("/agenda");
  return data;
}

export async function markReviewAsDone(id: string) {
  return updateSpacedReview(id, { status: "done" });
}

// ============================================================
// MÉTRICAS POR DISCIPLINA (Histórico e Dashboard Gamificado)
// ============================================================

export async function getSubjectStats(): Promise<{ stats: SubjectStat[]; truncated: boolean }> {
  try {
    const { data: subjects, error: e1 } = await supabase
      .from("subjects")
      .select("*")
      .order("name");
    if (e1) {
      console.warn("Aviso ao carregar subjects para stats:", e1.message);
      return { stats: [], truncated: false };
    }

    const { data: readings, error: e2 } = await supabase
      .from("readings")
      .select("id, subject_id, is_read, target_pages");
    if (e2) {
      console.warn("Aviso ao carregar readings para stats:", e2.message);
      return { stats: [], truncated: false };
    }

    const { data: progress, error: e3 } = await supabase
      .from("reading_progress")
      .select("reading_id, total_seconds, pages_read");
    if (e3) {
      console.warn("Aviso ao carregar sessions para stats:", e3.message);
      return { stats: [], truncated: false };
    }

    const progressRows = progress ?? [];
    const truncated = warnIfTruncated(progressRows, "getSubjectStats.reading_progress");

    // Agregar estatísticas por disciplina
    const subjectRows = (subjects ?? []) as Subject[];
    const readingRows = (readings ?? []) as Pick<Reading, "id" | "subject_id" | "is_read" | "target_pages">[];
    const progressByReading = new Map(
      progressRows.map((row) => [
        row.reading_id,
        { total_seconds: Number(row.total_seconds) || 0, pages_read: Number(row.pages_read) || 0 },
      ]),
    );

    const stats: SubjectStat[] = subjectRows.map((sub) => {
      const subReadings = readingRows.filter((reading) => reading.subject_id === sub.id);
      const totalReadings = subReadings.length;
      const completedReadings = subReadings.filter((reading) => reading.is_read).length;

      const subProgress = subReadings
        .map((reading) => progressByReading.get(reading.id))
        .filter((row): row is { total_seconds: number; pages_read: number } => Boolean(row));
      const totalSeconds = subProgress.reduce((sum, row) => sum + row.total_seconds, 0);
      const pageProgress = computeSubjectPageProgress(subReadings.map((reading) => ({
        pagesRead: progressByReading.get(reading.id)?.pages_read ?? 0,
        targetPages: reading.target_pages,
      })));

      return {
        id: sub.id,
        name: sub.name,
        professor: sub.professor || "",
        theme_color: sub.theme_color || "#6366f1",
        is_autonomous: sub.is_autonomous,
        totalReadings,
        completedReadings,
        progressPercent: pageProgress.progressPercent,
        totalSeconds,
        totalPages: pageProgress.totalPagesRead,
        totalTargetPages: pageProgress.totalTargetPages,
      };
    });

    return { stats, truncated };
  } catch (err) {
    console.warn("Erro ao calcular subject stats:", err);
    return { stats: [], truncated: false };
  }
}

// ============================================================
// DASHBOARD — EFEITO CASCATA (Hierarquia de Execução)
// ============================================================

export async function getDashboardData() {
  const today = todayISO();
  const sevenDaysStr = addDaysISO(today, 7);
  const [progressByReading, lastSessionResult, speedStats, todaySummary, dailyGoalMinutes] = await Promise.all([
    getReadingProgressMap(),
    supabase
      .from("reading_sessions")
      .select("reading_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSpeedStats(),
    getTodayReadingSummary(),
    getDailyGoalMinutes(),
  ]);
  const todayReadingMinutes = todaySummary.minutes;
  if (lastSessionResult.error) {
    console.warn("Aviso ao buscar a leitura da sessão mais recente:", lastSessionResult.error.message);
  }
  const lastSessionReadingId = lastSessionResult.data?.reading_id ?? null;

  let tier1: SpacedReviewWithReading[] = [];
  let milestoneReviews: AgendaMilestoneReviewEvent[] = [];
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
      tier1 = ((data ?? []) as unknown as SpacedReviewWithReading[]).map((review) => ({
        ...review,
        reading: {
          ...review.reading,
          pages_read: progressByReading.get(review.reading.id)?.pages_read ?? 0,
        },
      }));
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : undefined;
    console.warn("Exceção na busca de spaced_reviews:", message);
    schemaError = message ?? null;
  }

  try {
    const { client, user } = await requireSupabaseUser();
    const pageSize = 1000;
    const rows: ScheduledReviewAgendaRow[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from("scheduled_reviews")
        .select("id, milestone_summary_id, review_date, review_type, status, milestone_summary:milestone_summaries(milestone_title, milestone_page, content, book:readings(id, title, chapter_title))")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .lte("review_date", today)
        .order("review_date", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      const pageRows = (data ?? []) as unknown as ScheduledReviewAgendaRow[];
      rows.push(...pageRows);
      if (pageRows.length < pageSize) break;
    }
    milestoneReviews = getDueAgendaReviews(
      rows
        .map(mapScheduledReviewToAgendaEvent)
        .filter((review): review is NonNullable<typeof review> => review !== null),
      today,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : undefined;
    console.warn("Aviso na busca de revisões de marcos:", message);
    schemaError ??= message ?? null;
  }

  let allPendingReadings: Array<ReadingWithSubject & { suggested_deadline: string | null }> = [];
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
      const rows = data ?? [];
      warnIfTruncated(rows, "getDashboardData.readings");
      const readingsWithProgress = (rows as unknown as ReadingWithSubject[]).map((reading) => ({
        ...reading,
        pages_read: progressByReading.get(reading.id)?.pages_read ?? 0,
      }));
      allPendingReadings = attachSuggestedDeadlines(readingsWithProgress, speedStats);
    }
  } catch (err: unknown) {
    console.warn(
      "Exceção na busca de readings:",
      err instanceof Error ? err.message : undefined
    );
  }

  const latestSessionDatesPromise = getLatestSessionDateMap(allPendingReadings, progressByReading);

  let urgentDeliverables: Deliverable[] = [];
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
      urgentDeliverables = (data ?? []) as Deliverable[];
    }
  } catch (err: unknown) {
    console.warn(
      "Exceção na busca de deliverables:",
      err instanceof Error ? err.message : undefined
    );
  }

  let allDeliverables: Deliverable[] = [];
  try {
    const { data, error: e4 } = await supabase
      .from("deliverables")
      .select("*")
      .order("date", { ascending: true });
    if (e4) {
      console.warn("Aviso na busca de allDeliverables:", e4.message);
    } else {
      allDeliverables = (data ?? []) as Deliverable[];
    }
  } catch (err: unknown) {
    console.warn(
      "Exceção na busca de allDeliverables:",
      err instanceof Error ? err.message : undefined
    );
  }

  const latestSessionDates = await latestSessionDatesPromise;
  allPendingReadings = allPendingReadings.map((reading) => ({
    ...reading,
    last_session_at: latestSessionDates.get(reading.id) ?? null,
  }));

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

    const linked = reading.deadline
      ? findLinkedDeliverable(subjectDeliverables, reading.deadline)
      : null;
    if (linked) {
      readingDeliverableMap.set(reading.id, linked.id);
    }
  }

  const tier2: ReadingWithSubject[] = [];
  const tier3: ReadingWithSubject[] = [];
  const tier4: ReadingWithSubject[] = [];

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

  const userPacePagesPerDay = pickUserPacePagesPerDay(speedStats);
  const recommendedReading = getSuggestedReading(
    [...tier2, ...tier3, ...tier4],
    userPacePagesPerDay,
    today,
    {
      todayPagesByReading: todaySummary.pagesByReading,
      dailyGoalReached: todayReadingMinutes >= dailyGoalMinutes,
    },
  );
  const recommendedPages = recommendedReading
    ? calculateSuggestedPages(recommendedReading, userPacePagesPerDay, today)
    : 0;

  return {
    tier1: tier1 ?? [],
    milestoneReviews,
    tier2,
    tier3,
    tier4,
    readingDeliverableMap: Object.fromEntries(readingDeliverableMap),
    urgentDeliverables: urgentDeliverables ?? [],
    allDeliverables: allDeliverables ?? [],
    schemaError,
    lastSessionReadingId,
    todayReadingMinutes,
    dailyGoalMinutes,
    averageSpeedPph: globalAverageSpeedPph(speedStats),
    recommendedReadingId: recommendedReading?.id ?? null,
    recommendedPages,
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
  const remaining = computeRemaining({
    targetPages: reading.target_pages,
    pagesRead,
    speedPph: reading.current_speed_pph,
  });

  const [speedStats, progressByReading, undatedReadings] = await Promise.all([
    getSpeedStats(),
    getReadingProgressMap(),
    !reading.is_read && reading.deadline === null ? getUndatedActiveReadings() : Promise.resolve([]),
  ]);
  const queueWithProgress = undatedReadings.map((queueReading) => ({
    ...queueReading,
    pages_read: progressByReading.get(queueReading.id)?.pages_read ?? 0,
  }));
  const suggestedDeadline = !reading.is_read && reading.deadline === null
    ? attachSuggestedDeadlines(queueWithProgress, speedStats).find((item) => item.id === readingId)?.suggested_deadline ?? null
    : null;
  const effectiveDeadline = reading.deadline ?? suggestedDeadline;
  const daysRemaining = reading.is_read || !effectiveDeadline
    ? 0
    : Math.max(0, daysUntil(effectiveDeadline));

  const hoursPerDay = reading.is_read
    ? 0
    : daysRemaining > 0
      ? Math.round((remaining.hoursRemaining / daysRemaining) * 100) / 100
      : Math.round(remaining.hoursRemaining * 100) / 100;

  return {
    totalPages: reading.target_pages,
    pagesRead,
    pagesRemaining: remaining.pagesRemaining,
    pagesPerDay: reading.is_read
      ? 0
      : daysRemaining > 0
        ? Math.ceil(remaining.pagesRemaining / daysRemaining)
      : remaining.pagesRemaining,
    speedPph: reading.current_speed_pph,
    hoursRemaining: Math.round(remaining.hoursRemaining * 100) / 100,
    daysRemaining,
    hoursPerDay,
    isOverdue: !reading.is_read && reading.deadline !== null && daysUntil(reading.deadline) < 0,
    suggestedDeadline,
  };
}
