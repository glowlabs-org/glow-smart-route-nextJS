import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUERY_CONFIG } from "@/hooks/query-config";

const {
  mockUseQuery,
  mockBuildRewardScoreCurrencyKey,
  mockBuildMiningScoreExtraLiveFarmsKey,
} = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockBuildRewardScoreCurrencyKey: vi.fn(() => "reward-key"),
  mockBuildMiningScoreExtraLiveFarmsKey: vi.fn(() => "extra-live-key"),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mockUseQuery,
}));

vi.mock("@/lib/api/control-routers", () => ({
  getFarmsRouter: vi.fn(),
  getKickstarterRouter: vi.fn(),
}));

vi.mock("@/lib/reward-score", () => ({
  buildRewardScoreCurrencyKey: mockBuildRewardScoreCurrencyKey,
  buildRewardScoreBatchInputs: vi.fn(() => ({ requestList: [], batchParams: [] })),
  getMissingRewardScoresForApplications: vi.fn(() => []),
  mapRewardScoresBatchToApplications: vi.fn(() => []),
}));

vi.mock("@/lib/mining-score", () => ({
  buildMiningScoreBatchInputs: vi.fn(() => ({
    applicationsWithFarmIds: [],
    farmParams: [],
    extraLiveFarms: [],
  })),
  buildMiningScoreExtraLiveFarmsKey: mockBuildMiningScoreExtraLiveFarmsKey,
  fetchLiveSoonMiningScoreFarms: vi.fn(async () => []),
  mapMiningScoresBatchToApplications: vi.fn(() => []),
}));

import { useMiningScore, useRewardScore } from "@/hooks/control-farms";

function createApplication(id: string) {
  return {
    id,
    farmId: `${id}-farm`,
    userId: "0x0000000000000000000000000000000000000001",
    activeFraction: {
      totalSteps: 10,
      sponsorSplitPercent: 10,
      stepPrice: "1000000",
    },
  } as any;
}

function renderHook<T>(useHook: () => T): T {
  let captured: T | undefined;

  function Probe() {
    captured = useHook();
    return React.createElement("div");
  }

  renderToStaticMarkup(React.createElement(Probe));

  if (captured === undefined) {
    throw new Error("Hook result was not captured");
  }

  return captured;
}

describe("estimate query caching", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockBuildRewardScoreCurrencyKey.mockClear();
    mockBuildMiningScoreExtraLiveFarmsKey.mockClear();
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("uses the dedicated estimate cache policy for reward scores", () => {
    renderHook(() =>
      useRewardScore({
        applications: [createApplication("reward-app")],
        paymentCurrency: "GLW" as any,
      })
    );

    expect(mockUseQuery).toHaveBeenCalledTimes(1);
    const queryOptions = mockUseQuery.mock.calls[0][0];

    expect(queryOptions.staleTime).toBe(QUERY_CONFIG.ESTIMATES.staleTime);
    expect(queryOptions.gcTime).toBe(QUERY_CONFIG.ESTIMATES.gcTime);
    expect(queryOptions.refetchOnMount).toBe(
      QUERY_CONFIG.ESTIMATES.refetchOnMount
    );
    expect(queryOptions.refetchOnWindowFocus).toBe(
      QUERY_CONFIG.ESTIMATES.refetchOnWindowFocus
    );
    expect(queryOptions.refetchOnReconnect).toBe(
      QUERY_CONFIG.ESTIMATES.refetchOnReconnect
    );
  });

  it("uses the dedicated estimate cache policy and extra-live key for mining scores", () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

    renderHook(() =>
      useMiningScore({
        applications: [createApplication("miner-app")],
        extraLiveApplications: [createApplication("launchpad-app")],
      })
    );

    expect(mockBuildMiningScoreExtraLiveFarmsKey).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "launchpad-app" })],
      []
    );
    expect(mockUseQuery).toHaveBeenCalledTimes(2);

    const liveSoonQueryOptions = mockUseQuery.mock.calls[0][0];
    expect(liveSoonQueryOptions.queryKey).toEqual([
      "sponsor-listings-live-soon",
    ]);

    const queryOptions = mockUseQuery.mock.calls[1][0];
    expect(queryOptions.queryKey).toEqual([
      "mining-scores",
      ["miner-app"],
      "extra-live-key",
    ]);
    expect(queryOptions.staleTime).toBe(QUERY_CONFIG.ESTIMATES.staleTime);
    expect(queryOptions.gcTime).toBe(QUERY_CONFIG.ESTIMATES.gcTime);
    expect(queryOptions.refetchOnMount).toBe(
      QUERY_CONFIG.ESTIMATES.refetchOnMount
    );
    expect(queryOptions.refetchOnWindowFocus).toBe(
      QUERY_CONFIG.ESTIMATES.refetchOnWindowFocus
    );
    expect(queryOptions.refetchOnReconnect).toBe(
      QUERY_CONFIG.ESTIMATES.refetchOnReconnect
    );
  });
});
