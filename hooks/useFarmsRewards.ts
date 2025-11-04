"use client";

import { useQuery } from "@tanstack/react-query";
import { FarmsRouter } from "@glowlabs-org/utils/browser";
import type {
  FarmWeeklyRewardsResponse,
  FarmWeeklyRewardsQuery,
  FarmEfficiencyScore,
} from "@glowlabs-org/utils/browser";

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL;

if (!CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

const farmsRouter = FarmsRouter(CONTROL_API_URL);

interface UseFarmWeeklyRewardsParams {
  farmId: string;
  startWeek?: number;
  endWeek?: number;
  paymentCurrency?: string;
  limit?: number;
  enabled?: boolean;
}

export function useFarmWeeklyRewards({
  farmId,
  startWeek,
  endWeek,
  paymentCurrency,
  limit,
  enabled = true,
}: UseFarmWeeklyRewardsParams) {
  const queryKey = [
    "farm-weekly-rewards",
    farmId,
    startWeek,
    endWeek,
    paymentCurrency,
    limit,
  ];

  const query = useQuery<FarmWeeklyRewardsResponse>({
    queryKey,
    enabled: enabled && !!farmId,
    queryFn: async () => {
      if (!farmId) throw new Error("Farm ID is required");

      const queryParams: FarmWeeklyRewardsQuery = {};

      if (startWeek !== undefined) {
        queryParams.startWeek = startWeek;
      }
      if (endWeek !== undefined) {
        queryParams.endWeek = endWeek;
      }
      if (paymentCurrency) {
        queryParams.paymentCurrency = paymentCurrency as any;
      }
      if (limit !== undefined) {
        queryParams.limit = limit;
      }

      try {
        const data = await farmsRouter.fetchFarmWeeklyRewards(
          farmId,
          queryParams
        );
        return data;
      } catch (error) {
        console.error("Error fetching farm weekly rewards:", error);
        throw error;
      }
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

interface UseFarmsEfficiencyScoresParams {
  farmId?: string;
  enabled?: boolean;
}

export function useFarmsEfficiencyScores({
  farmId,
  enabled = true,
}: UseFarmsEfficiencyScoresParams = {}) {
  const queryKey = ["farms-efficiency-scores", farmId];

  const query = useQuery<FarmEfficiencyScore | FarmEfficiencyScore[]>({
    queryKey,
    enabled,
    queryFn: async () => {
      try {
        const data = await farmsRouter.fetchEfficiencyScores(farmId);
        return data;
      } catch (error) {
        console.error("Error fetching farms efficiency scores:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
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

interface UseFarmWeeklyRewardsBatchParams {
  farmIds: string[];
  startWeek?: number;
  endWeek?: number;
  enabled?: boolean;
}

export function useFarmWeeklyRewardsBatch({
  farmIds,
  startWeek,
  endWeek,
  enabled = true,
}: UseFarmWeeklyRewardsBatchParams) {
  const queryKey = ["farm-weekly-rewards-batch", farmIds, startWeek, endWeek];

  const query = useQuery({
    queryKey,
    enabled: enabled && farmIds.length > 0,
    queryFn: async () => {
      if (farmIds.length === 0) return null;

      try {
        const data = await farmsRouter.fetchFarmWeeklyRewardsBatch({
          farmIds,
          startWeek,
          endWeek,
        });
        return data;
      } catch (error) {
        console.error("Error fetching farm weekly rewards batch:", error);
        throw error;
      }
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

export function formatRewardValue(value: string, decimals: number): string {
  try {
    const divisor = Math.pow(10, decimals);
    const num = Number(value) / divisor;
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0.00";
  }
}
