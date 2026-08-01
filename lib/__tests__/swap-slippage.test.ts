import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import {
  computeAmountOutMin,
  computeGlowSwapPriceImpactPct,
  computeGuaranteedGlowRouteMinimum,
  computeQuotedBondingIncrements,
  enforceConfirmedGlowRouteMinimum,
  enforceReviewedAmountOutMinimum,
  normalizeSlippageTolerance,
  parseSlippageTolerance,
  slippagePctToBps,
} from "@/lib/swap-slippage";
import { toFixedTruncate } from "@/utils/toFixedTruncate";

describe("swap slippage parsing", () => {
  it("handles partial decimal input without throwing", () => {
    expect(parseSlippageTolerance(".")).toBeNull();
    expect(normalizeSlippageTolerance(".", "5")).toBe("5");
    expect(slippagePctToBps(".", 500n)).toBe(500n);
  });

  it("converts fractional percentages to integer basis points", () => {
    expect(slippagePctToBps("0.29")).toBe(29n);
    expect(slippagePctToBps("0.299")).toBe(29n);
  });

  it("rejects tolerances above the safety cap", () => {
    expect(parseSlippageTolerance("50.01")).toBeNull();
    expect(normalizeSlippageTolerance("101", "5")).toBe("5");
    expect(slippagePctToBps("101", 500n)).toBe(500n);
  });

  it("never computes a negative minimum output", () => {
    expect(computeAmountOutMin(1_000n, -1n)).toBe(1_000n);
    expect(computeAmountOutMin(1_000n, 10_000n)).toBe(0n);
    expect(computeAmountOutMin(1_000n, 50_000n)).toBe(0n);
  });

  it("never weakens the absolute minimum the user reviewed", () => {
    expect(enforceReviewedAmountOutMinimum(900n, 950n)).toBe(950n);
    expect(enforceReviewedAmountOutMinimum(975n, 950n)).toBe(975n);
    expect(enforceReviewedAmountOutMinimum(975n)).toBe(975n);
  });

  it("combines the Uniswap floor with executable 0.01 GLW bonding increments", () => {
    expect(
      computeGuaranteedGlowRouteMinimum({
        uniswapQuotedAmountOut: 10n * 10n ** 18n,
        slippageBps: 100n,
        bondingIncrements: 250,
      }),
    ).toBe(12_400_000_000_000_000_000n);
  });

  it("floors a quote's bonding leg to whole 0.01 GLW increments", () => {
    expect(
      computeQuotedBondingIncrements({
        amountOutGlow: "137.489",
        bondingAllocation: 5_000_000n,
      }),
    ).toBe(13_748);
    expect(
      computeQuotedBondingIncrements({
        amountOutGlow: "137.489",
        bondingAllocation: 0n,
      }),
    ).toBeNull();
    expect(
      computeQuotedBondingIncrements({
        amountOutGlow: "not-a-number",
        bondingAllocation: 5_000_000n,
      }),
    ).toBeNull();
    expect(
      computeQuotedBondingIncrements({
        amountOutGlow: "0.004",
        bondingAllocation: 5_000_000n,
      }),
    ).toBeNull();
  });

  it("does not reject an unchanged pure-Uniswap route over float rendering", () => {
    // Regression: the reviewed floor used to come from the display estimate
    // (`(uniOut + bondingOut).toString()`) while the guard parsed the route leg
    // (`toFixedTruncate(uniOut, 18)`). Both render the same double, but the
    // shortest round-trip form and the 18-decimal expansion differ by ~1 ulp,
    // so the guard rejected roughly half of all quotes with nothing moving.
    const uniOut = 3323.057242660756;
    const slippageBps = 100n;

    const displayBasis = computeAmountOutMin(
      parseUnits((uniOut + 0).toString(), 18),
      slippageBps,
    );
    const routeBasis = computeGuaranteedGlowRouteMinimum({
      uniswapQuotedAmountOut: parseUnits(toFixedTruncate(uniOut, 18), 18),
      slippageBps,
      bondingIncrements: null,
    });

    // The old basis really is unreachable — this is the bug, pinned.
    expect(routeBasis).toBeLessThan(displayBasis);

    // The reviewed floor is now the guard's own output over the same legs, so
    // an unchanged route clears it exactly.
    const guardAtExecution = computeGuaranteedGlowRouteMinimum({
      uniswapQuotedAmountOut: parseUnits(toFixedTruncate(uniOut, 18), 18),
      slippageBps,
      bondingIncrements: null,
    });
    expect(guardAtExecution).toBe(routeBasis);
  });

  it("keeps the reviewed floor reachable when the bonding leg is truncated", () => {
    const quote = {
      amount_in_uni: 100_000_000n,
      amount_in_glow_bonding_curve: 50_000_000n,
      amount_out_uni: "1200.5",
      amount_out_glow: "137.489",
    };
    const floor = computeGuaranteedGlowRouteMinimum({
      uniswapQuotedAmountOut: parseUnits(quote.amount_out_uni, 18),
      slippageBps: 500n,
      bondingIncrements: computeQuotedBondingIncrements({
        amountOutGlow: quote.amount_out_glow,
        bondingAllocation: quote.amount_in_glow_bonding_curve,
      }),
    });

    // 1200.5 * 0.95 + 137.48 (0.009 GLW of the bonding leg is unsellable)
    expect(floor).toBe(1_277_955_000_000_000_000_000n);
  });

  it("requires the aggregate receipt output to meet the reviewed floor", () => {
    expect(
      enforceConfirmedGlowRouteMinimum({
        uniswapReceived: 600n,
        bondingReceived: 400n,
        reviewedMinimum: 1_000n,
      }),
    ).toBe(1_000n);
    expect(() =>
      enforceConfirmedGlowRouteMinimum({
        uniswapReceived: 599n,
        bondingReceived: 400n,
        reviewedMinimum: 1_000n,
      }),
    ).toThrow(/less GLOW/);
  });
});

describe("computeGlowSwapPriceImpactPct", () => {
  it("computes buy-side impact for USDG -> GLOW", () => {
    const impact = computeGlowSwapPriceImpactPct({
      sellToken: "USDG",
      buyToken: "GLOW",
      sellAmount: "30000",
      buyAmount: "65105.449206",
      glowPriceUsd: "0.413617",
    });

    expect(impact).not.toBeNull();
    expect(impact!.toDecimalPlaces(2).toString()).toBe("11.41");
  });

  it("computes buy-side impact for ETH -> GLOW", () => {
    const impact = computeGlowSwapPriceImpactPct({
      sellToken: "ETH",
      buyToken: "GLOW",
      sellAmount: "10",
      buyAmount: "65105.449206",
      glowPriceUsd: "0.413617",
      ethPriceUsd: "3000",
    });

    expect(impact).not.toBeNull();
    expect(impact!.toDecimalPlaces(2).toString()).toBe("11.41");
  });

  it("computes sell-side impact for GLOW -> USDG", () => {
    const impact = computeGlowSwapPriceImpactPct({
      sellToken: "GLOW",
      buyToken: "USDG",
      sellAmount: "10000",
      buyAmount: "4012.91203",
      glowPriceUsd: "0.413617",
    });

    expect(impact).not.toBeNull();
    expect(impact!.toDecimalPlaces(2).toString()).toBe("2.98");
  });

  it("returns null for unsupported pairs", () => {
    const impact = computeGlowSwapPriceImpactPct({
      sellToken: "USDC",
      buyToken: "USDG",
      sellAmount: "100",
      buyAmount: "100",
      glowPriceUsd: "0.413617",
    });

    expect(impact).toBeNull();
  });

  it("returns zero when execution is not worse than spot", () => {
    const impact = computeGlowSwapPriceImpactPct({
      sellToken: "USDG",
      buyToken: "GLOW",
      sellAmount: "100",
      buyAmount: "250",
      glowPriceUsd: "0.5",
    });

    expect(impact?.toString()).toBe("0");
  });
});
