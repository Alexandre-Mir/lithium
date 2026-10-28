import { addDaysISO, daysBetweenISO } from "@/lib/dates";
import type { ReviewStatus, ScheduledReviewStatus, ScheduledReviewType } from "@/types/database";

export interface AgendaDeliverableEvent {
  kind: "deliverable";
  id: string;
  date: string;
  title: string;
  subjectName: string;
}

interface AgendaReviewEventBase {
  kind: "review";
  id: string;
  date: string;
  reviewType: string;
  status: ScheduledReviewStatus;
}

export interface AgendaMilestoneReviewEvent extends AgendaReviewEventBase {
  source: "milestone";
  milestoneSummaryId: string;
  milestoneTitle: string;
  milestonePage: number;
  summaryContent: string | null;
  bookTitle: string;
  readingId: string | null;
  chapterTitle: string | null;
}

export interface AgendaSpacedReviewEvent extends AgendaReviewEventBase {
  source: "reading";
  readingId: string;
  bookTitle: string;
  chapterTitle: string | null;
  subjectName: string;
}

export type AgendaReviewEvent = AgendaMilestoneReviewEvent | AgendaSpacedReviewEvent;
export type AgendaEvent = AgendaDeliverableEvent | AgendaReviewEvent;

export interface ScheduledReviewAgendaRow {
  id: string;
  milestone_summary_id: string;
  review_date: string;
  review_type: ScheduledReviewType;
  status: ScheduledReviewStatus;
  milestone_summary: {
    milestone_title: string;
    milestone_page: number;
    content: string | null;
    book: { id: string; title: string; chapter_title: string | null } | null;
  } | null;
}

export interface SpacedReviewAgendaRow {
  id: string;
  reading_id: string;
  review_date: string;
  type: string;
  status: ReviewStatus;
  reading: {
    title: string;
    chapter_title: string | null;
    subject: { name: string } | null;
  } | null;
}

export function mapScheduledReviewToAgendaEvent(
  row: ScheduledReviewAgendaRow,
): AgendaMilestoneReviewEvent | null {
  const summary = row.milestone_summary;
  if (!summary) return null;
  return {
    kind: "review",
    source: "milestone",
    id: row.id,
    date: row.review_date,
    reviewType: row.review_type,
    status: row.status,
    milestoneSummaryId: row.milestone_summary_id,
    milestoneTitle: summary.milestone_title,
    milestonePage: summary.milestone_page,
    summaryContent: summary.content,
    bookTitle: summary.book?.title ?? "Leitura removida",
    readingId: summary.book?.id ?? null,
    chapterTitle: summary.book?.chapter_title ?? null,
  };
}

export function mapSpacedReviewToAgendaEvent(
  row: SpacedReviewAgendaRow,
): AgendaSpacedReviewEvent | null {
  if (!row.reading) return null;
  return {
    kind: "review",
    source: "reading",
    id: row.id,
    date: row.review_date,
    reviewType: row.type,
    status: row.status === "done" ? "completed" : "pending",
    readingId: row.reading_id,
    bookTitle: row.reading.title,
    chapterTitle: row.reading.chapter_title,
    subjectName: row.reading.subject?.name ?? "Sem disciplina",
  };
}

export function getDueAgendaReviews<T extends AgendaReviewEvent>(
  reviews: readonly T[],
  today: string,
): T[] {
  return reviews.filter((review) => review.status === "pending" && review.date <= today);
}

export interface AgendaDayGroup {
  date: string;
  label: string;
  items: AgendaEvent[];
}

export function getReviewScheduleDates(completionDate: string): Array<{
  review_type: ScheduledReviewType;
  review_date: string;
}> {
  return ([1, 7, 21] as const).map((days) => ({
    review_type: `D+${days}` as ScheduledReviewType,
    review_date: addDaysISO(completionDate, days),
  }));
}

export function getAgendaMonthRange(dateISO: string): {
  from: string;
  to: string;
  monthISO: string;
} {
  const [year, month] = dateISO.split("-").map(Number);
  const monthISO = `${year}-${String(month).padStart(2, "0")}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${monthISO}-01`,
    to: `${monthISO}-${String(lastDay).padStart(2, "0")}`,
    monthISO,
  };
}

export function sortAgendaEvents(events: readonly AgendaEvent[]): AgendaEvent[] {
  return [...events].sort((left, right) => {
    const byDate = left.date.localeCompare(right.date);
    if (byDate !== 0) return byDate;
    if (left.kind !== right.kind) return left.kind === "deliverable" ? -1 : 1;
    const leftTitle = left.kind === "deliverable"
      ? left.title
      : left.source === "milestone" ? left.milestoneTitle : left.bookTitle;
    const rightTitle = right.kind === "deliverable"
      ? right.title
      : right.source === "milestone" ? right.milestoneTitle : right.bookTitle;
    return leftTitle.localeCompare(rightTitle, "pt-BR");
  });
}

export function formatAgendaDayHeading(dateISO: string, todayISO: string): string {
  const distance = daysBetweenISO(todayISO, dateISO);
  if (distance === 0) return "Hoje";
  if (distance === 1) return "Amanhã";

  const date = new Date(`${dateISO}T00:00:00Z`);
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

export function formatAgendaMonthLabel(monthISO: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${monthISO}-01T00:00:00Z`));
}

export function groupAgendaEventsByDate(
  events: readonly AgendaEvent[],
  todayISO: string,
): AgendaDayGroup[] {
  const sorted = sortAgendaEvents(events);
  const groups = new Map<string, AgendaEvent[]>();
  for (const event of sorted) {
    const dayItems = groups.get(event.date) ?? [];
    dayItems.push(event);
    groups.set(event.date, dayItems);
  }

  return [...groups].map(([date, items]) => ({
    date,
    label: formatAgendaDayHeading(date, todayISO),
    items,
  }));
}

export function getScheduledReviewStatusLabel(status: ScheduledReviewStatus): string {
  if (status === "completed") return "Concluída";
  if (status === "missed") return "Perdida";
  return "Pendente";
}
