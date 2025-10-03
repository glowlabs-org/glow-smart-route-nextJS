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
}: RewardScoreParams) {
  const queryKey = [
    "reward-scores",
    applications.map((app) => app.id),
    paymentCurrency,
  ];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ApplicationRewardScore[]> => {
      if (!applications.length) return [];

      // Prepare batch request parameters
      const batchParams = applications
        .map((app) => {
          // Calculate protocol deposit amount for the selected currency
          const protocolDepositAmount = calculateProtocolDepositAmount(
            app.finalProtocolFee,
            app.applicationPriceQuotes,
            paymentCurrency
          );

          if (
            !protocolDepositAmount ||
            !app.auditFields?.expectedWeeklyCarbonCredits
          ) {
            return null;
          }

          const protocolDepositAmountBigInt = BigInt(
            Number(protocolDepositAmount) *
              10 ** DECIMALS_BY_TOKEN[paymentCurrency]
          );

          return {
            userId: app.id,
            sponsorSplitPercent: app.sponsorSplitPercent,
            protocolDepositAmount: protocolDepositAmountBigInt.toString(),
            paymentCurrency,
            expectedWeeklyCarbonCredits:
              app.auditFields.expectedWeeklyCarbonCredits,
            regionId: app.zone.id,
          };
        })
        .filter((param): param is NonNullable<typeof param> => param !== null);

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

        // Map the batch response back to applications
        return applications.map((app) => {
          const result = response.results.find(
            (r) =>
              r.success &&
              r.data &&
              batchParams.some((p) => p && p.userId === app.id)
          );

          if (result && result.success) {
            return {
              applicationId: app.id,
              rewardScore: result.data.rewardScore,
              userWeeklyGlwRewards: result.data.userWeeklyGlwRewards,
              userWeeklyGlwValueUsd: result.data.userWeeklyGlwValueUsd,
              userWeeklyPdRewards: result.data.userWeeklyPdRewards,
              userWeeklyPdRewardsUsd: result.data.userWeeklyPdRewardsUsd,
              userEstimatedWeeklyCash: result.data.userEstimatedWeeklyCash,
              userProtocolDeposit: result.data.userProtocolDeposit,
            };
          }

          // Find error result
          const errorResult = response.results.find(
            (r) =>
              !r.success && batchParams.some((p) => p && p.userId === app.id)
          );

          return {
            applicationId: app.id,
            rewardScore: 0,
            userWeeklyGlwRewards: "0",
            userWeeklyGlwValueUsd: "0",
            userWeeklyPdRewards: "0",
            userWeeklyPdRewardsUsd: "0",
            userEstimatedWeeklyCash: "0",
            userProtocolDeposit: "0",
            error:
              errorResult && !errorResult.success
                ? errorResult.error
                : "Failed to calculate reward score",
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
