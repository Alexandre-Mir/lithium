import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/auth-redirect";

describe("safeReturnPath", () => {
  it("mantém destinos locais e rejeita redirecionamentos externos", () => {
    expect(safeReturnPath("/library?status=pending")).toBe("/library?status=pending");
    expect(safeReturnPath("//example.com")).toBe("/");
    expect(safeReturnPath("https://example.com")).toBe("/");
    expect(safeReturnPath("/\\example.com")).toBe("/");
    expect(safeReturnPath(["/library"])).toBe("/");
  });
});
