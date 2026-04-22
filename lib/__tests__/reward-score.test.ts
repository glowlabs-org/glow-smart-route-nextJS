import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import type {
  ActiveFraction,
  ApplicationPriceQuote,
  AuctionApplication,
} from "@/hooks/hub-listings";
import {
  REWARD_SCORE_FALLBACK_USER_ID,
  buildRewardScoreBatchInputs,
  buildRewardScoreCurrencyKey,
  filterActiveRewardApplications,
  resolveRewardScorePaymentCurrency,
} from "../reward-score";

function createActiveFraction(
  overrides: Partial<ActiveFraction> = {}
): ActiveFraction {
  return {
    id: "fraction-1",
    nonce: 1,
    status: "active",
    sponsorSplitPercent: 10,
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
    delegationAsset: null,
    delegationPhase: null,
    ...overrides,
  };
}

function createPriceQuote(
  overrides: Partial<ApplicationPriceQuote> = {}
): ApplicationPriceQuote {
  return {
    id: 1,
    prices: {
      GLW: "2",
      GCTL: "5",
      SGCTL: "0",
      USDC: "1",
      USDG: "1",
    },
    signature: "sig",
    createdAt: "2024-01-01T00:00:00.000Z",
    gcaAddress: "0x0000000000000000000000000000000000000000",
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
    finalProtocolFee: "1000",
    paymentCurrency: "GLW",
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
    applicationPriceQuotes: [createPriceQuote()],
    enquiryFields: null,
    auditFields: {
      systemWattageOutput: 1,
      averageSunlightHoursPerDay: 1,
      expectedWeeklyCarbonCredits: 1,
      netCarbonCreditEarningWeekly: 10,
      solarPanelsQuantity: 1,
    },
    weeklyProduction: [],
    weeklyCarbonDebt: [],
    afterInstallPictures: [],
    activeFraction: createActiveFraction(),
    ...overrides,
  };
}

describe("resolveRewardScorePaymentCurrency", () => {
  it("switches SGCTL delegations to SGCTL even when the caller falls back to GLW", () => {
    const sgctlApplication = createApplication("sgctl-app", {
      activeFraction: createActiveFraction({
        delegationAsset: "SGCTL",
        delegationPhase: "sgctl",
      }),
    });

    expect(resolveRewardScorePaymentCurrency(sgctlApplication, "GLW")).toBe(
      "SGCTL"
    );
  });

  it("keeps the fallback currency for standard delegations", () => {
    const glwApplication = createApplication("glw-app");
    expect(resolveRewardScorePaymentCurrency(glwApplication, "GLW")).toBe(
      "GLW"
    );
  });
});

describe("filterActiveRewardApplications", () => {
  it("excludes fractions that are already committed on-chain", () => {
    const active = createApplication("active");
    const committed = createApplication("committed", {
      activeFraction: createActiveFraction({
        status: "committed",
        isCommittedOnChain: true,
        remainingSteps: 10,
        isFilled: false,
      }),
    });

    expect(filterActiveRewardApplications([active, committed]).map((app) => app.id))
      .toEqual(["active"]);
  });
});

describe("buildRewardScoreCurrencyKey", () => {
  it("differentiates GLW and SGCTL launchpad rows in the cache key", () => {
    const glwApplication = createApplication("glw-app");
    const sgctlApplication = createApplication("sgctl-app", {
      activeFraction: createActiveFraction({
        delegationAsset: "SGCTL",
        delegationPhase: "sgctl",
      }),
    });

    expect(
      buildRewardScoreCurrencyKey([glwApplication, sgctlApplication], "GLW")
    ).toBe("glw-app:GLW|sgctl-app:SGCTL");
  });
});

describe("buildRewardScoreBatchInputs", () => {
  it("builds mixed-currency reward score requests with the correct decimals", () => {
    const glwApplication = createApplication("glw-app", {
      finalProtocolFee: "1000",
    });
    const sgctlApplication = createApplication("sgctl-app", {
      finalProtocolFee: "1000",
      activeFraction: createActiveFraction({
        delegationAsset: "SGCTL",
        delegationPhase: "sgctl",
      }),
    });

    const { requestList, batchParams } = buildRewardScoreBatchInputs({
      applications: [glwApplication, sgctlApplication],
      paymentCurrency: "GLW",
      walletAddress: null,
    });

    expect(requestList).toHaveLength(2);
    expect(batchParams).toEqual([
      {
        userId: REWARD_SCORE_FALLBACK_USER_ID,
        sponsorSplitPercent: 10,
        protocolDepositAmount: parseUnits("500", 18).toString(),
        protocolDepositUsd6: "1000",
        paymentCurrency: "GLW",
        // Mirrors the fixture's GLW price quote ("2").
        paymentCurrencyPriceUsd6: "2",
        expectedWeeklyCarbonCredits: 10,
        regionId: 1,
      },
      {
        userId: REWARD_SCORE_FALLBACK_USER_ID,
        sponsorSplitPercent: 10,
        protocolDepositAmount: parseUnits("200", 6).toString(),
        protocolDepositUsd6: "1000",
        paymentCurrency: "SGCTL",
        // SGCTL quote is 0 in the fixture; code falls back to the GCTL
        // quote ("5") so the reward score has a usable price.
        paymentCurrencyPriceUsd6: "5",
        expectedWeeklyCarbonCredits: 10,
        regionId: 1,
      },
    ]);
  });
});

describe("filterActiveRewardApplications", () => {
  it("keeps only non-filled delegations with remaining steps", () => {
    const active = createApplication("active");
    const soldOut = createApplication("sold-out", {
      activeFraction: createActiveFraction({ isFilled: true, remainingSteps: 0 }),
    });
    const noFraction = createApplication("no-fraction", { activeFraction: null });

    const result = filterActiveRewardApplications([active, soldOut, noFraction]);

    expect(result.map((application) => application.id)).toEqual(["active"]);
  });
});
