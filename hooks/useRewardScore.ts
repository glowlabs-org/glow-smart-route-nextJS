"use client";

import { DECIMALS_BY_TOKEN, FarmsRouter } from "@glowlabs-org/utils/browser";
import { useQuery } from "@tanstack/react-query";
import {
  type AuctionApplication,
  type PaymentCurrency,
  calculateProtocolDepositAmount,
} from "./useGlowLaunchpad";

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL;

if (!CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

const farmsRouter = FarmsRouter(CONTROL_API_URL);

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

export function useRewardScore({
  applications,
  paymentCurrency,
  enabled = true,
  walletAddress,
}: RewardScoreParams) {
  const queryKey = [
    "reward-scores",
    applications.map((app) => app.id),
    paymentCurrency,
    walletAddress || null,
  ];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ApplicationRewardScore[]> => {
      if (!applications.length) return [];

      // If we don't have a valid wallet, skip querying and return zeros
      if (!walletAddress) {
        return applications.map((app) => ({
          applicationId: app.id,
          rewardScore: 0,
          userWeeklyGlwRewards: "0",
          userWeeklyGlwValueUsd: "0",
          userWeeklyPdRewards: "0",
          userWeeklyPdRewardsUsd: "0",
          userEstimatedWeeklyCash: "0",
          userProtocolDeposit: "0",
          error: "Missing wallet address for reward estimate",
        }));
      }

      // Build request list preserving application association for stable mapping
      const requestList = applications
        .map((app) => {
          // Calculate protocol deposit amount for the selected currency
          const protocolDepositAmount = calculateProtocolDepositAmount(
            app.finalProtocolFee,
            app.applicationPriceQuotes,
            paymentCurrency
          );

          if (
            !protocolDepositAmount ||
            !app.auditFields?.netCarbonCreditEarningWeekly
          ) {
            return null;
          }

          const protocolDepositAmountBigInt = BigInt(
            Number(protocolDepositAmount) *
              10 ** DECIMALS_BY_TOKEN[paymentCurrency]
          );

          return {
            applicationId: app.id,
            params: {
              userId: walletAddress,
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
        const response = await farmsRouter.estimateRewardScoresBatch({
          farms: batchParams,
        });

        // Map the batch response back to applications by index alignment
        const resultByApplicationId = new Map<string, ApplicationRewardScore>();

        // Fill success/error for all request entries in order
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

        // Prepare final list preserving original applications order
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

        // Return error state for all applications
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
    enabled: enabled && applications.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Create a map for easy lookup
  const rewardScoreMap = new Map<string, ApplicationRewardScore>();
  if (query.data) {
    query.data.forEach((score) => {
      rewardScoreMap.set(score.applicationId, score);
    });
  }

  return {
    rewardScores: query.data || [],
    rewardScoreMap,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Helper function to get reward score for a specific application
export function getRewardScoreForApplication(
  rewardScoreMap: Map<string, ApplicationRewardScore>,
  applicationId: string
): ApplicationRewardScore | null {
  return rewardScoreMap.get(applicationId) || null;
}
