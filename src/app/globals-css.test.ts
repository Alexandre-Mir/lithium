import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const cssWithoutComments = globalsCss.replace(/\/\*[\s\S]*?\*\//g, "");
const themeMatch = cssWithoutComments.match(/@theme\s+inline\s*\{([\s\S]*?)\n\}/);
const theme = themeMatch?.[1] ?? "";

describe("fonte do tema global", () => {
  it("não usa a referência circular de font-sans do shadcn", () => {
    expect(cssWithoutComments).not.toMatch(/--font-sans\s*:\s*var\(\s*--font-sans\s*\)/);
  });

  it("usa fallback dentro de cada var de Geist no @theme", () => {
    expect(themeMatch).not.toBeNull();
    expect(theme).not.toMatch(/var\(\s*--font-geist-[\w-]+\s*\)/);
  });
});
