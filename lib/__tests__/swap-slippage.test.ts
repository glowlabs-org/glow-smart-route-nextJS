import { describe, expect, it } from "vitest";
import { computeGlowSwapPriceImpactPct } from "@/lib/swap-slippage";

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
