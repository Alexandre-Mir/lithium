import { describe, expect, it } from "vitest";
import { safeReturnPath, safeReturnPathFromReferer } from "@/lib/auth-redirect";

describe("safeReturnPath", () => {
  it("mantém destinos locais e rejeita redirecionamentos externos", () => {
    expect(safeReturnPath("/library?status=pending")).toBe("/library?status=pending");
    expect(safeReturnPath("//example.com")).toBe("/");
    expect(safeReturnPath("https://example.com")).toBe("/");
    expect(safeReturnPath("/\\example.com")).toBe("/");
    expect(safeReturnPath(["/library"])).toBe("/");
  });

  describe("safeReturnPathFromReferer", () => {
    it("preserva caminho e consulta locais sem aceitar destino externo", () => {
      expect(safeReturnPathFromReferer("https://lithium.example/library?status=pending"))
        .toBe("/library?status=pending");
      expect(safeReturnPathFromReferer("https://attacker.example//attacker.example"))
        .toBe("/");
    });

    it("evita voltar ao login e usa a raiz quando o referer é inválido", () => {
      expect(safeReturnPathFromReferer("https://lithium.example/login?next=%2Fagenda")).toBe("/");
      expect(safeReturnPathFromReferer("not a URL")).toBe("/");
      expect(safeReturnPathFromReferer(null)).toBe("/");
    });
  });
});
