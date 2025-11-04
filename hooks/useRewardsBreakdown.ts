"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

if (!HUB_URL) {
  throw new Error("NEXT_PUBLIC_HUB_URL is not set");
}

export interface RewardsBreakdownResponse {
  type: "wallet";
  walletAddress: string;
  farms: string[];
  farmStatistics: {
    totalFarms: number;
    delegatorOnlyFarms: number;
    minerOnlyFarms: number;
    bothTypesFarms: number;
  };
  totals: {
    totalGlwDelegated: string;
    totalUsdcSpentByMiners: string;
  };
  weekRange: {
    startWeek: number;
    endWeek: number;
  };
  rewards: {
    delegator: {
      lastWeek: string;
      allWeeks: string;
    };
    miner: {
      lastWeek: string;
      allWeeks: string;
    };
  };
  apy: {
    delegatorApyPercent: string;
    minerApyPercent: string;
  };
  delegatedAfterWeekRange: {
    totalGlwDelegatedAfter: string;
    totalUsdcSpentAfter: string;
  };
  farmDetails: Array<{
    farmId: string;
    type: "launchpad" | "mining-center";
    amountInvested: string;
    firstWeekWithRewards: number;
    totalWeeksEarned: number;
    totalEarnedSoFar: string;
    totalInflationRewards: string;
    totalProtocolDepositRewards: string;
    lastWeekRewards: string;
    apy: string;
  }>;
}

export interface UseRewardsBreakdownParams {
  walletAddress?: string | null;
  farmId?: string | null;
  startWeek?: number;
  endWeek?: number;
  enabled?: boolean;
}

export function useRewardsBreakdown(params: UseRewardsBreakdownParams = {}) {
  const { walletAddress, farmId, startWeek, endWeek, enabled = true } = params;

  const queryKey = [
    "rewards-breakdown",
    walletAddress,
    farmId,
    startWeek,
    endWeek,
  ];

  const query = useQuery<RewardsBreakdownResponse | null>({
    queryKey,
    enabled: enabled && (Boolean(walletAddress) || Boolean(farmId)),
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (walletAddress) {
        searchParams.append("walletAddress", walletAddress);
      }
      if (farmId) {
        searchParams.append("farmId", farmId);
      }
      if (startWeek !== undefined) {
        searchParams.append("startWeek", startWeek.toString());
      }
      if (endWeek !== undefined) {
        searchParams.append("endWeek", endWeek.toString());
      }

      const url = `${HUB_URL}/fractions/rewards-breakdown?${searchParams.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch rewards breakdown: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      return data as RewardsBreakdownResponse;
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function formatGLW(value: string): string {
  try {
    const num = Number(value) / 1e18;
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0.00";
  }
}

export function formatUSDC(value: string): string {
  try {
    const num = Number(value) / 1e6;
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0.00";
  }
}

export function formatAPY(value: string): string {
  const rounded = Math.round(Number(value));
  return `${rounded}%`;
}
