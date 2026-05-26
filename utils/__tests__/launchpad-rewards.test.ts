import { describe, expect, it } from "vitest";
import {
  calculateLaunchpadPerShareRewards,
  parseUsd6Amount,
  resolveLaunchpadDelegationShareCount,
} from "../launchpad-rewards";
import { parseUnits } from "viem";

describe("parseUsd6Amount", () => {
  it("converts usd6 strings to dollar amounts", () => {
    expect(parseUsd6Amount("5000000")).toBe(5);
  });
});

describe("calculateLaunchpadPerShareRewards", () => {
  it("scales API USD reward fields from usd6 before computing per-share usd", () => {
    const result = calculateLaunchpadPerShareRewards({
      reward: {
        userWeeklyGlwRewards: parseUnits("120", 18).toString(),
        userWeeklyPdRewards: parseUnits("120", 18).toString(),
        userWeeklyGlwValueUsd: "49200000",
        userWeeklyPdRewardsUsd: "49200000",
      },
      totalShares: 120,
      delegationCurrency: "GLW",
      glwSpotPrice: 0.41,
    });

    expect(result.totalUsdPerShare).toBeCloseTo(0.82, 6);
  });

  it("prefers live GLW spot pricing for GLW-phase usd labels when backend usd disagrees", () => {
    const result = calculateLaunchpadPerShareRewards({
      reward: {
        userWeeklyGlwRewards: parseUnits("1093.842072156261920248", 18).toString(),
        userWeeklyPdRewards: parseUnits("1101.828431371646719983", 18).toString(),
        userWeeklyGlwValueUsd: "159256246",
        userWeeklyPdRewardsUsd: "441152271",
      },
      totalShares: 120,
      delegationCurrency: "GLW",
      glwSpotPrice: 0.41,
    });

    expect(result.totalGlwPerShare).toBeCloseTo(18.29725419606591, 6);
    expect(result.totalUsdPerShare).toBeCloseTo(
      18.29725419606591 * 0.41,
      6,
    );
  });
});

describe("resolveLaunchpadDelegationShareCount", () => {
  it("uses ceiling division for SGCTL share counts so remaining can never exceed total", () => {
    const totalShares = resolveLaunchpadDelegationShareCount({
      paymentCurrency: "SGCTL",
      finalProtocolFee: "953554810000",
      applicationPriceQuotes: [],
      activeFraction: {
        delegationAsset: "SGCTL",
        totalSteps: 47677,
        currentStepUsd6: "20000000",
      },
    } as any);

    expect(totalShares).toBe(47678);
  });

  it("returns totalSteps for GLW phase (delegationAsset!='SGCTL')", () => {
    // After auto-commit transitions a launchpad fraction to the GLW phase,
    // resolveDelegationCurrency returns 'GLW' and the function should return
    // the fraction's totalSteps directly — not the sGCTL-share computation.
    const totalShares = resolveLaunchpadDelegationShareCount({
      paymentCurrency: "USDG",
      finalProtocolFee: "7846900000",
      applicationPriceQuotes: [],
      activeFraction: {
        delegationAsset: "GLW",
        totalSteps: 25,
        currentStepUsd6: null,
      },
    } as any);

    expect(totalShares).toBe(25);
  });

  it("wk129 Spectrum Canopy snapshot during sGCTL: 95 shares for $7,847 / $82.60 step", () => {
    // The exact configuration that triggered the wk129 UI bug in prod. Pin
    // it so any future change to the share-count formula has to consciously
    // break or update this regression.
    const totalShares = resolveLaunchpadDelegationShareCount({
      paymentCurrency: "SGCTL",
      finalProtocolFee: "7846900000",
      applicationPriceQuotes: [],
      activeFraction: {
        delegationAsset: "SGCTL",
        totalSteps: 16,
        currentStepUsd6: "82599006",
      },
    } as any);

    expect(totalShares).toBe(95);
  });

  it("falls back to totalSteps when finalProtocolFee is missing in sGCTL phase", () => {
    const totalShares = resolveLaunchpadDelegationShareCount({
      paymentCurrency: "SGCTL",
      finalProtocolFee: null,
      applicationPriceQuotes: [],
      activeFraction: {
        delegationAsset: "SGCTL",
        totalSteps: 50,
        currentStepUsd6: "100000",
      },
    } as any);

    expect(totalShares).toBe(50);
  });

  it("falls back to totalSteps when currentStepUsd6 is missing in sGCTL phase", () => {
    const totalShares = resolveLaunchpadDelegationShareCount({
      paymentCurrency: "SGCTL",
      finalProtocolFee: "1000000000",
      applicationPriceQuotes: [],
      activeFraction: {
        delegationAsset: "SGCTL",
        totalSteps: 50,
        currentStepUsd6: null,
      },
    } as any);

    expect(totalShares).toBe(50);
  });

  it("returns 0 when there is no active fraction", () => {
    const totalShares = resolveLaunchpadDelegationShareCount({
      paymentCurrency: "SGCTL",
      finalProtocolFee: "1000000000",
      applicationPriceQuotes: [],
      activeFraction: null,
    } as any);

    expect(totalShares).toBe(0);
  });
});
