import type { NewToast } from "@/lib/toast-store";

/** Toast padrão ao concluir uma leitura, com ação rápida de desfazer. */
export function readingCompletedUndoToast(
  title: string,
  onUndo: () => void | Promise<void>
): NewToast {
  return {
    message: `«${title}» concluída`,
    actionLabel: "Desfazer",
    onAction: onUndo,
  };
}
