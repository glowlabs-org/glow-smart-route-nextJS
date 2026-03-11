import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import type { AuctionApplication } from "@/hooks/hub-listings";
import { formatUnits } from "viem";

export type DelegationCurrency = "GLW" | "SGCTL";

type DelegationApplicationLike = Pick<
  AuctionApplication,
  "paymentCurrency" | "activeFraction"
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
  const activityCurrency = normalizeDelegationCurrency(params.currency);
  const listingCurrency = params.application
    ? resolveDelegationCurrency(params.application)
    : normalizeDelegationCurrency(params.listingCurrency);

  if (activityCurrency === "SGCTL" || listingCurrency === "SGCTL") {
    return "SGCTL";
  }

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

  return activityCurrency;
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

export function parseDelegationAmountFromBaseUnits(
  value: string | number | bigint | null | undefined,
  currency: DelegationCurrency
): number {
  return parseTokenAmountFromBaseUnits(
    value,
    getDelegationCurrencyDecimals(currency)
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

  const glwUsdTotal = Number.parseFloat(
    String(reward.userWeeklyGlwValueUsd ?? "0")
  );
  const pdUsdTotal = Number.parseFloat(
    String(reward.userWeeklyPdRewardsUsd ?? "0")
  );
  const apiUsdTotal = glwUsdTotal + pdUsdTotal;
  const hasUsdFromApi = Number.isFinite(apiUsdTotal) && apiUsdTotal > 0;

  const totalUsdPerShare = hasUsdFromApi
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
