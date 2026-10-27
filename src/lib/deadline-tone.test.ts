import { describe, expect, it } from "vitest";
import { getDeadlineTone } from "@/lib/deadline-tone";

describe("getDeadlineTone", () => {
  it("reserva danger para prazos vencidos", () => {
    expect(getDeadlineTone(-1)).toBe("danger");
    expect(getDeadlineTone(-30)).toBe("danger");
  });

  it("classifica hoje e os próximos sete dias como warning", () => {
    expect(getDeadlineTone(0)).toBe("warning");
    expect(getDeadlineTone(1)).toBe("warning");
    expect(getDeadlineTone(7)).toBe("warning");
  });

  it("mantém prazos distantes e ausentes neutros", () => {
    expect(getDeadlineTone(8)).toBe("neutral");
    expect(getDeadlineTone(null)).toBe("neutral");
  });
});
