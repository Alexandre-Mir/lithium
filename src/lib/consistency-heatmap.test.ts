import { describe, expect, it } from "vitest";
import {
  CONSISTENCY_HEATMAP_DAYS,
  buildConsistencyHeatmap,
  buildHeatmapWeekGrid,
  heatmapDayLabel,
  minutesToHeatmapLevel,
  sessionHeatmapDate,
  weekdayMondayFirst,
} from "@/lib/consistency-heatmap";

describe("consistency-heatmap", () => {
  it("atribui a data da sessão e mapeia níveis por minutos", () => {
    expect(sessionHeatmapDate({
      duration_minutes: 30,
      started_at: "2026-10-20T15:00:00.000Z",
      created_at: "2026-10-21T12:00:00.000Z",
    })).toBe("2026-10-20");
    expect(minutesToHeatmapLevel(0)).toBe(0);
    expect(minutesToHeatmapLevel(10)).toBe(1);
    expect(minutesToHeatmapLevel(20)).toBe(2);
    expect(minutesToHeatmapLevel(50)).toBe(3);
    expect(minutesToHeatmapLevel(90)).toBe(4);
  });

  it("usa segunda-feira como início da semana", () => {
    expect(weekdayMondayFirst("2026-10-26")).toBe(0); // segunda
    expect(weekdayMondayFirst("2026-10-28")).toBe(2); // quarta
    expect(weekdayMondayFirst("2026-11-01")).toBe(6); // domingo
  });

  it("monta 28 dias com agregação de minutos e dias ativos", () => {
    const model = buildConsistencyHeatmap(
      [
        {
          duration_minutes: 30,
          duration_seconds: 1_800,
          started_at: "2026-10-20T12:00:00.000Z",
        },
        {
          duration_minutes: 60,
          duration_seconds: 3_600,
          started_at: "2026-10-20T18:00:00.000Z",
        },
        {
          duration_minutes: 15,
          duration_seconds: 900,
          started_at: "2026-10-28T12:00:00.000Z",
        },
        {
          duration_minutes: 45,
          duration_seconds: 2_700,
          started_at: "2026-09-01T12:00:00.000Z", // fora da janela
        },
      ],
      "2026-10-28",
    );

    expect(model.days).toHaveLength(CONSISTENCY_HEATMAP_DAYS);
    expect(model.windowStart).toBe("2026-10-01");
    expect(model.windowEnd).toBe("2026-10-28");
    expect(model.activeDays).toBe(2);
    expect(model.totalMinutes).toBe(105);

    const oct20 = model.days.find((day) => day.date === "2026-10-20");
    expect(oct20).toMatchObject({ sessions: 2, minutes: 90, level: 4 });

    const oct28 = model.days.find((day) => day.date === "2026-10-28");
    expect(oct28).toMatchObject({ sessions: 1, minutes: 15, level: 2 });
  });

  it("gera grade semanal com padding Seg→Dom", () => {
    const model = buildConsistencyHeatmap([], "2026-10-28"); // quarta
    const grid = buildHeatmapWeekGrid(model.days);
    // 2026-10-01 é quinta → 3 pads + 28 dias + pads finais → múltiplo de 7
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(28);
    expect(heatmapDayLabel(model.days[0])).toContain("sem sessão");
  });
});
