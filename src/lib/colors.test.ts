import { describe, expect, it } from "vitest";
import { getReadableTextColor } from "./colors";

describe("getReadableTextColor", () => {
  it("retorna texto escuro (#111827) para fundos claros", () => {
    expect(getReadableTextColor("#ffffff")).toBe("#111827");
    expect(getReadableTextColor("#fef08a")).toBe("#111827"); // amarelo claro
    expect(getReadableTextColor("#e0e7ff")).toBe("#111827"); // indigo claro
    expect(getReadableTextColor("ffffff")).toBe("#111827"); // sem prefixo #
  });

  it("retorna texto claro (#ffffff) para fundos escuros", () => {
    expect(getReadableTextColor("#000000")).toBe("#ffffff");
    expect(getReadableTextColor("#1e1b4b")).toBe("#ffffff"); // indigo escuro
    expect(getReadableTextColor("#111827")).toBe("#ffffff"); // gray 900
    expect(getReadableTextColor("#0f172a")).toBe("#ffffff"); // slate 900
    expect(getReadableTextColor("000000")).toBe("#ffffff"); // sem prefixo #
  });

  it("retorna fallback (#ffffff) para valores hex inválidos ou incompletos", () => {
    expect(getReadableTextColor("")).toBe("#ffffff");
    expect(getReadableTextColor("#fff")).toBe("#ffffff");
    expect(getReadableTextColor("invalid")).toBe("#ffffff");
    expect(getReadableTextColor("#12345")).toBe("#ffffff");
  });
});
