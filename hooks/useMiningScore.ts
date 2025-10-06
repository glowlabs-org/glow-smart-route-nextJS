"use client";

import { FarmsRouter } from "@glowlabs-org/utils/browser";
import type {
  MiningScoresBatchResponse,
  BatchMiningScoreResult,
  MiningScoreParams,
} from "@glowlabs-org/utils/browser";
import { useQuery } from "@tanstack/react-query";
import type { AuctionApplication } from "./useMiningCenter";
import Decimal from "decimal.js";
import { parseUnits } from "viem";

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL;

if (!CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

const farmsRouter = FarmsRouter(CONTROL_API_URL);

// Generate a random valid Ethereum address for mining score estimation
// when wallet is not connected (useful for Safari and initial load)
function generateRandomEthAddress(): string {
  const bytes = new Uint8Array(20);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < 20; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface UseMiningScoreParams {
  applications: AuctionApplication[];
  enabled?: boolean;
}

export interface ApplicationMiningScore {
  applicationId: string;
  farmId: string;
  miningScore: number;
  weeklyGlwRewards?: string;
  weeklyGlwRewardsUsd?: string;
  error?: string;
}

export function useMiningScore({
  applications,
  enabled = true,
}: UseMiningScoreParams) {
  const queryKey = ["mining-scores", applications.map((app) => app.id)];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ApplicationMiningScore[]> => {
      if (!applications.length) return [];

      // Filter applications that have farmIds
      const applicationsWithFarmIds = applications.filter(
        (app) => app.farmId !== null
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
        // Prepare batch request with proper mining score params
        const farmParams: MiningScoreParams[] = applicationsWithFarmIds.map(
          (app) => {
            // Use a random address for estimation if userId not available
            // This allows mining score display to work on Safari and during initial load
            const userIdForEstimation =
              app.userId || generateRandomEthAddress();

            return {
              farmId: app.farmId!,
              userId: userIdForEstimation,
              dollarCostOfMiner: String(app.activeFraction?.stepPrice || "0"), // Use stepPrice from activeFraction (USD with 6 decimals)
              numberOfMiners: app.activeFraction?.totalSteps || 0,
              minerRewardSplit: app.activeFraction?.sponsorSplitPercent
                ? parseUnits(
                    String(app.activeFraction?.sponsorSplitPercent),
                    4
                  ).toString()
                : "0",
            };
          }
        );

        const response = (await farmsRouter.calculateMiningScoresBatch({
          farms: farmParams,
        })) as MiningScoresBatchResponse;

        // Map the batch response back to applications
        return applications.map((app) => {
          if (!app.farmId) {
            return {
              applicationId: app.id,
              farmId: "",
              miningScore: 0,
              error: "No farmId available",
            };
          }

          // Find the mining score result for this farm - match by farmId in params
          const paramIndex = farmParams.findIndex(
            (p) => p.farmId === app.farmId
          );
          const farmResult: BatchMiningScoreResult | undefined =
            paramIndex >= 0 ? response.results[paramIndex] : undefined;

          if (farmResult?.success) {
            const glwRewards = farmResult.data.userWeeklyGlwRewards;
            const glwPrice = farmResult.data.glwPriceUsd6;

            // Calculate USD value if we have the price
            let weeklyGlwRewardsUsd: string | undefined;
            if (glwPrice) {
              const glwRewardsDecimal = new Decimal(glwRewards).div(1e18); // GLW has 18 decimals
              const glwPriceDecimal = new Decimal(glwPrice).div(1e6); // Price has 6 decimals
              weeklyGlwRewardsUsd = glwRewardsDecimal
                .mul(glwPriceDecimal)
                .toFixed(2);
            }

            return {
              applicationId: app.id,
              farmId: app.farmId,
              miningScore: farmResult.data.miningScore || 0,
              weeklyGlwRewards: glwRewards,
              weeklyGlwRewardsUsd,
            };
          }

          return {
            applicationId: app.id,
            farmId: app.farmId,
            miningScore: 0,
            error:
              farmResult && !farmResult.success
                ? farmResult.error
                : "Failed to calculate mining score",
          };
        });
      } catch (error) {
        console.error("Error fetching mining scores:", error);

        // Return error state for all applications
        return applications.map((app) => ({
          applicationId: app.id,
          farmId: app.farmId || "",
          miningScore: 0,
          error: "Failed to fetch mining score",
        }));
      }
    },
    enabled: enabled && applications.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Create a map for easy lookup
  const miningScoreMap = new Map<string, ApplicationMiningScore>();
  if (query.data) {
    query.data.forEach((score) => {
      miningScoreMap.set(score.applicationId, score);
    });
  }

  return {
    miningScores: query.data || [],
    miningScoreMap,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Helper function to get mining score for a specific application
export function getMiningScoreForApplication(
  miningScoreMap: Map<string, ApplicationMiningScore>,
  applicationId: string
): ApplicationMiningScore | null {
  return miningScoreMap.get(applicationId) || null;
}
