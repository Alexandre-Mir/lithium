export function getReadableTextColor(hex: string): "#111827" | "#ffffff" {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "#ffffff";
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? "#111827" : "#ffffff";
}
