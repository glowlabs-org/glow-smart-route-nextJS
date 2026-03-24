import { describe, expect, it } from "vitest";
import {
  isFractionOpenForMarketplace,
  isFractionPubliclyVisible,
  type ActiveFraction,
} from "../hub-listings";

function createFraction(overrides: Partial<ActiveFraction> = {}): ActiveFraction {
  return {
    id: "fraction-1",
    nonce: 1,
    status: "active",
    sponsorSplitPercent: 10,
    createdAt: "2024-01-01T00:00:00.000Z",
    expirationAt: null,
    filledAt: null,
    isCommittedOnChain: false,
    isFilled: false,
    totalSteps: 10,
    splitsSold: 0,
    stepPrice: "1",
    step: "1",
    token: null as any,
    owner: "0x0000000000000000000000000000000000000000",
    txHash: null,
    progressPercent: 0,
    remainingSteps: 10,
    amountRaised: null,
    totalAmountNeeded: null,
    rewardScore: null,
    delegationAsset: null,
    delegationPhase: null,
    ...overrides,
  };
}

describe("isFractionOpenForMarketplace", () => {
  it("returns true for active fractions with remaining capacity", () => {
    expect(isFractionOpenForMarketplace(createFraction())).toBe(true);
  });

  it("returns true for committed on-chain fractions when remainingSteps are positive", () => {
    expect(
      isFractionOpenForMarketplace(
        createFraction({
          status: "committed",
          isCommittedOnChain: true,
          remainingSteps: 10,
          isFilled: false,
        })
      )
    ).toBe(true);
  });
});

describe("isFractionPubliclyVisible", () => {
  it("returns false before marketplaceVisibleAt", () => {
    expect(
      isFractionPubliclyVisible(
        createFraction({
          marketplaceVisibleAt: "2026-03-24T17:00:00.000Z",
        }),
        Date.parse("2026-03-24T16:15:00.000Z")
      )
    ).toBe(false);
  });

  it("returns true at or after marketplaceVisibleAt", () => {
    expect(
      isFractionPubliclyVisible(
        createFraction({
          marketplaceVisibleAt: "2026-03-24T17:00:00.000Z",
        }),
        Date.parse("2026-03-24T17:00:00.000Z")
      )
    ).toBe(true);
  });

  it("treats missing marketplaceVisibleAt as visible", () => {
    expect(isFractionPubliclyVisible(createFraction(), 0)).toBe(true);
  });
});
