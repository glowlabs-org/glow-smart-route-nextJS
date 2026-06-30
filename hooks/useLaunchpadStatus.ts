"use client";

import * as React from "react";

import { useGlowLaunchpad, useMiningCenter } from "@/hooks";
import { useMinerEarlyAccessSignature } from "@/hooks/v2-early-access";
import {
  getNextLaunchpadDelegationBatchAtET,
  getNextMiningCenterBatchAtET,
  getNextSponsorListingsBatchAtET,
} from "@/utils/nextTuesdayET";
import { countActiveListings } from "@/utils/launchpad";

export interface LaunchpadStatus {
  isLive: boolean;
  activeFarmsCount: number;
  activeDelegationsCount: number;
  activeMinersCount: number;
  nextBatchAtMs: number;
  nextMinerBatchAtMs: number;
  nextDelegationBatchAtMs: number;
  refreshNextBatchAtMs: () => void;
  isLoading: boolean;
  isError: boolean;
}

type LaunchpadBatchSchedule = Pick<
  LaunchpadStatus,
  "nextBatchAtMs" | "nextMinerBatchAtMs" | "nextDelegationBatchAtMs"
>;

function getLaunchpadBatchSchedule(): LaunchpadBatchSchedule {
  const nextMinerBatchAtMs = getNextMiningCenterBatchAtET().getTime();
  const nextDelegationBatchAtMs =
    getNextLaunchpadDelegationBatchAtET().getTime();

  return {
    nextBatchAtMs: getNextSponsorListingsBatchAtET().getTime(),
    nextMinerBatchAtMs,
    nextDelegationBatchAtMs,
  };
}

export function useLaunchpadStatus(): LaunchpadStatus {
  // An UNLOCKED early-access wallet sends its signed header so the backend
  // returns the per-wallet early `visibleAt`. That flips `isLive` and the
  // available counts up to the pass window before the public 9 AM open, which
  // is what actually reveals the listings early (and lets the countdown's early
  // target line up with a real live state instead of stalling at 00:00:00).
  const earlyAccess = useMinerEarlyAccessSignature();
  const {
    applications: launchpadApplications,
    isLoading: isLaunchpadLoading,
    isError: isLaunchpadError,
  } = useGlowLaunchpad({ earlyAccessHeader: earlyAccess.header });

  const {
    applications: minersApplications,
    isLoading: isMinersLoading,
    isError: isMinersError,
  } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
    earlyAccessHeader: earlyAccess.header,
  });

  const isLoading = isLaunchpadLoading || isMinersLoading;
  const isError = isLaunchpadError || isMinersError;

  const activeDelegationsCount = React.useMemo(
    () => countActiveListings(launchpadApplications),
    [launchpadApplications]
  );
  const activeMinersCount = React.useMemo(
    () => countActiveListings(minersApplications),
    [minersApplications]
  );
  const activeFarmsCount = React.useMemo(
    () => activeDelegationsCount + activeMinersCount,
    [activeDelegationsCount, activeMinersCount]
  );

  const isLive = activeFarmsCount > 0;

  const [batchSchedule, setBatchSchedule] = React.useState<LaunchpadBatchSchedule>(
    () => {
      try {
        return getLaunchpadBatchSchedule();
      } catch {
        const nowMs = Date.now();
        return {
          nextBatchAtMs: nowMs,
          nextMinerBatchAtMs: nowMs,
          nextDelegationBatchAtMs: nowMs,
        };
      }
    }
  );

  const refreshNextBatchAtMs = React.useCallback(() => {
    try {
      setBatchSchedule(getLaunchpadBatchSchedule());
    } catch {
      const nowMs = Date.now();
      setBatchSchedule({
        nextBatchAtMs: nowMs,
        nextMinerBatchAtMs: nowMs,
        nextDelegationBatchAtMs: nowMs,
      });
    }
  }, []);

  return {
    isLive,
    activeFarmsCount,
    activeDelegationsCount,
    activeMinersCount,
    nextBatchAtMs: batchSchedule.nextBatchAtMs,
    nextMinerBatchAtMs: batchSchedule.nextMinerBatchAtMs,
    nextDelegationBatchAtMs: batchSchedule.nextDelegationBatchAtMs,
    refreshNextBatchAtMs,
    isLoading,
    isError,
  };
}
