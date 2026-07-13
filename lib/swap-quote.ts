import Decimal from "decimal.js";

export const SWAP_QUOTE_MAX_AGE_MS = 60_000;
export const SMART_ROUTE_ALLOCATION_TOLERANCE_ATOMIC = 2n;

export interface SwapQuoteIdentity {
  amount: string;
  sellToken: string;
  buyToken: string;
  chainId: number;
  slippageBps: bigint;
  priceBasis?: string | number | null;
}

export interface CommittedSwapQuote {
  key: string;
  quotedAt: number;
}

export function createSwapQuoteKey(identity: SwapQuoteIdentity): string {
  return [
    identity.chainId,
    identity.sellToken,
    identity.buyToken,
    identity.amount.trim(),
    identity.slippageBps.toString(),
    identity.priceBasis == null ? "" : String(identity.priceBasis),
  ].join("|");
}

export function isCurrentSwapQuote({
  quote,
  expectedKey,
  now = Date.now(),
}: {
  quote: CommittedSwapQuote | null | undefined;
  expectedKey: string;
  now?: number;
}): boolean {
  return Boolean(
    quote &&
      quote.key === expectedKey &&
      now - quote.quotedAt >= 0 &&
      now - quote.quotedAt <= SWAP_QUOTE_MAX_AGE_MS,
  );
}

interface SmartBalancingBudgetQuote {
  amount_in_uni: bigint;
  amount_in_glow_bonding_curve: bigint;
  amount_out_uni: string;
  amount_out_glow: string;
  usdgToSpend: number | string;
}

export type SmartBalancingValidationResult =
  | { ok: true; allocatedAtomic: bigint }
  | { ok: false; error: string };

export function validateSmartBalancingQuote({
  quote,
  budgetAtomic,
}: {
  quote: SmartBalancingBudgetQuote | null | undefined;
  budgetAtomic?: bigint;
}): SmartBalancingValidationResult {
  if (!quote) return { ok: false, error: "A current route quote is required." };

  const uniswapAllocation = quote.amount_in_uni;
  const bondingAllocation = quote.amount_in_glow_bonding_curve;
  if (uniswapAllocation < 0n || bondingAllocation < 0n) {
    return { ok: false, error: "The route quote contains an invalid allocation." };
  }

  const allocatedAtomic = uniswapAllocation + bondingAllocation;
  if (allocatedAtomic <= 0n) {
    return { ok: false, error: "The route quote has no executable allocation." };
  }
  let quotedBudgetAtomic: bigint;
  try {
    const quotedBudget = new Decimal(String(quote.usdgToSpend));
    if (!quotedBudget.isFinite() || quotedBudget.lte(0)) {
      throw new Error("invalid quoted budget");
    }
    quotedBudgetAtomic = BigInt(
      quotedBudget
        .mul(1_000_000)
        .toDecimalPlaces(0, Decimal.ROUND_DOWN)
        .toFixed(0),
    );
  } catch {
    return { ok: false, error: "The route quote has an invalid input amount." };
  }

  const absoluteDifference = (left: bigint, right: bigint) =>
    left >= right ? left - right : right - left;
  const allocationDifference = absoluteDifference(
    allocatedAtomic,
    quotedBudgetAtomic,
  );
  if (allocationDifference > SMART_ROUTE_ALLOCATION_TOLERANCE_ATOMIC) {
    return {
      ok: false,
      error: "The route quote does not allocate the full reviewed input.",
    };
  }
  if (
    budgetAtomic !== undefined &&
    (absoluteDifference(allocatedAtomic, budgetAtomic) >
      SMART_ROUTE_ALLOCATION_TOLERANCE_ATOMIC ||
      absoluteDifference(quotedBudgetAtomic, budgetAtomic) >
        SMART_ROUTE_ALLOCATION_TOLERANCE_ATOMIC)
  ) {
    return {
      ok: false,
      error: "The route quote does not match the amount approved for this order.",
    };
  }

  let uniswapOutput: Decimal;
  let bondingOutput: Decimal;
  try {
    uniswapOutput = new Decimal(quote.amount_out_uni);
    bondingOutput = new Decimal(quote.amount_out_glow);
  } catch {
    return { ok: false, error: "The route quote has an invalid output amount." };
  }
  if (
    !uniswapOutput.isFinite() ||
    !bondingOutput.isFinite() ||
    uniswapOutput.isNegative() ||
    bondingOutput.isNegative()
  ) {
    return { ok: false, error: "The route quote has an invalid output amount." };
  }

  const hasUniswapAllocation = uniswapAllocation > 0n;
  const hasBondingAllocation = bondingAllocation > 0n;
  const hasUniswapOutput = uniswapOutput.gt(0);
  const hasBondingOutput = bondingOutput.gt(0);
  if (
    hasUniswapAllocation !== hasUniswapOutput ||
    hasBondingAllocation !== hasBondingOutput
  ) {
    return {
      ok: false,
      error: "The route quote contains an inconsistent leg allocation.",
    };
  }

  if (uniswapOutput.plus(bondingOutput).lte(0)) {
    return { ok: false, error: "The route quote has no valid output amount." };
  }

  return { ok: true, allocatedAtomic };
}
