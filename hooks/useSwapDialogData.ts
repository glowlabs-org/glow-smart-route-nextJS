"use client";

import { useQuery } from "@tanstack/react-query";
import { getHeadlineStats } from "@/web3/web3/queries/getHeadlineStats";
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";

export type HeadlineStats = Awaited<ReturnType<typeof getHeadlineStats>>;

interface UseSwapDialogDataOptions {
  enabled?: boolean;
}

export function useSwapDialogData(options?: UseSwapDialogDataOptions) {
  const { enabled = true } = options ?? {};

  const headlineStatsQuery = useQuery({
    queryKey: ["headline-stats"],
    queryFn: getHeadlineStats,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const ethPriceQuery = useQuery({
    queryKey: ["eth-price"],
    queryFn: getEthPriceInUSD,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    headlineStats: headlineStatsQuery.data,
    ethPriceInUSD: ethPriceQuery.data ?? null,

    isHeadlineStatsLoading: headlineStatsQuery.isLoading,
    isEthPriceLoading: ethPriceQuery.isLoading,
    isLoading: headlineStatsQuery.isLoading || ethPriceQuery.isLoading,

    headlineStatsError: headlineStatsQuery.error,
    ethPriceError: ethPriceQuery.error,

    refetchHeadlineStats: headlineStatsQuery.refetch,
    refetchEthPrice: ethPriceQuery.refetch,
  };
}


