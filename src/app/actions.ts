"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { todayISO, addDaysISO, daysUntil, startOfDayUtcISO } from "@/lib/dates";
import { findLinkedDeliverable } from "@/lib/cascade";
import { fetchArticleMetadata, fetchBookMetadata } from "@/lib/book-metadata";
import { globalAverageSpeedPph, pickInitialSpeed, pickUserPacePagesPerDay } from "@/lib/speed";
import { projectReadingQueue } from "@/lib/projection";
import {
  calculateBudgetAwareSuggestedPages,
  getSuggestedReading,
} from "@/lib/recommendation";
import { computeCognitiveBudget } from "@/lib/cognitive-budget";
import {
  buildConsistencyHeatmap,
  CONSISTENCY_HEATMAP_DAYS,
  type HeatmapSessionInput,
} from "@/lib/consistency-heatmap";
import {
  getReadingCreateErrors,
  validateReadingUpdate,
  validateTargetPagesAgainstProgress,
} from "@/lib/reading-validation";
import { computeRemaining } from "@/lib/progress";
import { computeSubjectPageProgress } from "@/lib/subject-progress";
import { getTodayTotalReadingTime, pph, sessionPagesOnDate, sessionSeconds } from "@/lib/session-time";
import { validateSessionInput } from "@/lib/session-validation";
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
} from "@/types/database";

async function getActionClient() {
  const { client } = await requireSupabaseUser();
  return client;
}

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

  const client = await getActionClient();
  const allSubjects: Array<Pick<Subject, "id" | "class_days">> = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("subjects")
      .select("id, class_days")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Não foi possível validar os dias da disciplina: ${error.message}`);
    const rows = (data ?? []) as Array<Pick<Subject, "id" | "class_days">>;
    allSubjects.push(...rows);
    if (rows.length < pageSize) break;
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
  const client = await getActionClient();
  const pageSize = 1000;
  const subjects: Subject[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("subjects")
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Subject[];
    subjects.push(...rows);
    if (rows.length < pageSize) return subjects;
  }
}

export async function createSubject(input: SubjectInsert) {
  const client = await getActionClient();
  // Validação: limite de 2 disciplinas por dia
  const validation = await validateClassDays(input.class_days || []);
  if (!validation.valid) {
    throw new Error(`Limite de 2 disciplinas por dia atingido (dia: ${validation.exceededDay}).`);
  }

  const { data, error } = await client
    .from("subjects")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/setup");
  revalidatePath("/agenda");
  return data;
}

export async function updateSubject(id: string, input: SubjectUpdate) {
  const client = await getActionClient();
  if (input.class_days) {
    const validation = await validateClassDays(input.class_days, id);
    if (!validation.valid) {
      throw new Error(`Limite de 2 disciplinas por dia atingido (dia: ${validation.exceededDay}).`);
    }
  }

  const { data, error } = await client
    .from("subjects")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/setup");
  revalidatePath("/library", "layout");
  revalidatePath("/agenda");
  return data;
}

export async function deleteSubject(id: string) {
  const client = await getActionClient();
  const [{ count: deliverables, error: deliverableError }, { count: readings, error: readingError }] =
    await Promise.all([
      client.from("deliverables").select("id", { count: "exact", head: true }).eq("subject_id", id),
      client.from("readings").select("id", { count: "exact", head: true }).eq("subject_id", id),
    ]);
  if (deliverableError) throw new Error(deliverableError.message);
  if (readingError) throw new Error(readingError.message);
  if ((deliverables ?? 0) > 0 || (readings ?? 0) > 0) {
    throw new Error("Não é possível excluir esta disciplina enquanto houver leituras ou entregas vinculadas.");
  }
  const { error } = await client.from("subjects").delete().eq("id", id);
  if (error) throw new Error(error.code === "23503"
    ? "Não é possível excluir esta disciplina enquanto houver dados vinculados."
    : error.message);
  revalidatePath("/");
  revalidatePath("/setup");
  revalidatePath("/library", "layout");
  revalidatePath("/agenda");
}

// ============================================================
// DELIVERABLES
// ============================================================

export async function getDeliverables(subjectId?: string) {
  const client = await getActionClient();
  const pageSize = 1000;
  const deliverables: Deliverable[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = client
      .from("deliverables")
      .select("*")
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (subjectId) query = query.eq("subject_id", subjectId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Deliverable[];
    deliverables.push(...rows);
    if (rows.length < pageSize) return deliverables;
  }
}

export async function createDeliverable(input: DeliverableInsert) {
  const client = await getActionClient();
  const { data, error } = await client
    .from("deliverables")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/agenda");
  return data;
}

export async function updateDeliverable(id: string, input: DeliverableUpdate) {
  const client = await getActionClient();
  const { data, error } = await client
    .from("deliverables")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/agenda");
  return data;
}

export async function deleteDeliverable(id: string) {
  const client = await getActionClient();
  const { error } = await client.from("deliverables").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/agenda");
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
  const client = await getActionClient();
  const pageSize = 1000;
  const rows: Array<Pick<Reading, "id" | "target_pages" | "created_at" | "deadline" | "is_read">> = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("readings")
      .select("id, target_pages, created_at, deadline, is_read")
      .eq("is_read", false)
      .is("deadline", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function getReadingProgressMap(): Promise<Map<string, ReadingProgressSummary>> {
  const client = await getActionClient();
  const pageSize = 1000;
  const rows: ReadingProgressViewRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("reading_progress")
      .select("reading_id, sessions, pages_read, total_seconds")
      .order("reading_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Não foi possível carregar o progresso das leituras: ${error.message}`);
    const page = (data ?? []) as unknown as ReadingProgressViewRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return new Map(rows.map((row) => [
    row.reading_id,
    {
      pages_read: Number(row.pages_read) || 0,
      sessions: Number(row.sessions) || 0,
      total_seconds: Number(row.total_seconds) || 0,
    },
  ]));
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

  const client = await getActionClient();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("reading_sessions")
      .select("reading_id, started_at, ended_at, created_at")
      .in("reading_id", readingIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Não foi possível consultar a última sessão por leitura: ${error.message}`);
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
  const client = await getActionClient();
  const pageSize = 1000;
  const rows: Reading[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = client
      .from("readings")
      .select("*, subject:subjects(*)")
      .order("deadline", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (subjectId) query = query.eq("subject_id", subjectId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as Reading[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  const [progressByReading, speedStats] = await Promise.all([getReadingProgressMap(), getSpeedStats()]);
  const readingsWithProgress = rows.map((reading) => ({
    ...reading,
    pages_read: progressByReading.get(reading.id)?.pages_read ?? 0,
  }));
  return attachSuggestedDeadlines(readingsWithProgress, speedStats) as ReadingWithProgress[];
}

export async function getReadingById(id: string) {
  const client = await getActionClient();
  const { data, error } = await client
    .from("readings")
    .select("*, subject:subjects(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSpacedReviewsByReading(readingId: string) {
  const client = await getActionClient();
  const { data, error } = await client
    .from("spaced_reviews")
    .select("*")
    .eq("reading_id", readingId)
    .order("review_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getSpeedStats(): Promise<ReadingSpeedStat[]> {
  const client = await getActionClient();
  const { data, error } = await client
    .from("reading_speed_stats")
    .select("reading_type, sessions, total_pages, total_minutes, total_seconds");

  if (error) throw new Error(`Não foi possível consultar reading_speed_stats: ${error.message}`);

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
  const client = await getActionClient();

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("reading_sessions")
      .select("reading_id, pages_read, duration_minutes, duration_seconds, started_at, ended_at, created_at")
      .or(
        `and(started_at.gte.${start},started_at.lt.${end}),and(ended_at.gte.${start},ended_at.lt.${end}),and(started_at.is.null,ended_at.is.null,created_at.gte.${start},created_at.lt.${end})`,
      )
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Não foi possível consultar as sessões de hoje: ${error.message}`);

    const rows = (data ?? []) as unknown as TodayReadingSession[];
    sessions.push(...rows);
    if (rows.length < pageSize) break;
  }

  const pagesByReading = new Map<string, number>();
  for (const session of sessions) {
    const pagesToday = sessionPagesOnDate(session, today);
    if (pagesToday <= 0) continue;
    pagesByReading.set(
      session.reading_id,
      (pagesByReading.get(session.reading_id) ?? 0) + pagesToday,
    );
  }

  return {
    minutes: getTodayTotalReadingTime(sessions),
    pagesByReading,
  };
}

async function getConsistencyHeatmapSessions(
  today: string = todayISO(),
): Promise<HeatmapSessionInput[]> {
  const windowStart = addDaysISO(today, -(CONSISTENCY_HEATMAP_DAYS - 1));
  const start = startOfDayUtcISO(windowStart);
  const end = startOfDayUtcISO(addDaysISO(today, 1));
  const pageSize = 1000;
  const sessions: HeatmapSessionInput[] = [];
  const client = await getActionClient();

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("reading_sessions")
      .select("duration_minutes, duration_seconds, started_at, ended_at, created_at")
      .or(
        `and(started_at.gte.${start},started_at.lt.${end}),and(ended_at.gte.${start},ended_at.lt.${end}),and(started_at.is.null,ended_at.is.null,created_at.gte.${start},created_at.lt.${end})`,
      )
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Não foi possível consultar sessões do heatmap: ${error.message}`);

    const rows = (data ?? []) as unknown as HeatmapSessionInput[];
    sessions.push(...rows);
    if (rows.length < pageSize) break;
  }

  return sessions;
}

export async function getDailyGoalMinutes(): Promise<number> {
  const client = await getActionClient();
  const { data, error } = await client
    .from("app_settings")
    .select("daily_goal_minutes")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível consultar a meta diária: ${error.message}`);

  if (!data) throw new Error("Meta diária não encontrada para a conta autenticada.");
  return Number(data.daily_goal_minutes);
}

export async function updateDailyGoalMinutes(minutes: number): Promise<number> {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error("A meta diária deve ser um número inteiro entre 1 e 1.440 minutos.");
  }

  const client = await getActionClient();
  const { data, error } = await client
    .from("app_settings")
    .update({ daily_goal_minutes: minutes })
    .eq("id", 1)
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
  const createErrors = getReadingCreateErrors({
    title: input.title,
    subject_id: input.subject_id,
    target_pages: input.target_pages,
    full_book_pages: input.full_book_pages,
    segment_start_page: input.segment_start_page,
    deadline: input.deadline,
    hasDeadline: input.deadline !== null && input.deadline !== undefined,
  });
  const createError = Object.values(createErrors)[0];
  if (createError) throw new Error(createError);

  const validationError = validateReadingUpdate({
    deadline: input.deadline,
    milestones: input.milestones,
    segment_start_page: input.segment_start_page,
  });
  if (validationError) throw new Error(validationError);

  const currentSpeed = input.current_speed_pph ?? pickInitialSpeed(await getSpeedStats(), input.type);
  const client = await getActionClient();
  const insert = {
    ...input,
    current_speed_pph: currentSpeed,
    ...(input.metadata_source ? { metadata_fetched_at: new Date().toISOString() } : {}),
  };
  const { data, error } = await client
    .from("readings")
    .insert(insert)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/agenda");
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
  const client = await getActionClient();
  const { data: reading, error: readingError } = await client.from("readings").select("id, type, isbn, doi, cover_url, publisher, published_year, metadata_source, metadata_fetched_at").eq("id", readingId).single();
  if (readingError) throw new Error(readingError.message);
  if (!options.force && reading.metadata_fetched_at) return { status: "skipped" as const };
  const result = reading.type === "book" && reading.isbn ? await fetchBookMetadata(reading.isbn) : reading.type === "article" && reading.doi ? await fetchArticleMetadata(reading.doi) : { status: "not_found" as const };
  if (result.status === "error") return result;
  const fields: MetadataFields = result.status === "not_found"
    ? { cover_url: reading.cover_url, publisher: reading.publisher, published_year: reading.published_year, metadata_source: reading.metadata_source, metadata_fetched_at: new Date().toISOString() }
    : { cover_url: result.data.coverUrl ?? reading.cover_url, publisher: result.data.publisher ?? reading.publisher, published_year: result.data.publishedYear ?? reading.published_year, metadata_source: result.data.source ?? reading.metadata_source, metadata_fetched_at: new Date().toISOString() };
  const { error } = await client.from("readings").update(fields).eq("id", readingId);
  if (error) throw new Error(error.message);
  revalidatePath("/library");
  revalidatePath(`/library/${readingId}`);
  return result;
}

export async function backfillMissingMetadata() {
  const client = await getActionClient();
  const { data: readings, error } = await client.from("readings").select("id, type, isbn, doi, metadata_fetched_at").is("metadata_fetched_at", null).or("isbn.not.is.null,doi.not.is.null").limit(6);
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
  const { count, error: countError } = await client.from("readings").select("id", { count: "exact", head: true }).is("metadata_fetched_at", null).or("isbn.not.is.null,doi.not.is.null");
  if (countError) throw new Error(countError.message);
  return { updated, notFound, failed, remaining: count ?? 0 };
}

export async function updateReading(id: string, input: ReadingUpdate) {
  const validationError = validateReadingUpdate(input);
  if (validationError) throw new Error(validationError);

  const client = await getActionClient();
  if (input.target_pages !== undefined) {
    const { data: progress, error: progressError } = await client
      .from("reading_progress")
      .select("pages_read")
      .eq("reading_id", id)
      .maybeSingle();
    if (progressError) throw new Error(progressError.message);
    const progressValidation = validateTargetPagesAgainstProgress(
      input.target_pages,
      Number(progress?.pages_read) || 0,
    );
    if (progressValidation) throw new Error(progressValidation);
  }

  const { data, error } = await client
    .from("readings")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/agenda");
  revalidatePath(`/library/${id}`);
  return data;
}

export async function deleteReading(id: string) {
  const client = await getActionClient();
  const [
    { count: sessions, error: sessionError },
    { count: reviews, error: reviewError },
    { count: summaries, error: summaryError },
  ] = await Promise.all([
    client.from("reading_sessions").select("id", { count: "exact", head: true }).eq("reading_id", id),
    client.from("spaced_reviews").select("id", { count: "exact", head: true }).eq("reading_id", id),
    client.from("milestone_summaries").select("id", { count: "exact", head: true }).eq("book_id", id),
  ]);
  if (sessionError) throw new Error(sessionError.message);
  if (reviewError) throw new Error(reviewError.message);
  if (summaryError) throw new Error(summaryError.message);
  if ((sessions ?? 0) > 0 || (reviews ?? 0) > 0 || (summaries ?? 0) > 0) {
    throw new Error("Não é possível excluir esta leitura enquanto houver sessões ou revisões vinculadas.");
  }
  const { error } = await client.from("readings").delete().eq("id", id);
  if (error) throw new Error(error.code === "23503"
    ? "Não é possível excluir esta leitura enquanto houver dados vinculados."
    : error.message);
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/agenda");
}

// ============================================================
// READING SESSIONS + CALIBRAÇÃO
// ============================================================

export async function getReadingSessions(readingId: string) {
  const client = await getActionClient();
  const pageSize = 1000;
  const sessions: ReadingSession[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("reading_sessions")
      .select("*")
      .eq("reading_id", readingId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ReadingSession[];
    sessions.push(...rows);
    if (rows.length < pageSize) return sessions;
  }
}

function revalidateReadingSessionPaths(readingId: string) {
  revalidatePath("/");
  revalidatePath("/library", "layout");
  revalidatePath("/history");
  revalidatePath(`/library/${readingId}`);
}

export async function getAllReadingSessions(offset = 0) {
  if (!Number.isInteger(offset) || offset < 0) throw new Error("Página de histórico inválida.");
  const client = await getActionClient();
  const pageSize = 50;
  const [{ data, error, count }, speedStats, heatmapSessions] = await Promise.all([
    client
      .from("reading_sessions")
      .select("*, reading:readings(title, chapter_title, author, type, target_pages, full_book_pages, segment_start_page, subject:subjects(name, theme_color))", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1),
    getSpeedStats(),
    offset === 0 ? getConsistencyHeatmapSessions() : Promise.resolve([]),
  ]);
  if (error) throw new Error(error.message);
  const sessions = data ?? [];
  const nextOffset = offset + sessions.length;
  return {
    sessions,
    nextOffset,
    totalCount: count ?? nextOffset,
    hasMore: nextOffset < (count ?? nextOffset),
    totalPages: speedStats.reduce((total, item) => total + item.total_pages, 0),
    totalSeconds: speedStats.reduce((total, item) => total + item.total_seconds, 0),
    heatmapSessions,
  };
}

/**
 * Cria uma sessão de leitura e executa a CALIBRAÇÃO:
 * - Calcula a velocidade real a partir dos segundos agregados em reading_progress.
 * - Atualiza current_speed_pph na leitura correspondente
 */
export async function createReadingSession(input: ReadingSessionInsert) {
  const validationError = validateSessionInput(input);
  if (validationError) throw new Error(validationError);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(input.request_id)) {
    throw new Error("Identificador de envio da sessão inválido.");
  }

  const { client } = await requireSupabaseUser();
  const { data: result, error: sessionError } = await client.rpc("create_reading_session_atomic", {
    p_request_id: input.request_id,
    p_reading_id: input.reading_id,
    p_pages_read: input.pages_read,
    p_duration_seconds: input.duration_seconds,
    p_started_at: input.started_at ?? null,
    p_ended_at: input.ended_at ?? null,
    p_source: input.source,
  });
  if (sessionError) throw new Error(sessionError.message);
  const created = Array.isArray(result) ? result[0] : null;
  if (!created?.session_id) throw new Error("O banco não confirmou o registro da sessão.");
  const { data: session, error: readError } = await client
    .from("reading_sessions")
    .select("*")
    .eq("id", created.session_id)
    .single();
  if (readError) throw new Error(readError.message);

  revalidateReadingSessionPaths(input.reading_id);
  return { session, newSpeedPph: Number(created.current_speed_pph) };
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
  const client = await getActionClient();
  const { data: original, error: findError } = await client
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
  const { data: newSpeedPph, error } = await client.rpc("update_reading_session_atomic", {
    p_session_id: id,
    p_pages_read: input.pages_read,
    p_duration_seconds: input.duration_seconds,
    p_source: adjustedSource,
  });
  if (error) throw new Error(error.message);
  const { data: session, error: sessionError } = await client
    .from("reading_sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (sessionError) throw new Error(sessionError.message);
  revalidateReadingSessionPaths(original.reading_id);
  return { session, newSpeedPph: Number(newSpeedPph) };
}

export async function deleteReadingSession(id: string) {
  const client = await getActionClient();
  const { data: original, error: findError } = await client
    .from("reading_sessions")
    .select("reading_id")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!original) throw new Error("Sessão não encontrada.");

  const { data: newSpeedPph, error } = await client.rpc("delete_reading_session_atomic", {
    p_session_id: id,
  });
  if (error) throw new Error(error.message);
  revalidateReadingSessionPaths(original.reading_id);
  return { success: true, newSpeedPph: Number(newSpeedPph) };
}

// ============================================================
// MARCAR LEITURA COMO CONCLUÍDA + REPETIÇÃO ESPAÇADA
// ============================================================

export async function markReadingAsRead(readingId: string) {
  const client = await getActionClient();
  const today = todayISO();
  const { error } = await client.rpc("set_reading_completion_atomic", {
    p_reading_id: readingId,
    p_is_read: true,
    p_review_date_1: addDaysISO(today, 1),
    p_review_date_7: addDaysISO(today, 7),
    p_review_date_21: addDaysISO(today, 21),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/agenda");
}

export async function markReadingAsUnread(readingId: string) {
  const client = await getActionClient();
  const { error } = await client.rpc("set_reading_completion_atomic", {
    p_reading_id: readingId,
    p_is_read: false,
    p_review_date_1: null,
    p_review_date_7: null,
    p_review_date_21: null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/agenda");
}

// ============================================================
// SPACED REVIEWS
// ============================================================

export async function getSpacedReviews(status?: "pending" | "done") {
  const client = await getActionClient();
  let query = client
    .from("spaced_reviews")
    .select("*, reading:readings(*, subject:subjects(*))")
    .order("review_date", { ascending: true });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSpacedReview(id: string, input: SpacedReviewUpdate) {
  const client = await getActionClient();
  const { data, error } = await client
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

export async function getSubjectStats(): Promise<{ stats: SubjectStat[]; truncated: boolean; error?: string }> {
  try {
    const client = await getActionClient();
    const pageSize = 1000;
    const subjects: Subject[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from("subjects")
        .select("*")
        .order("name")
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Subject[];
      subjects.push(...rows);
      if (rows.length < pageSize) break;
    }

    const readings: Array<Pick<Reading, "id" | "subject_id" | "is_read" | "target_pages">> = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from("readings")
        .select("id, subject_id, is_read, target_pages")
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as typeof readings;
      readings.push(...rows);
      if (rows.length < pageSize) break;
    }

    const progressRows: ReadingProgressViewRow[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from("reading_progress")
        .select("reading_id, total_seconds, pages_read")
        .order("reading_id")
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as ReadingProgressViewRow[];
      progressRows.push(...rows);
      if (rows.length < pageSize) break;
    }

    const progressByReading = new Map(
      progressRows.map((row) => [
        row.reading_id,
        { total_seconds: Number(row.total_seconds) || 0, pages_read: Number(row.pages_read) || 0 },
      ]),
    );

    const stats: SubjectStat[] = subjects.map((sub) => {
      const subReadings = readings.filter((reading) => reading.subject_id === sub.id);
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

    return { stats, truncated: false };
  } catch (err) {
    unstable_rethrow(err);
    const message = err instanceof Error ? err.message : "Falha desconhecida ao calcular as métricas por disciplina.";
    console.warn("Erro ao calcular subject stats:", message);
    return { stats: [], truncated: false, error: message };
  }
}

// ============================================================
// DASHBOARD — EFEITO CASCATA (Hierarquia de Execução)
// ============================================================

export async function getDashboardData() {
  const today = todayISO();
  const sevenDaysStr = addDaysISO(today, 7);
  const client = await getActionClient();
  const [
    progressResult,
    lastSessionResult,
    speedStatsResult,
    todaySummaryResult,
    dailyGoalResult,
    heatmapResult,
  ] = await Promise.allSettled([
    getReadingProgressMap(),
    client
      .from("reading_sessions")
      .select("reading_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSpeedStats(),
    getTodayReadingSummary(),
    getDailyGoalMinutes(),
    getConsistencyHeatmapSessions(today),
  ]);
  const metricWarnings: string[] = [];
  const progressAvailable = progressResult.status === "fulfilled";
  const progressByReading = progressAvailable ? progressResult.value : new Map<string, ReadingProgressSummary>();
  const todaySummary = todaySummaryResult.status === "fulfilled" ? todaySummaryResult.value : null;
  const todayReadingMinutes = todaySummary?.minutes ?? null;
  const speedStats = speedStatsResult.status === "fulfilled" ? speedStatsResult.value : [];
  const dailyGoalMinutes = dailyGoalResult.status === "fulfilled" ? dailyGoalResult.value : 60;
  const heatmapSessions = heatmapResult.status === "fulfilled" ? heatmapResult.value : [];
  const consistencyHeatmap = buildConsistencyHeatmap(heatmapSessions, today);
  if (!progressAvailable) metricWarnings.push("O progresso das leituras não pôde ser carregado; recomendações foram ocultadas.");
  if (!todaySummary) metricWarnings.push("O tempo e as páginas de hoje estão indisponíveis; a meta diária não pode ser calculada.");
  if (speedStatsResult.status === "rejected") metricWarnings.push("A velocidade média está indisponível.");
  if (dailyGoalResult.status === "rejected") metricWarnings.push("A meta diária não pôde ser carregada.");
  if (heatmapResult.status === "rejected") metricWarnings.push("O mapa de consistência está indisponível.");
  if (lastSessionResult.status === "rejected") {
    metricWarnings.push("A sessão mais recente não pôde ser identificada.");
  } else if (lastSessionResult.value.error) {
    metricWarnings.push("A sessão mais recente não pôde ser identificada.");
  }
  const lastSessionReadingId = lastSessionResult.status === "fulfilled"
    ? lastSessionResult.value.data?.reading_id ?? null
    : null;

  let tier1: SpacedReviewWithReading[] = [];
  let milestoneReviews: AgendaMilestoneReviewEvent[] = [];
  let schemaError: string | null = null;

  try {
    const { data, error: e1 } = await client
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
    unstable_rethrow(err);
    const message = err instanceof Error ? err.message : undefined;
    console.warn("Aviso na busca de revisões de marcos:", message);
    schemaError ??= message ?? null;
  }

  let allPendingReadings: Array<ReadingWithSubject & { suggested_deadline: string | null }> = [];
  try {
    if (progressAvailable && todaySummary) {
      const pageSize = 1000;
      const rows: ReadingWithSubject[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client
          .from("readings")
          .select("*, subject:subjects(*)")
          .eq("is_read", false)
          .order("deadline", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error(error.message);
        const page = (data ?? []) as unknown as ReadingWithSubject[];
        rows.push(...page);
        if (page.length < pageSize) break;
      }
      const readingsWithProgress = rows.map((reading) => ({
        ...reading,
        pages_read: progressByReading.get(reading.id)?.pages_read ?? 0,
      }));
      allPendingReadings = attachSuggestedDeadlines(readingsWithProgress, speedStats);
    }
  } catch (err: unknown) {
    unstable_rethrow(err);
    metricWarnings.push("As leituras pendentes não puderam ser carregadas.");
    console.warn("Exceção na busca de readings:", err instanceof Error ? err.message : undefined);
  }

  const latestSessionDatesPromise = getLatestSessionDateMap(allPendingReadings, progressByReading);

  let urgentDeliverables: Deliverable[] = [];
  try {
    const { data, error: e3 } = await client
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
    const { data, error: e4 } = await client
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

  let latestSessionDates = new Map<string, string>();
  try {
    latestSessionDates = await latestSessionDatesPromise;
  } catch (error) {
    unstable_rethrow(error);
    metricWarnings.push("A data da última sessão por leitura está indisponível.");
    console.warn("Não foi possível carregar as últimas sessões:", error);
  }
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
  const reviewCount = (tier1 ?? []).length + milestoneReviews.length;
  const recommendedReading = todaySummary && progressAvailable ? getSuggestedReading(
    [...tier2, ...tier3, ...tier4],
    userPacePagesPerDay,
    today,
    {
      todayPagesByReading: todaySummary.pagesByReading,
      dailyGoalReached: todayReadingMinutes !== null && todayReadingMinutes >= dailyGoalMinutes,
    },
  ) : null;
  const budgetAware = recommendedReading
    ? calculateBudgetAwareSuggestedPages({
      reading: recommendedReading,
      userPace: userPacePagesPerDay,
      budgetMinutes: dailyGoalMinutes,
      reviewCount,
      tier2Readings: tier2,
      today,
    })
    : {
      pages: 0,
      uncappedPages: 0,
      budget: computeCognitiveBudget({
        budgetMinutes: dailyGoalMinutes,
        reviewCount,
        tier2Readings: tier2,
        userPace: userPacePagesPerDay,
        today,
      }),
    };
  const recommendedPages = budgetAware.pages;
  const cognitiveBudget = budgetAware.budget;
  const alternativeReading = recommendedReading
    ? getSuggestedReading(
      [...tier2, ...tier3, ...tier4].filter(
        (reading) => reading.id !== recommendedReading.id,
      ),
      userPacePagesPerDay,
      today,
      {
        todayPagesByReading: todaySummary!.pagesByReading,
        dailyGoalReached: todayReadingMinutes !== null && todayReadingMinutes >= dailyGoalMinutes,
      },
    )
    : null;
  const alternativeBudget = alternativeReading
    ? calculateBudgetAwareSuggestedPages({
      reading: alternativeReading,
      userPace: userPacePagesPerDay,
      budgetMinutes: dailyGoalMinutes,
      reviewCount,
      tier2Readings: tier2,
      today,
    })
    : null;

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
    metricWarnings,
    lastSessionReadingId,
    todayReadingMinutes,
    dailyGoalMinutes,
    averageSpeedPph: globalAverageSpeedPph(speedStats),
    recommendedReadingId: recommendedReading?.id ?? null,
    recommendedPages,
    alternativeReadingId: alternativeBudget && alternativeBudget.pages > 0
      ? alternativeReading?.id ?? null
      : null,
    alternativePages: alternativeBudget?.pages ?? 0,
    today,
    cognitiveBudget: {
      budgetMinutes: cognitiveBudget.budgetMinutes,
      demandedMinutes: cognitiveBudget.demandedMinutes,
      tier1Minutes: cognitiveBudget.tier1Minutes,
      tier2Minutes: cognitiveBudget.tier2Minutes,
      isOverloaded: cognitiveBudget.isOverloaded,
      overloadMinutes: cognitiveBudget.overloadMinutes,
      pagesCapped: Boolean(recommendedReading) && recommendedPages < budgetAware.uncappedPages,
    },
    consistencyHeatmap,
  };
}

// ============================================================
// PROJEÇÃO DE TEMPO (utilitário)
// ============================================================

export async function getReadingProjection(readingId: string) {
  const client = await getActionClient();
  const { data: reading, error: readingError } = await client
    .from("readings")
    .select("*")
    .eq("id", readingId)
    .single();
  if (readingError) throw new Error(readingError.message);

  const { data: sessions, error: sessionsError } = await client
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
