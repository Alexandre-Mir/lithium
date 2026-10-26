import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addToast,
  DEFAULT_TOAST_DURATION_MS,
  getToastSnapshot,
  pauseToast,
  removeToast,
  resumeToast,
} from "@/lib/toast-store";

afterEach(() => {
  getToastSnapshot().forEach((item) => removeToast(item.id));
  vi.useRealTimers();
});

describe("toast-store", () => {
  it("mantém no máximo três toasts, removendo o mais antigo", () => {
    const first = addToast({ message: "Primeiro" });
    addToast({ message: "Segundo" });
    addToast({ message: "Terceiro" });
    addToast({ message: "Quarto" });

    expect(getToastSnapshot()).toHaveLength(3);
    expect(getToastSnapshot().map((item) => item.message)).toEqual([
      "Segundo",
      "Terceiro",
      "Quarto",
    ]);
    expect(getToastSnapshot().some((item) => item.id === first.id)).toBe(false);
  });

  it("remove um toast pelo id", () => {
    const first = addToast({ message: "Primeiro" });
    const second = addToast({ message: "Segundo" });
    removeToast(first.id);

    expect(getToastSnapshot().map((item) => item.id)).toEqual([second.id]);
  });

  it("remove o toast quando termina sua duração", () => {
    vi.useFakeTimers();
    const item = addToast({ message: "Temporário" });
    expect(item.durationMs).toBe(DEFAULT_TOAST_DURATION_MS);

    vi.advanceTimersByTime(7_999);
    expect(getToastSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToastSnapshot()).toHaveLength(0);
  });

  it("pausa a contagem até o toast voltar a receber tempo", () => {
    vi.useFakeTimers();
    const item = addToast({ message: "Pausável", durationMs: 1_000 });

    vi.advanceTimersByTime(400);
    pauseToast(item.id);
    vi.advanceTimersByTime(2_000);
    expect(getToastSnapshot()).toHaveLength(1);

    resumeToast(item.id);
    vi.advanceTimersByTime(599);
    expect(getToastSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToastSnapshot()).toHaveLength(0);
  });
});
