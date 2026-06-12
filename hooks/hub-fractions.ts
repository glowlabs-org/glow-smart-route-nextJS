"use client";

import { useQuery } from "@tanstack/react-query";
import { hubGet } from "@/lib/api/hub-client";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";

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

export function formatAPY(value: string): string {
  const rounded = Math.round(Number(value));
  return `${rounded}%`;
}

export interface YieldPer100Response {
  weekRange: { startWeek: number; endWeek: number };
  metrics: {
    glwPerWeekPer100UsdMiner: string;
    glwPerWeekPer100GlwDelegated: string;
  };
}

export function useYieldPer100(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const query = useQuery<YieldPer100Response>({
    queryKey: QUERY_KEYS.fractions.yieldPer100(),
    enabled,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () =>
      await hubGet<YieldPer100Response>("/fractions/yield-per-100"),
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export interface FractionsSummaryResponse {
  totalGlwDelegated: string;
  totalMiningCenterVolume: string;
  launchpadContributors: number;
  miningCenterContributors: number;
  glwDelegationByEpoch: Record<number, string>;
  walletCountByEpoch?: Record<number, number>;
}

export function useFractionsSummary(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const query = useQuery<FractionsSummaryResponse>({
    queryKey: QUERY_KEYS.fractions.summary(),
    enabled,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchInterval: enabled ? QUERY_CONFIG.DEFAULT.staleTime : false,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () =>
      await hubGet<FractionsSummaryResponse>("/fractions/summary"),
  });

  return {
    summary: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export interface FractionRecord {
  id: string;
  applicationId: string;
  createdBy: string;
  stepPrice: string;
  totalSteps: string;
  splitsSold: string;
  expirationAt: string;
  status: string;
  type: "launchpad" | "mining-center";
  rewardScore: number | null;
  token: string;
  remainingSteps: string;
  remainingValue: string;
}

export interface AvailabilitySummary {
  totalCount: number;
  totalStepsRemaining: string;
  totalValueRemaining: string;
}

export interface FractionsAvailabilityResponse {
  type: "launchpad" | "mining-center";
  summary: AvailabilitySummary;
  fractions: FractionRecord[];
}

export interface FractionsAvailabilityGroupedResponse {
  launchpad: FractionsAvailabilityResponse;
  miningCenter: FractionsAvailabilityResponse;
}

export function useFractionsAvailability(
  params: {
    type?: "launchpad" | "mining-center";
    enabled?: boolean;
  } = {}
) {
  const { type, enabled = true } = params;

  const query = useQuery<
    FractionsAvailabilityResponse | FractionsAvailabilityGroupedResponse
  >({
    queryKey: QUERY_KEYS.fractions.availability(type ?? "all"),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      await hubGet<
        FractionsAvailabilityResponse | FractionsAvailabilityGroupedResponse
      >("/fractions/available", { params: { type } }),
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
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
    weeksWithRewards: number;
  };
  rewards: {
    delegator: { lastWeek: string; allWeeks: string };
    miner: { lastWeek: string; allWeeks: string };
  };
  apy: { delegatorApyPercent: string; minerApyPercent: string };
  delegatedAfterWeekRange: {
    totalGlwDelegatedAfter: string;
    totalUsdcSpentAfter: string;
  };
  recentPurchasesWithoutRewards: Array<{
    farmId: string;
    types: ("launchpad" | "mining-center")[];
  }>;
  farmDetails: Array<{
    farmId: string;
    type: "launchpad" | "mining-center";
    amountInvested: string;
    firstWeekWithRewards: number;
    totalWeeksEarned: number;
    totalEarnedSoFar: string;
    totalInflationRewards: string;
    totalProtocolDepositRewards: string;
    totalProtocolDepositRewardsByAsset?: Record<string, string>;
    lastWeekRewards: string;
    apy: string;
    weeklyBreakdown: Array<{
      weekNumber: number;
      inflationRewards: string;
      protocolDepositRewards: string;
      protocolDepositAsset?: string | null;
      protocolDepositRewardsByAsset?: Record<string, string>;
      totalRewards: string;
    }>;
  }>;
  otherFarmsWithRewards: {
    count: number;
    farms: Array<{
      farmId: string;
      farmName: string | null;
      builtEpoch: number | null;
      weeksLeft: number | null;
      asset: string | null;
      totalInflationRewards: string;
      totalProtocolDepositRewards: string;
      totalRewards: string;
      lastWeekRewards: string;
      weeklyBreakdown: Array<{
        weekNumber: number;
        inflationRewards: string;
        protocolDepositRewards: string;
        protocolDepositAsset?: string | null;
        protocolDepositRewardsByAsset?: Record<string, string>;
        totalRewards: string;
      }>;
    }>;
  };
}

export function useRewardsBreakdown(
  params: {
    walletAddress?: string | null;
    farmId?: string | null;
    startWeek?: number;
    endWeek?: number;
    enabled?: boolean;
  } = {}
) {
  const { walletAddress, farmId, startWeek, endWeek, enabled = true } = params;
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;

  const query = useQuery<RewardsBreakdownResponse | null>({
    queryKey: QUERY_KEYS.fractions.rewardsBreakdown({
      walletAddress: normalizedWalletAddress,
      farmId,
      startWeek,
      endWeek,
    }),
    enabled: enabled && (Boolean(normalizedWalletAddress) || Boolean(farmId)),
    staleTime: QUERY_CONFIG.DEFAULT.staleTime * 2,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () =>
      await hubGet<RewardsBreakdownResponse | null>(
        "/fractions/rewards-breakdown",
        {
          params: {
            walletAddress: normalizedWalletAddress ?? undefined,
            farmId: farmId ?? undefined,
            startWeek,
            endWeek,
          },
          notFound: null,
        }
      ),
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

// --- Wallet reward splits + per-farm V1 (pre-97) rewards ---------------------
// Backs the farms-performance dialog's lifetime totals + real deposit cost for
// V1/V2 farms. The `farmRewards` array in this endpoint only covers the pre-97
// (V1) era and holds FARM totals (2-decimal), so callers scale by the wallet's
// split to get its share. `depositPaid*` is the on-chain protocol deposit the
// wallet actually paid (atomic units, by currency).
export interface WalletRewardSplitFarmReward {
  weekNumber: number;
  glowRewards: string;
  usdgRewards: string;
}

export interface WalletRewardSplitRow {
  id: string;
  walletAddress: string;
  applicationId: string | null;
  glowSplitPercent: string;
  usdgSplitPercent: string;
  depositPaidAmount: string | null;
  depositPaidCurrency: string | null;
  depositPaidTxHash: string | null;
  farm: {
    id: string;
    farmRewards: WalletRewardSplitFarmReward[] | null;
  } | null;
}

export interface WalletRewardSplitsResponse {
  rewardSplits: WalletRewardSplitRow[];
}

export function useWalletRewardSplitsAndFarmRewards(
  params: { walletAddress?: string | null; enabled?: boolean } = {}
) {
  const { walletAddress, enabled = true } = params;
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;

  const query = useQuery<WalletRewardSplitsResponse | null>({
    queryKey: QUERY_KEYS.fractions.walletRewardSplits(normalizedWalletAddress),
    enabled: enabled && Boolean(walletAddress),
    staleTime: QUERY_CONFIG.DEFAULT.staleTime * 2,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () =>
      await hubGet<WalletRewardSplitsResponse | null>(
        "/rewards/wallet-reward-splits-and-farm-rewards",
        {
          params: { wallet: walletAddress ?? undefined },
          notFound: null,
        }
      ),
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
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

  // Optional fields when sourced from `/impact/delegators-leaderboard`
  glwPerWeekWei?: string; // last completed week only
  sharePercent?: string; // percent string (e.g. "13.0")
}

export interface WalletsActivityResponse {
  weekRange: { startWeek: number; endWeek: number };
  summary: { totalWallets: number; returnedWallets: number };
  wallets: WalletActivity[];
}

interface DelegatorsLeaderboardRow {
  rank: number;
  walletAddress: string;
  activelyDelegatedGlwWei: string;
  glwPerWeekWei: string;
  netRewardsWei: string;
  sharePercent: string;
}

interface DelegatorsLeaderboardResponse {
  weekRange: { startWeek: number; endWeek: number };
  limit: number;
  totalWalletCount: number;
  wallets: DelegatorsLeaderboardRow[];
}

export interface TotalActivelyDelegatedResponse {
  weekRange: { startWeek: number; endWeek: number };
  totalGlwDelegatedWei: string;
  totalWallets: number;
  averageDelegatorApy?: string | null;
  apyWeekRange?: { startWeek: number; endWeek: number } | null;
}

export function useTotalActivelyDelegated(
  options: { enabled?: boolean; includeApy?: boolean } = {}
) {
  const { enabled = true, includeApy = false } = options;
  const queryParam = includeApy ? "?includeApy=true" : "";

  const query = useQuery<TotalActivelyDelegatedResponse>({
    queryKey: QUERY_KEYS.fractions.totalActivelyDelegated(includeApy),
    enabled,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () => {
      const res = await fetch(`/api/fractions/total-actively-delegated${queryParam}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to load total actively delegated (${res.status}) - ${text}`
        );
      }
      return (await res.json()) as TotalActivelyDelegatedResponse;
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export interface ActivelyDelegatedByWeekResponse {
  weekRange: { startWeek: number; endWeek: number };
  byWeek: Record<number, string>;
}

export function useActivelyDelegatedByWeek(
  params: {
    startWeek?: number;
    endWeek?: number;
    enabled?: boolean;
  } = {}
) {
  const { startWeek, endWeek, enabled = true } = params;

  const query = useQuery<ActivelyDelegatedByWeekResponse>({
    queryKey: QUERY_KEYS.fractions.activelyDelegatedByWeek(startWeek, endWeek),
    enabled,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime * 2,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () => {
      const search = new URLSearchParams();
      if (typeof startWeek === "number" && Number.isFinite(startWeek)) {
        search.set("startWeek", String(startWeek));
      }
      if (typeof endWeek === "number" && Number.isFinite(endWeek)) {
        search.set("endWeek", String(endWeek));
      }

      const query = search.toString();
      const path = query
        ? `/api/fractions/actively-delegated-by-week?${query}`
        : "/api/fractions/actively-delegated-by-week";

      const res = await fetch(path);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to load actively delegated by week (${res.status}) - ${text}`
        );
      }
      return (await res.json()) as ActivelyDelegatedByWeekResponse;
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export function useWalletsActivity(
  params: {
    type?: "delegator" | "miner";
    sortBy?:
      | "glwDelegated"
      | "usdcSpentOnMiners"
      | "delegatorRewardsEarned"
      | "minerRewardsEarned"
      | "totalRewardsEarned";
    limit?: number;
    enabled?: boolean;
  } = {}
) {
  const {
    type = "delegator",
    sortBy = "totalRewardsEarned",
    limit = 100,
    enabled = true,
  } = params;

  const query = useQuery<WalletsActivityResponse>({
    queryKey: ["wallets-activity", type, sortBy, limit] as const,
    enabled,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () => {
      if (type === "delegator") {
        const leaderboard = await hubGet<DelegatorsLeaderboardResponse>(
          "/impact/delegators-leaderboard",
          {
            params: {
              limit,
            },
          }
        );

        return {
          weekRange: leaderboard.weekRange,
          summary: {
            totalWallets: leaderboard.totalWalletCount,
            returnedWallets: leaderboard.wallets.length,
          },
          wallets: leaderboard.wallets.map((w) => ({
            walletAddress: w.walletAddress,
            glwDelegated: w.activelyDelegatedGlwWei,
            usdcSpentOnMiners: "0",
            glwDelegatedAfterRange: "0",
            usdcSpentAfterRange: "0",
            delegatorRewardsEarned: w.netRewardsWei,
            minerRewardsEarned: "0",
            totalRewardsEarned: w.netRewardsWei,
            glwPerWeekWei: w.glwPerWeekWei,
            sharePercent: w.sharePercent,
          })),
        };
      }

      return await hubGet<WalletsActivityResponse>(
        "/fractions/wallets/activity",
        {
          params: { type, sortBy, limit },
        }
      );
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
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
  weekRange: { startWeek: number; endWeek: number };
  summary: { totalFarms: number; returnedFarms: number };
  farms: FarmActivity[];
}

export function useFarmsActivity(
  params: {
    type?: "delegator" | "miner" | "both";
    sortBy?:
      | "delegatorRewardsDistributed"
      | "minerRewardsDistributed"
      | "totalRewardsDistributed";
    limit?: number;
    enabled?: boolean;
  } = {}
) {
  const {
    type = "both",
    sortBy = "totalRewardsDistributed",
    limit = 50,
    enabled = true,
  } = params;

  const query = useQuery<FarmsActivityResponse>({
    queryKey: QUERY_KEYS.farms.activity(type, sortBy, limit),
    enabled,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime * 2,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () =>
      await hubGet<FarmsActivityResponse>("/fractions/farms/activity", {
        params: { type, sortBy, limit },
      }),
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export interface FractionSplit {
  id: string;
  walletAddress: string;
  fractionId: string;
  stepsPurchased: number;
  amount: string;
  txHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface FractionSplitsResponse {
  walletAddress: string;
  fractionId: string;
  splits: FractionSplit[];
  summary: {
    totalTransactions: number;
    totalStepsPurchased: number;
    totalAmountSpent: string;
  };
}

export function useFractionSplits(params: {
  walletAddress: string | null;
  fractionId: string | null;
  enabled?: boolean;
  refetchInterval?: number;
}) {
  const {
    walletAddress,
    fractionId,
    enabled = true,
    refetchInterval = 10_000,
  } = params;

  const query = useQuery<FractionSplitsResponse | null>({
    queryKey: QUERY_KEYS.fractions.splits(walletAddress, fractionId),
    enabled: enabled && Boolean(walletAddress && fractionId),
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    queryFn: async () => {
      if (!walletAddress || !fractionId) return null;
      return await hubGet<FractionSplitsResponse | null>(
        "/fractions/splits-by-wallet",
        {
          params: { walletAddress, fractionId },
          notFound: {
            walletAddress,
            fractionId,
            splits: [],
            summary: {
              totalTransactions: 0,
              totalStepsPurchased: 0,
              totalAmountSpent: "0",
            },
          },
        }
      );
    },
  });

  return {
    splits: query.data?.splits || [],
    summary: query.data?.summary || {
      totalTransactions: 0,
      totalStepsPurchased: 0,
      totalAmountSpent: "0",
    },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export interface RefundableFraction {
  fraction: {
    id: string;
    applicationId: string;
    status: string;
    createdBy: string;
    owner: string;
    token: string;
    step: string;
    totalSteps: number;
    splitsSold: number;
    expirationAt: string;
    isCommittedOnChain: boolean;
    txHash: string | null;
  };
  userPurchaseData: {
    walletAddress: string;
    totalStepsPurchased: number;
    totalAmountSpent: string;
    purchaseCount: number;
  };
  refundDetails: {
    user: string;
    creator: string;
    fractionId: string;
    estimatedRefundAmount: string;
  };
}

export interface RefundableFractionsResponse {
  walletAddress: string;
  refundableFractions: RefundableFraction[];
  summary: {
    totalRefundableFractions: number;
    totalRefundableAmount: string;
    totalStepsPurchased: number;
    byStatus: { expired: number; cancelled: number };
  };
}

export function useRefundableFractions(params: {
  walletAddress: string | null;
  enabled?: boolean;
  refetchInterval?: number | false;
}) {
  const { walletAddress, enabled = true, refetchInterval = false } = params;
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;

  const query = useQuery<RefundableFractionsResponse | null>({
    queryKey: QUERY_KEYS.fractions.refundable(normalizedWalletAddress),
    enabled: enabled && Boolean(normalizedWalletAddress),
    refetchInterval,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 30_000,
    queryFn: async () => {
      if (!normalizedWalletAddress) return null;
      return await hubGet<RefundableFractionsResponse | null>(
        "/fractions/refundable-by-wallet",
        {
          params: { walletAddress: normalizedWalletAddress },
          notFound: {
            walletAddress: normalizedWalletAddress,
            refundableFractions: [],
            summary: {
              totalRefundableFractions: 0,
              totalRefundableAmount: "0",
              totalStepsPurchased: 0,
              byStatus: { expired: 0, cancelled: 0 },
            },
          },
        }
      );
    },
  });

  return {
    refundableFractions: query.data?.refundableFractions || [],
    summary: query.data?.summary || {
      totalRefundableFractions: 0,
      totalRefundableAmount: "0",
      totalStepsPurchased: 0,
      byStatus: { expired: 0, cancelled: 0 },
    },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}
