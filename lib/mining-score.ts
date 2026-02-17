import Decimal from "decimal.js";
import { parseUnits } from "viem";
import type {
  BatchMiningScoreResult,
  MiningScoreParams,
  MiningScoresBatchResponse,
} from "@glowlabs-org/utils/browser";
import type { AuctionApplication } from "@/hooks/hub-listings";

export const MINING_SCORE_FALLBACK_USER_ID =
  "0x0000000000000000000000000000000000000001";

export interface ApplicationMiningScore {
  applicationId: string;
  farmId: string;
  miningScore: number;
  weeklyGlwRewards?: string;
  weeklyGlwRewardsUsd?: string;
  error?: string;
}

export function filterActiveMiningApplications(
  applications: AuctionApplication[]
): AuctionApplication[] {
  return applications.filter((application) => {
    const fraction = application.activeFraction;
    if (!fraction) return false;
    const remainingSteps = fraction.remainingSteps ?? 0;
    return !fraction.isFilled && remainingSteps > 0;
  });
}

export function buildMiningScoreBatchInputs(applications: AuctionApplication[]) {
  const applicationsWithFarmIds = applications.filter(
    (application) => application.farmId !== null
  );

  const farmParams: MiningScoreParams[] = applicationsWithFarmIds.map(
    (application) => {
      const userIdForEstimation =
        application.userId || MINING_SCORE_FALLBACK_USER_ID;

      return {
        farmId: application.farmId!,
        userId: userIdForEstimation,
        dollarCostOfMiner: String(application.activeFraction?.stepPrice || "0"),
        numberOfMiners: application.activeFraction?.totalSteps || 0,
        minerRewardSplit: application.activeFraction?.sponsorSplitPercent
          ? parseUnits(
              String(application.activeFraction?.sponsorSplitPercent),
              4
            ).toString()
          : "0",
      };
    }
  );

  return { applicationsWithFarmIds, farmParams } as const;
}

export function mapMiningScoresBatchToApplications(
  applications: AuctionApplication[],
  farmParams: MiningScoreParams[],
  response: MiningScoresBatchResponse
): ApplicationMiningScore[] {
  return applications.map((application) => {
    if (!application.farmId) {
      return {
        applicationId: application.id,
        farmId: "",
        miningScore: 0,
        error: "No farmId available",
      };
    }

    const paramIndex = farmParams.findIndex((params) => {
      return params.farmId === application.farmId;
    });
    const farmResult: BatchMiningScoreResult | undefined =
      paramIndex >= 0 ? response.results[paramIndex] : undefined;

    if (farmResult?.success) {
      const glwRewards = farmResult.data.userWeeklyGlwRewards;
      const glwPrice = farmResult.data.glwPriceUsd6;

      let weeklyGlwRewardsUsd: string | undefined;
      if (glwPrice) {
        const glwRewardsDecimal = new Decimal(glwRewards).div(1e18);
        const glwPriceDecimal = new Decimal(glwPrice).div(1e6);
        weeklyGlwRewardsUsd = glwRewardsDecimal
          .mul(glwPriceDecimal)
          .toFixed(2);
      }

      return {
        applicationId: application.id,
        farmId: application.farmId,
        miningScore: farmResult.data.miningScore || 0,
        weeklyGlwRewards: glwRewards,
        weeklyGlwRewardsUsd,
      };
    }

    return {
      applicationId: application.id,
      farmId: application.farmId,
      miningScore: 0,
      error:
        farmResult && !farmResult.success
          ? (farmResult as any).error
          : "Failed to calculate mining score",
    };
  });
}
