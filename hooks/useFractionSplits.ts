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

// Types for refundable fractions
export interface RefundableFraction {
  fraction: {
    id: string;
    applicationId: string;
    status: string;
    createdBy: string;
    owner: string;
    token: string;
    step: string;
    totalSteps: number;
    splitsSold: number;
    expirationAt: string;
    isCommittedOnChain: boolean;
    txHash: string | null;
  };
  userPurchaseData: {
    walletAddress: string;
    totalStepsPurchased: number;
    totalAmountSpent: string;
    purchaseCount: number;
  };
  refundDetails: {
    user: string;
    creator: string;
    fractionId: string;
    estimatedRefundAmount: string;
  };
}

export interface RefundableFractionsResponse {
  walletAddress: string;
  refundableFractions: RefundableFraction[];
  summary: {
    totalRefundableFractions: number;
    totalRefundableAmount: string;
    totalStepsPurchased: number;
    byStatus: {
      expired: number;
      cancelled: number;
    };
  };
}

export interface UseRefundableFractionsParams {
  walletAddress: string | null;
  enabled?: boolean;
  refetchInterval?: number;
}

export function useRefundableFractions(params: UseRefundableFractionsParams) {
  const {
    walletAddress,
    enabled = true,
    refetchInterval = 60_000, // 60 seconds
  } = params;

  const queryKey = ["refundable-fractions", walletAddress];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<RefundableFractionsResponse | null> => {
      if (!walletAddress) {
        return null;
      }

      const searchParams = new URLSearchParams({
        walletAddress,
      });

      const url = `${HUB_URL}/fractions/refundable-by-wallet?${searchParams.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        // If 404, return empty response instead of throwing
        if (response.status === 404) {
          return {
            walletAddress,
            refundableFractions: [],
            summary: {
              totalRefundableFractions: 0,
              totalRefundableAmount: "0",
              totalStepsPurchased: 0,
              byStatus: {
                expired: 0,
                cancelled: 0,
              },
            },
          };
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to fetch refundable fractions: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      return data as RefundableFractionsResponse;
    },
    enabled: enabled && Boolean(walletAddress),
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 10_000, // 10 seconds
  });

  return {
    refundableFractions: query.data?.refundableFractions || [],
    summary: query.data?.summary || {
      totalRefundableFractions: 0,
      totalRefundableAmount: "0",
      totalStepsPurchased: 0,
      byStatus: {
        expired: 0,
        cancelled: 0,
      },
    },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
