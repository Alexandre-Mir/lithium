import { describe, expect, it } from "vitest";
import {
  formatAgendaDayHeading,
  getDueAgendaReviews,
  getAgendaMonthRange,
  getReviewScheduleDates,
  groupAgendaEventsByDate,
  mapScheduledReviewToAgendaEvent,
  mapSpacedReviewToAgendaEvent,
  sortAgendaEvents,
  type AgendaEvent,
} from "@/lib/agenda";

describe("agenda date helpers", () => {
  it("creates D+1, D+7 and D+21 dates using calendar days across year end", () => {
    expect(getReviewScheduleDates("2026-12-25")).toEqual([
      { review_type: "D+1", review_date: "2026-12-26" },
      { review_type: "D+7", review_date: "2027-01-01" },
      { review_type: "D+21", review_date: "2027-01-15" },
    ]);
  });

  it("returns the current month start and end, including leap February", () => {
    expect(getAgendaMonthRange("2028-02-24")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
      monthISO: "2028-02",
    });
  });

  it("labels today and tomorrow in the app calendar", () => {
    expect(formatAgendaDayHeading("2026-10-27", "2026-10-27")).toBe("Hoje");
    expect(formatAgendaDayHeading("2026-10-28", "2026-10-27")).toBe("Amanhã");
    expect(formatAgendaDayHeading("2026-11-02", "2026-10-27")).toBe("Segunda-feira, 2 de novembro");
  });
});

describe("agenda event ordering", () => {
  const events: AgendaEvent[] = [
    {
      kind: "review",
      source: "milestone",
      id: "review-1",
      date: "2026-10-28",
      reviewType: "D+1",
      status: "pending",
      milestoneSummaryId: "summary-1",
      milestoneTitle: "Capítulo 1",
      milestonePage: 20,
      summaryContent: "Resumo",
      bookTitle: "Livro",
      readingId: "book-1",
      chapterTitle: "Capítulo 1",
    },
    {
      kind: "deliverable",
      id: "deliverable-1",
      date: "2026-10-27",
      title: "Prova",
      subjectName: "História",
    },
    {
      kind: "deliverable",
      id: "deliverable-2",
      date: "2026-10-28",
      title: "Trabalho",
      subjectName: "História",
    },
  ];

  it("sorts events chronologically, with deliverables before reviews on the same day", () => {
    expect(sortAgendaEvents(events).map((event) => event.id)).toEqual([
      "deliverable-1",
      "deliverable-2",
      "review-1",
    ]);
  });

  it("groups sorted events by day", () => {
    const groups = groupAgendaEventsByDate(events, "2026-10-27");
    expect(groups.map((group) => [group.date, group.label, group.items.length])).toEqual([
      ["2026-10-27", "Hoje", 1],
      ["2026-10-28", "Amanhã", 2],
    ]);
  });
});

describe("unified spaced reviews", () => {
  it("maps milestone and reading reviews to shared agenda events", () => {
    const milestone = mapScheduledReviewToAgendaEvent({
      id: "scheduled-1",
      milestone_summary_id: "summary-1",
      review_date: "2026-10-26",
      review_type: "D+1",
      status: "pending",
      milestone_summary: {
        milestone_title: "Capítulo 1",
        milestone_page: 20,
        content: "Resumo do capítulo",
        book: { id: "book-1", title: "Livro", chapter_title: "Capítulo 1" },
      },
    });
    const reading = mapSpacedReviewToAgendaEvent({
      id: "spaced-1",
      reading_id: "book-2",
      review_date: "2026-10-27",
      type: "active_recall",
      status: "pending",
      reading: {
        title: "Artigo",
        chapter_title: null,
        subject: { name: "Psicologia" },
      },
    });

    expect(milestone).toMatchObject({ kind: "review", source: "milestone", date: "2026-10-26" });
    expect(reading).toMatchObject({ kind: "review", source: "reading", date: "2026-10-27" });

    const due = getDueAgendaReviews([
      milestone!,
      reading!,
      { ...reading!, id: "future", date: "2026-10-28" },
      { ...reading!, id: "done", status: "completed" },
    ], "2026-10-27");

    expect(due.map((event) => `${event.source}:${event.id}`)).toEqual([
      "milestone:scheduled-1",
      "reading:spaced-1",
    ]);
  });
});
