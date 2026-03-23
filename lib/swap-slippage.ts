import Decimal from "decimal.js";

export const DEFAULT_SLIPPAGE_TOLERANCE = "15";
export const DEFAULT_SLIPPAGE_BPS = 1500n;
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
