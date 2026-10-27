import { afterEach, describe, expect, it, vi } from "vitest";
import { generateUniquePastelColor, getReadableTextColor } from "./colors";

function hslFromHex(hex: string) {
  const normalized = hex.slice(1);
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return {
    hue: (hue + 360) % 360,
    saturation: saturation * 100,
    lightness: lightness * 100,
  };
}

afterEach(() => vi.restoreAllMocks());

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

describe("generateUniquePastelColor", () => {
  it("retorna HEX pastel com saturação e luminosidade no intervalo definido", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const color = generateUniquePastelColor([]);
    const hsl = hslFromHex(color);

    expect(color).toMatch(/^#[\da-f]{6}$/i);
    expect(hsl.saturation).toBeGreaterThanOrEqual(69.5);
    expect(hsl.saturation).toBeLessThanOrEqual(85.5);
    expect(hsl.lightness).toBeGreaterThanOrEqual(74.5);
    expect(hsl.lightness).toBeLessThanOrEqual(85.5);
  });

  it("rejeita matizes próximas às cores existentes e escolhe uma distinta", () => {
    const values = [0.01, 0.5, 0.5, 0.25, 0.5, 0.5];
    let index = 0;
    vi.spyOn(Math, "random").mockImplementation(() => values[index++] ?? 0.5);

    const color = generateUniquePastelColor(["#ff0000"]);
    const hue = hslFromHex(color).hue;
    const distanceFromRed = Math.min(hue, 360 - hue);

    expect(distanceFromRed).toBeGreaterThanOrEqual(30);
  });

  it("usa um fallback aleatório limitado quando os matizes distintos se esgotam", () => {
    const existingColors = Array.from({ length: 360 }, (_, hue) => `hsl(${hue}, 75%, 80%)`);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);

    const color = generateUniquePastelColor(existingColors);

    expect(color).toMatch(/^#[\da-f]{6}$/i);
    expect(random).toHaveBeenCalledTimes(363);
  });
});
