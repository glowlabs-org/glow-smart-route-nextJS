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
import { useQuery } from "@tanstack/react-query";
import { v2ApiGet } from "@/lib/api/v2-api-client";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { STALE_TIMES } from "@/hooks/query-config";

/** Matches the backend's accepted `sort` query values exactly. */
export type V2LeaderboardSort = "totalWatts" | "carbonCredits";
export type V2SortDir = "asc" | "desc";

export interface V2LeaderboardRow {
  rank: number;
  wallet: string;
  totalWatts: string;
  totalCarbonCredits: string;
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
}

export function useV2ImpactLeaderboard(
  options: UseV2ImpactLeaderboardOptions = {},
) {
  const sort = options.sort ?? "totalWatts";
  const dir = options.dir ?? "desc";
  const limit = options.limit ?? 100;
  return useQuery({
    queryKey: QUERY_KEYS.v2.impactLeaderboard(sort, dir, limit),
    queryFn: () =>
      v2ApiGet<V2LeaderboardResponse>(
        `/api/impact/leaderboard?sort=${sort}&dir=${dir}&limit=${limit}`,
      ),
    staleTime: STALE_TIMES.SLOW,
    refetchOnWindowFocus: false,
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
