"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import {
  type FarmEfficiencyScore,
  type FarmWeeklyRewardsQuery,
  type FarmWeeklyRewardsResponse,
  type FarmWithRewards,
  type MiningScoresBatchResponse,
} from "@glowlabs-org/utils/browser";
import type { Kickstarter } from "@glowlabs-org/utils/browser";
import {
  getControlApiUrl,
  getFarmsRouter,
  getKickstarterRouter,
} from "@/lib/api/control-routers";
import type { AuctionApplication, PaymentCurrency } from "@/hooks/hub-listings";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";
import { useMemo } from "react";
import {
  buildMiningScoreBatchInputs,
  buildMiningScoreExtraLiveFarmsKey,
  fetchLiveSoonMiningScoreFarms,
  mapMiningScoresBatchToApplications,
  type ApplicationMiningScore,
} from "@/lib/mining-score";
import {
  buildRewardScoreCurrencyKey,
  buildRewardScoreBatchInputs,
  getMissingRewardScoresForApplications,
  mapRewardScoresBatchToApplications,
  type ApplicationRewardScore,
  type RewardScoresBatchResponse,
} from "@/lib/reward-score";

export type { ApplicationRewardScore } from "@/lib/reward-score";
export type { ApplicationMiningScore } from "@/lib/mining-score";

const MAX_FARMS_PER_BATCH = 100;

function chunkFarmIds(farmIds: string[], chunkSize: number): string[][] {
  if (chunkSize <= 0) return [farmIds];
  const chunks: string[][] = [];
  for (let i = 0; i < farmIds.length; i += chunkSize) {
    chunks.push(farmIds.slice(i, i + chunkSize));
  }
  return chunks;
}

function mergeBatchResults(responses: Array<{ results?: Record<string, any> }>) {
  const mergedResults: Record<string, any> = {};
  responses.forEach((response) => {
    if (!response?.results) return;
    Object.assign(mergedResults, response.results);
  });
  const firstResponse = responses.find((response) => response !== undefined);
  if (firstResponse && "results" in firstResponse) {
    return { ...firstResponse, results: mergedResults };
  }
  return { results: mergedResults };
}

export function useWalletFarms(params: {
  walletAddress?: string;
  enabled?: boolean;
}) {
  const { walletAddress, enabled = true } = params;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const query = useQuery({
    queryKey: QUERY_KEYS.wallets.farms(walletAddress),
    enabled: enabled && isConfigured && Boolean(walletAddress),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    queryFn: async (): Promise<FarmWithRewards[]> => {
      if (!walletAddress) return [];
      try {
        return await (getFarmsRouter() as any).fetchWalletFarmsWithRewards(
          walletAddress
        );
      } catch (error) {
        console.error("Error fetching wallet farms:", error);
        return [];
      }
    },
  });

  return {
    farms: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export interface WalletRewardSplitOwnership {
  farms: FarmWithRewards[];
  totalFarms: number;
  hasRewardSplits: boolean;
}

export async function fetchWalletRewardSplitOwnership(
  walletAddress: string,
): Promise<WalletRewardSplitOwnership> {
  const baseUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL;
  if (!baseUrl) {
    throw new Error(
      "Environment variable NEXT_PUBLIC_CONTROL_API_URL is not set",
    );
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/farms/wallet/${encodeURIComponent(
      walletAddress,
    )}/farms-with-rewards`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`farms-with-rewards returned ${response.status}`);
  }

  const body = (await response.json()) as
    | { farms?: FarmWithRewards[]; totalFarms?: number }
    | FarmWithRewards[];
  const farms = Array.isArray(body) ? body : body.farms ?? [];
  const totalFarms = Array.isArray(body)
    ? farms.length
    : body.totalFarms ?? farms.length;

  return {
    farms,
    totalFarms,
    hasRewardSplits: totalFarms > 0 || farms.length > 0,
  };
}

export function useWalletRewardSplitOwnership(params: {
  walletAddress?: string;
  enabled?: boolean;
}) {
  const { walletAddress, enabled = true } = params;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const query = useQuery({
    queryKey: QUERY_KEYS.wallets.rewardSplitOwnership(walletAddress),
    enabled: enabled && isConfigured && Boolean(walletAddress),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 1,
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error("Wallet address is required");
      }
      return fetchWalletRewardSplitOwnership(walletAddress);
    },
  });

  return {
    farms: query.data?.farms ?? [],
    totalFarms: query.data?.totalFarms ?? 0,
    hasRewardSplits: query.data?.hasRewardSplits ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

/**
 * Fetch wallet farms with the simulator evaluated at a specific historical
 * epoch instead of the current one. Used by the wallet view to surface the
 * just-ended week's locked estimate for pending-start cards (the live
 * estimate dilutes as new delegators land in the current epoch).
 *
 * Uses a direct fetch instead of the SDK because the SDK helper does not
 * yet forward the `week` query param.
 */
export function useWalletFarmsAtWeek(params: {
  walletAddress?: string;
  week?: number;
  enabled?: boolean;
}) {
  const { walletAddress, week, enabled = true } = params;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);
  const isWeekValid =
    typeof week === "number" && Number.isInteger(week) && week >= 0;

  const query = useQuery({
    queryKey: ["wallets", "farms", walletAddress, "week", week] as const,
    enabled: enabled && isConfigured && Boolean(walletAddress) && isWeekValid,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    queryFn: async (): Promise<FarmWithRewards[]> => {
      if (!walletAddress || !isWeekValid) return [];
      try {
        const baseUrl = getControlApiUrl().replace(/\/$/, "");
        const url = `${baseUrl}/farms/wallet/${encodeURIComponent(
          walletAddress
        )}/farms-with-rewards?week=${week}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `farms-with-rewards@week=${week} returned ${response.status}`
          );
        }
        const data = (await response.json()) as {
          farms?: FarmWithRewards[];
        };
        return data.farms ?? [];
      } catch (error) {
        console.error("Error fetching wallet farms at week:", error);
        return [];
      }
    },
  });

  return {
    farms: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export function useFarmWeeklyRewards(params: {
  farmId: string;
  startWeek?: number;
  endWeek?: number;
  paymentCurrency?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const {
    farmId,
    startWeek,
    endWeek,
    paymentCurrency,
    limit,
    enabled = true,
  } = params;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const queryParams: FarmWeeklyRewardsQuery = {};
  if (startWeek !== undefined) queryParams.startWeek = startWeek;
  if (endWeek !== undefined) queryParams.endWeek = endWeek;
  if (paymentCurrency) queryParams.paymentCurrency = paymentCurrency as any;
  if (limit !== undefined) queryParams.limit = limit;

  const query = useQuery<FarmWeeklyRewardsResponse>({
    queryKey: QUERY_KEYS.farms.rewards(farmId, queryParams),
    enabled: enabled && isConfigured && Boolean(farmId),
    staleTime: QUERY_CONFIG.DEFAULT.staleTime * 2,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () => {
      if (!farmId) throw new Error("Farm ID is required");

      try {
        return await (getFarmsRouter() as any).fetchFarmWeeklyRewards(
          farmId,
          queryParams
        );
      } catch (error) {
        console.error("Error fetching farm weekly rewards:", error);
        throw error;
      }
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

export function useFarmsEfficiencyScores(
  params: { farmId?: string; enabled?: boolean } = {}
) {
  const { farmId, enabled = true } = params;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const query = useQuery<FarmEfficiencyScore | FarmEfficiencyScore[]>({
    queryKey: QUERY_KEYS.farms.efficiencyScores(farmId),
    enabled: enabled && isConfigured,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () => {
      try {
        return await (getFarmsRouter() as any).fetchEfficiencyScores(farmId);
      } catch (error) {
        console.error("Error fetching farms efficiency scores:", error);
        throw error;
      }
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

export function useFarmWeeklyRewardsBatch(params: {
  farmIds: string[];
  startWeek?: number;
  endWeek?: number;
  enabled?: boolean;
}) {
  const { farmIds, startWeek, endWeek, enabled = true } = params;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const query = useQuery({
    queryKey: QUERY_KEYS.farms.rewardsBatch(farmIds, startWeek, endWeek),
    enabled: enabled && isConfigured && farmIds.length > 0,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime * 2,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () => {
      if (farmIds.length === 0) return null;
      try {
        const farmIdBatches = chunkFarmIds(farmIds, MAX_FARMS_PER_BATCH);
        const responses = await Promise.all(
          farmIdBatches.map(async (batch) => {
            try {
              return await (getFarmsRouter() as any).fetchFarmWeeklyRewardsBatch({
                farmIds: batch,
                startWeek,
                endWeek,
              });
            } catch (error) {
              console.error(
                "Error fetching farm weekly rewards batch chunk:",
                error
              );
              throw error;
            }
          })
        );
        return mergeBatchResults(responses);
      } catch (error) {
        console.error("Error fetching farm weekly rewards batch:", error);
        throw error;
      }
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

export interface RewardScoreParams {
  applications: AuctionApplication[];
  paymentCurrency: PaymentCurrency;
  enabled?: boolean;
  walletAddress?: string | null;
  // Force this currency for every application (no per-app sGCTL auto-resolve).
  // The two-tile launchpad UI calls this hook twice: forceCurrency "GLW" for the
  // GLW tiles and "SGCTL" for the sGCTL tiles, so each tile shows its own score.
  forceCurrency?: PaymentCurrency;
}

export function useRewardScore(params: RewardScoreParams) {
  const {
    applications,
    paymentCurrency,
    enabled = true,
    walletAddress,
    forceCurrency,
  } = params;
  const rewardScoreCurrencyKey = buildRewardScoreCurrencyKey(
    applications,
    paymentCurrency,
    forceCurrency
  );

  const query = useQuery({
    queryKey: QUERY_KEYS.listings.rewardScores(
      applications.map((app) => app.id),
      rewardScoreCurrencyKey,
      walletAddress || null
    ),
    enabled: enabled && applications.length > 0,
    staleTime: QUERY_CONFIG.ESTIMATES.staleTime,
    gcTime: QUERY_CONFIG.ESTIMATES.gcTime,
    refetchOnMount: QUERY_CONFIG.ESTIMATES.refetchOnMount,
    refetchOnWindowFocus: QUERY_CONFIG.ESTIMATES.refetchOnWindowFocus,
    refetchOnReconnect: QUERY_CONFIG.ESTIMATES.refetchOnReconnect,
    queryFn: async (): Promise<ApplicationRewardScore[]> => {
      if (!applications.length) return [];

      const { requestList, batchParams } = buildRewardScoreBatchInputs({
        applications,
        paymentCurrency,
        walletAddress,
        forceCurrency,
      });

      if (!batchParams.length) {
        return getMissingRewardScoresForApplications(
          applications,
          "Missing required data for calculation"
        );
      }

      try {
        const response = await fetch("/api/farms/reward-scores-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ farms: batchParams }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch reward scores batch: ${response.status} ${errorText}`
          );
        }

        const payload = (await response.json()) as RewardScoresBatchResponse;
        return mapRewardScoresBatchToApplications({
          applications,
          requestList,
          response: payload,
        });
      } catch (error) {
        console.error("Error fetching reward scores:", error);
        return getMissingRewardScoresForApplications(
          applications,
          "Failed to fetch reward score"
        );
      }
    },
  });

  const rewardScoreMap = useMemo(() => {
    const map = new Map<string, ApplicationRewardScore>();
    if (query.data) {
      query.data.forEach((score) => map.set(score.applicationId, score));
    }
    return map;
  }, [query.data]);

  return {
    rewardScores: query.data || [],
    rewardScoreMap,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export function getRewardScoreForApplication(
  rewardScoreMap: Map<string, ApplicationRewardScore>,
  applicationId: string
): ApplicationRewardScore | null {
  return rewardScoreMap.get(applicationId) || null;
}

export interface UseMiningScoreParams {
  applications: AuctionApplication[];
  extraLiveApplications?: AuctionApplication[];
  enabled?: boolean;
}

export function useMiningScore(params: UseMiningScoreParams) {
  const { applications, extraLiveApplications = [], enabled = true } = params;
  const liveSoonQuery = useQuery({
    queryKey: QUERY_KEYS.listings.liveSoon(),
    enabled,
    staleTime: QUERY_CONFIG.ESTIMATES.staleTime,
    gcTime: QUERY_CONFIG.ESTIMATES.gcTime,
    refetchOnMount: QUERY_CONFIG.ESTIMATES.refetchOnMount,
    refetchOnWindowFocus: QUERY_CONFIG.ESTIMATES.refetchOnWindowFocus,
    refetchOnReconnect: QUERY_CONFIG.ESTIMATES.refetchOnReconnect,
    queryFn: fetchLiveSoonMiningScoreFarms,
  });

  const extraLiveKey = buildMiningScoreExtraLiveFarmsKey(
    extraLiveApplications,
    liveSoonQuery.data ?? []
  );

  const query = useQuery({
    queryKey: QUERY_KEYS.listings.miningScores(
      applications.map((app) => app.id),
      extraLiveKey
    ),
    enabled: enabled && applications.length > 0 && !liveSoonQuery.isLoading,
    staleTime: QUERY_CONFIG.ESTIMATES.staleTime,
    gcTime: QUERY_CONFIG.ESTIMATES.gcTime,
    refetchOnMount: QUERY_CONFIG.ESTIMATES.refetchOnMount,
    refetchOnWindowFocus: QUERY_CONFIG.ESTIMATES.refetchOnWindowFocus,
    refetchOnReconnect: QUERY_CONFIG.ESTIMATES.refetchOnReconnect,
    queryFn: async (): Promise<ApplicationMiningScore[]> => {
      if (!applications.length) return [];

      const { applicationsWithFarmIds, farmParams, extraLiveFarms } =
        buildMiningScoreBatchInputs(
          applications,
          extraLiveApplications,
          liveSoonQuery.data ?? []
        );
      if (!applicationsWithFarmIds.length) {
        return applications.map((app) => ({
          applicationId: app.id,
          farmId: app.farmId || "",
          miningScore: 0,
          error: "No farmId available",
        }));
      }

      try {
        const response = await fetch("/api/farms/mining-scores-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ farms: farmParams, extraLiveFarms }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch mining scores batch: ${response.status} ${errorText}`
          );
        }

        const payload = (await response.json()) as MiningScoresBatchResponse;
        return mapMiningScoresBatchToApplications(
          applications,
          farmParams,
          payload
        );
      } catch (error) {
        console.error("Error fetching mining scores:", error);
        return applications.map((app) => ({
          applicationId: app.id,
          farmId: app.farmId || "",
          miningScore: 0,
          error: "Failed to fetch mining score",
        }));
      }
    },
  });

  const miningScoreMap = useMemo(() => {
    const map = new Map<string, ApplicationMiningScore>();
    if (query.data) {
      query.data.forEach((score) => map.set(score.applicationId, score));
    }
    return map;
  }, [query.data]);

  return {
    miningScores: query.data || [],
    miningScoreMap,
    isLoading: liveSoonQuery.isLoading || query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export function getMiningScoreForApplication(
  miningScoreMap: Map<string, ApplicationMiningScore>,
  applicationId: string
): ApplicationMiningScore | null {
  return miningScoreMap.get(applicationId) || null;
}

export function useKickstarters() {
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);
  const {
    data: kickstarters = [],
    refetch: refetchKickstarters,
    isLoading: isKickstartersLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.listings.kickstarters(),
    enabled: isConfigured,
    queryFn: () =>
      (getKickstarterRouter() as any).fetchKickstarters() as Promise<
        Kickstarter[]
      >,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    retry: 2,
  });

  return { kickstarters, refetchKickstarters, isKickstartersLoading } as const;
}
