import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { parseUnits } from "viem";
import type { MiningScoresBatchResponse } from "@glowlabs-org/utils/browser";
import type {
  ActiveFraction,
  AuctionApplication,
  SponsorListingsFilters,
} from "../../../hooks/hub-listings";
import { QUERY_KEYS } from "../../../hooks/query-keys";
import {
  DASHBOARD_SSR_LISTING_FILTERS,
  prefetchDashboardLaunchpadData,
} from "../dashboard-launchpad-prefetch";

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

describe("prefetchDashboardLaunchpadData", () => {
  const originalHubUrl = process.env.NEXT_PUBLIC_HUB_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_HUB_URL = "https://example.com";
  });

  afterEach(() => {
    if (originalHubUrl) process.env.NEXT_PUBLIC_HUB_URL = originalHubUrl;
    else delete process.env.NEXT_PUBLIC_HUB_URL;
  });

  it("hydrates launchpad/mining listing keys and mining-score key", async () => {
    const queryClient = new QueryClient();
    const activeMiner = createApplication("active-miner");
    const soldOutMiner = createApplication("sold-out-miner", {
      activeFraction: createActiveFraction({
        isFilled: true,
        remainingSteps: 0,
      }),
    });

    const fetchListings = vi.fn(
      async (filters: SponsorListingsFilters): Promise<AuctionApplication[]> => {
        if (filters.type === "mining-center" && filters.includeFilled) {
          return [activeMiner, soldOutMiner];
        }
        if (filters.type === "mining-center") {
          return [activeMiner];
        }
        return [];
      }
    );

    const fetchMiningScoresBatch = vi.fn(
      async (): Promise<MiningScoresBatchResponse> => {
        return {
          results: [
            {
              success: true,
              data: {
                miningScore: 101,
                userWeeklyGlwRewards: parseUnits("6", 18).toString(),
                glwPriceUsd6: "2000000",
              },
            },
          ],
        } as MiningScoresBatchResponse;
      }
    );

    await prefetchDashboardLaunchpadData(queryClient, {
      fetchListings,
      fetchMiningScoresBatch,
    });

    expect(fetchListings).toHaveBeenCalledTimes(4);
    expect(fetchMiningScoresBatch).toHaveBeenCalledTimes(1);

    const seededMiningLiveListings = queryClient.getQueryData<AuctionApplication[]>(
      QUERY_KEYS.listings.sponsor(DASHBOARD_SSR_LISTING_FILTERS.miningLive)
    );
    expect(seededMiningLiveListings).toHaveLength(2);

    const seededMiningScores = queryClient.getQueryData<any[]>(
      QUERY_KEYS.listings.miningScores(["active-miner"])
    );
    expect(seededMiningScores).toHaveLength(1);
    expect(seededMiningScores?.[0]).toMatchObject({
      applicationId: "active-miner",
      miningScore: 101,
      weeklyGlwRewardsUsd: "12.00",
    });
  });

  it("skips mining-score batch prefetch when no active mining listings exist", async () => {
    const queryClient = new QueryClient();
    const soldOutMiner = createApplication("sold-out-miner", {
      activeFraction: createActiveFraction({
        isFilled: true,
        remainingSteps: 0,
      }),
    });

    const fetchListings = vi.fn(
      async (filters: SponsorListingsFilters): Promise<AuctionApplication[]> => {
        if (filters.type === "mining-center" && filters.includeFilled) {
          return [soldOutMiner];
        }
        return [];
      }
    );

    const fetchMiningScoresBatch = vi.fn(
      async (): Promise<MiningScoresBatchResponse> => {
        return { results: [] } as MiningScoresBatchResponse;
      }
    );

    await prefetchDashboardLaunchpadData(queryClient, {
      fetchListings,
      fetchMiningScoresBatch,
    });

    expect(fetchMiningScoresBatch).not.toHaveBeenCalled();
  });
});
