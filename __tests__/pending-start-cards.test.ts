import { describe, expect, it } from "vitest";
import {
  isPendingStartStatus,
  shouldIncludePendingStartCard,
} from "../utils/pending-start-cards";

describe("pending-start-cards", () => {
  it("treats filled launchpad splits as pending-start", () => {
    expect(
      isPendingStartStatus({ fractionType: "launchpad", status: "filled" })
    ).toBe(true);
    expect(
      isPendingStartStatus({ fractionType: "launchpad", status: "committed" })
    ).toBe(false);
  });

  it("treats filled and expired mining-center splits as pending-start", () => {
    expect(
      isPendingStartStatus({ fractionType: "mining-center", status: "filled" })
    ).toBe(true);
    expect(
      isPendingStartStatus({ fractionType: "mining-center", status: "expired" })
    ).toBe(true);
    expect(
      isPendingStartStatus({
        fractionType: "mining-center",
        status: "committed",
      })
    ).toBe(false);
  });

  it("excludes pending-start cards when wallet no longer has ownership", () => {
    expect(
      shouldIncludePendingStartCard({
        fractionType: "launchpad",
        status: "filled",
        farmTypeKey: "farm-a:launchpad",
        rewardedFarmTypeKeys: new Set<string>(),
        hasCurrentOwnership: false,
      })
    ).toBe(false);
  });

  it("includes valid pending-start cards for current owners", () => {
    expect(
      shouldIncludePendingStartCard({
        fractionType: "launchpad",
        status: "filled",
        farmTypeKey: "farm-a:launchpad",
        rewardedFarmTypeKeys: new Set<string>(),
        hasCurrentOwnership: true,
      })
    ).toBe(true);
  });

  it("excludes cards that are already in rewarded farm details", () => {
    expect(
      shouldIncludePendingStartCard({
        fractionType: "launchpad",
        status: "filled",
        farmTypeKey: "farm-a:launchpad",
        rewardedFarmTypeKeys: new Set<string>(["farm-a:launchpad"]),
        hasCurrentOwnership: true,
      })
    ).toBe(false);
  });
});
