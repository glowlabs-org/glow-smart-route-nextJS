import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import type { MiningScoresBatchResponse } from "@glowlabs-org/utils/browser";
import type { AuctionApplication, ActiveFraction } from "@/hooks/hub-listings";
import {
  MINING_SCORE_FALLBACK_USER_ID,
  buildMiningScoreBatchInputs,
  filterActiveMiningApplications,
  mapMiningScoresBatchToApplications,
} from "../mining-score";

function createActiveFraction(
  overrides: Partial<ActiveFraction> = {}
): ActiveFraction {
  return {
    id: "fraction-1",
    nonce: 1,
    status: "active",
    sponsorSplitPercent: 12.3456,
    createdAt: "2024-01-01T00:00:00.000Z",
    expirationAt: null,
    filledAt: null,
    isCommittedOnChain: false,
    isFilled: false,
    totalSteps: 10,
    splitsSold: 2,
    stepPrice: parseUnits("50", 6).toString(),
    step: parseUnits("100", 18).toString(),
    token: "USDC",
    owner: "0x0000000000000000000000000000000000000000",
    txHash: null,
    progressPercent: 20,
    remainingSteps: 8,
    amountRaised: null,
    totalAmountNeeded: null,
    rewardScore: null,
    ...overrides,
  };
}

function createApplication(
  id: string,
  overrides: Partial<AuctionApplication> = {}
): AuctionApplication {
  return {
    id,
    userId: "",
    status: "approved",
    createdAt: "2024-01-01T00:00:00.000Z",
    farmId: `${id}-farm`,
    farmName: `Farm ${id}`,
    isPublishedOnAuction: true,
    publishedOnAuctionTimestamp: "2024-01-01T00:00:00.000Z",
    sponsorSplitPercent: 10,
    finalProtocolFee: null,
    paymentCurrency: "USDC",
    paymentEventType: null,
    zone: {
      id: 1,
      name: "Zone 1",
      isAcceptingSponsors: true,
      isActive: true,
      requirementSet: {
        id: 1,
        name: "Requirement 1",
        code: "REQ_1",
      },
    },
    applicationPriceQuotes: [],
    enquiryFields: null,
    auditFields: null,
    weeklyProduction: [],
    weeklyCarbonDebt: [],
    afterInstallPictures: [],
    activeFraction: createActiveFraction(),
    ...overrides,
  };
}

describe("buildMiningScoreBatchInputs", () => {
  it("uses a stable fallback user id and maps mining params", () => {
    const application = createApplication("app-1", {
      userId: "",
      activeFraction: createActiveFraction({
        sponsorSplitPercent: 12.3456,
        stepPrice: parseUnits("123", 6).toString(),
        totalSteps: 7,
      }),
    });

    const { applicationsWithFarmIds, farmParams } = buildMiningScoreBatchInputs([
      application,
    ]);

    expect(applicationsWithFarmIds).toHaveLength(1);
    expect(farmParams).toEqual([
      {
        farmId: "app-1-farm",
        userId: MINING_SCORE_FALLBACK_USER_ID,
        dollarCostOfMiner: parseUnits("123", 6).toString(),
        numberOfMiners: 7,
        minerRewardSplit: parseUnits("12.3456", 4).toString(),
      },
    ]);
  });
});

describe("filterActiveMiningApplications", () => {
  it("keeps only applications with non-filled fractions and remaining steps", () => {
    const active = createApplication("active");
    const soldOut = createApplication("sold-out", {
      activeFraction: createActiveFraction({ isFilled: true, remainingSteps: 0 }),
    });
    const noFraction = createApplication("no-fraction", { activeFraction: null });

    const result = filterActiveMiningApplications([active, soldOut, noFraction]);

    expect(result.map((application) => application.id)).toEqual(["active"]);
  });
});

describe("mapMiningScoresBatchToApplications", () => {
  it("maps successful and failed batch rows and preserves no-farm errors", () => {
    const successApp = createApplication("success");
    const noFarmApp = createApplication("no-farm", { farmId: null });
    const failedApp = createApplication("failed");
    const applications = [successApp, noFarmApp, failedApp];

    const { farmParams } = buildMiningScoreBatchInputs(applications);

    const response = {
      results: [
        {
          success: true,
          data: {
            miningScore: 88,
            userWeeklyGlwRewards: parseUnits("5", 18).toString(),
            glwPriceUsd6: "2500000",
          },
        },
        {
          success: false,
          error: "Backend failed",
        },
      ],
    } as MiningScoresBatchResponse;

    const mapped = mapMiningScoresBatchToApplications(
      applications,
      farmParams,
      response
    );

    expect(mapped).toHaveLength(3);
    expect(mapped[0]).toMatchObject({
      applicationId: "success",
      farmId: "success-farm",
      miningScore: 88,
      weeklyGlwRewardsUsd: "12.50",
    });
    expect(mapped[1]).toMatchObject({
      applicationId: "no-farm",
      farmId: "",
      miningScore: 0,
      error: "No farmId available",
    });
    expect(mapped[2]).toMatchObject({
      applicationId: "failed",
      farmId: "failed-farm",
      miningScore: 0,
      error: "Backend failed",
    });
  });
});
