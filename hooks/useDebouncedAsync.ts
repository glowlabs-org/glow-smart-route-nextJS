import * as React from "react";

interface UseDebouncedAsyncOptions<T, R> {
  delayMs?: number;
  onResult?: (result: R, value: T) => void;
  onError?: (error: unknown, value: T) => void;
}

export function useDebouncedAsync<T, R = void>(
  runner: (value: T, signal: AbortSignal) => Promise<R>,
  options?: UseDebouncedAsyncOptions<T, R>
) {
  const delay = options?.delayMs ?? 400;
  const [isRunning, setIsRunning] = React.useState(false);

  const timerRef = React.useRef<number | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const cancel = React.useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const run = React.useCallback(
    (value: T) => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      timerRef.current = window.setTimeout(async () => {
        timerRef.current = null;
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsRunning(true);
        try {
          const res = await runner(value, controller.signal);
          if (!controller.signal.aborted) {
            options?.onResult?.(res as R, value);
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            options?.onError?.(err, value);
          }
        } finally {
          if (!controller.signal.aborted) setIsRunning(false);
        }
      }, delay);
    },
    [delay, runner, options]
  );

  React.useEffect(() => cancel, [cancel]);

  return { run, cancel, isRunning } as const;
}
