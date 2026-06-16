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
  /** The wallet's share of farm GLW inflation, scaled6. Lets a caller
   *  re-base `userWeeklyGlwRewards` onto a different split. */
  userGlowSplitPercent: string;
  /** NEW-ERA SGCTL leg only: the reward-score bump above the GLW-leg score,
   *  derived by control from the persisted split bonus `n` (publish-time
   *  `sgctlRewardScoreBump`, default 10). Undefined for GLW / old-era legs.
   *  The two-tile UI pins the sGCTL tile to (GLW tile score + this). */
  sgctlScoreBumpOverGlwLeg?: number;
  error?: string;
}

export interface RewardScoreBatchParams {
  userId: string;
  sponsorSplitPercent: number;
  protocolDepositAmount: string;
  protocolDepositUsd6: string;
  paymentCurrencyPriceUsd6?: string;
  /** Locked GLW price (6 decimals) from the application GVE quote, used to value
   *  the GLW emission leg so the reward score is stable (matches points) instead
   *  of drifting with the live EDGAP price. Passed on every leg. */
  glwPriceQuoteUsd6?: string;
  paymentCurrency: PaymentCurrency;
  expectedWeeklyCarbonCredits: number;
  regionId: number;
  /**
   * PD vault-recovery discount (farm-based). Divides the PD term of the
   * reward-score formula. Comes from the hub `applications` table.
   * Defaults to 1.25 in the control backend if omitted.
   */
  pdRecoveryDiscount?: number;
  /**
   * Solved sGCTL split bonus `n` (percentage points) for new-era listings.
   * When present, the control backend bumps the sGCTL glow split by `n` and
   * pins the displayed score to (GLW score + 10). MUST be omitted for GLW-leg
   * estimates so the baseline `glwContributionRaw` is at the un-bumped split.
   */
  sgctlSplitBonusPercent?: number;
}

interface RewardScoreBatchRequestEntry {
  applicationId: string;
  params: RewardScoreBatchParams;
}

function isFractionOpenForMarketplace(
  fraction:
    | Pick<
        NonNullable<AuctionApplication["activeFraction"]>,
        "isFilled" | "remainingSteps" | "totalSteps"
      >
    | null
    | undefined
): boolean {
  if (!fraction) return false;

  const totalSteps = fraction.totalSteps ?? 0;
  const remainingSteps = fraction.remainingSteps ?? 0;

  return !fraction.isFilled && remainingSteps > 0 && totalSteps > 0;
}

export function resolveRewardScorePaymentCurrency(
  application: AuctionApplication,
  fallbackCurrency: PaymentCurrency
): PaymentCurrency {
  // Consolidated-launch-window shape: a listing has an sGCTL leg whenever
  // `sgctl` is present. The score difference between legs is now the server's
  // pinned +10 (the persisted split bonus n), so we no longer assume anything
  // about a 2x multiplier here — we only pick the currency to estimate.
  if (application.activeFraction?.sgctl != null) {
    return "SGCTL";
  }
  // Legacy fallback during the deploy gap (new shape not yet emitted).
  if (application.activeFraction?.delegationAsset === "SGCTL") {
    return "SGCTL";
  }
  return fallbackCurrency;
}

export function buildRewardScoreCurrencyKey(
  applications: AuctionApplication[],
  fallbackCurrency: PaymentCurrency,
  // When set, the score is estimated for THIS currency on every application
  // (no per-app sGCTL auto-resolve). The two-tile launchpad UI fetches a forced
  // GLW map and a forced SGCTL map so each tile shows its own leg's score.
  forceCurrency?: PaymentCurrency
): string {
  const prefix = forceCurrency ? `force:${forceCurrency}|` : "";
  return (
    prefix +
    applications
      .map(
        (application) =>
          `${application.id}:${
            forceCurrency ??
            resolveRewardScorePaymentCurrency(application, fallbackCurrency)
          }`
      )
      .join("|")
  );
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
    userGlowSplitPercent: "0",
    error: "Missing required data for calculation",
  };
}

export function filterActiveRewardApplications(
  applications: AuctionApplication[]
): AuctionApplication[] {
  return applications.filter((application) => {
    const fraction = application.activeFraction;
    if (!isFractionOpenForMarketplace(fraction)) return false;
    if (!fraction) return false;
    if (fraction.isCommittedOnChain) return false;
    return fraction.status.toLowerCase() !== "committed";
  });
}

export function buildRewardScoreBatchInputs(params: {
  applications: AuctionApplication[];
  paymentCurrency: PaymentCurrency;
  walletAddress?: string | null;
  // When set, estimate for THIS currency on every application instead of the
  // per-app sGCTL auto-resolve. Used by the two-tile UI: a forced-GLW pass (the
  // GLW tile's score, no bonus) and a forced-SGCTL pass (the sGCTL tile's score,
  // with the solved n).
  forceCurrency?: PaymentCurrency;
}) {
  const { applications, paymentCurrency, walletAddress, forceCurrency } = params;
  const addressForEstimation = walletAddress || REWARD_SCORE_FALLBACK_USER_ID;

  const requestList = applications
    .map((application) => {
      const resolvedPaymentCurrency =
        forceCurrency ??
        resolveRewardScorePaymentCurrency(application, paymentCurrency);
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
          protocolDepositUsd6: application.finalProtocolFee,
          paymentCurrencyPriceUsd6:
            getAssetPriceQuote(
              application.applicationPriceQuotes,
              resolvedPaymentCurrency
            ) || undefined,
          // Always the GLW quote (emission is GLW-denominated on every leg,
          // including sGCTL where paymentCurrency resolves to the GCTL quote).
          // Locks the emission valuation to the quote so the score is stable.
          glwPriceQuoteUsd6:
            getAssetPriceQuote(application.applicationPriceQuotes, "GLW") ||
            undefined,
          paymentCurrency: resolvedPaymentCurrency,
          expectedWeeklyCarbonCredits:
            application.auditFields.netCarbonCreditEarningWeekly,
          regionId: application.zone.id,
          // Hub serializes the numeric column as a decimal string;
          // parse it. Control backend falls back to 1.25 if undefined.
          pdRecoveryDiscount: (() => {
            const raw = application.pdRecoveryDiscount;
            if (raw == null) return undefined;
            const parsed = Number(raw);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
          })(),
          // Forward the solved n ONLY for the sGCTL leg, so new-era sGCTL cards
          // render the pinned (GLW + 10) score instead of the legacy 2x branch.
          // GLW-leg estimates intentionally omit it (baseline split).
          sgctlSplitBonusPercent:
            resolvedPaymentCurrency === "SGCTL"
              ? (() => {
                  const raw = application.activeFraction?.sgctl?.splitBonusPercent;
                  if (raw == null) return undefined;
                  const parsed = Number(raw);
                  return Number.isFinite(parsed) && parsed > 0
                    ? parsed
                    : undefined;
                })()
              : undefined,
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
        userGlowSplitPercent: result.data.userGlowSplitPercent,
        sgctlScoreBumpOverGlwLeg: result.data.sgctlScoreBumpOverGlwLeg,
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
