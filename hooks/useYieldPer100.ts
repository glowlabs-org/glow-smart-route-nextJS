"use client";

import { useQuery } from "@tanstack/react-query";

export interface YieldPer100Response {
  weekRange: {
    startWeek: number;
    endWeek: number;
  };
  metrics: {
    glwPerWeekPer100UsdMiner: string;
    glwPerWeekPer100GlwDelegated: string;
  };
}

export interface UseYieldPer100Params {
  enabled?: boolean;
}

export function useYieldPer100({ enabled = true }: UseYieldPer100Params = {}) {
  const queryKey = ["yield-per-100"];

  const query = useQuery<YieldPer100Response>({
    queryKey,
    enabled,
    queryFn: async () => {
      const url = `${process.env.NEXT_PUBLIC_HUB_URL}/fractions/yield-per-100`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch yield per 100: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      return data as YieldPer100Response;
    },
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

