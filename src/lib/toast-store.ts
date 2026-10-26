"use client";

import { useSyncExternalStore } from "react";

export const DEFAULT_TOAST_DURATION_MS = 8_000;
export const MAX_TOASTS = 3;

export interface ToastItem {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  durationMs: number;
}

export type NewToast = Omit<ToastItem, "id" | "durationMs"> & {
  durationMs?: number;
};

interface ToastTimer {
  handle: ReturnType<typeof setTimeout> | null;
  remainingMs: number;
  startedAt: number;
  paused: boolean;
}

const EMPTY_TOASTS: readonly ToastItem[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ToastTimer>();
let toasts: ToastItem[] = [];
let nextId = 0;

function publish() {
  for (const listener of listeners) listener();
}

function stopTimer(id: string) {
  const timer = timers.get(id);
  if (timer?.handle !== null && timer?.handle !== undefined) {
    clearTimeout(timer.handle);
  }
  timers.delete(id);
}

function scheduleRemoval(id: string, timer: ToastTimer) {
  timer.startedAt = Date.now();
  timer.handle = setTimeout(() => removeToast(id), timer.remainingMs);
}

export function addToast(input: NewToast): ToastItem {
  while (toasts.length >= MAX_TOASTS) {
    removeToast(toasts[0].id, false);
  }

  nextId += 1;
  const item: ToastItem = {
    ...input,
    id: `${Date.now()}-${nextId}`,
    durationMs: input.durationMs ?? DEFAULT_TOAST_DURATION_MS,
  };
  toasts = [...toasts, item];

  const timer: ToastTimer = {
    handle: null,
    remainingMs: Math.max(0, item.durationMs),
    startedAt: 0,
    paused: false,
  };
  timers.set(item.id, timer);
  scheduleRemoval(item.id, timer);
  publish();
  return item;
}

export function removeToast(id: string, notify = true) {
  const nextToasts = toasts.filter((item) => item.id !== id);
  if (nextToasts.length === toasts.length) return;
  stopTimer(id);
  toasts = nextToasts;
  if (notify) publish();
}

export function pauseToast(id: string) {
  const timer = timers.get(id);
  if (!timer || timer.paused) return;
  if (timer.handle !== null) clearTimeout(timer.handle);
  timer.remainingMs = Math.max(0, timer.remainingMs - Math.max(0, Date.now() - timer.startedAt));
  timer.handle = null;
  timer.paused = true;
}

export function resumeToast(id: string) {
  const timer = timers.get(id);
  if (!timer || !timer.paused) return;
  timer.paused = false;
  scheduleRemoval(id, timer);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToastSnapshot(): readonly ToastItem[] {
  return toasts;
}

export function useToastStore(): readonly ToastItem[] {
  return useSyncExternalStore(subscribe, getToastSnapshot, () => EMPTY_TOASTS);
}
