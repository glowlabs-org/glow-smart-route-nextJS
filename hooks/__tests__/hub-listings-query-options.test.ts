import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mockUseQuery,
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock("@/lib/api/hub-client", () => ({
  hubGet: vi.fn(),
}));

import { useGlowLaunchpad, useMiningCenter } from "@/hooks/hub-listings";

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

describe("sponsor listings query options", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("passes query polling overrides through useGlowLaunchpad", () => {
    renderHook(() =>
      useGlowLaunchpad({
        query: {
          refetchInterval: 15_000,
          refetchIntervalInBackground: true,
        },
      })
    );

    const queryOptions = mockUseQuery.mock.calls[0][0];
    expect(queryOptions.refetchInterval).toBe(15_000);
    expect(queryOptions.refetchIntervalInBackground).toBe(true);
  });

  it("passes query polling overrides through useMiningCenter", () => {
    renderHook(() =>
      useMiningCenter({
        filters: { paymentCurrency: "USDC" },
        query: {
          refetchInterval: 15_000,
          refetchIntervalInBackground: true,
        },
      })
    );

    const queryOptions = mockUseQuery.mock.calls[0][0];
    expect(queryOptions.refetchInterval).toBe(15_000);
    expect(queryOptions.refetchIntervalInBackground).toBe(true);
    expect(queryOptions.queryKey).toEqual([
      "sponsor-listings",
      {
        type: "mining-center",
      },
    ]);
  });
});
