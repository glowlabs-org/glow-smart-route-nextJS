import { describe, expect, it } from "vitest";
import {
  calculateLaunchpadPerShareRewards,
  parseUsd6Amount,
  resolveLaunchpadDelegationShareCount,
  resolveLaunchpadDelegationUnitCount,
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

describe("resolveLaunchpadDelegationUnitCount", () => {
  // The PER-UNIT reward divisor must be the deposit's whole-unit count
  // (deposit ÷ per-step price), NOT fractions.total_steps. After the GLW
  // auto-commit, total_steps is bumped to (splitsSold + GLW remainder); for
  // Eternal Florida / Scarlet Brook that was 43 (24 sGCTL shares sold + 19 GLW
  // remainder) for a 24-unit deposit. Dividing per-unit PD/emission by 43
  // understated them (PD 5.0 instead of 8.94, merged 13.5 instead of 12.9,
  // stats-dialog 9.32 instead of 8.94). Regression for prod 2026-06-02,
  // commit 956ea79.
  const scarletBrookGlw = {
    paymentCurrency: "GLW",
    finalProtocolFee: "11621440000", // $11,621.44 protocol-deposit target
    applicationPriceQuotes: [{ prices: { GLW: "541878" } }], // locked $0.541878
    activeFraction: {
      delegationAsset: "GLW",
      totalSteps: 43, // post-commit: 24 sGCTL sold + 19 GLW remainder
      splitsSold: 24,
      step: "893609171978440411556", // 893.609 GLW per unit
      stepPrice: "893609171978440411556",
      currentStepUsd6: null,
    },
  } as any;

  it("returns deposit ÷ step (24), NOT the bumped total_steps (43), for a GLW farm post-commit", () => {
    expect(resolveLaunchpadDelegationUnitCount(scarletBrookGlw)).toBe(24);
    // The share-count helper (used for marketplace availability) intentionally
    // still returns total_steps. The two counts MUST stay distinct.
    expect(resolveLaunchpadDelegationShareCount(scarletBrookGlw)).toBe(43);
  });

  it("rounds to the nearest whole unit (a deposit is always an integer # of steps)", () => {
    // finalFee ÷ (step × price) computes to 23.99996 here; it must round to 24,
    // not be left as a float that calculateLaunchpadPerShareRewards then
    // Math.floor()s down to 23 (which produced the 13.5 / 9.32 displays).
    expect(resolveLaunchpadDelegationUnitCount(scarletBrookGlw)).toBe(24);
  });

  it("end-to-end: unit count yields PD≈8.94 / emission≈4.0 / total≈12.9, not 5.0/2.2 or 13.5", () => {
    const unitCount = resolveLaunchpadDelegationUnitCount(scarletBrookGlw); // 24
    const perShare = calculateLaunchpadPerShareRewards({
      reward: {
        userWeeklyGlwRewards: "95882277094772749570", // 95.882 GLW (7% emission)
        userWeeklyPdRewards: "214465986808838900000", // 214.466 GLW (deposit/100)
      },
      totalShares: unitCount,
      delegationCurrency: "GLW",
      glwSpotPrice: 0.494207,
    });
    expect(perShare.pdPerShare).toBeCloseTo(8.94, 2);
    expect(perShare.emissionGlwPerShare).toBeCloseTo(3.995, 2);
    expect(perShare.totalGlwPerShare).toBeCloseTo(12.93, 1);

    // Guard: the old bug divided by the bumped total_steps (43).
    const buggy = calculateLaunchpadPerShareRewards({
      reward: {
        userWeeklyGlwRewards: "95882277094772749570",
        userWeeklyPdRewards: "214465986808838900000",
      },
      totalShares: 43,
      delegationCurrency: "GLW",
      glwSpotPrice: 0.494207,
    });
    expect(buggy.pdPerShare).toBeCloseTo(4.99, 1); // the wrong value we fixed
  });

  it("delegates to the sGCTL share count for sGCTL farms", () => {
    const sgctl = {
      paymentCurrency: "SGCTL",
      finalProtocolFee: "7846900000",
      applicationPriceQuotes: [],
      activeFraction: {
        delegationAsset: "SGCTL",
        totalSteps: 16,
        currentStepUsd6: "82599006",
      },
    } as any;
    expect(resolveLaunchpadDelegationUnitCount(sgctl)).toBe(95);
    expect(resolveLaunchpadDelegationUnitCount(sgctl)).toBe(
      resolveLaunchpadDelegationShareCount(sgctl),
    );
  });

  it("falls back to total_steps when the GLW price quote is missing", () => {
    const noPrice = { ...scarletBrookGlw, applicationPriceQuotes: [] } as any;
    expect(resolveLaunchpadDelegationUnitCount(noPrice)).toBe(43);
  });

  it("falls back to total_steps when finalProtocolFee is missing", () => {
    const noFee = { ...scarletBrookGlw, finalProtocolFee: null } as any;
    expect(resolveLaunchpadDelegationUnitCount(noFee)).toBe(43);
  });

  it("is safe for a mining-center (USDC 6-dec) step: falls back to total_steps, no garbage count", () => {
    // A mining-center step is USDC 6-dec ($2,299 = 2299000000). Misread as GLW
    // wei it floors perStepUsd6 to 0, so the function must fall back to
    // total_steps rather than emit an enormous bogus unit count.
    const minerLike = {
      paymentCurrency: "USDC",
      finalProtocolFee: "18392000000",
      applicationPriceQuotes: [{ prices: { GLW: "541878" } }],
      activeFraction: {
        delegationAsset: null,
        totalSteps: 8,
        step: "2299000000",
        stepPrice: "2299000000",
        currentStepUsd6: null,
      },
    } as any;
    expect(resolveLaunchpadDelegationUnitCount(minerLike)).toBe(8);
  });

  it("returns 0 when there is no active fraction", () => {
    expect(
      resolveLaunchpadDelegationUnitCount({
        paymentCurrency: "GLW",
        finalProtocolFee: "1000000000",
        applicationPriceQuotes: [],
        activeFraction: null,
      } as any),
    ).toBe(0);
  });
});
