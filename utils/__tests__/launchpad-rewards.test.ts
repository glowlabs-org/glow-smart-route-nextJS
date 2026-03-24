import { describe, expect, it } from "vitest";
import { calculateLaunchpadPerShareRewards, parseUsd6Amount } from "../launchpad-rewards";
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
