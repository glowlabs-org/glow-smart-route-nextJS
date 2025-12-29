"use client";

import React from "react";

import { useSplitsActivity } from "@/hooks";
import { useWalletSwaps, type SwapEvent } from "@/hooks/useWalletSwaps";

export interface SwapActivity {
  txHash?: string;
  timestampMs: number;
  glwIn: number;
  glwOut: number;
  usdgIn: number;
  usdgOut: number;
}

export interface UseRecentActivityFeedResult {
  splitsActivity: ReturnType<typeof useSplitsActivity>["activity"];
  swapsActivity: SwapActivity[];
  isSplitsActivityLoading: boolean;
  isSwapsActivityLoading: boolean;
}

function toSwapActivity(swap: SwapEvent): SwapActivity {
  return {
    txHash: swap.txHash,
    timestampMs: swap.timestamp,
    glwIn: swap.glwIn,
    glwOut: swap.glwOut,
    usdgIn: swap.usdgIn,
    usdgOut: swap.usdgOut,
  };
}

export function useRecentActivityFeed(
  walletAddress?: string
): UseRecentActivityFeedResult {
  const hasWallet = Boolean(walletAddress);

  const { activity: splitsActivity, isLoading: isSplitsActivityLoading } =
    useSplitsActivity({
      walletAddress,
      enabled: hasWallet,
      limit: 50,
    });

  const { swaps, isLoading: isSwapsActivityLoading } =
    useWalletSwaps(walletAddress);

  const swapsActivity = React.useMemo(() => {
    return swaps.map(toSwapActivity);
  }, [swaps]);

  return {
    splitsActivity,
    swapsActivity,
    isSplitsActivityLoading,
    isSwapsActivityLoading,
  };
}
