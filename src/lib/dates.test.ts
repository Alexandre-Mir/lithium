import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDaysISO,
  daysBetweenISO,
  daysUntil,
  formatDateBR,
  formatDateTimeBR,
  startOfDayUtcISO,
  timestampToDateISO,
  todayISO,
} from "@/lib/dates";

describe("datas no fuso de São Paulo", () => {
  afterEach(() => vi.useRealTimers());

  it("calcula hoje no fuso fixo, inclusive antes da meia-noite UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T01:30:00Z"));
    expect(todayISO()).toBe("2026-10-23");

    vi.setSystemTime(new Date("2026-10-24T03:00:00Z"));
    expect(todayISO()).toBe("2026-10-24");
  });

  it("adiciona dias de calendário em mudanças de mês, ano e ano bissexto", () => {
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("calcula diferença de dias nos dois sentidos", () => {
    expect(daysBetweenISO("2026-10-23", "2026-10-24")).toBe(1);
    expect(daysBetweenISO("2026-10-24", "2026-10-24")).toBe(0);
    expect(daysBetweenISO("2026-10-25", "2026-10-24")).toBe(-1);
  });

  it("calcula prazo positivo, hoje e atrasado usando hoje em São Paulo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));

    expect(daysUntil("2026-10-27")).toBe(3);
    expect(daysUntil("2026-10-24")).toBe(0);
    expect(daysUntil("2026-10-22")).toBe(-2);
  });

  it("formata datas e timestamps UTC em pt-BR", () => {
    expect(formatDateBR("2026-10-24")).toBe("24/10/2026");
    expect(formatDateBR("2026-10-24", { day: "2-digit", month: "2-digit" })).toBe("24/10");
    expect(formatDateTimeBR("2026-10-24T03:00:00Z")).toBe("24/10/2026, 00:00");
  });

  it("converte a meia-noite de São Paulo para o limite UTC correto", () => {
    expect(startOfDayUtcISO("2026-10-24")).toBe("2026-10-24T03:00:00.000Z");
    expect(startOfDayUtcISO("2026-10-25")).toBe("2026-10-25T03:00:00.000Z");
  });

  it("extrai a data local de São Paulo de timestamps", () => {
    expect(timestampToDateISO("2026-10-24T02:59:00Z")).toBe("2026-10-23");
    expect(timestampToDateISO("2026-10-24T03:00:00Z")).toBe("2026-10-24");
    expect(timestampToDateISO("inválido")).toBeNull();
  });
});
