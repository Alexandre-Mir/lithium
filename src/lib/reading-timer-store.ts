"use client";

import { useSyncExternalStore } from "react";
import {
  pauseTimer,
  parse,
  resumeTimer,
  serialize,
  startTimer,
  type TimerState,
} from "@/lib/reading-timer";

export const READING_TIMER_STORAGE_KEY = "lithium:reading-timer:v1";

let snapshot: TimerState | null = null;
let hydratedFromStorage = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function readStorage(): TimerState | null {
  if (typeof window === "undefined") return null;
  try {
    return parse(window.localStorage.getItem(READING_TIMER_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStorage(value: TimerState | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(READING_TIMER_STORAGE_KEY, serialize(value));
    else window.localStorage.removeItem(READING_TIMER_STORAGE_KEY);
  } catch {
    // O cronômetro continua funcionando nesta aba quando o storage estiver indisponível.
  }
}

function syncFromStorage() {
  snapshot = readStorage();
  hydratedFromStorage = true;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined" && !hydratedFromStorage) syncFromStorage();
  if (typeof window !== "undefined" && listeners.size === 1) {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined" && listeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

function handleStorage(event: StorageEvent) {
  if (event.key !== READING_TIMER_STORAGE_KEY && event.key !== null) return;
  snapshot = parse(event.newValue);
  hydratedFromStorage = true;
  notify();
}

function commit(next: TimerState | null) {
  snapshot = next;
  hydratedFromStorage = true;
  writeStorage(next);
  notify();
}

export function useReadingTimer(): TimerState | null {
  return useSyncExternalStore(subscribe, () => snapshot, () => null);
}

export function getReadingTimerSnapshot(): TimerState | null {
  if (typeof window !== "undefined" && !hydratedFromStorage) {
    snapshot = readStorage();
    hydratedFromStorage = true;
  }
  return snapshot;
}

export function startReadingTimer(readingId: string, readingTitle: string): boolean {
  const current = getReadingTimerSnapshot();
  if (current && typeof window !== "undefined") {
    const confirmed = window.confirm(
      `Finalizar ou descartar o cronômetro de «${current.readingTitle}»?`,
    );
    if (!confirmed) return false;
  }
  commit(startTimer(readingId, readingTitle));
  return true;
}

export function pauseReadingTimer() {
  const current = getReadingTimerSnapshot();
  if (current) commit(pauseTimer(current));
}

export function resumeReadingTimer() {
  const current = getReadingTimerSnapshot();
  if (current) commit(resumeTimer(current));
}

export function clearReadingTimer() {
  commit(null);
}

