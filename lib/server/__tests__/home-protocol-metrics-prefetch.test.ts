import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "../../../hooks/query-keys";
import type { HeadlineStats } from "../headline-stats";
import { prefetchHomeProtocolMetricsData } from "../home-protocol-metrics-prefetch";
import { hubGet } from "../../api/hub-client";

vi.mock("../../api/hub-client", () => ({
  hubGet: vi.fn(),
}));

const HEADLINE_STATS_FIXTURE: HeadlineStats = {
  glowPrice: 1.2345,
  uniswapPrice: 1.25,
  lowestGlowPrice: 1.2,
  earlyLiquidityPrice: 1.21,
  circulatingSupply: 12_345_678,
  marketCap: 15_240_740,
  totalSupply: 88_000_000,
  usdcRewardPool: "1000000",
};

describe("prefetchHomeProtocolMetricsData", () => {
  const originalHubUrl = process.env.NEXT_PUBLIC_HUB_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_HUB_URL = "https://hub.example";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalHubUrl) process.env.NEXT_PUBLIC_HUB_URL = originalHubUrl;
    else delete process.env.NEXT_PUBLIC_HUB_URL;
  });

  it("hydrates protocol metrics keys used by the home page", async () => {
    const queryClient = new QueryClient();
    const mockedHubGet = vi.mocked(hubGet);

    mockedHubGet.mockResolvedValue({
      weekRange: { startWeek: 10, endWeek: 10 },
      totalGlwDelegatedWei: "123000000000000000000",
      totalWallets: 42,
    });

    const completedFarms = [
      {
        id: "farm-1",
        status: "completed",
        paymentCurrency: "USDC",
        netCarbonCreditEarningWeekly: "0",
        solarPanelsQuantity: 1,
        paymentAmount: "1000000",
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => completedFarms,
    });
    vi.stubGlobal("fetch", fetchMock);

    await prefetchHomeProtocolMetricsData(queryClient, {
      headlineStats: HEADLINE_STATS_FIXTURE,
    });

    expect(queryClient.getQueryData(QUERY_KEYS.prices.glowSpot())).toMatchObject({
      spotPrice: HEADLINE_STATS_FIXTURE.glowPrice,
      indexingComplete: true,
    });

    expect(queryClient.getQueryData(QUERY_KEYS.prices.marketCap())).toEqual({
      circulatingSupply: HEADLINE_STATS_FIXTURE.circulatingSupply,
      marketCap: HEADLINE_STATS_FIXTURE.marketCap,
      totalSupply: HEADLINE_STATS_FIXTURE.totalSupply,
    });

    expect(
      queryClient.getQueryData(QUERY_KEYS.fractions.totalActivelyDelegated())
    ).toEqual({
      weekRange: { startWeek: 10, endWeek: 10 },
      totalGlwDelegatedWei: "123000000000000000000",
      totalWallets: 42,
    });

    expect(queryClient.getQueryData(["completed-farms", false])).toEqual(
      completedFarms
    );

    expect(mockedHubGet).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

});
