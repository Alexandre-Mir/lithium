import { afterEach, describe, expect, it, vi } from "vitest";
import { warnIfTruncated } from "@/lib/warn-if-truncated";

describe("warnIfTruncated", () => {
  afterEach(() => vi.restoreAllMocks());

  it("não avisa abaixo do limite", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(warnIfTruncated(Array.from({ length: 999 }, (_, index) => index), "test")).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("avisa ao atingir 1.000 registros", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(warnIfTruncated(Array.from({ length: 1_000 }, (_, index) => index), "test")).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });
});
