"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

if (!HUB_URL) {
  throw new Error("NEXT_PUBLIC_HUB_URL is not set");
}

export interface WalletActivity {
  walletAddress: string;
  glwDelegated: string;
  usdcSpentOnMiners: string;
  glwDelegatedAfterRange: string;
  usdcSpentAfterRange: string;
  delegatorRewardsEarned: string;
  minerRewardsEarned: string;
  totalRewardsEarned: string;
}

export interface WalletsActivityResponse {
  weekRange: {
    startWeek: number;
    endWeek: number;
  };
  summary: {
    totalWallets: number;
    returnedWallets: number;
  };
  wallets: WalletActivity[];
}

export interface UseWalletsActivityParams {
  type?: "delegator" | "miner";
  sortBy?:
    | "glwDelegated"
    | "usdcSpentOnMiners"
    | "delegatorRewardsEarned"
    | "minerRewardsEarned"
    | "totalRewardsEarned";
  limit?: number;
  enabled?: boolean;
}

export function useWalletsActivity({
  type = "delegator",
  sortBy = "totalRewardsEarned",
  limit = 100,
  enabled = true,
}: UseWalletsActivityParams = {}) {
  const queryKey = ["wallets-activity", type, sortBy, limit];

  const query = useQuery<WalletsActivityResponse>({
    queryKey,
    enabled,
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (type) {
        searchParams.append("type", type);
      }
      if (sortBy) {
        searchParams.append("sortBy", sortBy);
      }
      if (limit) {
        searchParams.append("limit", limit.toString());
      }

      const url = `${HUB_URL}/fractions/wallets/activity?${searchParams.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch wallets activity: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      return data as WalletsActivityResponse;
    },
    staleTime: 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function formatGLW(value: string): string {
  try {
    const num = Number(value) / 1e18;
    if (num >= 1000) {
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    }
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
    if (num >= 1000) {
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    }
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0.00";
  }
}

export interface FarmActivity {
  farmId: string;
  farmName: string | null;
  delegatorRewardsDistributed: string;
  minerRewardsDistributed: string;
  totalRewardsDistributed: string;
  uniqueDelegators: number;
  uniqueMiners: number;
  totalUniqueParticipants: number;
}

export interface FarmsActivityResponse {
  weekRange: {
    startWeek: number;
    endWeek: number;
  };
  summary: {
    totalFarms: number;
    returnedFarms: number;
  };
  farms: FarmActivity[];
}

export interface UseFarmsActivityParams {
  type?: "delegator" | "miner" | "both";
  sortBy?:
    | "delegatorRewardsDistributed"
    | "minerRewardsDistributed"
    | "totalRewardsDistributed";
  limit?: number;
  enabled?: boolean;
}

export function useFarmsActivity({
  type = "both",
  sortBy = "totalRewardsDistributed",
  limit = 50,
  enabled = true,
}: UseFarmsActivityParams = {}) {
  const queryKey = ["farms-activity", type, sortBy, limit];

  const query = useQuery<FarmsActivityResponse>({
    queryKey,
    enabled,
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (type && type !== "both") {
        searchParams.append("type", type);
      }
      if (sortBy) {
        searchParams.append("sortBy", sortBy);
      }
      if (limit) {
        searchParams.append("limit", limit.toString());
      }

      const url = `${HUB_URL}/fractions/farms/activity?${searchParams.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch farms activity: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      return data as FarmsActivityResponse;
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
