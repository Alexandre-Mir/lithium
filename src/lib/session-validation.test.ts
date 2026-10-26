import { describe, expect, it } from "vitest";
import { validateSessionInput } from "@/lib/session-validation";

const validSession = {
  pages_read: 1,
  duration_seconds: 1,
  source: "manual",
};

describe("validateSessionInput", () => {
  it("aceita os limites válidos", () => {
    expect(validateSessionInput(validSession)).toBeNull();
    expect(validateSessionInput({ ...validSession, duration_seconds: 43_200 })).toBeNull();
  });

  it("rejeita páginas ausentes, zero ou fracionárias", () => {
    expect(validateSessionInput({ ...validSession, pages_read: 0 })).not.toBeNull();
    expect(validateSessionInput({ ...validSession, pages_read: 1.5 })).not.toBeNull();
  });

  it("rejeita duração fora do intervalo ou fracionária", () => {
    expect(validateSessionInput({ ...validSession, duration_seconds: 0 })).not.toBeNull();
    expect(validateSessionInput({ ...validSession, duration_seconds: 43_201 })).not.toBeNull();
    expect(validateSessionInput({ ...validSession, duration_seconds: 1.5 })).not.toBeNull();
  });

  it("valida origem e ordem temporal", () => {
    expect(validateSessionInput({ ...validSession, source: "other" })).not.toBeNull();
    expect(validateSessionInput({
      ...validSession,
      started_at: "2026-10-25T12:00:01.000Z",
      ended_at: "2026-10-25T12:00:00.000Z",
    })).not.toBeNull();
  });
});
