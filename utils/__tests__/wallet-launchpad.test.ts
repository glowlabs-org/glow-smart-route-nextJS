import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import type {
  ActiveFraction,
  AuctionApplication,
  SplitActivity,
} from "@/hooks/hub-listings";
import {
  buildCurrentLaunchpadCurrencyByFarmId,
  buildLaunchpadCurrenciesByFarmId,
  buildLaunchpadDelegatedAmountsByFarmId,
  resolveLaunchpadActivityFarmId,
} from "@/utils/wallet-launchpad";

type ApplicationOverrides = Partial<Omit<AuctionApplication, "activeFraction">> & {
  activeFraction?: Partial<ActiveFraction> | null;
};

function createApplication(
  id: string,
  overrides: ApplicationOverrides = {}
): AuctionApplication {
  return {
    id,
    farmId: `${id}-farm`,
    paymentCurrency: "GLW",
    activeFraction: {
      delegationAsset: "GLW",
    },
    ...overrides,
  } as AuctionApplication;
}

function createSplitActivity(
  overrides: Partial<SplitActivity> = {}
): SplitActivity {
  return {
    transactionHash: "0xhash",
    blockNumber: 1,
    buyer: "0x0000000000000000000000000000000000000001",
    creator: "0x0000000000000000000000000000000000000002",
    stepsPurchased: 1,
    amount: parseUnits("100", 18).toString(),
    step: parseUnits("100", 18).toString(),
    timestamp: 1,
    purchaseDate: "2026-03-12T10:00:00.000Z",
    fractionId: "fraction-1",
    applicationId: "app-1",
    farmId: "farm-1",
    farmName: "Test Farm",
    fractionType: "launchpad",
    fractionStatus: "committed",
    currency: "GLW",
    currencyDecimals: 18,
    activityAssetKey: "app-1:GLW",
    isFilled: false,
    progressPercent: 40,
    rewardScore: null,
    stepPrice: parseUnits("50", 6).toString(),
    totalValue: "0",
    ...overrides,
  };
}

describe("resolveLaunchpadActivityFarmId", () => {
  it("prefers activity farmId, then listing farmId, then applicationId", () => {
    expect(
      resolveLaunchpadActivityFarmId({
        applicationId: "app-1",
        activityFarmId: "farm-from-activity",
        listingFarmId: "farm-from-listing",
      })
    ).toBe("farm-from-activity");

    expect(
      resolveLaunchpadActivityFarmId({
        applicationId: "app-1",
        activityFarmId: null,
        listingFarmId: "farm-from-listing",
      })
    ).toBe("farm-from-listing");

    expect(
      resolveLaunchpadActivityFarmId({
        applicationId: "app-1",
        activityFarmId: null,
        listingFarmId: null,
      })
    ).toBe("app-1");
  });
});

describe("wallet launchpad aggregation helpers", () => {
  it("keeps mixed GLW and SGCTL history on the same farm while preserving pre-farm application keys", () => {
    const mixedFarmApp = createApplication("app-1", {
      farmId: "farm-1",
      paymentCurrency: "SGCTL",
      activeFraction: {
        delegationAsset: "SGCTL",
      },
    });
    const unresolvedFarmApp = createApplication("app-2", {
      farmId: null,
      paymentCurrency: "SGCTL",
      activeFraction: {
        delegationAsset: "SGCTL",
      },
    });

    const sponsorListings = [mixedFarmApp, unresolvedFarmApp];
    const sponsorListingById = new Map(
      sponsorListings.map((application) => [application.id, application])
    );

    const splitsActivity = [
      createSplitActivity({
        applicationId: "app-1",
        farmId: null,
        amount: parseUnits("200", 18).toString(),
        currency: "GLW",
        currencyDecimals: 18,
        activityAssetKey: "app-1:GLW",
      }),
      createSplitActivity({
        applicationId: "app-1",
        farmId: "farm-1",
        amount: parseUnits("300", 6).toString(),
        step: parseUnits("100", 6).toString(),
        currency: "SGCTL",
        currencyDecimals: 6,
        activityAssetKey: "app-1:SGCTL",
      }),
      createSplitActivity({
        applicationId: "app-2",
        farmId: null,
        amount: parseUnits("150", 6).toString(),
        step: parseUnits("50", 6).toString(),
        currency: "SGCTL",
        currencyDecimals: 6,
        activityAssetKey: "app-2:SGCTL",
      }),
    ];

    const currentCurrencyByFarmId =
      buildCurrentLaunchpadCurrencyByFarmId(sponsorListings);
    const currenciesByFarmId = buildLaunchpadCurrenciesByFarmId({
      splitsActivity,
      sponsorListingById,
    });
    const delegatedAmountsByFarmId = buildLaunchpadDelegatedAmountsByFarmId({
      splitsActivity,
      sponsorListingById,
    });

    expect(currentCurrencyByFarmId.get("app-1")).toBe("SGCTL");
    expect(currentCurrencyByFarmId.get("farm-1")).toBe("SGCTL");
    expect(currentCurrencyByFarmId.get("app-2")).toBe("SGCTL");

    expect(Array.from(currenciesByFarmId.get("farm-1") ?? [])).toEqual(
      expect.arrayContaining(["GLW", "SGCTL"])
    );
    expect(Array.from(currenciesByFarmId.get("app-2") ?? [])).toEqual([
      "SGCTL",
    ]);

    expect(delegatedAmountsByFarmId.get("farm-1")).toEqual({
      GLW: 200,
      SGCTL: 300,
    });
    expect(delegatedAmountsByFarmId.get("app-2")).toEqual({
      SGCTL: 150,
    });
  });
});
