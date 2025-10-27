"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import Decimal from "decimal.js";
import {
  WalletsRouter,
  DECIMALS_BY_TOKEN,
  type WeeklyReward,
  type WalletWeeklyRewardsResponse,
} from "@glowlabs-org/utils/browser";
import { getCurrentEpoch } from "@/utils/getCurrentEpoch";

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL;

if (!CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

// Initialize Wallets Router
const walletsRouter = WalletsRouter(CONTROL_API_URL);

// Query key
const QUERY_KEY = {
  walletRewards: (wallet?: string) => ["wallet-rewards", wallet] as const,
};

export interface ClaimableReward {
  week: number;
  currency: string;
  amount: string;
  amountRaw: string;
  type: "glowInflation" | "protocolDeposit";
}

export interface WeeklyClaimableRewards {
  week: number;
  rewards: ClaimableReward[];
  totalGlw: string;
  totalProtocolDeposit: Map<string, string>;
  isFinalized: boolean;
  weeksUntilClaimable: number;
}

export interface AggregatedTotals {
  [currency: string]: string;
}

export interface UseClaimableRewardsResult {
  aggregatedTotals: AggregatedTotals;
  weeklyBreakdown: WeeklyClaimableRewards[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useClaimableRewards(
  walletAddress?: string
): UseClaimableRewardsResult {
  const currentEpoch = getCurrentEpoch();
  const glwFinalizedThresholdWeek = currentEpoch - 3; // GLW inflation finalized at week <= currentEpoch - 3
  const pdFinalizedThresholdWeek = currentEpoch - 4; // Protocol deposits have 4-day lag, finalized at week <= currentEpoch - 4
  const endWeek = currentEpoch - 1; // include weeks posted but not finalized yet

  const {
    data: rewardsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY.walletRewards(walletAddress),
    queryFn: async () => {
      if (!walletAddress) throw new Error("No wallet address");

      // Fetch all rewards up to the claimable week
      const response = await walletsRouter.fetchWalletWeeklyRewards(
        walletAddress,
        {
          endWeek,
          limit: 100, // Get up to 100 weeks of history
        }
      );
      return response;
    },
    enabled: !!walletAddress,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Process the rewards data
  const { aggregatedTotals, weeklyBreakdown } = React.useMemo(() => {
    if (!rewardsData?.rewards || rewardsData.rewards.length === 0) {
      return {
        aggregatedTotals: {},
        weeklyBreakdown: [],
      };
    }

    const totals: AggregatedTotals = {};
    const weeklyMap = new Map<number, WeeklyClaimableRewards>();

    // Process each reward
    rewardsData.rewards.forEach((reward: WeeklyReward) => {
      // Only include rewards that are claimable (finalized)
      // Also exclude weeks before v2 launch (week 97)
      if (reward.weekNumber > endWeek || reward.weekNumber < 97) {
        return;
      }

      const weekData = weeklyMap.get(reward.weekNumber) || {
        week: reward.weekNumber,
        rewards: [],
        totalGlw: "0",
        totalProtocolDeposit: new Map<string, string>(),
        isFinalized: false,
        weeksUntilClaimable: 0,
      };

      // Check if both GLW and PD are finalized for this week
      const isGlwFinalized = reward.weekNumber <= glwFinalizedThresholdWeek;
      const isPdFinalized = reward.weekNumber <= pdFinalizedThresholdWeek;

      // Process GLW inflation rewards
      if (reward.glowInflationTotal && reward.glowInflationTotal !== "0") {
        const glwAmount = formatUnits(
          BigInt(reward.glowInflationTotal),
          DECIMALS_BY_TOKEN.GLW
        );

        weekData.rewards.push({
          week: reward.weekNumber,
          currency: "GLW",
          amount: glwAmount,
          amountRaw: reward.glowInflationTotal,
          type: "glowInflation",
        });

        // Update weekly GLW total
        weekData.totalGlw = new Decimal(weekData.totalGlw)
          .plus(glwAmount)
          .toString();

        // Update aggregated GLW total (only when both GLW and PD are finalized)
        if (isGlwFinalized && isPdFinalized) {
          totals.GLW = new Decimal(totals.GLW || "0")
            .plus(glwAmount)
            .toString();
        }
      }

      // Process protocol deposit rewards
      if (
        reward.protocolDepositRewardsReceived &&
        reward.protocolDepositRewardsReceived !== "0"
      ) {
        const currency = reward.paymentCurrency;
        const decimals =
          DECIMALS_BY_TOKEN[currency as keyof typeof DECIMALS_BY_TOKEN] || 18;
        const pdAmount = formatUnits(
          BigInt(reward.protocolDepositRewardsReceived),
          decimals
        );

        weekData.rewards.push({
          week: reward.weekNumber,
          currency,
          amount: pdAmount,
          amountRaw: reward.protocolDepositRewardsReceived,
          type: "protocolDeposit",
        });

        // Update weekly protocol deposit total for this currency
        const currentPdTotal =
          weekData.totalProtocolDeposit.get(currency) || "0";
        weekData.totalProtocolDeposit.set(
          currency,
          new Decimal(currentPdTotal).plus(pdAmount).toString()
        );

        // Update aggregated total for this currency (only when both GLW and PD are finalized)
        if (isGlwFinalized && isPdFinalized) {
          totals[currency] = new Decimal(totals[currency] || "0")
            .plus(pdAmount)
            .toString();
        }
      }

      weeklyMap.set(reward.weekNumber, weekData);
    });

    // Convert map to sorted array (most recent week first)
    const weeklyBreakdown = Array.from(weeklyMap.values())
      .map((entry) => ({
        ...entry,
        // A week is only finalized when BOTH GLW and PD are finalized
        isFinalized:
          entry.week <= glwFinalizedThresholdWeek &&
          entry.week <= pdFinalizedThresholdWeek,
        // Show weeks until claimable based on the later finalization (PD)
        weeksUntilClaimable: Math.max(0, entry.week - pdFinalizedThresholdWeek),
      }))
      .sort((a, b) => b.week - a.week);

    return {
      aggregatedTotals: totals,
      weeklyBreakdown,
    };
  }, [
    rewardsData,
    glwFinalizedThresholdWeek,
    pdFinalizedThresholdWeek,
    endWeek,
  ]);

  return {
    aggregatedTotals,
    weeklyBreakdown,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
