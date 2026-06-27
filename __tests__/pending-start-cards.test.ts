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

  it("treats filled, expired and committed mining-center splits as pending-start", () => {
    expect(
      isPendingStartStatus({ fractionType: "mining-center", status: "filled" })
    ).toBe(true);
    expect(
      isPendingStartStatus({ fractionType: "mining-center", status: "expired" })
    ).toBe(true);
    // Evergreen miners are perpetually "committed" (never sell out), so a
    // committed mining-center purchase must still surface a pending-start card.
    expect(
      isPendingStartStatus({
        fractionType: "mining-center",
        status: "committed",
      })
    ).toBe(true);
  });

  it("still shows pending-start when ownership has not been computed yet (hasCurrentOwnership=false means unknown, not sold)", () => {
    // The companion test at utils/__tests__/pending-start-cards.test.ts
    // codifies the opposite semantic for this input shape: we want to
    // show the card optimistically for a brand-new filled farm while
    // ownership projections are still catching up. Renamed to match.
    expect(
      shouldIncludePendingStartCard({
        fractionType: "launchpad",
        status: "filled",
        farmTypeKey: "farm-a:launchpad",
        rewardedFarmTypeKeys: new Set<string>(),
        hasCurrentOwnership: false,
      })
    ).toBe(true);
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
