"use client";

import { useEffect, useRef } from "react";
import { addToast, pauseToast, removeToast, resumeToast, useToastStore } from "@/lib/toast-store";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function Toaster() {
  const toasts = useToastStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || toasts.length === 0) return;
      event.preventDefault();
      removeToast(toasts[toasts.length - 1].id);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toasts]);

  const runAction = async (id: string, action?: () => void | Promise<void>) => {
    try {
      await action?.();
    } catch (error) {
      console.error("Erro ao executar ação do toast:", error);
      addToast({ message: "Não foi possível concluir a ação." });
    } finally {
      removeToast(id);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((item) => (
        <ToastRow key={item.id} item={item} onAction={() => void runAction(item.id, item.onAction)} />
      ))}
    </div>
  );
}

function ToastRow({
  item,
  onAction,
}: {
  item: ReturnType<typeof useToastStore>[number];
  onAction: () => void;
}) {
  const pauseReasons = useRef(new Set<"hover" | "focus">());

  const setPauseReason = (reason: "hover" | "focus", active: boolean) => {
    if (active) {
      if (pauseReasons.current.size === 0) pauseToast(item.id);
      pauseReasons.current.add(reason);
      return;
    }
    pauseReasons.current.delete(reason);
    if (pauseReasons.current.size === 0) resumeToast(item.id);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPauseReason("hover", true)}
      onMouseLeave={() => setPauseReason("hover", false)}
      onFocusCapture={() => setPauseReason("focus", true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPauseReason("focus", false);
        }
      }}
      className="pointer-events-auto flex w-full max-w-lg items-center gap-3 border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
    >
      <span className="min-w-0 flex-1">{item.message}</span>
      {item.actionLabel && item.onAction && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs font-semibold"
          onClick={onAction}
        >
          {item.actionLabel}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Fechar notificação"
        onClick={() => removeToast(item.id)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
