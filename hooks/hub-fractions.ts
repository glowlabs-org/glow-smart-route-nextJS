"use client";

import { useQuery } from "@tanstack/react-query";
import { hubGet } from "@/lib/api/hub-client";

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
    queryKey: ["yield-per-100"] as const,
    enabled,
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => await hubGet<YieldPer100Response>("/fractions/yield-per-100"),
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
    queryKey: ["fractions", "summary"] as const,
    enabled,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnWindowFocus: false,
    queryFn: async () => await hubGet<FractionsSummaryResponse>("/fractions/summary"),
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

export function useFractionsAvailability(params: {
  type?: "launchpad" | "mining-center";
  enabled?: boolean;
} = {}) {
  const { type, enabled = true } = params;

  const query = useQuery<
    FractionsAvailabilityResponse | FractionsAvailabilityGroupedResponse
  >({
    queryKey: ["fractions", "available", type ?? "all"] as const,
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
    lastWeekRewards: string;
    apy: string;
    weeklyBreakdown: Array<{
      weekNumber: number;
      inflationRewards: string;
      protocolDepositRewards: string;
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
        totalRewards: string;
      }>;
    }>;
  };
}

export function useRewardsBreakdown(params: {
  walletAddress?: string | null;
  farmId?: string | null;
  startWeek?: number;
  endWeek?: number;
  enabled?: boolean;
} = {}) {
  const { walletAddress, farmId, startWeek, endWeek, enabled = true } = params;

  const query = useQuery<RewardsBreakdownResponse | null>({
    queryKey: [
      "rewards-breakdown",
      walletAddress,
      farmId,
      startWeek,
      endWeek,
    ] as const,
    enabled: enabled && (Boolean(walletAddress) || Boolean(farmId)),
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      await hubGet<RewardsBreakdownResponse | null>("/fractions/rewards-breakdown", {
        params: { walletAddress: walletAddress ?? undefined, farmId: farmId ?? undefined, startWeek, endWeek },
        notFound: null,
      }),
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
}

export interface WalletsActivityResponse {
  weekRange: { startWeek: number; endWeek: number };
  summary: { totalWallets: number; returnedWallets: number };
  wallets: WalletActivity[];
}

export function useWalletsActivity(params: {
  type?: "delegator" | "miner";
  sortBy?:
    | "glwDelegated"
    | "usdcSpentOnMiners"
    | "delegatorRewardsEarned"
    | "minerRewardsEarned"
    | "totalRewardsEarned";
  limit?: number;
  enabled?: boolean;
} = {}) {
  const { type = "delegator", sortBy = "totalRewardsEarned", limit = 100, enabled = true } = params;

  const query = useQuery<WalletsActivityResponse>({
    queryKey: ["wallets-activity", type, sortBy, limit] as const,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      await hubGet<WalletsActivityResponse>("/fractions/wallets/activity", {
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

export function useFarmsActivity(params: {
  type?: "delegator" | "miner" | "both";
  sortBy?:
    | "delegatorRewardsDistributed"
    | "minerRewardsDistributed"
    | "totalRewardsDistributed";
  limit?: number;
  enabled?: boolean;
} = {}) {
  const { type = "both", sortBy = "totalRewardsDistributed", limit = 50, enabled = true } = params;

  const query = useQuery<FarmsActivityResponse>({
    queryKey: ["farms-activity", type, sortBy, limit] as const,
    enabled,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
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
  const { walletAddress, fractionId, enabled = true, refetchInterval = 10_000 } = params;

  const query = useQuery<FractionSplitsResponse | null>({
    queryKey: ["fraction-splits", walletAddress, fractionId] as const,
    enabled: enabled && Boolean(walletAddress && fractionId),
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    queryFn: async () => {
      if (!walletAddress || !fractionId) return null;
      return await hubGet<FractionSplitsResponse | null>("/fractions/splits-by-wallet", {
        params: { walletAddress, fractionId },
        notFound: {
          walletAddress,
          fractionId,
          splits: [],
          summary: { totalTransactions: 0, totalStepsPurchased: 0, totalAmountSpent: "0" },
        },
      });
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
  refetchInterval?: number;
}) {
  const { walletAddress, enabled = true, refetchInterval = 60_000 } = params;

  const query = useQuery<RefundableFractionsResponse | null>({
    queryKey: ["refundable-fractions", walletAddress] as const,
    enabled: enabled && Boolean(walletAddress),
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    queryFn: async () => {
      if (!walletAddress) return null;
      return await hubGet<RefundableFractionsResponse | null>(
        "/fractions/refundable-by-wallet",
        {
          params: { walletAddress },
          notFound: {
            walletAddress,
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


