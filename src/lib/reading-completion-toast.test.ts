import { describe, expect, it, vi } from "vitest";
import { readingCompletedUndoToast } from "@/lib/reading-completion-toast";

describe("readingCompletedUndoToast", () => {
  it("monta toast com mensagem de conclusão e ação Desfazer", async () => {
    const onUndo = vi.fn();
    const toast = readingCompletedUndoToast("Dom Casmurro", onUndo);

    expect(toast.message).toBe("«Dom Casmurro» concluída");
    expect(toast.actionLabel).toBe("Desfazer");
    expect(toast.onAction).toBe(onUndo);

    await toast.onAction?.();
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
