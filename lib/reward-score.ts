import Decimal from "decimal.js";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import type {
  AuctionApplication,
  ApplicationPriceQuote,
  PaymentCurrency,
} from "../hooks/hub-listings";

export const REWARD_SCORE_FALLBACK_USER_ID =
  "0x0000000000000000000000000000000000000001";

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

export interface RewardScoreBatchParams {
  userId: string;
  sponsorSplitPercent: number;
  protocolDepositAmount: string;
  paymentCurrency: PaymentCurrency;
  expectedWeeklyCarbonCredits: number;
  regionId: number;
}

interface RewardScoreBatchRequestEntry {
  applicationId: string;
  params: RewardScoreBatchParams;
}

export function resolveRewardScorePaymentCurrency(
  application: AuctionApplication,
  fallbackCurrency: PaymentCurrency
): PaymentCurrency {
  if (application.activeFraction?.delegationAsset === "SGCTL") {
    return "SGCTL";
  }
  return fallbackCurrency;
}

export function buildRewardScoreCurrencyKey(
  applications: AuctionApplication[],
  fallbackCurrency: PaymentCurrency
): string {
  return applications
    .map(
      (application) =>
        `${application.id}:${resolveRewardScorePaymentCurrency(
          application,
          fallbackCurrency
        )}`
    )
    .join("|");
}

export interface RewardScoresBatchResponse {
  results: Array<
    | {
        success: true;
        data: Omit<ApplicationRewardScore, "applicationId" | "error">;
      }
    | {
        success: false;
        error?: string;
      }
  >;
}

function getAssetPriceQuote(
  priceQuotes: ApplicationPriceQuote[],
  currency: PaymentCurrency
): string | null {
  if (!priceQuotes.length) return null;
  const latestQuote = priceQuotes[0];
  if (currency === "SGCTL") return latestQuote.prices.GCTL || null;
  return latestQuote.prices[currency] || null;
}

function calculateProtocolDepositAmount(
  finalProtocolFee: string | null,
  priceQuotes: ApplicationPriceQuote[],
  currency: PaymentCurrency
): string | null {
  if (!finalProtocolFee || !priceQuotes.length) return null;

  const assetPriceQuote = getAssetPriceQuote(priceQuotes, currency);
  if (!assetPriceQuote) return null;

  try {
    const protocolFeeInDollars = new Decimal(finalProtocolFee);
    const assetPriceInDollars = new Decimal(assetPriceQuote);
    if (assetPriceInDollars.isZero()) return null;
    return protocolFeeInDollars.div(assetPriceInDollars).toString();
  } catch {
    return null;
  }
}

function getMissingRewardScore(applicationId: string): ApplicationRewardScore {
  return {
    applicationId,
    rewardScore: 0,
    userWeeklyGlwRewards: "0",
    userWeeklyGlwValueUsd: "0",
    userWeeklyPdRewards: "0",
    userWeeklyPdRewardsUsd: "0",
    userEstimatedWeeklyCash: "0",
    userProtocolDeposit: "0",
    error: "Missing required data for calculation",
  };
}

export function filterActiveRewardApplications(
  applications: AuctionApplication[]
): AuctionApplication[] {
  return applications.filter((application) => {
    const fraction = application.activeFraction;
    if (!fraction) return false;
    const remainingSteps = fraction.remainingSteps ?? 0;
    return !fraction.isFilled && remainingSteps > 0;
  });
}

export function buildRewardScoreBatchInputs(params: {
  applications: AuctionApplication[];
  paymentCurrency: PaymentCurrency;
  walletAddress?: string | null;
}) {
  const { applications, paymentCurrency, walletAddress } = params;
  const addressForEstimation = walletAddress || REWARD_SCORE_FALLBACK_USER_ID;

  const requestList = applications
    .map((application) => {
      const resolvedPaymentCurrency = resolveRewardScorePaymentCurrency(
        application,
        paymentCurrency
      );
      const protocolDepositAmount = calculateProtocolDepositAmount(
        application.finalProtocolFee,
        application.applicationPriceQuotes,
        resolvedPaymentCurrency
      );

      if (
        !protocolDepositAmount ||
        !application.auditFields?.netCarbonCreditEarningWeekly
      ) {
        return null;
      }

      const decimals = DECIMALS_BY_TOKEN[resolvedPaymentCurrency];
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
        applicationId: application.id,
        params: {
          userId: addressForEstimation,
          sponsorSplitPercent: application.sponsorSplitPercent,
          protocolDepositAmount: protocolDepositAmountBigInt.toString(),
          paymentCurrency: resolvedPaymentCurrency,
          expectedWeeklyCarbonCredits:
            application.auditFields.netCarbonCreditEarningWeekly,
          regionId: application.zone.id,
        },
      } as RewardScoreBatchRequestEntry;
    })
    .filter((entry): entry is RewardScoreBatchRequestEntry => entry !== null);

  const batchParams = requestList.map((entry) => entry.params);
  return { requestList, batchParams } as const;
}

export function mapRewardScoresBatchToApplications(params: {
  applications: AuctionApplication[];
  requestList: RewardScoreBatchRequestEntry[];
  response: RewardScoresBatchResponse;
}) {
  const { applications, requestList, response } = params;
  const resultByApplicationId = new Map<string, ApplicationRewardScore>();

  requestList.forEach((requestEntry, index) => {
    const result = response.results[index];
    if (result && result.success) {
      resultByApplicationId.set(requestEntry.applicationId, {
        applicationId: requestEntry.applicationId,
        rewardScore: result.data.rewardScore,
        userWeeklyGlwRewards: result.data.userWeeklyGlwRewards,
        userWeeklyGlwValueUsd: result.data.userWeeklyGlwValueUsd,
        userWeeklyPdRewards: result.data.userWeeklyPdRewards,
        userWeeklyPdRewardsUsd: result.data.userWeeklyPdRewardsUsd,
        userEstimatedWeeklyCash: result.data.userEstimatedWeeklyCash,
        userProtocolDeposit: result.data.userProtocolDeposit,
      });
      return;
    }

    resultByApplicationId.set(requestEntry.applicationId, {
      ...getMissingRewardScore(requestEntry.applicationId),
      error:
        result && !result.success
          ? String(result.error || "Failed to calculate reward score")
          : "Failed to calculate reward score",
    });
  });

  return applications.map((application) => {
    const found = resultByApplicationId.get(application.id);
    return found ?? getMissingRewardScore(application.id);
  });
}

export function getMissingRewardScoresForApplications(
  applications: AuctionApplication[],
  errorMessage: string
): ApplicationRewardScore[] {
  return applications.map((application) => ({
    ...getMissingRewardScore(application.id),
    error: errorMessage,
  }));
}
