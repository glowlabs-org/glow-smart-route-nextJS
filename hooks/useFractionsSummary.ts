"use client";

import { useQuery } from "@tanstack/react-query";

export interface FractionsSummaryResponse {
  totalGlwDelegated: string;
  totalMiningCenterVolume: string;
  launchpadContributors: number;
  miningCenterContributors: number;
  glwDelegationByEpoch: Record<number, string>;
  walletCountByEpoch?: Record<number, number>;
}

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

if (!HUB_URL) {
  throw new Error("NEXT_PUBLIC_HUB_URL is not set");
}

export function useFractionsSummary(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const queryKey = ["fractions", "summary"] as const;

  const query = useQuery<FractionsSummaryResponse>({
    queryKey,
    enabled,
    queryFn: async () => {
      const response = await fetch(`${HUB_URL}/fractions/summary`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch fractions summary: ${response.status} - ${errorText}`
        );
      }
      return (await response.json()) as FractionsSummaryResponse;
    },
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnWindowFocus: false,
  });

  return {
    summary: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}
