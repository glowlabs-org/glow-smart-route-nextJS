"use client";

import * as React from "react";

import { useGlowLaunchpad } from "@/hooks/useGlowLaunchpad";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";
import { countActiveListings } from "@/utils/launchpad";

export interface LaunchpadStatus {
  isLive: boolean;
  activeFarmsCount: number;
  nextBatchAtMs: number;
  refreshNextBatchAtMs: () => void;
  isLoading: boolean;
  isError: boolean;
}

export function useLaunchpadStatus(): LaunchpadStatus {
  const { applications, isLoading, isError } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
  });

  const activeFarmsCount = React.useMemo(
    () => countActiveListings(applications),
    [applications]
  );

  const isLive = activeFarmsCount > 0;

  const [nextBatchAtMs, setNextBatchAtMs] = React.useState(() => {
    try {
      return getNextTuesdayAt1pmET().getTime();
    } catch {
      return Date.now();
    }
  });

  const refreshNextBatchAtMs = React.useCallback(() => {
    try {
      setNextBatchAtMs(getNextTuesdayAt1pmET().getTime());
    } catch {
      setNextBatchAtMs(Date.now());
    }
  }, []);

  return {
    isLive,
    activeFarmsCount,
    nextBatchAtMs,
    refreshNextBatchAtMs,
    isLoading,
    isError,
  };
}


