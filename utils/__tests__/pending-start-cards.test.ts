import { describe, expect, it } from "vitest";

import { shouldIncludePendingStartCard } from "@/utils/pending-start-cards";

describe("shouldIncludePendingStartCard", () => {
  it("keeps pending-start visible for a brand-new mining-center purchase on an already rewarded farm", () => {
    // Purchase made today (epoch phase): the existing rewarded card covers
    // older splits; the new buy hasn't begun earning so the pending-start
    // card legitimately represents it.
    expect(
      shouldIncludePendingStartCard({
        fractionType: "mining-center",
        status: "filled",
        farmTypeKey: "farm-1:mining-center",
        rewardedFarmTypeKeys: new Set(["farm-1:mining-center"]),
        hasCurrentOwnership: true,
        purchaseDate: new Date().toISOString(),
      })
    ).toBe(true);
  });

  it("suppresses pending-start once a mining-center purchase has moved past the epoch phase", () => {
    // Purchase made two weeks ago: the rewarded card already represents this
    // split (week-1 earnings flowing through farmDetails). Showing a second
    // "Earning Soon" card would just duplicate it.
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(
      shouldIncludePendingStartCard({
        fractionType: "mining-center",
        status: "filled",
        farmTypeKey: "farm-1:mining-center",
        rewardedFarmTypeKeys: new Set(["farm-1:mining-center"]),
        hasCurrentOwnership: true,
        purchaseDate: twoWeeksAgo.toISOString(),
      })
    ).toBe(false);
  });

  it("suppresses pending-start for a mining-center purchase on an already rewarded farm when purchaseDate is unknown", () => {
    // Without a purchaseDate we cannot tell if this is the same split that
    // produced the rewarded card. Default to suppression to avoid duplicates.
    expect(
      shouldIncludePendingStartCard({
        fractionType: "mining-center",
        status: "filled",
        farmTypeKey: "farm-1:mining-center",
        rewardedFarmTypeKeys: new Set(["farm-1:mining-center"]),
        hasCurrentOwnership: true,
      })
    ).toBe(false);
  });

  it("suppresses pending-start when rewards-breakdown already accounts for the full mining-center position", () => {
    // Even in the epoch phase, if the rewards-breakdown's amountInvested
    // already includes every dollar the wallet spent on this farm, the
    // rewarded card represents the position end-to-end. A second card
    // would just double-count and would compute its estimate from the
    // wrong listing's step price.
    expect(
      shouldIncludePendingStartCard({
        fractionType: "mining-center",
        status: "filled",
        farmTypeKey: "farm-1:mining-center",
        rewardedFarmTypeKeys: new Set(["farm-1:mining-center"]),
        hasCurrentOwnership: true,
        purchaseDate: new Date().toISOString(),
        isAccountedForByRewards: true,
      })
    ).toBe(false);
  });

  it("ignores isAccountedForByRewards for launchpad delegations", () => {
    // Launchpad already takes the early-return path; isAccountedForByRewards
    // is a mining-center concept and should not change launchpad behavior.
    expect(
      shouldIncludePendingStartCard({
        fractionType: "launchpad",
        status: "filled",
        farmTypeKey: "farm-1:launchpad",
        rewardedFarmTypeKeys: new Set<string>(),
        hasCurrentOwnership: true,
        isAccountedForByRewards: true,
      })
    ).toBe(true);
  });

  it("still suppresses launchpad pending-start for already rewarded same-type farms", () => {
    expect(
      shouldIncludePendingStartCard({
        fractionType: "launchpad",
        status: "filled",
        farmTypeKey: "farm-1:launchpad",
        rewardedFarmTypeKeys: new Set(["farm-1:launchpad"]),
        hasCurrentOwnership: true,
      })
    ).toBe(false);
  });

  it("shows pending-start for a brand-new filled farm before ownership projections catch up", () => {
    expect(
      shouldIncludePendingStartCard({
        fractionType: "launchpad",
        status: "filled",
        farmTypeKey: "farm-2:launchpad",
        rewardedFarmTypeKeys: new Set(),
        hasCurrentOwnership: false,
      })
    ).toBe(true);
  });
});
