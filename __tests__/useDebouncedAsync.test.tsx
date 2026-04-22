import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";

import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";

describe("useDebouncedAsync", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("delays the runner by delayMs", async () => {
    const runner = vi.fn(async () => {});
    const { result } = renderHook(() => useDebouncedAsync(runner, { delayMs: 200 }));

    act(() => {
      result.current.run("hello");
    });
    expect(runner).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(199);
    });
    expect(runner).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith("hello", expect.any(AbortSignal));
  });

  it("aborts the previous runner when a new run() is triggered before the prior async resolves", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    const captured: AbortSignal[] = [];
    const runner = vi.fn(async (_value: string, signal: AbortSignal) => {
      captured.push(signal);
      if (captured.length === 1) {
        await new Promise((r) => (resolveFirst = r));
      }
    });

    const { result } = renderHook(() =>
      useDebouncedAsync(runner, { delayMs: 10 }),
    );

    act(() => {
      result.current.run("first");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15);
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].aborted).toBe(false);

    act(() => {
      result.current.run("second");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15);
    });

    // Second fire aborts the first controller before creating a new one.
    expect(captured).toHaveLength(2);
    expect(captured[0].aborted).toBe(true);
    expect(captured[1].aborted).toBe(false);

    // Release the stale first promise so it doesn't leak — it should be a no-op.
    resolveFirst(undefined);
  });

  it("cancel() aborts an in-flight runner and clears pending timers", async () => {
    let signalFromRunner: AbortSignal | null = null;
    const runner = vi.fn(async (_value: string, signal: AbortSignal) => {
      signalFromRunner = signal;
      await new Promise(() => {}); // never resolves
    });

    const { result } = renderHook(() => useDebouncedAsync(runner, { delayMs: 10 }));

    act(() => {
      result.current.run("x");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15);
    });
    expect(signalFromRunner).not.toBeNull();
    expect(signalFromRunner!.aborted).toBe(false);

    act(() => {
      result.current.cancel();
    });
    expect(signalFromRunner!.aborted).toBe(true);
  });

  it("cancel() before the timer fires prevents runner from running at all", async () => {
    const runner = vi.fn(async () => {});
    const { result } = renderHook(() => useDebouncedAsync(runner, { delayMs: 50 }));

    act(() => {
      result.current.run("x");
      result.current.cancel();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(runner).not.toHaveBeenCalled();
  });
});
