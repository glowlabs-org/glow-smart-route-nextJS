import { describe, expect, it } from "vitest";
import { formatInProgressFilledLabel } from "@/app/test/widgets/farms-performance-dialog";
import type { AuctionApplication } from "@/hooks/hub-listings";

function createApplication(
  overrides: Partial<AuctionApplication> = {}
): AuctionApplication {
  return {
    id: "app-1",
    userId: "user-1",
    farmId: null,
    farmName: "Radiant Plane",
    application_status: "waiting-for-payment",
    paymentCurrency: "SGCTL",
    sponsorSplitPercent: 35,
    finalProtocolFee: "953554810000",
    maxSplits: "207000000",
    zone: {
      id: 1,
      name: "Ratan Rajasthan",
      isAcceptingSponsors: true,
      isActive: true,
      requirementSet: {
        id: 1,
        name: "Rajasthan",
        code: "rajasthan",
      },
    },
    activeFraction: {
      id: "fraction-1",
      nonce: 1,
      status: "draft",
      sponsorSplitPercent: 35,
      createdAt: "2026-04-13T00:00:00.000Z",
      expirationAt: null,
      filledAt: null,
      isCommittedOnChain: false,
      isFilled: false,
      totalSteps: 4607,
      splitsSold: 1,
      stepPrice: "399744605825866273877",
      step: "399744605825866273877",
      sgctlStepAtomic: "26666666",
      token: "GLW",
      owner: "0xowner",
      txHash: null,
      delegationAsset: "SGCTL",
      delegationPhase: "sgctl",
      marketplaceVisibleAt: null,
      glwDelegationVisibleAt: null,
      progressPercent: 0,
      remainingSteps: 47677,
      remainingUsd6: "953534810001",
      currentStepUsd6: "19999999",
      amountRaised: null,
      totalAmountNeeded: null,
      rewardScore: 199,
    },
    applicationPriceQuotes: [],
    documents: [],
    weeklyProductions: [],
    weeklyCarbonDebts: [],
    ...overrides,
  } as AuctionApplication;
}

describe("formatInProgressFilledLabel", () => {
  it("uses normalized SGCTL share counts for launchpad lifecycle labels", () => {
    const application = createApplication();

    expect(
      formatInProgressFilledLabel({
        application,
        fractionType: "launchpad",
      })
    ).toBe("1 / 47678 filled");
  });

  it("keeps miner lifecycle labels based on miner counts", () => {
    const application = createApplication({
      paymentCurrency: "USDG",
      activeFraction: {
        ...createApplication().activeFraction,
        totalSteps: 10,
        remainingSteps: 7,
        sgctlStepAtomic: null,
        delegationAsset: "GLW",
      },
    });

    expect(
      formatInProgressFilledLabel({
        application,
        fractionType: "mining-center",
      })
    ).toBe("3 / 10 miners filled");
  });
});
