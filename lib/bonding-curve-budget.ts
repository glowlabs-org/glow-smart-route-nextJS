export const BONDING_CURVE_QUOTE_CHANGED_MESSAGE =
  "The bonding-curve price changed beyond this order's budget. Review a fresh quote before trying again.";

export type BoundedPurchaseSpendResult =
  | { ok: true; maxSpend: bigint }
  | { ok: false; error: string };

export function computeBoundedPurchaseSpend({
  quotedPrice,
  slippageBps,
  maxBudget,
}: {
  quotedPrice: bigint;
  slippageBps: bigint;
  maxBudget?: bigint;
}): BoundedPurchaseSpendResult {
  if (quotedPrice < 0n) {
    return { ok: false, error: "Invalid bonding-curve quote." };
  }

  const safeSlippageBps = slippageBps > 0n ? slippageBps : 0n;
  const bufferedSpend =
    quotedPrice + (quotedPrice * safeSlippageBps) / 10_000n;

  if (maxBudget === undefined) return { ok: true, maxSpend: bufferedSpend };
  if (maxBudget < 0n || quotedPrice > maxBudget) {
    return { ok: false, error: BONDING_CURVE_QUOTE_CHANGED_MESSAGE };
  }

  return {
    ok: true,
    maxSpend: bufferedSpend > maxBudget ? maxBudget : bufferedSpend,
  };
}
