import { afterEach, describe, expect, it, vi } from "vitest";
import { serialize, startTimer } from "@/lib/reading-timer";

const hydration = vi.hoisted(() => ({
  effects: [] as Array<() => void>,
  listeners: [] as Array<ReturnType<typeof vi.fn>>,
  cleanups: [] as Array<() => void>,
}));

vi.mock("react", () => ({
  useSyncExternalStore: (
    subscribe: (listener: () => void) => () => void,
    _getSnapshot: () => unknown,
    getServerSnapshot: () => unknown,
  ) => {
    const listener = vi.fn();
    hydration.listeners.push(listener);
    hydration.cleanups.push(subscribe(listener));
    return getServerSnapshot();
  },
  useEffect: (effect: () => void) => {
    hydration.effects.push(effect);
  },
}));

import {
  clearReadingTimer,
  getReadingTimerSnapshot,
  READING_TIMER_STORAGE_KEY,
  useReadingTimer,
} from "@/lib/reading-timer-store";

afterEach(() => {
  hydration.cleanups.splice(0).forEach((cleanup) => cleanup());
  clearReadingTimer();
  vi.unstubAllGlobals();
  hydration.effects.length = 0;
  hydration.listeners.length = 0;
});

describe("reading timer hydration", () => {
  it("loads persisted state after subscribing instead of updating during hydration", () => {
    const persistedTimer = serialize(
      startTimer("reading-1", "Livro", new Date("2026-11-09T12:00:00.000Z")),
    );
    const localStorage = {
      getItem: vi.fn(() => persistedTimer),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal("window", {
      localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    expect(useReadingTimer()).toBeNull();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(hydration.listeners[0]).not.toHaveBeenCalled();
    expect(hydration.effects).toHaveLength(1);

    hydration.effects[0]();

    expect(localStorage.getItem).toHaveBeenCalledWith(READING_TIMER_STORAGE_KEY);
    expect(hydration.listeners[0]).toHaveBeenCalledOnce();
    expect(getReadingTimerSnapshot()).toMatchObject({
      readingId: "reading-1",
      readingTitle: "Livro",
    });
  });
});
