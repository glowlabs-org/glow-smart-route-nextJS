import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import { estimateMiningCenterWeeklyGlw } from "../sponsorships-in-progress";

describe("estimateMiningCenterWeeklyGlw", () => {
  it("multiplies weekly rewards per miner by purchased miners", () => {
    expect(
      estimateMiningCenterWeeklyGlw({
        miningScore: {
          applicationId: "miner-app",
          farmId: "farm-1",
          miningScore: 662,
          weeklyGlwRewards: parseUnits("58.51", 18).toString(),
        },
        userSteps: 1,
      }),
    ).toBeCloseTo(58.51, 6);
  });

  it("returns zero when no weekly rewards are available", () => {
    expect(
      estimateMiningCenterWeeklyGlw({
        miningScore: null,
        userSteps: 3,
      }),
    ).toBe(0);
  });
});
