import Decimal from "decimal.js";

const DECIMAL_SEPARATOR_PATTERN = /^\d*\.?\d*$/;

/**
 * Sanitizes a user-typed swap-amount string. Accepts commas as decimal
 * separators (EU locales), rejects non-numeric characters, and clamps
 * negatives to empty. Returns `null` when the raw input should be ignored
 * (preserving current state), or a string to set as the new value.
 *
 * Mirrors the inline logic in `app/buy/swap-interface.tsx` so it can be
 * unit-tested in isolation and reused by other swap dialogs.
 */
export function parseSwapInputValue(raw: string): string | null {
  const value = raw.replace(",", ".");
  if (value !== "" && !DECIMAL_SEPARATOR_PATTERN.test(value)) {
    return null;
  }
  if (Number(value) < 0) {
    return "";
  }
  return value;
}

/**
 * Converts a decimal string to atomic bigint units for ERC20 or ETH math.
 * Rounds DOWN (truncates) to avoid accidentally overspending. Returns 0n
 * for malformed, non-positive, or non-finite input — callers are expected
 * to separately check that the input amount is > 0 before submitting a tx.
 */
export function toUnitsDecimal(value: string, decimals: number): bigint {
  try {
    const d = new Decimal(value || "0");
    if (!d.isFinite() || d.lte(0)) return 0n;
    const scaled = d.mul(new Decimal(10).pow(decimals)).toFixed(0, Decimal.ROUND_DOWN);
    return BigInt(scaled);
  } catch {
    return 0n;
  }
}
