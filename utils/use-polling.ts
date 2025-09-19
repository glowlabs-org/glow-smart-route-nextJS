import { useState, useEffect, useRef, useCallback } from "react";

interface UsePollingOptions<T> {
  /**
   * Function to call on each poll interval
   * Should return the data or throw an error
   */
  pollFn: () => Promise<T>;

  /**
   * Interval between polls in milliseconds
   * @default 10000 (10 seconds)
   */
  pollInterval?: number;

  /**
   * Maximum duration to poll in seconds
   * @default 120 (2 minutes)
   */
  maxDuration?: number;

  /**
   * Whether polling is enabled
   * @default false
   */
  enabled?: boolean;

  /**
   * Callback when polling succeeds
   */
  onSuccess?: (data: T) => void;

  /**
   * Callback when polling fails or times out
   */
  onError?: (error: Error) => void;

  /**
   * Custom function to check if polling should stop
   * Return true to stop polling
   */
  shouldStopPolling?: (data: T) => boolean;
}

interface UsePollingReturn<T> {
  /**
   * Current data from the last successful poll
   */
  data: T | null;

  /**
   * Whether currently polling
   */
  isPolling: boolean;

  /**
   * Error from polling
   */
  error: Error | null;

  /**
   * Countdown in seconds
   */
  countdown: number;

  /**
   * Start polling manually
   */
  startPolling: () => void;

  /**
   * Stop polling manually
   */
  stopPolling: () => void;

  /**
   * Reset all states
   */
  reset: () => void;
}

/**
 * Hook for polling with countdown timer and automatic cleanup
 * Useful for checking transaction status, API polling, etc.
 */
export function usePolling<T = any>({
  pollFn,
  pollInterval = 10000,
  maxDuration = 120,
  enabled = false,
  onSuccess,
  onError,
  shouldStopPolling,
}: UsePollingOptions<T>): UsePollingReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [countdown, setCountdown] = useState(maxDuration);

  // Refs for intervals and abort controller
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Clear all intervals and abort controller
   */
  const clearAllIntervals = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Reset all states
   */
  const reset = useCallback(() => {
    clearAllIntervals();
    setData(null);
    setIsPolling(false);
    setError(null);
    setCountdown(maxDuration);
  }, [clearAllIntervals, maxDuration]);

  /**
   * Start polling
   */
  const startPolling = useCallback(() => {
    setIsPolling(true);
    setError(null);
    setCountdown(maxDuration);
  }, [maxDuration]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    clearAllIntervals();
    setIsPolling(false);
  }, [clearAllIntervals]);

  /**
   * Main polling effect
   */
  useEffect(() => {
    // Clear any existing intervals
    clearAllIntervals();

    if (!isPolling || !enabled) return;

    // Create new AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Start countdown timer
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Timeout reached
          const timeoutError = new Error(
            `Polling timed out after ${maxDuration} seconds. The operation may still be processing.`
          );
          setError(timeoutError);
          setIsPolling(false);
          clearAllIntervals();
          onError?.(timeoutError);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Polling function
    const poll = async () => {
      // Check if already aborted
      if (signal.aborted) return;

      try {
        const result = await pollFn();

        // Check again if aborted after async call
        if (signal.aborted) return;

        setData(result);

        // Check if we should stop polling
        if (shouldStopPolling?.(result)) {
          clearAllIntervals();
          setIsPolling(false);
          onSuccess?.(result);
        }
      } catch (err) {
        // Only handle error if not aborted
        if (!signal.aborted) {
          console.warn("Polling error:", err);
          // Continue polling on error unless it's critical
          // You can customize this behavior
        }
      }
    };

    // Initial poll
    poll();

    // Set up interval for subsequent polls
    pollIntervalRef.current = setInterval(poll, pollInterval);

    // Cleanup function
    return () => {
      clearAllIntervals();
    };
  }, [
    isPolling,
    enabled,
    pollFn,
    pollInterval,
    maxDuration,
    shouldStopPolling,
    onSuccess,
    onError,
    clearAllIntervals,
  ]);

  return {
    data,
    isPolling,
    error,
    countdown,
    startPolling,
    stopPolling,
    reset,
  };
}

/**
 * Specialized hook for transaction polling
 */
export function useTransactionPolling(
  txHash: string | null,
  fetchStatusFn: (hash: string) => Promise<any>,
  options?: Partial<UsePollingOptions<any>>
) {
  return usePolling({
    pollFn: async () => {
      if (!txHash) throw new Error("No transaction hash");
      return fetchStatusFn(txHash);
    },
    enabled: Boolean(txHash),
    shouldStopPolling: (data) => {
      // Customize based on your transaction status structure
      return (
        data?.status === "confirmed" ||
        data?.status === "finalized" ||
        data?.status === "failed"
      );
    },
    ...options,
  });
}
