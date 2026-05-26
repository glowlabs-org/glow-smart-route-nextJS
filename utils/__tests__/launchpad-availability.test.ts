import { describe, expect, it } from "vitest";
import { getLaunchpadAvailability } from "../launchpad-availability";
import type { DelegationApplicationLike } from "../launchpad-rewards";

// Why every test here matters: this util is the single source of truth for
// "X / Y left" on the launchpad listing card. Pre-extraction, the math lived
// inline in three places (launchpad-view, launchpad-status-widget,
// farms-performance-dialog) with subtle drift between them. The wk128
// Spectrum Canopy regression was a unit mismatch: `total` was sourced from
// resolveLaunchpadDelegationShareCount (sGCTL-share units) while `remaining`
// came from resolveFractionRemainingSteps (GLW-step units), so the displayed
// "sold" was computed by subtracting incompatible units. Every test below
// pins down a real production scenario or a documented edge case.

type Build = Partial<{
  splitsSold: number | null;
  totalSteps: number | null;
  isFilled: boolean;
  expirationAt: string | null;
  isCommittedOnChain: boolean;
  marketplaceVisibleAt: string | null;
  sgctlStepAtomic: string | null;
  currentStepUsd6: string | null;
}>;

function buildApplication(args: {
  paymentCurrency?: "SGCTL" | "GLW" | "USDG" | "USDC";
  fraction: Build | null;
  finalProtocolFee?: string;
  /** Phase-toggle: when paymentCurrency='SGCTL' and currentStepUsd6 is set, resolveLaunchpadDelegationShareCount returns the sGCTL-share count. */
  prices?: Record<string, string>;
}): DelegationApplicationLike {
  return {
    paymentCurrency: args.paymentCurrency ?? "USDG",
    finalProtocolFee: args.finalProtocolFee ?? null,
    activeFraction: args.fraction
      ? ({
          splitsSold: args.fraction.splitsSold ?? 0,
          totalSteps: args.fraction.totalSteps ?? 0,
          isFilled: args.fraction.isFilled ?? false,
          expirationAt:
            args.fraction.expirationAt ??
            "2099-01-01T00:00:00.000Z",
          isCommittedOnChain: args.fraction.isCommittedOnChain ?? false,
          marketplaceVisibleAt: args.fraction.marketplaceVisibleAt ?? null,
          sgctlStepAtomic: args.fraction.sgctlStepAtomic ?? null,
          currentStepUsd6: args.fraction.currentStepUsd6 ?? null,
        } as unknown as DelegationApplicationLike["activeFraction"])
      : null,
    applicationPriceQuotes: args.prices
      ? [
          {
            prices: args.prices,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ]
      : null,
  } as unknown as DelegationApplicationLike;
}

describe("getLaunchpadAvailability — empty inputs", () => {
  it("returns empty when application is null", () => {
    expect(getLaunchpadAvailability(null)).toEqual({
      remaining: 0,
      total: 0,
      sold: 0,
      isSoldOut: true,
      progressFilledPct: 0,
    });
  });

  it("returns empty when application is undefined", () => {
    expect(getLaunchpadAvailability(undefined)).toEqual({
      remaining: 0,
      total: 0,
      sold: 0,
      isSoldOut: true,
      progressFilledPct: 0,
    });
  });

  it("returns empty when activeFraction is null", () => {
    const app = buildApplication({ fraction: null });
    expect(getLaunchpadAvailability(app)).toEqual({
      remaining: 0,
      total: 0,
      sold: 0,
      isSoldOut: true,
      progressFilledPct: 0,
    });
  });
});

describe("getLaunchpadAvailability — GLW phase (typical post-commit)", () => {
  it("shows full availability on a fresh listing", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 16, splitsSold: 0 },
    });
    const av = getLaunchpadAvailability(app);
    expect(av.total).toBe(16);
    expect(av.sold).toBe(0);
    expect(av.remaining).toBe(16);
    expect(av.isSoldOut).toBe(false);
    expect(av.progressFilledPct).toBe(0);
  });

  it("computes remaining from splitsSold, capping sold at total", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 16, splitsSold: 10 },
    });
    const av = getLaunchpadAvailability(app);
    expect(av.total).toBe(16);
    expect(av.sold).toBe(10);
    expect(av.remaining).toBe(6);
    expect(av.progressFilledPct).toBe(62.5);
  });

  it("clamps progress to 100 when splitsSold > totalSteps (Crimson Valley overspill)", () => {
    // Real wk128 case: total=113, splits_sold=463. Pre-fix the inline math
    // would produce sold=113 (clamped) and progress=100. We preserve that.
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 113, splitsSold: 463 },
    });
    const av = getLaunchpadAvailability(app);
    expect(av.total).toBe(113);
    expect(av.sold).toBe(113);
    expect(av.remaining).toBe(0);
    expect(av.progressFilledPct).toBe(100);
  });

  it("never returns negative remaining", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 5, splitsSold: 1000 },
    });
    expect(getLaunchpadAvailability(app).remaining).toBe(0);
  });

  it("never returns negative sold", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 10, splitsSold: -3 as number },
    });
    expect(getLaunchpadAvailability(app).sold).toBe(0);
  });

  it("rounds splitsSold down to an integer (defensive against fractional rows)", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 10, splitsSold: 7.9 as number },
    });
    expect(getLaunchpadAvailability(app).sold).toBe(7);
  });
});

describe("getLaunchpadAvailability — sGCTL phase (currency=SGCTL)", () => {
  it("uses ceil(finalProtocolFee / currentStepUsd6) as total during sGCTL phase", () => {
    // wk129 Spectrum Canopy mid-sGCTL: total target $7,847 / step ~$82.60 →
    // ceil = 95 shares. Use a currentStepUsd6 that produces exactly 95.
    const app = buildApplication({
      paymentCurrency: "SGCTL",
      finalProtocolFee: "7846900000",
      prices: { SGCTL: "796135", GLW: "578014" },
      fraction: {
        totalSteps: 16,
        splitsSold: 12,
        sgctlStepAtomic: "103750000",
        // 103750000 * 796135 / 1e6 = 82599006 (~$82.599) → ceil(7846900000 / 82599006) = 95
        currentStepUsd6: "82599006",
      },
    });
    const av = getLaunchpadAvailability(app);
    expect(av.total).toBe(95);
    expect(av.sold).toBe(12);
    expect(av.remaining).toBe(83);
  });

  it("reports the wk129 Spectrum live state cleanly (the original bug it caught)", () => {
    // Captured from prod 2026-05-26 just before the manual total_steps=25 patch
    // landed: 12 sGCTL shares sold; UI must show 83 / 95 left, never 4 / 95.
    const app = buildApplication({
      paymentCurrency: "SGCTL",
      finalProtocolFee: "7846900000",
      prices: { SGCTL: "796135", GLW: "578014" },
      fraction: {
        totalSteps: 16,
        splitsSold: 12,
        sgctlStepAtomic: "103750000",
        currentStepUsd6: "82599006",
      },
    });
    const av = getLaunchpadAvailability(app);
    expect(av.remaining).toBe(83);
    expect(av.total).toBe(95);
    expect(av.sold).toBe(12);
    expect(av.isSoldOut).toBe(false);
    expect(av.progressFilledPct).toBeCloseTo(12.63, 2);
  });

  it("falls back to totalSteps when sGCTL pricing fields are missing", () => {
    // Without sgctlStepAtomic + price quote, resolveLaunchpadDelegationShareCount
    // can't compute the sGCTL share count; it returns the baseTotalSteps.
    const app = buildApplication({
      paymentCurrency: "SGCTL",
      finalProtocolFee: "7846900000",
      fraction: {
        totalSteps: 16,
        splitsSold: 4,
        sgctlStepAtomic: null,
      },
    });
    const av = getLaunchpadAvailability(app);
    expect(av.total).toBe(16);
    expect(av.sold).toBe(4);
    expect(av.remaining).toBe(12);
  });
});

describe("getLaunchpadAvailability — isSoldOut", () => {
  it("is sold out when the fraction is filled", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 16, splitsSold: 16, isFilled: true },
    });
    expect(getLaunchpadAvailability(app).isSoldOut).toBe(true);
  });

  it("is sold out when isFilled flips true (the canonical fill signal)", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: {
        totalSteps: 16,
        splitsSold: 16,
        isFilled: true,
      },
    });
    expect(getLaunchpadAvailability(app).isSoldOut).toBe(true);
  });

  it("is sold out when splitsSold catches up to totalSteps (post-fix invariant)", () => {
    // After the backend fix on `c465bbf` (gca-crm-backend main), the commit
    // path sets total_steps = splits_sold_at_commit + on-chain GLW remainder.
    // So splits_sold == total_steps reliably means the GLW phase is fully
    // filled. isFractionOpenForMarketplace correctly flags this as not-open.
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: {
        totalSteps: 100,
        splitsSold: 100,
        isFilled: false,
      },
    });
    expect(getLaunchpadAvailability(app).isSoldOut).toBe(true);
  });

  it("is not sold out for a typical mid-sale listing", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 20, splitsSold: 5 },
    });
    expect(getLaunchpadAvailability(app).isSoldOut).toBe(false);
  });
});

describe("getLaunchpadAvailability — boundary numerics", () => {
  it("handles totalSteps=0 gracefully (no division-by-zero)", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 0, splitsSold: 0 },
    });
    const av = getLaunchpadAvailability(app);
    expect(av.total).toBe(0);
    expect(av.remaining).toBe(0);
    expect(av.progressFilledPct).toBe(0);
  });

  it("returns progress 100 when fully sold", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 25, splitsSold: 25 },
    });
    expect(getLaunchpadAvailability(app).progressFilledPct).toBe(100);
  });

  it("returns progress 0 when nothing sold", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 25, splitsSold: 0 },
    });
    expect(getLaunchpadAvailability(app).progressFilledPct).toBe(0);
  });

  it("treats null splitsSold as 0", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: 10, splitsSold: null },
    });
    expect(getLaunchpadAvailability(app).sold).toBe(0);
  });

  it("treats null totalSteps as 0", () => {
    const app = buildApplication({
      paymentCurrency: "USDG",
      fraction: { totalSteps: null, splitsSold: 0 },
    });
    expect(getLaunchpadAvailability(app).total).toBe(0);
  });
});
