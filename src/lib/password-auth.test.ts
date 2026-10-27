import { describe, expect, it } from "vitest";
import {
  createPasswordSessionToken,
  isPasswordSessionTokenValid,
  PASSWORD_SESSION_TTL_SECONDS,
  passwordMatches,
  safeReturnPath,
} from "@/lib/password-auth";

describe("password authentication helpers", () => {
  it("matches only a configured non-empty password", () => {
    expect(passwordMatches("correct horse", "correct horse")).toBe(true);
    expect(passwordMatches("wrong", "correct horse")).toBe(false);
    expect(passwordMatches("anything", undefined)).toBe(false);
    expect(passwordMatches("", "configured")).toBe(false);
  });

  it("validates signed sessions and rejects tampering, other secrets, and expiry", () => {
    const now = 1_800_000_000;
    const token = createPasswordSessionToken("configured-secret", now);
    const finalCharacter = token.at(-1);
    const tamperedToken = `${token.slice(0, -1)}${finalCharacter === "a" ? "b" : "a"}`;

    expect(isPasswordSessionTokenValid(token, "configured-secret", now)).toBe(true);
    expect(isPasswordSessionTokenValid(token, "other-secret", now)).toBe(false);
    expect(isPasswordSessionTokenValid(tamperedToken, "configured-secret", now)).toBe(false);
    expect(isPasswordSessionTokenValid(
      token,
      "configured-secret",
      now + PASSWORD_SESSION_TTL_SECONDS,
    )).toBe(false);
  });

  it("allows only local return paths", () => {
    expect(safeReturnPath("/library?status=pendente")).toBe("/library?status=pendente");
    expect(safeReturnPath("//example.com")).toBe("/");
    expect(safeReturnPath("https://example.com")).toBe("/");
    expect(safeReturnPath("/\\example.com")).toBe("/");
    expect(safeReturnPath(["/library"])).toBe("/");
  });
});
