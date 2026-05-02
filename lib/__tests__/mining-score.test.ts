import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import type { MiningScoresBatchResponse } from "@glowlabs-org/utils/browser";
import type { AuctionApplication, ActiveFraction } from "@/hooks/hub-listings";
import {
  MINING_SCORE_FALLBACK_USER_ID,
  buildMiningScoreBatchInputs,
  buildMiningScoreExtraLiveFarms,
  filterActiveMiningApplications,
  mergeMiningScoreExtraLiveFarms,
  mapMiningScoresBatchToApplications,
  normalizeMinerWeeksRemainingDisplay,
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
    pdRecoveryDiscount: "1.25",
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

  it("builds extra live farms from unfunded GLW launchpad listings", () => {
    const miningApplication = createApplication("miner-1");
    const launchpadApplication = createApplication("launchpad-1", {
      farmId: null,
      paymentCurrency: "GLW",
      finalProtocolFee: "37777180000",
      applicationPriceQuotes: [
        {
          id: 1,
          prices: {
            GLW: "396750",
            GCTL: "500000",
            SGCTL: "500000",
            USDC: "1000000",
            USDG: "1000000",
          },
          signature: "sig",
          createdAt: "2024-01-01T00:00:00.000Z",
          gcaAddress: "0x0000000000000000000000000000000000000000",
        },
      ],
      auditFields: {
        systemWattageOutput: 1,
        averageSunlightHoursPerDay: 1,
        expectedWeeklyCarbonCredits: 1,
        netCarbonCreditEarningWeekly: 0.1333,
        solarPanelsQuantity: 1,
      },
      activeFraction: createActiveFraction({
        delegationAsset: "GLW",
        delegationPhase: "glw",
      }),
    });

    const { farmParams, extraLiveFarms } = buildMiningScoreBatchInputs(
      [miningApplication],
      [launchpadApplication]
    );

    expect(farmParams).toHaveLength(1);
    expect(extraLiveFarms).toEqual([
      {
        farmId: "launchpad-1",
        regionId: 1,
        expectedWeeklyCarbonCredits: 0.1333,
        protocolDepositPaidAmount: "95216584751102709515000",
        protocolDepositUSDC6Decimals: "37777180000",
        protocolDepositPaidCurrency: "GLW",
        builtEpoch: expect.any(Number),
      },
    ]);
  });

  it("merges live-soon mining score context into extra live farms", () => {
    const miningApplication = createApplication("miner-1");
    const liveSoonFarm = {
      farmId: "live-soon-farm",
      applicationId: "live-soon-app",
      applicationStatus: "waiting-for-payment",
      status: "go_live_passed" as const,
      goLiveAt: "2026-03-24T00:00:00.000Z",
      miningScoreContext: {
        farmId: "live-soon-farm",
        regionId: 9,
        expectedWeeklyCarbonCredits: 0.1333,
        protocolDepositPaidAmount: "95216584751102709515000",
        protocolDepositUSDC6Decimals: "37777180000",
        protocolDepositPaidCurrency: "GLW",
        builtEpoch: 122,
        rewardSplits: [
          {
            walletAddress: "0x6972B05A0c80064fBE8a10CBc2a2FBCF6fb47D6a",
            glowSplitPercent6Decimals: "880000",
            depositSplitPercent6Decimals: "1000000",
          },
        ],
      },
    };

    const { farmParams, extraLiveFarms } = buildMiningScoreBatchInputs(
      [miningApplication],
      [],
      [liveSoonFarm]
    );

    expect(farmParams).toHaveLength(1);
    expect(extraLiveFarms).toEqual([liveSoonFarm.miningScoreContext]);
    expect(mergeMiningScoreExtraLiveFarms([], [liveSoonFarm])).toEqual([
      liveSoonFarm.miningScoreContext,
    ]);
  });
});

describe("buildMiningScoreExtraLiveFarms", () => {
  it("includes unfunded sponsor listings and skips already-live farms", () => {
    const sgctlLaunchpad = createApplication("launchpad-sgctl", {
      farmId: null,
      paymentCurrency: "GLW",
      finalProtocolFee: "1000",
      applicationPriceQuotes: [
        {
          id: 1,
          prices: {
            GLW: "1",
            GCTL: "5",
            SGCTL: "5",
            USDC: "1",
            USDG: "1",
          },
          signature: "sig",
          createdAt: "2024-01-01T00:00:00.000Z",
          gcaAddress: "0x0000000000000000000000000000000000000000",
        },
      ],
      auditFields: {
        systemWattageOutput: 1,
        averageSunlightHoursPerDay: 1,
        expectedWeeklyCarbonCredits: 1,
        netCarbonCreditEarningWeekly: 10,
        solarPanelsQuantity: 1,
      },
      activeFraction: createActiveFraction({
        delegationAsset: "SGCTL",
        delegationPhase: "sgctl",
      }),
    });
    const alreadyLive = createApplication("launchpad-live", {
      farmId: "launchpad-live-farm",
    });

    expect(buildMiningScoreExtraLiveFarms([sgctlLaunchpad, alreadyLive])).toEqual(
      [
        {
          farmId: "launchpad-sgctl",
          regionId: 1,
          expectedWeeklyCarbonCredits: 10,
          protocolDepositPaidAmount: "1000000000000000000000",
          protocolDepositUSDC6Decimals: "1000",
          protocolDepositPaidCurrency: "GLW",
          builtEpoch: expect.any(Number),
        },
      ]
    );
  });
});

describe("normalizeMinerWeeksRemainingDisplay", () => {
  it("adds the current reward epoch for positive values", () => {
    expect(normalizeMinerWeeksRemainingDisplay(74)).toBe(75);
    expect(normalizeMinerWeeksRemainingDisplay(74.9)).toBe(75);
  });

  it("keeps zero and invalid values safe", () => {
    expect(normalizeMinerWeeksRemainingDisplay(0)).toBe(0);
    expect(normalizeMinerWeeksRemainingDisplay(null)).toBeNull();
    expect(normalizeMinerWeeksRemainingDisplay(undefined)).toBeNull();
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
            weeksOfMinerLifeRemaining: 80,
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
      weeksOfMinerLifeRemaining: 80,
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
