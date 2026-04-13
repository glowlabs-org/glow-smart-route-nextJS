import { describe, expect, it } from "vitest";

import { shouldIncludePendingStartCard } from "@/utils/pending-start-cards";

describe("shouldIncludePendingStartCard", () => {
  it("keeps pending-start visible for mining-center purchases on already rewarded farms", () => {
    expect(
      shouldIncludePendingStartCard({
        fractionType: "mining-center",
        status: "filled",
        farmTypeKey: "farm-1:mining-center",
        rewardedFarmTypeKeys: new Set(["farm-1:mining-center"]),
        hasCurrentOwnership: true,
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
