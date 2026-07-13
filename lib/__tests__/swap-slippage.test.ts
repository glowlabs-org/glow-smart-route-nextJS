import { describe, expect, it } from "vitest";
import {
  computeAmountOutMin,
  computeGlowSwapPriceImpactPct,
  computeGuaranteedGlowRouteMinimum,
  enforceConfirmedGlowRouteMinimum,
  enforceReviewedAmountOutMinimum,
  normalizeSlippageTolerance,
  parseSlippageTolerance,
  slippagePctToBps,
} from "@/lib/swap-slippage";

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
