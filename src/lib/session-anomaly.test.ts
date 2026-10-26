import { describe, expect, it } from "vitest";
import { isUnusualSession, type SessionSpeedSample } from "@/lib/session-anomaly";

function sample(pages: number, seconds = 3_600): SessionSpeedSample {
  return { pages_read: pages, duration_seconds: seconds, duration_minutes: seconds / 60 };
}

describe("isUnusualSession", () => {
  it("marca velocidades acima de 300 p/h mesmo com poucas sessões", () => {
    expect(isUnusualSession(sample(6, 60), [sample(6, 60)])).toBe(true);
  });

  it("não compara com a média antes de haver três sessões", () => {
    const sessions = [sample(200), sample(10)];
    expect(isUnusualSession(sessions[0], sessions)).toBe(false);
  });

  it("marca velocidade acima de três vezes a média da leitura", () => {
    const sessions = [sample(200), sample(10), sample(10), sample(10)];
    expect(isUnusualSession(sessions[0], sessions)).toBe(true);
  });

  it("marca velocidade abaixo de um terço da média da leitura", () => {
    const sessions = [sample(1), sample(100), sample(100), sample(100)];
    expect(isUnusualSession(sessions[0], sessions)).toBe(true);
  });

  it("não marca uma sessão próxima da média", () => {
    const sessions = [sample(40), sample(40), sample(40)];
    expect(isUnusualSession(sessions[0], sessions)).toBe(false);
  });
});
