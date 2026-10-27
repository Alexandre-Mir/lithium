const MIN_HUE_DISTANCE = 30;
const MIN_HUE_DISTANCE_FLOOR = 5;
const MAX_COLOR_RETRIES = 120;

function parseColorHue(color: string): number | null {
  const normalized = color.trim();
  const hslMatch = normalized.match(/^hsl\(\s*(-?\d+(?:\.\d+)?)/i);
  if (hslMatch) {
    const hue = Number(hslMatch[1]);
    return Number.isFinite(hue) ? ((hue % 360) + 360) % 360 : null;
  }

  const hex = normalized.replace(/^#/, "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return null;
  const fullHex = hex.length === 3
    ? hex.split("").map((channel) => channel + channel).join("")
    : hex;
  const red = parseInt(fullHex.slice(0, 2), 16) / 255;
  const green = parseInt(fullHex.slice(2, 4), 16) / 255;
  const blue = parseInt(fullHex.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta === 0) return null;

  let hue: number;
  if (max === red) hue = 60 * (((green - blue) / delta) % 6);
  else if (max === green) hue = 60 * ((blue - red) / delta + 2);
  else hue = 60 * ((red - green) / delta + 4);
  return (hue + 360) % 360;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = h / 60;
  const second = chroma * (1 - Math.abs((section % 2) - 1));
  const match = l - chroma / 2;

  let channels: [number, number, number];
  if (section < 1) channels = [chroma, second, 0];
  else if (section < 2) channels = [second, chroma, 0];
  else if (section < 3) channels = [0, chroma, second];
  else if (section < 4) channels = [0, second, chroma];
  else if (section < 5) channels = [second, 0, chroma];
  else channels = [chroma, 0, second];

  return `#${channels
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hueDistance(left: number, right: number): number {
  const difference = Math.abs(left - right);
  return Math.min(difference, 360 - difference);
}

function randomPastelColor(hue = Math.random() * 360): string {
  const saturation = 70 + Math.random() * 15;
  const lightness = 75 + Math.random() * 10;
  return hslToHex(hue, saturation, lightness);
}

export function generateUniquePastelColor(existingColors: string[]): string {
  const existingHues = existingColors
    .map(parseColorHue)
    .filter((hue): hue is number => hue !== null);
  const normalizedExisting = new Set(existingColors.map((color) => color.trim().toLowerCase()));
  const hueThreshold = Math.max(
    MIN_HUE_DISTANCE_FLOOR,
    MIN_HUE_DISTANCE - Math.max(0, existingHues.length - 6) * 2,
  );

  for (let attempt = 0; attempt < MAX_COLOR_RETRIES; attempt += 1) {
    const hue = Math.random() * 360;
    const color = randomPastelColor(hue);
    const distinctHue = existingHues.every((existingHue) => hueDistance(hue, existingHue) >= hueThreshold);
    if (distinctHue && !normalizedExisting.has(color.toLowerCase())) return color;
  }

  // O fallback mantém o padrão pastel quando o espaço de matizes distintas se esgota.
  return randomPastelColor();
}

export function getReadableTextColor(hex: string): "#111827" | "#ffffff" {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "#ffffff";
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? "#111827" : "#ffffff";
}
