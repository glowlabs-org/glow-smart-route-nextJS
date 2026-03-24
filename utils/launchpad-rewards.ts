import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import type { AuctionApplication } from "@/hooks/hub-listings";
import { formatUnits } from "viem";
import { calculateSgctlStepAtomicFromGlwStep } from "@/app/marketplace/deposit-dialog-utils";

export type DelegationCurrency = "GLW" | "SGCTL";

type DelegationApplicationLike = Pick<
  AuctionApplication,
  "paymentCurrency" | "activeFraction" | "applicationPriceQuotes"
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
  const rawStep = application?.activeFraction?.step;
  if (!rawStep) return null;

  try {
    const glwStepAtomic = BigInt(rawStep);
    if (glwStepAtomic <= 0n) return null;

    const delegationCurrency = resolveDelegationCurrency(application);
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
