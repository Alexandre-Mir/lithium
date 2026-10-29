import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Arquivos que o UX-02 migrou de alert()/confirm() para ConfirmDialog/addToast/inline. */
const TARGET_FILES = [
  "src/components/library/readings-table.tsx",
  "src/components/setup/subjects-table.tsx",
  "src/components/agenda/deliverables-table.tsx",
  "src/components/dashboard/tier1-card.tsx",
  "src/components/dashboard/reading-tier-card.tsx",
] as const;

const NATIVE_DIALOG = /\b(?:alert|confirm|prompt)\s*\(/;

describe("UX-02: sem diálogos nativos do navegador", () => {
  it.each(TARGET_FILES)("%s não chama alert/confirm/prompt", (relativePath) => {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    expect(source).not.toMatch(NATIVE_DIALOG);
  });
});
