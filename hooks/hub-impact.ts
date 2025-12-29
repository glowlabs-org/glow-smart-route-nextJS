"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { hubGet } from "@/lib/api/hub-client";

export interface ImpactWeekRange {
  startWeek: number;
  endWeek: number;
}

export interface ImpactGlowScoreComposition {
  steeringPoints: string;
  inflationPoints: string;
  worthPoints: string;
  vaultPoints: string;
}

export interface ImpactGlowScoreLeaderboardRow {
  walletAddress: string;
  totalPoints: string;
  glowWorthWei: string;
  composition?: ImpactGlowScoreComposition;
  lastWeekPoints?: string;
  activeMultiplier?: boolean;
  endWeekMultiplier?: number;
}

export interface ImpactGlowScoreLeaderboardResponse {
  weekRange: ImpactWeekRange;
  limit: number;
  wallets: ImpactGlowScoreLeaderboardRow[];
  totalWalletCount?: number;
}

export interface ImpactGlowScoreTotals {
  totalPoints: string;
  rolloverPoints?: string;
  continuousPoints?: string;
  inflationPoints?: string;
  steeringPoints?: string;
  vaultBonusPoints?: string;
}

export interface ImpactGlowScoreProjection {
  weekNumber: number;
  hasMinerMultiplier: boolean;
  hasSteeringStake: boolean;
  impactStreakWeeks?: number;
  baseMultiplier?: number;
  streakBonusMultiplier?: number;
  totalMultiplier?: number;
  projectedPoints: {
    steeringGlwWei: string;
    inflationGlwWei: string;
    delegatedGlwWei: string;
    glowWorthWei: string;
    totalProjectedScore: string;
  };
}

export interface ImpactGlowWorthResponse {
  glowWorthWei: string;
}

export interface ImpactGlowScoreWeeklyRow {
  weekNumber: number;
  inflationGlwWei: string;
  steeringGlwWei: string;
  delegatedActiveGlwWei: string;
  protocolDepositRecoveredGlwWei?: string;
  inflationPoints: string;
  steeringPoints: string;
  vaultBonusPoints: string;
  rolloverPointsPreMultiplier?: string;
  rolloverMultiplier?: number;
  rolloverPoints: string;
  glowWorthGlwWei?: string;
  continuousPoints: string;
  totalPoints?: string;
  hasCashMinerBonus: boolean;
  baseMultiplier?: number;
  streakBonusMultiplier?: number;
  impactStreakWeeks?: number;
}

export interface ImpactGlowScoreResponse {
  walletAddress: string;
  weekRange: ImpactWeekRange;
  totals: ImpactGlowScoreTotals;
  composition?: ImpactGlowScoreComposition;
  lastWeekPoints?: string;
  activeMultiplier?: boolean;
  currentWeekProjection?: ImpactGlowScoreProjection;
  glowWorth?: ImpactGlowWorthResponse;
  weekly?: ImpactGlowScoreWeeklyRow[];
}

export interface UseImpactLeaderboardQueryArgs {
  enabled?: boolean;
}

export function useImpactLeaderboardQuery(
  args: UseImpactLeaderboardQueryArgs = {}
) {
  const { enabled = true } = args;

  return useQuery({
    queryKey: ["impact-leaderboard"] as const,
    enabled,
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<ImpactGlowScoreLeaderboardResponse> => {
      try {
        return await hubGet<ImpactGlowScoreLeaderboardResponse>(
          "/impact/glow-score"
        );
      } catch (error) {
        toast.error("Failed to load Impact leaderboard", {
          description: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  });
}

export function getImpactScoreQueryKey(args: {
  walletAddress: string | null | undefined;
  weekRange: ImpactWeekRange | null | undefined;
}) {
  const normalizedWalletAddress = args.walletAddress?.toLowerCase() ?? null;
  return [
    "impact-score-breakdown",
    normalizedWalletAddress,
    args.weekRange?.startWeek,
    args.weekRange?.endWeek,
  ] as const;
}

export interface UseImpactScoreQueryArgs {
  walletAddress: string | null | undefined;
  weekRange: ImpactWeekRange | null | undefined;
  enabled?: boolean;
  toastTitle?: string;
}

export function useImpactScoreQuery(args: UseImpactScoreQueryArgs) {
  const {
    walletAddress,
    weekRange,
    enabled = true,
    toastTitle = "Failed to load Impact Score",
  } = args;

  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;

  return useQuery({
    queryKey: getImpactScoreQueryKey({ walletAddress, weekRange }),
    enabled: Boolean(enabled && normalizedWalletAddress && weekRange),
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<ImpactGlowScoreResponse> => {
      try {
        if (!normalizedWalletAddress) throw new Error("Missing wallet address");
        if (!weekRange) throw new Error("Missing week range");

        return await hubGet<ImpactGlowScoreResponse>("/impact/glow-score", {
          params: {
            walletAddress: normalizedWalletAddress,
            startWeek: weekRange.startWeek,
            endWeek: weekRange.endWeek,
          },
        });
      } catch (error) {
        toast.error(toastTitle, {
          description: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  });
}
