import { describe, expect, it } from "vitest";
import {
  countActiveListings,
  filterPublicLaunchpadApplications,
  isPublicActiveListing,
} from "../launchpad";

function createApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    activeFraction: {
      isFilled: false,
      remainingSteps: 12,
      totalSteps: 120,
      marketplaceVisibleAt: "2026-03-24T18:00:00.000Z",
    },
    ...overrides,
  };
}

describe("filterPublicLaunchpadApplications", () => {
  it("keeps only launchpad applications whose fraction is publicly visible", () => {
    const visibleNow = Date.parse("2026-03-24T17:00:00.000Z");

    const applications: Array<{
      id: string;
      activeFraction: {
        isFilled: boolean;
        remainingSteps: number;
        totalSteps: number;
        marketplaceVisibleAt: string | null;
      };
    }> = [
      createApplication({ id: "hidden-app" }),
      createApplication({
        id: "visible-app",
        activeFraction: {
          isFilled: false,
          remainingSteps: 20,
          totalSteps: 120,
          marketplaceVisibleAt: "2026-03-24T16:30:00.000Z",
        },
      }),
      createApplication({
        id: "always-visible-app",
        activeFraction: {
          isFilled: false,
          remainingSteps: 20,
          totalSteps: 120,
          marketplaceVisibleAt: null,
        },
      }),
    ];

    expect(
      filterPublicLaunchpadApplications(applications, visibleNow).map(
        (application) => application.id,
      ),
    ).toEqual(["visible-app", "always-visible-app"]);
  });
});

describe("isPublicActiveListing", () => {
  it("returns false for listings hidden behind marketplaceVisibleAt", () => {
    expect(
      isPublicActiveListing(
        createApplication() as any,
        Date.parse("2026-03-24T16:59:59.000Z"),
      ),
    ).toBe(false);
  });
});

describe("countActiveListings", () => {
  it("counts only visible listings with remaining capacity", () => {
    const nowMs = Date.parse("2026-03-24T17:00:00.000Z");

    const applications = [
      createApplication({
        id: "visible-open-app",
        activeFraction: {
          isFilled: false,
          remainingSteps: 12,
          totalSteps: 120,
          marketplaceVisibleAt: "2026-03-24T16:00:00.000Z",
        },
      }),
      createApplication({
        id: "sold-out-app",
        activeFraction: {
          isFilled: true,
          remainingSteps: 0,
          totalSteps: 120,
          marketplaceVisibleAt: "2026-03-24T16:00:00.000Z",
        },
      }),
      createApplication({
        id: "hidden-app",
        activeFraction: {
          isFilled: false,
          remainingSteps: 10,
          totalSteps: 120,
          marketplaceVisibleAt: "2026-03-24T18:00:00.000Z",
        },
      }),
    ];

    expect(countActiveListings(applications as any, nowMs)).toBe(1);
  });
});
