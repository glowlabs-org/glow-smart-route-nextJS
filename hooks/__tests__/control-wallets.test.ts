import { describe, expect, it } from "vitest";

import { calculateImpactEligibleStakedGctl } from "../control-wallets";

describe("calculateImpactEligibleStakedGctl", () => {
  it("counts total staked, delegated, and protocol deposit SGCTL toward impact", () => {
    expect(
      calculateImpactEligibleStakedGctl({
        availableStakedGctl: "2870419030",
        totalStakedAndNotUsedInProtocolFees: "2870419030",
        delegatedSgctlVaultBalance: "25336980000",
        protocolDepositVaultBalance: "55792546932",
      }),
    ).toBe(83999945962n);
  });

  it("does not use available stake as the total impact basis", () => {
    expect(
      calculateImpactEligibleStakedGctl({
        availableStakedGctl: "100",
        totalStakedAndNotUsedInProtocolFees: "250",
        delegatedSgctlVaultBalance: "10",
        protocolDepositVaultBalance: "20",
      }),
    ).toBe(280n);
  });

  it("handles missing fields safely", () => {
    expect(calculateImpactEligibleStakedGctl()).toBe(0n);
    expect(
      calculateImpactEligibleStakedGctl({
        totalStakedAndNotUsedInProtocolFees: "100",
      }),
    ).toBe(100n);
  });
});
