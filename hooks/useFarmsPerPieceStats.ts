"use client";

import { useQuery } from "@tanstack/react-query";

export interface RewardAmount {
  lastWeek: string;
  allWeeks: string;
}

export interface RewardsPerPiece {
  total: RewardAmount;
  inflation: RewardAmount;
  protocolDeposit: RewardAmount;
}

export interface ROI {
  lastWeek: string;
  allWeeks: string;
}

export interface WeeklyBreakdown {
  weekNumber: number;
  inflationRewards: string;
  protocolDepositRewards: string;
  protocolDepositAsset: string | null;
  totalRewards: string;
}

export interface FarmPerPieceStats {
  farmId: string;
  appId: string;
  farmName: string | null;
  fractionTypes: ("launchpad" | "mining-center")[];
  delegator: {
    filledListings: number;
    stepsSold: number;
    weightedPieceSizeGlw: string;
    weeksEarned: number;
    weeksLeft: number;
    rewardsPerPiece: RewardsPerPiece;
    roi: ROI;
    weeklyBreakdown: WeeklyBreakdown[];
  };
  miner: {
    filledListings: number;
    stepsSold: number;
    weightedPiecePriceUsdc: string;
    weeksEarned: number;
    weeksLeft: number;
    rewardsPerPiece: RewardsPerPiece;
    roi: ROI;
    weeklyBreakdown: WeeklyBreakdown[];
  };
  participants: {
    uniqueDelegators: number;
    uniqueMiners: number;
  };
}

export interface FarmsPerPieceStatsResponse {
  weekRange: {
    startWeek: number;
    endWeek: number;
  };
  farms: FarmPerPieceStats[];
}

export interface UseFarmsPerPieceStatsParams {
  farmId?: string;
  startWeek?: number;
  endWeek?: number;
  enabled?: boolean;
}

export function useFarmsPerPieceStats({
  farmId,
  startWeek,
  endWeek,
  enabled = true,
}: UseFarmsPerPieceStatsParams = {}) {
  const queryKey = ["farms-per-piece-stats", farmId, startWeek, endWeek];

  const query = useQuery<FarmsPerPieceStatsResponse>({
    queryKey,
    enabled,
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (farmId) {
        searchParams.append("farmId", farmId);
      }
      if (startWeek !== undefined) {
        searchParams.append("startWeek", startWeek.toString());
      }
      if (endWeek !== undefined) {
        searchParams.append("endWeek", endWeek.toString());
      }

      const url = `/api/farms-per-piece-stats?${searchParams.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch farms per-piece stats: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      return data as FarmsPerPieceStatsResponse;
    },
    staleTime: 60 * 60 * 1000,
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
