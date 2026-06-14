import { describe, expect, it } from "vitest";
import {
  isFractionOpenForMarketplace,
  isFractionPubliclyVisible,
  isSgctlOrganicLegFrozen,
  resolveGlwRemainingSteps,
  SGCTL_BACKSTOP_GRACE_PERIOD_MS,
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

  it("treats null remainingSteps as unsold totalSteps minus splitsSold", () => {
    const fraction = createFraction({
      status: "committed",
      isCommittedOnChain: true,
      totalSteps: 16,
      splitsSold: 0,
      remainingSteps: null,
      isFilled: false,
    });

    expect(resolveGlwRemainingSteps(fraction)).toBe(16);
    expect(isFractionOpenForMarketplace(fraction)).toBe(true);
  });
});

describe("resolveGlwRemainingSteps", () => {
  it("prefers the exact step ledger over a USD-derived remainingSteps that floors short", () => {
    // The backend derives remainingSteps from leftover USD/GLW, which can floor
    // to one short of a whole step. Trusting it made "Max" buy every unit but
    // the last; the exact ledger (totalSteps - splitsSold) is authoritative.
    const fraction = createFraction({
      totalSteps: 85,
      splitsSold: 0,
      remainingSteps: 84,
      isFilled: false,
    });

    expect(resolveGlwRemainingSteps(fraction)).toBe(85);
  });

  it("clamps overfilled fractions (splitsSold > totalSteps) to zero", () => {
    const fraction = createFraction({
      totalSteps: 128,
      splitsSold: 152,
      remainingSteps: 0,
      isFilled: true,
    });

    expect(resolveGlwRemainingSteps(fraction)).toBe(0);
  });

  it("falls back to remainingSteps when step counts are unavailable", () => {
    const fraction = createFraction({
      totalSteps: Number.NaN as unknown as number,
      splitsSold: Number.NaN as unknown as number,
      remainingSteps: 7,
    });

    expect(resolveGlwRemainingSteps(fraction)).toBe(7);
  });

  it("returns 0 when the fraction is null", () => {
    expect(resolveGlwRemainingSteps(null)).toBe(0);
  });

  it("returns 0 when the fraction is undefined", () => {
    expect(resolveGlwRemainingSteps(undefined)).toBe(0);
  });

  it("wk129 Spectrum post-fix snapshot: total=25, sold=12, remaining=13", () => {
    // After the gca-crm-backend fix at commit `c465bbf`, total_steps =
    // existing_splits_sold + on-chain GLW remainder. For Spectrum that's
    // 12 + 13 = 25, so totalSteps-splitsSold returns the on-chain GLW
    // capacity. Lock this so the deposit-dialog Max button uses 13.
    const fraction = createFraction({
      totalSteps: 25,
      splitsSold: 12,
      remainingSteps: null as unknown as number,
      isFilled: false,
    });

    expect(resolveGlwRemainingSteps(fraction)).toBe(13);
  });

  it("rounds non-integer totalSteps and splitsSold down before subtracting", () => {
    const fraction = createFraction({
      totalSteps: 16.9 as unknown as number,
      splitsSold: 4.1 as unknown as number,
      remainingSteps: null as unknown as number,
      isFilled: false,
    });

    expect(resolveGlwRemainingSteps(fraction)).toBe(12);
  });

  it("clamps negative computed remaining to 0", () => {
    const fraction = createFraction({
      totalSteps: 10,
      splitsSold: 100,
      remainingSteps: null as unknown as number,
      isFilled: false,
    });

    expect(resolveGlwRemainingSteps(fraction)).toBe(0);
  });

  it("ignores fractional remainingSteps fallback in favor of the integer step ledger", () => {
    const fraction = createFraction({
      totalSteps: 20,
      splitsSold: 8,
      remainingSteps: 11.7 as unknown as number,
      isFilled: false,
    });

    expect(resolveGlwRemainingSteps(fraction)).toBe(12);
  });
});

describe("isFractionOpenForMarketplace (extended)", () => {
  it("returns false when the fraction is null", () => {
    // Defensive: the function explicitly accepts null/undefined.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((isFractionOpenForMarketplace as any)(null)).toBe(false);
  });

  it("returns false when isFilled is true even if remaining > 0", () => {
    expect(
      isFractionOpenForMarketplace(
        createFraction({
          totalSteps: 20,
          splitsSold: 5,
          remainingSteps: null as unknown as number,
          isFilled: true,
        }),
      ),
    ).toBe(false);
  });

  it("returns false when remainingSteps is 0 (post-fix wk129 sold-out case)", () => {
    expect(
      isFractionOpenForMarketplace(
        createFraction({
          totalSteps: 25,
          splitsSold: 25,
          remainingSteps: null as unknown as number,
          isFilled: false,
        }),
      ),
    ).toBe(false);
  });

  it("returns false when totalSteps is 0 (malformed row)", () => {
    expect(
      isFractionOpenForMarketplace(
        createFraction({
          totalSteps: 0,
          splitsSold: 0,
          remainingSteps: null as unknown as number,
          isFilled: false,
        }),
      ),
    ).toBe(false);
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

describe("isSgctlOrganicLegFrozen (hide sGCTL tile after GLW sold out + 1h grace)", () => {
  const VISIBLE_AT = "2026-03-24T17:00:00.000Z";
  const visibleAtMs = Date.parse(VISIBLE_AT);
  const graceEndMs = visibleAtMs + SGCTL_BACKSTOP_GRACE_PERIOD_MS; // visibleAt + 1h

  // GLW sold out via the consolidated-window leg; sGCTL leg still has units so
  // we prove the freeze hides the tile REGARDLESS of remaining (those units go
  // to the Foundation backstop, not buyers).
  const glwSoldOut = createFraction({
    visibleAt: VISIBLE_AT,
    glw: { remainingSteps: 0, stepWei: "1000000000000000000" },
    sgctl: { remainingUnits: 5, unitAtomic: "1000000", splitBonusPercent: "8" },
  });

  it("GLW NOT sold out -> never frozen, even long after the grace hour", () => {
    const glwOpen = createFraction({
      visibleAt: VISIBLE_AT,
      glw: { remainingSteps: 3, stepWei: "1000000000000000000" },
      sgctl: { remainingUnits: 5, unitAtomic: "1000000", splitBonusPercent: "8" },
    });
    expect(isSgctlOrganicLegFrozen(glwOpen, graceEndMs + 10 * 60 * 1000)).toBe(
      false
    );
  });

  it("GLW sold out but within the grace hour -> NOT frozen", () => {
    expect(
      isSgctlOrganicLegFrozen(glwSoldOut, visibleAtMs + 30 * 60 * 1000)
    ).toBe(false);
  });

  it("GLW sold out and exactly at the grace edge -> frozen", () => {
    expect(isSgctlOrganicLegFrozen(glwSoldOut, graceEndMs)).toBe(true);
  });

  it("GLW sold out and past the grace hour -> frozen", () => {
    expect(
      isSgctlOrganicLegFrozen(glwSoldOut, graceEndMs + 60 * 1000)
    ).toBe(true);
  });

  it("falls back to marketplaceVisibleAt when visibleAt is absent", () => {
    const legacy = createFraction({
      visibleAt: null,
      marketplaceVisibleAt: VISIBLE_AT,
      glw: { remainingSteps: 0, stepWei: "1000000000000000000" },
      sgctl: { remainingUnits: 5, unitAtomic: "1000000", splitBonusPercent: null },
    });
    expect(isSgctlOrganicLegFrozen(legacy, visibleAtMs + 30 * 60 * 1000)).toBe(
      false
    );
    expect(isSgctlOrganicLegFrozen(legacy, graceEndMs)).toBe(true);
  });

  it("GLW sold out with NO visible-at known -> frozen (conservative)", () => {
    const noVisible = createFraction({
      visibleAt: null,
      marketplaceVisibleAt: null,
      glw: { remainingSteps: 0, stepWei: "1000000000000000000" },
      sgctl: { remainingUnits: 5, unitAtomic: "1000000", splitBonusPercent: null },
    });
    expect(isSgctlOrganicLegFrozen(noVisible, graceEndMs)).toBe(true);
  });

  it("returns false for a null fraction", () => {
    expect(isSgctlOrganicLegFrozen(null, graceEndMs)).toBe(false);
  });
});
