import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { parseUnits } from "viem";
import type { AuctionApplication, SplitActivity } from "@/hooks/hub-listings";
import type { ApplicationRewardScore } from "@/lib/reward-score";

const { mockUseGlowLaunchpad, mockUseRewardScore } = vi.hoisted(() => ({
  mockUseGlowLaunchpad: vi.fn(),
  mockUseRewardScore: vi.fn(),
}));

vi.mock("@/hooks/hub-listings", () => ({
  useGlowLaunchpad: mockUseGlowLaunchpad,
}));

vi.mock("@/hooks/control-farms", () => ({
  useRewardScore: mockUseRewardScore,
}));

import { useWalletLaunchpadInProgress } from "@/hooks/use-wallet-launchpad-in-progress";

function createApplication(
  id: string,
  overrides: Partial<AuctionApplication> = {}
): AuctionApplication {
  return {
    id,
    farmId: `${id}-farm`,
    paymentCurrency: "GLW",
    activeFraction: {
      totalSteps: 10,
      progressPercent: 40,
      isFilled: false,
      remainingSteps: 8,
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

function createRewardScore(
  applicationId: string,
  overrides: Partial<ApplicationRewardScore> = {}
): ApplicationRewardScore {
  return {
    applicationId,
    rewardScore: 100,
    userWeeklyGlwRewards: parseUnits("100", 18).toString(),
    userWeeklyGlwValueUsd: "100",
    userWeeklyPdRewards: parseUnits("50", 18).toString(),
    userWeeklyPdRewardsUsd: "50",
    userEstimatedWeeklyCash: "0",
    userProtocolDeposit: "0",
    ...overrides,
  };
}

function renderHook(params: {
  splitsActivity: SplitActivity[];
  walletAddress?: string | null;
  enabled?: boolean;
}) {
  let captured:
    | ReturnType<typeof useWalletLaunchpadInProgress>
    | undefined;

  function Probe() {
    captured = useWalletLaunchpadInProgress(params);
    return React.createElement("div");
  }

  renderToStaticMarkup(React.createElement(Probe));

  if (!captured) {
    throw new Error("Hook result was not captured");
  }

  return captured;
}

describe("useWalletLaunchpadInProgress", () => {
  beforeEach(() => {
    mockUseGlowLaunchpad.mockReset();
    mockUseRewardScore.mockReset();
  });

  it("derives mixed-asset in-progress launchpad rows and estimates from shared score maps", () => {
    const sponsorListings = [
      createApplication("app-1", {
        farmId: "farm-1",
        paymentCurrency: "SGCTL",
        activeFraction: {
          totalSteps: 10,
          progressPercent: 40,
          isFilled: false,
          remainingSteps: 5,
          delegationAsset: "SGCTL",
        },
      }),
      createApplication("app-2", {
        farmId: "farm-2",
        paymentCurrency: "GLW",
        activeFraction: {
          totalSteps: 20,
          progressPercent: 80,
          isFilled: false,
          remainingSteps: 10,
          delegationAsset: "GLW",
        },
      }),
    ];

    mockUseGlowLaunchpad.mockReturnValue({
      applications: sponsorListings,
      isLoading: false,
      isError: false,
    });

    mockUseRewardScore.mockImplementation(
      ({
        paymentCurrency,
      }: {
        paymentCurrency: "GLW" | "SGCTL";
      }) => ({
        rewardScoreMap:
          paymentCurrency === "GLW"
            ? new Map<string, ApplicationRewardScore>([
                [
                  "app-1",
                  createRewardScore("app-1", {
                    userWeeklyGlwRewards: parseUnits("100", 18).toString(),
                    userWeeklyPdRewards: parseUnits("50", 18).toString(),
                  }),
                ],
                [
                  "app-2",
                  createRewardScore("app-2", {
                    userWeeklyGlwRewards: parseUnits("60", 18).toString(),
                    userWeeklyPdRewards: "0",
                    userWeeklyGlwValueUsd: "60",
                    userWeeklyPdRewardsUsd: "0",
                  }),
                ],
              ])
            : new Map<string, ApplicationRewardScore>([
                [
                  "app-1",
                  createRewardScore("app-1", {
                    userWeeklyGlwRewards: parseUnits("80", 18).toString(),
                    userWeeklyPdRewards: parseUnits("30", 6).toString(),
                    userWeeklyGlwValueUsd: "80",
                    userWeeklyPdRewardsUsd: "30",
                  }),
                ],
              ]),
        isLoading: false,
        isError: false,
      })
    );

    const result = renderHook({
      walletAddress: "0xabc",
      enabled: true,
      splitsActivity: [
        createSplitActivity({
          applicationId: "app-1",
          farmId: null,
          stepsPurchased: 2,
          amount: parseUnits("200", 18).toString(),
          currency: "GLW",
          currencyDecimals: 18,
          activityAssetKey: "app-1:GLW",
        }),
        createSplitActivity({
          applicationId: "app-1",
          farmId: "farm-1",
          stepsPurchased: 3,
          amount: parseUnits("300", 6).toString(),
          step: parseUnits("100", 6).toString(),
          currency: "SGCTL",
          currencyDecimals: 6,
          activityAssetKey: "app-1:SGCTL",
        }),
        createSplitActivity({
          applicationId: "app-2",
          farmId: "farm-2",
          stepsPurchased: 1,
          amount: parseUnits("100", 18).toString(),
          currency: "GLW",
          currencyDecimals: 18,
          activityAssetKey: "app-2:GLW",
          progressPercent: 80,
        }),
      ],
    });

    expect(mockUseGlowLaunchpad).toHaveBeenCalledWith({ enabled: true });
    expect(mockUseRewardScore).toHaveBeenCalledTimes(2);
    expect(mockUseRewardScore).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        paymentCurrency: "GLW",
        walletAddress: "0xabc",
        enabled: true,
      })
    );
    expect(mockUseRewardScore).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        paymentCurrency: "SGCTL",
        walletAddress: "0xabc",
        enabled: true,
      })
    );

    expect(result.currentLaunchpadCurrencyByFarmId.get("farm-1")).toBe("SGCTL");
    expect(Array.from(result.launchpadCurrenciesByFarmId.get("farm-1") ?? []))
      .toEqual(expect.arrayContaining(["GLW", "SGCTL"]));
    expect(result.launchpadDelegatedAmountsByFarmId.get("farm-1")).toEqual({
      GLW: 200,
      SGCTL: 300,
    });

    expect(result.sponsorshipsInProgressWithEstimates[0]?.applicationId).toBe(
      "app-2"
    );

    const glwRow = result.sponsorshipsInProgressWithEstimates.find(
      (item) =>
        item.applicationId === "app-1" && item.delegationCurrency === "GLW"
    );
    const sgctlRow = result.sponsorshipsInProgressWithEstimates.find(
      (item) =>
        item.applicationId === "app-1" && item.delegationCurrency === "SGCTL"
    );

    expect(glwRow).toMatchObject({
      estimatedUserWeeklyGlw: 30,
      estimatedUserWeeklyPd: 0,
      estimatedUserWeeklyPdAsset: null,
      delegationCurrency: "GLW",
    });
    expect(sgctlRow).toMatchObject({
      estimatedUserWeeklyGlw: 24,
      estimatedUserWeeklyPd: 9,
      estimatedUserWeeklyPdAsset: "SGCTL",
      delegationCurrency: "SGCTL",
    });
  });

  it("falls back to applicationId keys when launchpad activity exists before farm creation", () => {
    const sponsorListings = [
      createApplication("app-pre-farm", {
        farmId: null,
        paymentCurrency: "SGCTL",
        activeFraction: {
          totalSteps: 10,
          progressPercent: 25,
          isFilled: false,
          remainingSteps: 7,
          delegationAsset: "SGCTL",
        },
      }),
    ];

    mockUseGlowLaunchpad.mockReturnValue({
      applications: sponsorListings,
      isLoading: false,
      isError: false,
    });

    mockUseRewardScore.mockReturnValue({
      rewardScoreMap: new Map<string, ApplicationRewardScore>(),
      isLoading: false,
      isError: false,
    });

    const result = renderHook({
      walletAddress: "0xdef",
      enabled: true,
      splitsActivity: [
        createSplitActivity({
          applicationId: "app-pre-farm",
          farmId: null,
          stepsPurchased: 3,
          amount: parseUnits("150", 6).toString(),
          step: parseUnits("50", 6).toString(),
          currency: "SGCTL",
          currencyDecimals: 6,
          activityAssetKey: "app-pre-farm:SGCTL",
          progressPercent: 25,
        }),
      ],
    });

    expect(result.currentLaunchpadCurrencyByFarmId.get("app-pre-farm")).toBe(
      "SGCTL"
    );
    expect(Array.from(result.launchpadCurrenciesByFarmId.get("app-pre-farm") ?? []))
      .toEqual(["SGCTL"]);
    expect(result.launchpadDelegatedAmountsByFarmId.get("app-pre-farm")).toEqual(
      {
        SGCTL: 150,
      }
    );
    expect(result.sponsorshipsInProgress).toHaveLength(1);
    expect(result.sponsorshipsInProgress[0]).toMatchObject({
      applicationId: "app-pre-farm",
      userSteps: 3,
      delegationCurrency: "SGCTL",
    });
  });
});
