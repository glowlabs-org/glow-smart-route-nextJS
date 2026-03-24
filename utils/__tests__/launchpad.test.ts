import { describe, expect, it } from "vitest";

import {
  countActiveListings,
  isPublicActiveListing,
  type LaunchpadListingLike,
} from "../launchpad";

function createListing(
  overrides: Partial<NonNullable<LaunchpadListingLike["activeFraction"]>> = {}
): LaunchpadListingLike {
  return {
    activeFraction: {
      isFilled: false,
      remainingSteps: 10,
      totalSteps: 10,
      marketplaceVisibleAt: null,
      ...overrides,
    },
  };
}

describe("isPublicActiveListing", () => {
  it("returns false before marketplaceVisibleAt", () => {
    expect(
      isPublicActiveListing(
        createListing({
          marketplaceVisibleAt: "2026-03-24T17:00:00.000Z",
        }),
        Date.parse("2026-03-24T16:59:59.000Z")
      )
    ).toBe(false);
  });

  it("returns true at marketplaceVisibleAt when the listing still has capacity", () => {
    expect(
      isPublicActiveListing(
        createListing({
          marketplaceVisibleAt: "2026-03-24T17:00:00.000Z",
        }),
        Date.parse("2026-03-24T17:00:00.000Z")
      )
    ).toBe(true);
  });
});

describe("countActiveListings", () => {
  it("counts only public listings with remaining capacity", () => {
    expect(
      countActiveListings(
        [
          createListing(),
          createListing({
            marketplaceVisibleAt: "2026-03-24T17:00:00.000Z",
          }),
          createListing({
            isFilled: true,
            remainingSteps: 0,
          }),
        ],
        Date.parse("2026-03-24T16:59:59.000Z")
      )
    ).toBe(1);
  });
});
