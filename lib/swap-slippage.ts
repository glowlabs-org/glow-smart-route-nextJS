import Decimal from "decimal.js";

export const DEFAULT_SLIPPAGE_TOLERANCE = "5";
export const DEFAULT_SLIPPAGE_BPS = 500n;
export const HIGH_SLIPPAGE_WARNING_THRESHOLD_PCT = 5;
export const MAX_SLIPPAGE_TOLERANCE_PCT = 50;
export const SLIPPAGE_BPS_DENOMINATOR = 10_000n;
export const CONFIRMED_GLOW_BELOW_REVIEWED_MINIMUM_MESSAGE =
  "The confirmed route returned less GLOW than the minimum you reviewed.";

export function normalizeSlippageTolerance(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (!/^\d*\.?\d*$/.test(trimmed)) return fallback;
  const n = Number(trimmed);
  if (
    !Number.isFinite(n) ||
    n <= 0 ||
    n > MAX_SLIPPAGE_TOLERANCE_PCT
  )
    return fallback;
  return trimmed;
}

export function slippagePctToBps(
  value: string,
  fallbackBps = DEFAULT_SLIPPAGE_BPS
) {
  try {
    const d = new Decimal(value || "0");
    if (
      !d.isFinite() ||
      d.lte(0) ||
      d.gt(MAX_SLIPPAGE_TOLERANCE_PCT)
    )
      return fallbackBps;
    return BigInt(d.mul(100).toFixed(0, Decimal.ROUND_DOWN));
  } catch {
    return fallbackBps;
  }
}

export function parseSlippageTolerance(value: string): Decimal | null {
  try {
    const d = new Decimal(value || "0");
    if (
      !d.isFinite() ||
      d.lte(0) ||
      d.gt(MAX_SLIPPAGE_TOLERANCE_PCT)
    )
      return null;
    return d;
  } catch {
    return null;
  }
}

export function computeAmountOutMin(
  quotedAmountOut: bigint,
  slippageBps: bigint
) {
  const boundedSlippageBps =
    slippageBps <= 0n
      ? 0n
      : slippageBps >= SLIPPAGE_BPS_DENOMINATOR
        ? SLIPPAGE_BPS_DENOMINATOR
        : slippageBps;
  return (
    quotedAmountOut -
    (quotedAmountOut * boundedSlippageBps) / SLIPPAGE_BPS_DENOMINATOR
  );
}

export function enforceReviewedAmountOutMinimum(
  currentMinimum: bigint,
  reviewedMinimum?: bigint,
): bigint {
  const safeCurrent = currentMinimum > 0n ? currentMinimum : 0n;
  const safeReviewed =
    reviewedMinimum !== undefined && reviewedMinimum > 0n
      ? reviewedMinimum
      : 0n;
  return safeReviewed > safeCurrent ? safeReviewed : safeCurrent;
}

// The bonding curve only sells whole 0.01 GLW increments, so a quote's bonding
// leg is worth `floor(amount_out_glow * 100)` increments and no more. Both the
// reviewed floor and the execution-time guard must derive it the same way, or
// they disagree about an unchanged route.
export function computeQuotedBondingIncrements({
  amountOutGlow,
  bondingAllocation,
}: {
  amountOutGlow: string | null | undefined;
  bondingAllocation: bigint | null | undefined;
}): number | null {
  if (bondingAllocation == null || bondingAllocation <= 0n) return null;
  const output = Number(amountOutGlow ?? "0");
  if (!Number.isFinite(output) || output <= 0) return null;
  const increments = Math.floor(output * 100);
  return Number.isSafeInteger(increments) && increments > 0 ? increments : null;
}

export function computeGuaranteedGlowRouteMinimum({
  uniswapQuotedAmountOut,
  slippageBps,
  bondingIncrements,
}: {
  uniswapQuotedAmountOut: bigint;
  slippageBps: bigint;
  bondingIncrements: number | null | undefined;
}): bigint {
  const safeIncrements =
    bondingIncrements != null &&
    Number.isSafeInteger(bondingIncrements) &&
    bondingIncrements > 0
      ? bondingIncrements
      : 0;
  const bondingGuaranteed =
    BigInt(safeIncrements) * 10_000_000_000_000_000n;
  return (
    computeAmountOutMin(uniswapQuotedAmountOut, slippageBps) +
    bondingGuaranteed
  );
}

export function enforceConfirmedGlowRouteMinimum({
  uniswapReceived,
  bondingReceived,
  reviewedMinimum,
}: {
  uniswapReceived: bigint;
  bondingReceived: bigint;
  reviewedMinimum: bigint;
}): bigint {
  const safeUniswap = uniswapReceived > 0n ? uniswapReceived : 0n;
  const safeBonding = bondingReceived > 0n ? bondingReceived : 0n;
  const totalReceived = safeUniswap + safeBonding;
  if (totalReceived < reviewedMinimum) {
    throw new Error(CONFIRMED_GLOW_BELOW_REVIEWED_MINIMUM_MESSAGE);
  }
  return totalReceived;
}

function parsePositiveDecimal(
  value: Decimal.Value | null | undefined
): Decimal | null {
  if (value == null) return null;
  try {
    const d = new Decimal(value);
    if (!d.isFinite() || d.lte(0)) return null;
    return d;
  } catch {
    return null;
  }
}

export function computeGlowSwapPriceImpactPct({
  sellToken,
  buyToken,
  sellAmount,
  buyAmount,
  glowPriceUsd,
  ethPriceUsd,
}: {
  sellToken: string;
  buyToken: string;
  sellAmount: Decimal.Value | null | undefined;
  buyAmount: Decimal.Value | null | undefined;
  glowPriceUsd: Decimal.Value | null | undefined;
  ethPriceUsd?: Decimal.Value | null | undefined;
}): Decimal | null {
  const sell = parsePositiveDecimal(sellAmount);
  const buy = parsePositiveDecimal(buyAmount);
  const glowPrice = parsePositiveDecimal(glowPriceUsd);

  if (!sell || !buy || !glowPrice) return null;

  if (buyToken === "GLOW") {
    let inputUsd: Decimal | null = null;

    if (sellToken === "USDG" || sellToken === "USDC") {
      inputUsd = sell;
    } else if (sellToken === "ETH") {
      const ethPrice = parsePositiveDecimal(ethPriceUsd);
      if (!ethPrice) return null;
      inputUsd = sell.mul(ethPrice);
    }

    if (!inputUsd) return null;
    const executionPrice = inputUsd.div(buy);
    if (executionPrice.lte(glowPrice)) return new Decimal(0);
    return executionPrice.div(glowPrice).minus(1).mul(100);
  }

  if (sellToken === "GLOW" && (buyToken === "USDG" || buyToken === "USDC")) {
    const executionPrice = buy.div(sell);
    if (executionPrice.gte(glowPrice)) return new Decimal(0);
    return glowPrice.minus(executionPrice).div(glowPrice).mul(100);
  }

  return null;
}
