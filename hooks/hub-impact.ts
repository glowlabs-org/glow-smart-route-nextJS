"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { hubGet } from "@/lib/api/hub-client";
import { QUERY_KEYS } from "@/hooks/query-keys";

export interface ImpactWeekRange {
  startWeek: number;
  endWeek: number;
}

export interface ImpactGlowScoreComposition {
  steeringPoints: string;
  inflationPoints: string;
  worthPoints: string;
  vaultPoints: string;
  referralPoints?: string;
  referralBonusPoints?: string;
}

export interface ImpactGlowScoreLeaderboardRow {
  walletAddress: string;
  totalPoints: string;
  glowWorthWei: string;
  composition?: ImpactGlowScoreComposition;
  lastWeekPoints?: string;
  activeMultiplier?: boolean;
  hasMinerMultiplier?: boolean;
  hasSteeringStake?: boolean;
  hasVaultBonus?: boolean;
  endWeekMultiplier?: number;
  globalRank?: number;
}

export interface ImpactGlowScoreLeaderboardResponse {
  weekRange: ImpactWeekRange;
  limit: number;
  wallets: (
    | ImpactGlowScoreLeaderboardRow
    | { isSystemRow: true; globalRegionTotals?: Record<string, string> }
  )[];
  totalWalletCount?: number;
}

export interface ImpactGlowScoreTotals {
  totalPoints: string;
  rolloverPoints?: string;
  continuousPoints?: string;
  inflationPoints?: string;
  steeringPoints?: string;
  vaultBonusPoints?: string;
  totalInflationGlwWei?: string;
  totalSteeringGlwWei?: string;
  basePointsPreMultiplierScaled6?: string;
}

export interface ImpactGlowScoreProjection {
  weekNumber: number;
  hasMinerMultiplier: boolean;
  hasSteeringStake: boolean;
  impactStreakWeeks?: number;
  baseMultiplier?: number;
  streakBonusMultiplier?: number;
  totalMultiplier?: number;
  streakAsOfPreviousWeek?: number;
  hasImpactActionThisWeek?: boolean;
  projectedPoints: {
    steeringGlwWei: string;
    inflationGlwWei: string;
    delegatedGlwWei: string;
    glowWorthWei: string;
    basePointsPreMultiplierScaled6?: string;
    totalProjectedScore: string;
  };
}

export interface ImpactGlowWorthResponse {
  walletAddress: string;
  liquidGlwWei: string;
  delegatedActiveGlwWei: string;
  pendingRecoveredGlwWei?: string;
  unclaimedGlwRewardsWei: string;
  glowWorthWei: string;
  dataSources?: {
    liquidGlw?: string;
    delegatedActiveGlw?: string;
    pendingRecoveredGlw?: string;
    unclaimedGlwRewards?: string;
  };
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

export interface RegionBreakdown {
  regionId: number;
  directPoints: string;
  glowWorthPoints: string;
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
  regionBreakdown?: RegionBreakdown[];
  referral?: {
    asReferrer?: {
      totalPointsEarnedScaled6: string;
      thisWeekPointsScaled6: string;
      activeRefereeCount: number;
      pendingRefereeCount: number;
      currentTier: {
        name: "Aurora" | "Solaris" | "Zenith" | "Eclipse Prime";
        percent: number;
      };
      nextTier?: {
        name: string;
        referralsNeeded: number;
        percent: number;
      };
    };
    asReferee?: {
      referrerWallet: string;
      referrerEns?: string;
      bonusIsActive: boolean;
      bonusEndsAt?: string;
      bonusWeeksRemaining?: number;
      bonusPointsThisWeekScaled6: string;
      bonusPointsProjectedScaled6?: string;
      lifetimeBonusPointsScaled6: string;
      activationBonus: {
        awarded: boolean;
        awardedAt?: string;
        pending?: boolean;
        pointsAwarded: number;
      };
    };
  };
}

export interface UseImpactLeaderboardQueryArgs {
  enabled?: boolean;
  limit?: number;
  sort?: "totalPoints" | "lastWeekPoints" | "glowWorth";
  dir?: "asc" | "desc";
}

export interface ImpactWalletStatsResponse {
  weekRange: ImpactWeekRange;
  totalWallets: number;
  delegators: number;
  miners: number;
  delegationWeek: number;
}

async function fetchImpactApi<T>(params: {
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
}): Promise<T> {
  const url = new URL(params.path, window.location.origin);

  for (const [key, value] of Object.entries(params.query || {})) {
    if (value === null || value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
    ) {
      throw new Error((payload as { error: string }).error);
    }

    throw new Error(
      typeof payload === "string"
        ? payload
        : `Request failed (${response.status})`
    );
  }

  return payload as T;
}

export function useImpactLeaderboardQuery(
  args: UseImpactLeaderboardQueryArgs = {}
) {
  const { enabled = true, limit, sort, dir } = args;

  return useQuery({
    queryKey: [
      "impact-leaderboard",
      limit ?? null,
      sort ?? null,
      dir ?? null,
    ] as const,
    enabled,
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<ImpactGlowScoreLeaderboardResponse> => {
      try {
        return await fetchImpactApi<ImpactGlowScoreLeaderboardResponse>({
          path: "/api/impact/glow-score",
          query: {
            limit: limit ?? undefined,
            sort: sort ?? undefined,
            dir: dir ?? undefined,
          },
        });
      } catch (error) {
        toast.error("Failed to load Impact leaderboard", {
          description: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  });
}

export function useImpactWalletStats(args: { enabled?: boolean } = {}) {
  const { enabled = true } = args;

  return useQuery({
    queryKey: QUERY_KEYS.impact.walletStats(),
    enabled,
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<ImpactWalletStatsResponse> => {
      try {
        return await fetchImpactApi<ImpactWalletStatsResponse>({
          path: "/api/impact/wallet-stats",
        });
      } catch (error) {
        toast.error("Failed to load wallet stats", {
          description: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  });
}

export interface ImpactNewWalletsByWeekResponse {
  weekRange: ImpactWeekRange;
  byWeek: Record<number, number>;
}

export function useImpactNewWalletsByWeek(params: {
  startWeek?: number;
  endWeek?: number;
  enabled?: boolean;
} = {}) {
  const { startWeek, endWeek, enabled = true } = params;

  return useQuery({
    queryKey: QUERY_KEYS.impact.newWalletsByWeek(startWeek, endWeek),
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ImpactNewWalletsByWeekResponse> => {
      return await hubGet<ImpactNewWalletsByWeekResponse>(
        "/impact/new-wallets-by-week",
        {
          params: {
            startWeek: startWeek ?? undefined,
            endWeek: endWeek ?? undefined,
          },
        }
      );
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
  includeWeekly?: boolean;
  includeProjection?: boolean;
  includeReferral?: boolean;
  summaryOnly?: boolean;
}

export function useImpactScoreQuery(args: UseImpactScoreQueryArgs) {
  const {
    walletAddress,
    weekRange,
    enabled = true,
    toastTitle = "Failed to load Impact Score",
    includeWeekly = false,
    includeProjection = true,
    includeReferral = true,
    summaryOnly = false,
  } = args;

  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;

  return useQuery({
    queryKey: [
      ...getImpactScoreQueryKey({ walletAddress, weekRange }),
      includeWeekly ? "weekly" : "no-weekly",
      includeProjection ? "projection" : "no-projection",
      includeReferral ? "referral" : "no-referral",
      summaryOnly ? "summary-only" : "full",
    ],
    enabled: Boolean(enabled && normalizedWalletAddress && weekRange),
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<ImpactGlowScoreResponse> => {
      try {
        if (!normalizedWalletAddress) throw new Error("Missing wallet address");
        if (!weekRange) throw new Error("Missing week range");

        return await fetchImpactApi<ImpactGlowScoreResponse>({
          path: "/api/impact/glow-score",
          query: {
            walletAddress: normalizedWalletAddress,
            startWeek: weekRange.startWeek,
            endWeek: weekRange.endWeek,
            includeWeekly: includeWeekly ? "1" : "0",
            includeProjection: includeProjection ? "1" : "0",
            includeReferral: includeReferral ? "1" : "0",
            summaryOnly: summaryOnly ? "1" : undefined,
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

export function getImpactGlowWorthQueryKey(args: {
  walletAddress: string | null | undefined;
  weekRange: ImpactWeekRange | null | undefined;
}) {
  const normalizedWalletAddress = args.walletAddress?.toLowerCase() ?? null;
  return [
    "impact-glow-worth",
    normalizedWalletAddress,
    args.weekRange?.startWeek,
    args.weekRange?.endWeek,
  ] as const;
}

export interface UseImpactGlowWorthQueryArgs {
  walletAddress: string | null | undefined;
  weekRange: ImpactWeekRange | null | undefined;
  enabled?: boolean;
  toastTitle?: string;
}

export function useImpactGlowWorthQuery(args: UseImpactGlowWorthQueryArgs) {
  const {
    walletAddress,
    weekRange,
    enabled = true,
    toastTitle = "Failed to load Glow Worth",
  } = args;

  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;

  return useQuery({
    queryKey: getImpactGlowWorthQueryKey({ walletAddress, weekRange }),
    enabled: Boolean(enabled && normalizedWalletAddress && weekRange),
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<ImpactGlowWorthResponse> => {
      try {
        if (!normalizedWalletAddress) throw new Error("Missing wallet address");
        if (!weekRange) throw new Error("Missing week range");

        return await fetchImpactApi<ImpactGlowWorthResponse>({
          path: "/api/impact/glow-worth",
          query: {
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
