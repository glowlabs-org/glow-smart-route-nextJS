"use client";

import { useQuery } from "@tanstack/react-query";

// Constants
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

// Types based on the backend response
export interface FractionSplit {
  id: string;
  walletAddress: string;
  fractionId: string;
  stepsPurchased: number;
  amount: string; // BigInt as string
  txHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface FractionSplitsResponse {
  walletAddress: string;
  fractionId: string;
  splits: FractionSplit[];
  summary: {
    totalTransactions: number;
    totalStepsPurchased: number;
    totalAmountSpent: string; // BigInt as string
  };
}

export interface UseFractionSplitsParams {
  walletAddress: string | null;
  fractionId: string | null;
  enabled?: boolean;
  refetchInterval?: number;
}

export function useFractionSplits(params: UseFractionSplitsParams) {
  const {
    walletAddress,
    fractionId,
    enabled = true,
    refetchInterval = 10_000, // 10 seconds by default
  } = params;

  const queryKey = ["fraction-splits", walletAddress, fractionId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<FractionSplitsResponse | null> => {
      if (!walletAddress || !fractionId) {
        return null;
      }

      const searchParams = new URLSearchParams({
        walletAddress,
        fractionId,
      });

      const url = `${HUB_URL}/fractions/splits-by-wallet?${searchParams.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        // If 404, return empty response instead of throwing
        if (response.status === 404) {
          return {
            walletAddress,
            fractionId,
            splits: [],
            summary: {
              totalTransactions: 0,
              totalStepsPurchased: 0,
              totalAmountSpent: "0",
            },
          };
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to fetch fraction splits: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      return data as FractionSplitsResponse;
    },
    enabled: enabled && Boolean(walletAddress && fractionId),
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 5_000, // 5 seconds - shorter than refetch interval for real-time feel
  });

  return {
    splits: query.data?.splits || [],
    summary: query.data?.summary || {
      totalTransactions: 0,
      totalStepsPurchased: 0,
      totalAmountSpent: "0",
    },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Helper hook to get splits for multiple fractions
export interface UseMultipleFractionSplitsParams {
  walletAddress: string | null;
  fractionIds: string[];
  enabled?: boolean;
  refetchInterval?: number;
}

export function useMultipleFractionSplits(
  params: UseMultipleFractionSplitsParams
) {
  const {
    walletAddress,
    fractionIds,
    enabled = true,
    refetchInterval = 10_000,
  } = params;

  const queries = fractionIds.map((fractionId) =>
    useFractionSplits({
      walletAddress,
      fractionId,
      enabled,
      refetchInterval,
    })
  );

  const allSplits = queries.flatMap((query) => query.splits);
  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const errors = queries
    .filter((query) => query.error)
    .map((query) => query.error);

  const totalSummary = {
    totalTransactions: queries.reduce(
      (sum, query) => sum + query.summary.totalTransactions,
      0
    ),
    totalStepsPurchased: queries.reduce(
      (sum, query) => sum + query.summary.totalStepsPurchased,
      0
    ),
    totalAmountSpent: queries
      .reduce((sum, query) => {
        try {
          return sum + BigInt(query.summary.totalAmountSpent);
        } catch {
          return sum;
        }
      }, BigInt(0))
      .toString(),
  };

  return {
    allSplits,
    totalSummary,
    isLoading,
    isError,
    errors,
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
