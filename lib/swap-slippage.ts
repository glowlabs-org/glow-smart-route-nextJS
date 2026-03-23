import Decimal from "decimal.js";

export const DEFAULT_SLIPPAGE_TOLERANCE = "5";
export const DEFAULT_SLIPPAGE_BPS = 500n;
export const HIGH_SLIPPAGE_WARNING_THRESHOLD_PCT = 5;
export const SLIPPAGE_BPS_DENOMINATOR = 10_000n;

export function normalizeSlippageTolerance(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (!/^\d*\.?\d*$/.test(trimmed)) return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return trimmed;
}

export function slippagePctToBps(
  value: string,
  fallbackBps = DEFAULT_SLIPPAGE_BPS
) {
  try {
    const d = new Decimal(value || "0");
    if (!d.isFinite() || d.lte(0)) return fallbackBps;
    return BigInt(d.mul(100).toFixed(0, Decimal.ROUND_DOWN));
  } catch {
    return fallbackBps;
  }
}

export function parseSlippageTolerance(value: string): Decimal | null {
  try {
    const d = new Decimal(value || "0");
    if (!d.isFinite() || d.lte(0)) return null;
    return d;
  } catch {
    return null;
  }
}

export function computeAmountOutMin(
  quotedAmountOut: bigint,
  slippageBps: bigint
) {
  return (
    quotedAmountOut -
    (quotedAmountOut * slippageBps) / SLIPPAGE_BPS_DENOMINATOR
  );
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
