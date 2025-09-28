"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";

// Re-export types from useGlowLaunchpad to maintain consistency
export type {
  PaymentCurrency,
  SortBy,
  SortOrder,
  Zone,
  ApplicationPriceQuote,
  EnquiryFields,
  AuditFields,
  Document,
  WeeklyProduction,
  WeeklyCarbonDebt,
  ActiveFraction,
  AuctionApplication,
  SplitActivity,
  SplitsActivityResponse,
  SponsorApplicationParams,
} from "./useGlowLaunchpad";

// Import helper functions from useGlowLaunchpad
export {
  getAssetPriceQuote,
  calculateProtocolDepositAmount,
  calculateGctlPaymentAmount,
  getAvailableCurrencies,
} from "./useGlowLaunchpad";

import type {
  PaymentCurrency,
  SortBy,
  SortOrder,
  AuctionApplication,
  SplitsActivityResponse,
  SponsorApplicationParams,
} from "./useGlowLaunchpad";

// Constants
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

export interface MiningCenterFilters {
  zoneId?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  paymentCurrency?: PaymentCurrency;
}

export interface UseMiningCenterParams {
  filters?: MiningCenterFilters;
  enabled?: boolean;
}

export interface UseMiningCenterSplitsActivityParams {
  limit?: number;
  walletAddress?: string;
  enabled?: boolean;
}

if (!process.env.NEXT_PUBLIC_CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

export function useMiningCenter(params: UseMiningCenterParams = {}) {
  const { filters = {}, enabled = true } = params;

  const queryKey = ["mining-center", filters];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<AuctionApplication[]> => {
      const searchParams = new URLSearchParams();

      // Always set type to "mining-center"
      searchParams.append("type", "mining-center");

      if (filters.zoneId !== undefined) {
        searchParams.append("zoneId", filters.zoneId.toString());
      }
      if (filters.sortBy) {
        searchParams.append("sortBy", filters.sortBy);
      }
      if (filters.sortOrder) {
        searchParams.append("sortOrder", filters.sortOrder);
      }
      if (filters.paymentCurrency) {
        searchParams.append("paymentCurrency", filters.paymentCurrency);
      }

      const url = `${HUB_URL}/applications/sponsor-listings-applications?${searchParams.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch mining center applications: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as AuctionApplication[];
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    applications: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useSponsorMiningCenterApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SponsorApplicationParams) => {
      // Since the actual sponsorship happens through the forwarder contract,
      // this mutation is primarily for cache invalidation after successful sponsorship
      return {
        applicationId: params.applicationId,
        txHash: params.txHash,
        success: true,
      };
    },
    onSuccess: (data, variables) => {
      // Invalidate mining center queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["mining-center"] });
      queryClient.invalidateQueries({
        queryKey: ["mining-center-splits-activity"],
      });

      // Call the onSuccess callback if provided
      if (variables.onSuccess) {
        variables.onSuccess();
      }
    },
    onError: (error) => {
      console.error("Mining center sponsorship mutation error:", error);
    },
  });
}
