import { addDaysISO, daysBetweenISO } from "@/lib/dates";
import type { ScheduledReviewStatus, ScheduledReviewType } from "@/types/database";

export interface AgendaDeliverableEvent {
  kind: "deliverable";
  id: string;
  date: string;
  title: string;
  subjectName: string;
}

export interface AgendaReviewEvent {
  kind: "review";
  id: string;
  date: string;
  reviewType: ScheduledReviewType;
  status: ScheduledReviewStatus;
  milestoneSummaryId: string;
  milestoneTitle: string;
  milestonePage: number;
  summaryContent: string | null;
  bookTitle: string;
}

export type AgendaEvent = AgendaDeliverableEvent | AgendaReviewEvent;

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
    const leftTitle = left.kind === "deliverable" ? left.title : left.milestoneTitle;
    const rightTitle = right.kind === "deliverable" ? right.title : right.milestoneTitle;
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
