"use client";

import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { formatUnits } from "viem";
import {
  DECIMALS_BY_TOKEN,
  type FarmEfficiencyScore,
  type FarmWeeklyRewardsQuery,
  type FarmWeeklyRewardsResponse,
  type FarmWithRewards,
  type MiningScoresBatchResponse,
} from "@glowlabs-org/utils/browser";
import type { Kickstarter } from "@glowlabs-org/utils/browser";
import {
  getFarmsRouter,
  getKickstarterRouter,
} from "@/lib/api/control-routers";
import { generateRandomEthAddress } from "@/utils/eth";
import type { AuctionApplication, PaymentCurrency } from "@/hooks/hub-listings";
import { calculateProtocolDepositAmount } from "@/hooks/hub-listings";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";
import { useMemo } from "react";
import {
  buildMiningScoreBatchInputs,
  mapMiningScoresBatchToApplications,
  type ApplicationMiningScore,
} from "@/lib/mining-score";

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
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
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
}

export interface ApplicationRewardScore {
  applicationId: string;
  rewardScore: number;
  userWeeklyGlwRewards: string;
  userWeeklyGlwValueUsd: string;
  userWeeklyPdRewards: string;
  userWeeklyPdRewardsUsd: string;
  userEstimatedWeeklyCash: string;
  userProtocolDeposit: string;
  error?: string;
}

export function useRewardScore(params: RewardScoreParams) {
  const {
    applications,
    paymentCurrency,
    enabled = true,
    walletAddress,
  } = params;

  const query = useQuery({
    queryKey: QUERY_KEYS.listings.rewardScores(
      applications.map((app) => app.id),
      paymentCurrency,
      walletAddress || null
    ),
    enabled: enabled && applications.length > 0,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async (): Promise<ApplicationRewardScore[]> => {
      if (!applications.length) return [];

      const addressForEstimation = walletAddress || generateRandomEthAddress();

      const requestList = applications
        .map((app) => {
          const protocolDepositAmount = calculateProtocolDepositAmount(
            app.finalProtocolFee,
            app.applicationPriceQuotes,
            paymentCurrency
          );

          if (
            !protocolDepositAmount ||
            !app.auditFields?.netCarbonCreditEarningWeekly
          )
            return null;

          const decimals = DECIMALS_BY_TOKEN[paymentCurrency];
          const protocolDepositAmountBigInt = (() => {
            const amount = Number(protocolDepositAmount);
            if (!Number.isFinite(amount)) return BigInt(0);
            const base = new Decimal(10).pow(decimals);
            const scaled = new Decimal(amount)
              .mul(base)
              .toFixed(0, Decimal.ROUND_DOWN);
            return BigInt(scaled);
          })();

          return {
            applicationId: app.id,
            params: {
              userId: addressForEstimation,
              sponsorSplitPercent: app.sponsorSplitPercent,
              protocolDepositAmount: protocolDepositAmountBigInt.toString(),
              paymentCurrency,
              expectedWeeklyCarbonCredits:
                app.auditFields.netCarbonCreditEarningWeekly,
              regionId: app.zone.id,
            },
          } as const;
        })
        .filter(
          (entry): entry is { applicationId: string; params: any } =>
            entry !== null
        );

      const batchParams = requestList.map((r) => r.params);
      if (!batchParams.length) {
        return applications.map((app) => ({
          applicationId: app.id,
          rewardScore: 0,
          userWeeklyGlwRewards: "0",
          userWeeklyGlwValueUsd: "0",
          userWeeklyPdRewards: "0",
          userWeeklyPdRewardsUsd: "0",
          userEstimatedWeeklyCash: "0",
          userProtocolDeposit: "0",
          error: "Missing required data for calculation",
        }));
      }

      try {
        const response = await (
          getFarmsRouter() as any
        ).estimateRewardScoresBatch({
          farms: batchParams,
        });

        const resultByApplicationId = new Map<string, ApplicationRewardScore>();
        requestList.forEach((req, idx) => {
          const res = response.results[idx];
          if (res && (res as any).success) {
            const data = (res as any).data;
            resultByApplicationId.set(req.applicationId, {
              applicationId: req.applicationId,
              rewardScore: data.rewardScore,
              userWeeklyGlwRewards: data.userWeeklyGlwRewards,
              userWeeklyGlwValueUsd: data.userWeeklyGlwValueUsd,
              userWeeklyPdRewards: data.userWeeklyPdRewards,
              userWeeklyPdRewardsUsd: data.userWeeklyPdRewardsUsd,
              userEstimatedWeeklyCash: data.userEstimatedWeeklyCash,
              userProtocolDeposit: data.userProtocolDeposit,
            });
          } else {
            const err =
              (res as any)?.error || "Failed to calculate reward score";
            resultByApplicationId.set(req.applicationId, {
              applicationId: req.applicationId,
              rewardScore: 0,
              userWeeklyGlwRewards: "0",
              userWeeklyGlwValueUsd: "0",
              userWeeklyPdRewards: "0",
              userWeeklyPdRewardsUsd: "0",
              userEstimatedWeeklyCash: "0",
              userProtocolDeposit: "0",
              error: String(err),
            });
          }
        });

        return applications.map((app) => {
          const found = resultByApplicationId.get(app.id);
          if (found) return found;
          return {
            applicationId: app.id,
            rewardScore: 0,
            userWeeklyGlwRewards: "0",
            userWeeklyGlwValueUsd: "0",
            userWeeklyPdRewards: "0",
            userWeeklyPdRewardsUsd: "0",
            userEstimatedWeeklyCash: "0",
            userProtocolDeposit: "0",
            error: "Missing required data for calculation",
          };
        });
      } catch (error) {
        console.error("Error fetching reward scores:", error);
        return applications.map((app) => ({
          applicationId: app.id,
          rewardScore: 0,
          userWeeklyGlwRewards: "0",
          userWeeklyGlwValueUsd: "0",
          userWeeklyPdRewards: "0",
          userWeeklyPdRewardsUsd: "0",
          userEstimatedWeeklyCash: "0",
          userProtocolDeposit: "0",
          error: "Failed to fetch reward score",
        }));
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
  enabled?: boolean;
}

export function useMiningScore(params: UseMiningScoreParams) {
  const { applications, enabled = true } = params;

  const query = useQuery({
    queryKey: QUERY_KEYS.listings.miningScores(
      applications.map((app) => app.id)
    ),
    enabled: enabled && applications.length > 0,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async (): Promise<ApplicationMiningScore[]> => {
      if (!applications.length) return [];

      const { applicationsWithFarmIds, farmParams } =
        buildMiningScoreBatchInputs(applications);
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
          body: JSON.stringify({ farms: farmParams }),
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
    isLoading: query.isLoading,
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
