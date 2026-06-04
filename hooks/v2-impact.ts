"use client";

/**
 * V2 impact hooks — leaderboard and per-wallet impact detail.
 *
 * Impact is separate from points. It ranks total watts (and carbon
 * credits), and is only earned when a farm fully funds. These hit the
 * app-local proxy routes under `/api/impact/*`.
 *
 * All numeric impact fields arrive as decimal STRINGS (scale-12 on the
 * backend) — never parse them with `Number()` for display math that
 * needs precision; format the string directly.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { v2ApiGet } from "@/lib/api/v2-api-client";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { STALE_TIMES } from "@/hooks/query-config";

/**
 * Matches the backend's accepted `sort` query values exactly.
 * `policyCredits` is only valid when a `regionId` filter is supplied.
 */
export type V2LeaderboardSort =
  | "totalWatts"
  | "carbonCredits"
  | "policyCredits";
export type V2SortDir = "asc" | "desc";

export interface V2LeaderboardRow {
  rank: number;
  wallet: string;
  totalWatts: string;
  totalCarbonCredits: string;
  /** Numeric string when the leaderboard is region-scoped, `null` otherwise. */
  totalPolicyCredits: string | null;
}

export interface V2LeaderboardResponse {
  sort: string;
  dir: string;
  regionId: number | null;
  total: number;
  rows: V2LeaderboardRow[];
}

export interface V2WalletFarmImpact {
  farmId: string;
  regionId: number;
  fundedAt: string;
  buckets: {
    delegator: string;
    staker: string;
    delegator_referral: string;
    staker_referral: string;
  };
  wattsTotal: string;
  carbonCredits: string;
  policyCredits: string;
}

export interface V2RegionWatts {
  regionId: number;
  watts: string;
}

export interface V2RegionPolicyCredits {
  regionId: number;
  policyCredits: string;
}

export interface V2WalletImpact {
  wallet: string;
  totalWatts: string;
  totalCarbonCredits: string;
  wattsByRegion: V2RegionWatts[];
  policyCreditsByRegion: V2RegionPolicyCredits[];
  farms: V2WalletFarmImpact[];
  updatedAt: string | null;
}

export interface UseV2ImpactLeaderboardOptions {
  sort?: V2LeaderboardSort;
  dir?: V2SortDir;
  limit?: number;
  offset?: number;
  /** When set, the leaderboard is ranked within that region only. */
  regionId?: number | null;
}

export function useV2ImpactLeaderboard(
  options: UseV2ImpactLeaderboardOptions = {},
) {
  const sort = options.sort ?? "totalWatts";
  const dir = options.dir ?? "desc";
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const regionId = options.regionId ?? null;
  return useQuery({
    queryKey: QUERY_KEYS.v2.impactLeaderboard(sort, dir, limit, regionId, offset),
    queryFn: () => {
      const params = new URLSearchParams({
        sort,
        dir,
        limit: String(limit),
        offset: String(offset),
      });
      if (regionId !== null) params.set("regionId", String(regionId));
      return v2ApiGet<V2LeaderboardResponse>(
        `/api/impact/leaderboard?${params.toString()}`,
      );
    },
    staleTime: STALE_TIMES.SLOW,
    refetchOnWindowFocus: false,
    // Keep the prior page visible while the next page / sort loads.
    placeholderData: keepPreviousData,
  });
}

export function useV2ImpactWallet(wallet: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.v2.impactWallet(wallet),
    queryFn: () =>
      v2ApiGet<V2WalletImpact>(
        `/api/impact/wallet?wallet=${encodeURIComponent(wallet!)}`,
      ),
    enabled: Boolean(wallet),
    staleTime: STALE_TIMES.SLOW,
    refetchOnWindowFocus: false,
  });
}

export interface V2EstimateAllocation {
  farmId: string;
  fractionId: string | null;
  quantity: number;
  fractionTotalUnits: number;
  expectedFarmWattsTotal: number;
  bucket: string;
  bucketShare: number;
  estimatedWattsPerUnit: number;
  estimatedWattsForQuantity: number;
  /**
   * Quote-based GLW-delegation points (the same locked GVE-quote basis the
   * award uses), so the preview equals what gets credited. Null when the
   * fraction has no GLW step or price quote (client keeps its local fallback).
   */
  estimatedUsdPerUnit: number | null;
  estimatedPointsPerUnit: number | null;
  estimatedPointsForQuantity: number | null;
  quotedGlwPriceMicros: string | null;
  pointsBasis: "gve_quote" | null;
  assumptions: Record<string, unknown>;
}

/**
 * Pre-purchase watts-per-unit estimate for a launchpad/mining-center fraction.
 * All funding paths land in the delegator bucket (0.24) by deposit-split share;
 * the value is an upper-bound estimate (see the backend endpoint). `enabled`
 * only when a fractionId is known, so the UI shows a graceful fallback before.
 */
export function useEstimatedAllocation(
  fractionId: string | null | undefined,
  quantity: number,
) {
  const qty = Math.max(1, Math.floor(quantity) || 1);
  return useQuery({
    queryKey: QUERY_KEYS.v2.estimateAllocation(fractionId, qty),
    queryFn: () =>
      v2ApiGet<V2EstimateAllocation>(
        `/api/impact/estimate-allocation?fractionId=${encodeURIComponent(
          fractionId!,
        )}&quantity=${qty}`,
      ),
    enabled: Boolean(fractionId),
    staleTime: STALE_TIMES.SLOW,
    refetchOnWindowFocus: false,
    // Per-unit estimates are quantity-invariant, so hold the previous value
    // while a new quantity refetches instead of flashing the loading state.
    placeholderData: keepPreviousData,
  });
}
