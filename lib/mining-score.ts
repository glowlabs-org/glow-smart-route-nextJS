import Decimal from "decimal.js";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { parseUnits } from "viem";
import type {
  BatchMiningScoreResult,
  MiningScoreParams,
  MiningScoresBatchResponse,
} from "@glowlabs-org/utils/browser";
import type { AuctionApplication } from "@/hooks/hub-listings";
import { hubGet } from "@/lib/api/hub-client";
import { getCurrentEpoch } from "@/utils/getCurrentEpoch";

export const MINING_SCORE_FALLBACK_USER_ID =
  "0x0000000000000000000000000000000000000001";

export interface ApplicationMiningScore {
  applicationId: string;
  farmId: string;
  miningScore: number;
  weeklyGlwRewards?: string;
  weeklyGlwRewardsUsd?: string;
  weeksOfMinerLifeRemaining?: number;
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

export interface ExtraLiveFarmInput {
  farmId: string;
  regionId: number;
  expectedWeeklyCarbonCredits: number;
  protocolDepositPaidAmount: string;
  protocolDepositUSDC6Decimals: string;
  protocolDepositPaidCurrency: string;
  builtEpoch: number;
  rewardSplits?: Array<{
    walletAddress: string;
    glowSplitPercent6Decimals: string;
    depositSplitPercent6Decimals: string;
  }>;
}

export interface LiveSoonFarmResult {
  farmId: string;
  applicationId: string;
  applicationStatus: string;
  status: "scheduled" | "go_live_passed";
  goLiveAt: string;
  miningScoreContext?: ExtraLiveFarmInput;
}

function calculateProtocolDepositAmountBaseUnits(
  application: AuctionApplication,
  paymentCurrency: "GLW" | "SGCTL"
): string | null {
  const finalProtocolFee = application.finalProtocolFee;
  if (!finalProtocolFee || !application.applicationPriceQuotes.length) return null;

  const latestQuote = application.applicationPriceQuotes[0];
  const quoteKey = paymentCurrency === "SGCTL" ? "GCTL" : paymentCurrency;
  const assetPriceQuote = latestQuote.prices?.[quoteKey];
  if (!assetPriceQuote) return null;

  try {
    const protocolFeeInUsd6 = new Decimal(finalProtocolFee);
    const assetPriceInUsd6 = new Decimal(assetPriceQuote);
    if (!assetPriceInUsd6.gt(0)) return null;

    const tokenAmount = protocolFeeInUsd6.div(assetPriceInUsd6);
    return tokenAmount
      .mul(new Decimal(10).pow(DECIMALS_BY_TOKEN[paymentCurrency]))
      .toFixed(0, Decimal.ROUND_DOWN);
  } catch {
    return null;
  }
}

function buildExtraLiveFarmInput(
  application: AuctionApplication
): ExtraLiveFarmInput | null {
  if (application.farmId) return null;

  const expectedWeeklyCarbonCredits =
    application.auditFields?.netCarbonCreditEarningWeekly ?? null;
  const protocolDepositPaidAmount = calculateProtocolDepositAmountBaseUnits(
    application,
    "GLW"
  );

  if (
    expectedWeeklyCarbonCredits == null ||
    !Number.isFinite(expectedWeeklyCarbonCredits) ||
    !protocolDepositPaidAmount ||
    !application.finalProtocolFee
  ) {
    return null;
  }

  return {
    farmId: application.id,
    regionId: application.zone.id,
    expectedWeeklyCarbonCredits,
    protocolDepositPaidAmount,
    protocolDepositUSDC6Decimals: application.finalProtocolFee,
    protocolDepositPaidCurrency: "GLW",
    builtEpoch: getCurrentEpoch(),
  };
}

export function buildMiningScoreExtraLiveFarms(
  applications: AuctionApplication[]
): ExtraLiveFarmInput[] {
  const extraLiveFarmsById = new Map<string, ExtraLiveFarmInput>();

  for (const application of applications) {
    const extraLiveFarm = buildExtraLiveFarmInput(application);
    if (!extraLiveFarm) continue;
    extraLiveFarmsById.set(extraLiveFarm.farmId, extraLiveFarm);
  }

  return Array.from(extraLiveFarmsById.values());
}

export function mergeMiningScoreExtraLiveFarms(
  applications: AuctionApplication[],
  liveSoonFarms: LiveSoonFarmResult[] = []
): ExtraLiveFarmInput[] {
  const extraLiveFarmsById = new Map<string, ExtraLiveFarmInput>();

  for (const extraLiveFarm of buildMiningScoreExtraLiveFarms(applications)) {
    extraLiveFarmsById.set(extraLiveFarm.farmId, extraLiveFarm);
  }

  for (const liveSoonFarm of liveSoonFarms) {
    const miningScoreContext = liveSoonFarm.miningScoreContext;
    if (!miningScoreContext) continue;
    extraLiveFarmsById.set(miningScoreContext.farmId, miningScoreContext);
  }

  return Array.from(extraLiveFarmsById.values());
}

function serializeRewardSplits(
  rewardSplits: ExtraLiveFarmInput["rewardSplits"]
): string {
  if (!rewardSplits || rewardSplits.length === 0) return "";

  return rewardSplits
    .map(
      (split) =>
        `${split.walletAddress.toLowerCase()}:${split.glowSplitPercent6Decimals}:${split.depositSplitPercent6Decimals}`
    )
    .sort()
    .join(",");
}

export function buildMiningScoreExtraLiveFarmsKey(
  applications: AuctionApplication[],
  liveSoonFarms: LiveSoonFarmResult[] = []
): string {
  return mergeMiningScoreExtraLiveFarms(applications, liveSoonFarms)
    .map(
      (farm) =>
        `${farm.farmId}:${farm.protocolDepositUSDC6Decimals}:${farm.expectedWeeklyCarbonCredits}:${farm.builtEpoch}:${serializeRewardSplits(farm.rewardSplits)}`
    )
    .join("|");
}

export function buildMiningScoreBatchInputs(
  applications: AuctionApplication[],
  extraLiveApplications: AuctionApplication[] = [],
  liveSoonFarms: LiveSoonFarmResult[] = []
) {
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

  const extraLiveFarms = mergeMiningScoreExtraLiveFarms(
    extraLiveApplications,
    liveSoonFarms
  );

  return { applicationsWithFarmIds, farmParams, extraLiveFarms } as const;
}

export async function fetchLiveSoonMiningScoreFarms(): Promise<
  LiveSoonFarmResult[]
> {
  try {
    const payload = await hubGet<{ farms?: LiveSoonFarmResult[] }>(
      "/applications/live-soon"
    );
    return payload.farms ?? [];
  } catch (error) {
    console.error("Error fetching live-soon farms:", error);
    return [];
  }
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
        weeksOfMinerLifeRemaining:
          farmResult.data.weeksOfMinerLifeRemaining,
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
