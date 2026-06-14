import { describe, expect, it } from "vitest";
import {
  expandLaunchpadCardEntries,
  hasBuyableSgctlLeg,
} from "../launchpad-card-legs";
import {
  SGCTL_BACKSTOP_GRACE_PERIOD_MS,
  type ActiveFraction,
  type AuctionApplication,
} from "@/hooks/hub-listings";

const VISIBLE_AT = "2026-03-24T17:00:00.000Z";
const visibleAtMs = Date.parse(VISIBLE_AT);
const graceEndMs = visibleAtMs + SGCTL_BACKSTOP_GRACE_PERIOD_MS;
const withinGraceMs = visibleAtMs + 30 * 60 * 1000;

function makeFraction(overrides: Partial<ActiveFraction> = {}): ActiveFraction {
  return {
    id: "fraction-1",
    nonce: 1,
    status: "active",
    sponsorSplitPercent: 70,
    createdAt: "2026-03-24T16:00:00.000Z",
    expirationAt: null,
    filledAt: null,
    isCommittedOnChain: true,
    isFilled: false,
    totalSteps: 10,
    splitsSold: 0,
    stepPrice: "1",
    step: "1",
    token: "0x0000000000000000000000000000000000000000",
    owner: "0x0000000000000000000000000000000000000000",
    txHash: null,
    visibleAt: VISIBLE_AT,
    glw: { remainingSteps: 5, stepWei: "1000000000000000000" },
    sgctl: { remainingUnits: 3, unitAtomic: "1000000", splitBonusPercent: "8" },
    progressPercent: 0,
    remainingSteps: 5,
    amountRaised: null,
    totalAmountNeeded: null,
    ...overrides,
  } as ActiveFraction;
}

function makeApp(
  id: string,
  fractionOverrides: Partial<ActiveFraction> = {}
): AuctionApplication {
  return {
    id,
    activeFraction: makeFraction(fractionOverrides),
  } as unknown as AuctionApplication;
}

const allEligible = () => true;
const allDelegations = () => true;

function legsFor(entries: ReturnType<typeof expandLaunchpadCardEntries>) {
  return entries.map((e) => e.leg);
}

describe("hasBuyableSgctlLeg", () => {
  it("true when the sGCTL leg has a positive unit price", () => {
    expect(hasBuyableSgctlLeg(makeApp("a"))).toBe(true);
  });
  it("false when there is no sGCTL leg", () => {
    expect(hasBuyableSgctlLeg(makeApp("a", { sgctl: null }))).toBe(false);
  });
  it("false when the sGCTL unit price is zero", () => {
    expect(
      hasBuyableSgctlLeg(
        makeApp("a", {
          sgctl: { remainingUnits: 3, unitAtomic: "0", splitBonusPercent: "8" },
        })
      )
    ).toBe(false);
  });
});

describe("expandLaunchpadCardEntries (two-tile + sGCTL freeze)", () => {
  it("eligible + buyable sGCTL + GLW open -> GLW and SGCTL tiles", () => {
    const entries = expandLaunchpadCardEntries({
      applications: [makeApp("a")],
      isSgctlEligible: allEligible,
      isDelegation: allDelegations,
      nowMs: graceEndMs + 60 * 1000, // GLW still open, so time is irrelevant
    });
    expect(legsFor(entries)).toEqual(["GLW", "SGCTL"]);
  });

  it("GLW sold out but within the grace hour -> still shows the SGCTL tile", () => {
    const entries = expandLaunchpadCardEntries({
      applications: [
        makeApp("a", {
          glw: { remainingSteps: 0, stepWei: "1000000000000000000" },
        }),
      ],
      isSgctlEligible: allEligible,
      isDelegation: allDelegations,
      nowMs: withinGraceMs,
    });
    expect(legsFor(entries)).toEqual(["GLW", "SGCTL"]);
  });

  it("GLW sold out AND past the grace hour -> HIDES the SGCTL tile (frozen)", () => {
    const entries = expandLaunchpadCardEntries({
      applications: [
        makeApp("a", {
          glw: { remainingSteps: 0, stepWei: "1000000000000000000" },
          // units still remain, but they go to the backstop -> not buyable
          sgctl: {
            remainingUnits: 3,
            unitAtomic: "1000000",
            splitBonusPercent: "8",
          },
        }),
      ],
      isSgctlEligible: allEligible,
      isDelegation: allDelegations,
      nowMs: graceEndMs,
    });
    expect(legsFor(entries)).toEqual(["GLW"]);
  });

  it("ineligible wallet -> only the GLW tile (never sGCTL)", () => {
    const entries = expandLaunchpadCardEntries({
      applications: [makeApp("a")],
      isSgctlEligible: () => false,
      isDelegation: allDelegations,
      nowMs: withinGraceMs,
    });
    expect(legsFor(entries)).toEqual(["GLW"]);
  });

  it("delegation with no sGCTL leg -> only the GLW tile", () => {
    const entries = expandLaunchpadCardEntries({
      applications: [makeApp("a", { sgctl: null })],
      isSgctlEligible: allEligible,
      isDelegation: allDelegations,
      nowMs: withinGraceMs,
    });
    expect(legsFor(entries)).toEqual(["GLW"]);
  });

  it("miner (non-delegation) -> a single null-leg entry", () => {
    const entries = expandLaunchpadCardEntries({
      applications: [makeApp("a")],
      isSgctlEligible: allEligible,
      isDelegation: () => false,
      nowMs: withinGraceMs,
    });
    expect(legsFor(entries)).toEqual([null]);
    expect(entries[0]?.key).toBe("a:MINER");
  });

  it("marks the GLW tile sold-out via legSoldOut without removing it", () => {
    const entries = expandLaunchpadCardEntries({
      applications: [
        makeApp("a", {
          glw: { remainingSteps: 0, stepWei: "1000000000000000000" },
        }),
      ],
      isSgctlEligible: allEligible,
      isDelegation: allDelegations,
      nowMs: withinGraceMs,
    });
    const glw = entries.find((e) => e.leg === "GLW");
    expect(glw?.legSoldOut).toBe(true);
  });
});
