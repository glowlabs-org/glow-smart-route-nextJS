import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import type { AuctionApplication } from "@/hooks/hub-listings";
import { formatUnits } from "viem";
import { calculateSgctlStepAtomicFromGlwStep } from "@/app/marketplace/deposit-dialog-utils";

export type DelegationCurrency = "GLW" | "SGCTL";

export type DelegationApplicationLike = Pick<
  AuctionApplication,
  "paymentCurrency" | "activeFraction" | "applicationPriceQuotes" | "finalProtocolFee"
>;

export interface LaunchpadRewardLike {
  userWeeklyGlwRewards?: string | null;
  userWeeklyGlwValueUsd?: string | number | null;
  userWeeklyPdRewards?: string | null;
  userWeeklyPdRewardsUsd?: string | number | null;
}

export interface LaunchpadPerShareRewards {
  emissionGlwPerShare: number;
  pdPerShare: number;
  pdCurrency: DelegationCurrency;
  totalGlwPerShare: number;
  totalUsdPerShare: number;
  hasUsdFromApi: boolean;
}

export function resolveDelegationCurrency(
  application?: DelegationApplicationLike | null
): DelegationCurrency {
  if (application?.activeFraction?.delegationAsset === "SGCTL") return "SGCTL";
  if (application?.paymentCurrency === "SGCTL") return "SGCTL";
  return "GLW";
}

export function normalizeDelegationCurrency(
  asset: string | null | undefined
): DelegationCurrency {
  if (!asset) return "GLW";
  const normalized = asset.toUpperCase();
  if (normalized === "SGCTL" || normalized === "GCTL") return "SGCTL";
  return "GLW";
}

function looksLikeSixDecimalDelegation(
  value: string | number | bigint | null | undefined
): boolean {
  try {
    if (value == null) return false;
    const raw = BigInt(value);
    return raw > 0n && raw < 1_000_000_000_000n;
  } catch {
    return false;
  }
}

function parseBigIntSafe(
  value: string | number | bigint | null | undefined
): bigint | null {
  try {
    if (value == null) return null;
    return BigInt(value);
  } catch {
    return null;
  }
}

function safeNumber(value: bigint): number {
  if (value <= 0n) return 0;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  return Number(value > max ? max : value);
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (numerator <= 0n || denominator <= 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}

export function resolveDelegationCurrencyFromSplitActivity(params: {
  currency?: string | null;
  amount?: string | number | bigint | null;
  stepPrice?: string | number | bigint | null;
  transactionHash?: string | null;
  listingCurrency?: string | null;
  application?: DelegationApplicationLike | null;
}): DelegationCurrency {
  if (params.currency) {
    return normalizeDelegationCurrency(params.currency);
  }

  const listingCurrency = params.application
    ? resolveDelegationCurrency(params.application)
    : params.listingCurrency
      ? normalizeDelegationCurrency(params.listingCurrency)
      : null;

  const hasSyntheticSgctlMarker = Boolean(
    params.transactionHash?.toLowerCase().startsWith("sgctl-delegation:")
  );
  const looksLikeSixDecimalAmount = looksLikeSixDecimalDelegation(params.amount);
  const looksLikeSixDecimalStepPrice = looksLikeSixDecimalDelegation(
    params.stepPrice
  );

  if (
    hasSyntheticSgctlMarker ||
    looksLikeSixDecimalAmount ||
    looksLikeSixDecimalStepPrice
  ) {
    return "SGCTL";
  }

  if (listingCurrency) {
    return listingCurrency;
  }

  return "GLW";
}

export function getDelegationCurrencyDecimals(
  currency: DelegationCurrency
): number {
  if (currency === "SGCTL") return DECIMALS_BY_TOKEN.GCTL;
  return DECIMALS_BY_TOKEN.GLW;
}

export function parseTokenAmountFromBaseUnits(
  value: string | number | bigint | null | undefined,
  decimals: number
): number {
  try {
    if (value == null) return 0;
    return Number.parseFloat(formatUnits(BigInt(value), decimals));
  } catch {
    return 0;
  }
}

export function parseUsd6Amount(
  value: string | number | bigint | null | undefined
): number {
  return parseTokenAmountFromBaseUnits(value, 6);
}

export function parseDelegationAmountFromBaseUnits(
  value: string | number | bigint | null | undefined,
  currency: DelegationCurrency
): number {
  return parseTokenAmountFromBaseUnits(
    value,
    getDelegationCurrencyDecimals(currency)
  );
}

export function getDelegationStepAtomic(
  application?: DelegationApplicationLike | null
): bigint | null {
  const delegationCurrency = resolveDelegationCurrency(application);
  if (delegationCurrency === "SGCTL") {
    const lockedSgctlStepAtomic = (() => {
      try {
        return application?.activeFraction?.sgctlStepAtomic != null
          ? BigInt(application.activeFraction.sgctlStepAtomic)
          : null;
      } catch {
        return null;
      }
    })();
    if (lockedSgctlStepAtomic != null && lockedSgctlStepAtomic > 0n) {
      return lockedSgctlStepAtomic;
    }
  }

  const rawStep = application?.activeFraction?.step;
  if (!rawStep) return null;

  try {
    const glwStepAtomic = BigInt(rawStep);
    if (glwStepAtomic <= 0n) return null;

    if (delegationCurrency === "GLW") return glwStepAtomic;

    const totalSteps = BigInt(
      Math.max(0, Math.floor(application?.activeFraction?.totalSteps ?? 0))
    );
    const exactTotalAmountNeeded = (() => {
      try {
        return application?.activeFraction?.totalAmountNeeded != null
          ? BigInt(application.activeFraction.totalAmountNeeded)
          : null;
      } catch {
        return null;
      }
    })();
    if (
      totalSteps > 0n &&
      exactTotalAmountNeeded != null &&
      exactTotalAmountNeeded > 0n &&
      exactTotalAmountNeeded % totalSteps === 0n
    ) {
      const exactStepAtomic = exactTotalAmountNeeded / totalSteps;
      if (exactStepAtomic > 0n && exactStepAtomic < 1_000_000_000_000n) {
        return exactStepAtomic;
      }
    }

    const latestQuote = application?.applicationPriceQuotes?.[0];
    const glwPriceRaw = latestQuote?.prices?.GLW;
    const gctlPriceRaw = latestQuote?.prices?.GCTL;
    if (!glwPriceRaw || !gctlPriceRaw) return null;

    return calculateSgctlStepAtomicFromGlwStep({
      glwStepAtomic,
      glwPriceMicros: BigInt(glwPriceRaw),
      gctlPriceMicros: BigInt(gctlPriceRaw),
    });
  } catch {
    return null;
  }
}

export function resolveLaunchpadDelegationShareCount(
  application?: DelegationApplicationLike | null
): number {
  const baseTotalSteps = Math.max(
    0,
    Math.floor(application?.activeFraction?.totalSteps ?? 0)
  );
  if (!application?.activeFraction) return 0;

  if (resolveDelegationCurrency(application) !== "SGCTL") {
    return baseTotalSteps;
  }

  const finalProtocolFeeUsd6 = parseBigIntSafe(application.finalProtocolFee);
  const currentStepUsd6 = parseBigIntSafe(
    application.activeFraction.currentStepUsd6
  );

  if (
    finalProtocolFeeUsd6 != null &&
    finalProtocolFeeUsd6 > 0n &&
    currentStepUsd6 != null &&
    currentStepUsd6 > 0n
  ) {
    return safeNumber(ceilDiv(finalProtocolFeeUsd6, currentStepUsd6));
  }

  return baseTotalSteps;
}

/**
 * Number of delegation UNITS the deposit represents = deposit ÷ per-unit step
 * price. This is the correct divisor for PER-UNIT reward figures (PD recovery
 * and emissions per delegated unit).
 *
 * Why this is NOT resolveLaunchpadDelegationShareCount() for GLW farms: after
 * the GLW auto-commit, `fractions.total_steps` is bumped to
 * (splitsSold + GLW remainder), so it over-counts the units — e.g. 43 (24 sGCTL
 * shares already sold + 19 GLW remainder) instead of the 24 units the deposit
 * actually represents. Dividing per-unit rewards by 43 dragged PD recovery
 * below its true value of ~1% of the step price (8.94 → 5.0). The marketplace
 * "remaining / units available" count legitimately uses total_steps; per-unit
 * *rewards* must divide by deposit ÷ step instead. For sGCTL this already
 * matches the share-count helper (finalProtocolFee ÷ currentStepUsd6).
 */
export function resolveLaunchpadDelegationUnitCount(
  application?: DelegationApplicationLike | null
): number {
  if (!application?.activeFraction) return 0;

  // sGCTL already derives the unit count as finalProtocolFee ÷ stepUsd6.
  if (resolveDelegationCurrency(application) === "SGCTL") {
    return resolveLaunchpadDelegationShareCount(application);
  }

  // GLW: deposit ÷ per-step price. perStepUsd6 = (stepWei / 1e18) * glwPriceUsd6.
  const finalProtocolFeeUsd6 = parseBigIntSafe(application.finalProtocolFee);
  const stepWei = parseBigIntSafe(
    application.activeFraction.step ?? application.activeFraction.stepPrice
  );
  const glwPriceUsd6 = parseBigIntSafe(
    application.applicationPriceQuotes?.[0]?.prices?.GLW
  );
  if (
    finalProtocolFeeUsd6 != null &&
    finalProtocolFeeUsd6 > 0n &&
    stepWei != null &&
    stepWei > 0n &&
    glwPriceUsd6 != null &&
    glwPriceUsd6 > 0n
  ) {
    const perStepUsd6 = (stepWei * glwPriceUsd6) / 10n ** 18n;
    if (perStepUsd6 > 0n) {
      // Round to the nearest whole unit: the deposit is always an integer
      // number of GLW steps, but finalFee ÷ (step × price) lands a hair below
      // the true count due to price rounding (e.g. 23.99996 for a 24-unit
      // deposit). Returning the raw float makes consumers that Math.floor()
      // the divisor (calculateLaunchpadPerShareRewards) drop to 23 → per-unit
      // rewards 13.5 instead of 12.9.
      return Math.round(Number(finalProtocolFeeUsd6) / Number(perStepUsd6));
    }
  }

  // Fallback to the (total_steps-based) share count when pricing is unavailable.
  return resolveLaunchpadDelegationShareCount(application);
}

export function parseDelegationStepAmount(
  application?: DelegationApplicationLike | null
): number {
  const delegationCurrency = resolveDelegationCurrency(application);
  const stepAtomic = getDelegationStepAtomic(application);
  if (!stepAtomic) return 0;
  return parseTokenAmountFromBaseUnits(
    stepAtomic,
    getDelegationCurrencyDecimals(delegationCurrency)
  );
}

export function calculateLaunchpadPerShareRewards(params: {
  reward: LaunchpadRewardLike | null | undefined;
  totalShares: number | null | undefined;
  delegationCurrency: DelegationCurrency;
  glwSpotPrice?: number;
}): LaunchpadPerShareRewards {
  const { reward, totalShares, delegationCurrency, glwSpotPrice = 0 } = params;

  const safeTotalShares =
    typeof totalShares === "number" && Number.isFinite(totalShares)
      ? Math.max(0, Math.floor(totalShares))
      : 0;
  if (!reward || safeTotalShares <= 0) {
    return {
      emissionGlwPerShare: 0,
      pdPerShare: 0,
      pdCurrency: delegationCurrency,
      totalGlwPerShare: 0,
      totalUsdPerShare: 0,
      hasUsdFromApi: false,
    };
  }

  const emissionTotalGlw = parseTokenAmountFromBaseUnits(
    reward.userWeeklyGlwRewards,
    DECIMALS_BY_TOKEN.GLW
  );
  const pdTotal = parseDelegationAmountFromBaseUnits(
    reward.userWeeklyPdRewards,
    delegationCurrency
  );

  const emissionGlwPerShare = emissionTotalGlw / safeTotalShares;
  const pdPerShare = pdTotal / safeTotalShares;
  const totalGlwPerShare =
    delegationCurrency === "GLW"
      ? emissionGlwPerShare + pdPerShare
      : emissionGlwPerShare;

  const glwUsdTotal = parseUsd6Amount(reward.userWeeklyGlwValueUsd);
  const pdUsdTotal = parseUsd6Amount(reward.userWeeklyPdRewardsUsd);
  const apiUsdTotal = glwUsdTotal + pdUsdTotal;
  const hasUsdFromApi = Number.isFinite(apiUsdTotal) && apiUsdTotal > 0;
  const shouldUseSpotPriceForGlwPhase =
    delegationCurrency === "GLW" && glwSpotPrice > 0 && totalGlwPerShare > 0;

  const totalUsdPerShare = shouldUseSpotPriceForGlwPhase
    ? totalGlwPerShare * glwSpotPrice
    : hasUsdFromApi
    ? apiUsdTotal / safeTotalShares
    : glwSpotPrice > 0
    ? totalGlwPerShare * glwSpotPrice
    : 0;

  return {
    emissionGlwPerShare,
    pdPerShare,
    pdCurrency: delegationCurrency,
    totalGlwPerShare,
    totalUsdPerShare,
    hasUsdFromApi,
  };
}
