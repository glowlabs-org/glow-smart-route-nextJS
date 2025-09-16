"use client";

import { FarmsRouter } from "@glowlabs-org/utils/browser";
import { useQuery } from "@tanstack/react-query";
import type { FarmWithRewards } from "@glowlabs-org/utils/browser";

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL;

if (!CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

const farmsRouter = FarmsRouter(CONTROL_API_URL);

export interface UseWalletFarmsParams {
  walletAddress?: string;
  enabled?: boolean;
}

export function useWalletFarms({
  walletAddress,
  enabled = true,
}: UseWalletFarmsParams) {
  const queryKey = ["wallet-farms", walletAddress];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<FarmWithRewards[]> => {
      if (!walletAddress) return [];

      try {
        const farms = await farmsRouter.fetchWalletFarmsWithRewards(
          walletAddress
        );
        return farms;
      } catch (error) {
        console.error("Error fetching wallet farms:", error);
        return [];
      }
    },
    enabled: enabled && !!walletAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    farms: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
