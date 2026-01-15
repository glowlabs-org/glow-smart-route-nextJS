"use client";

import { useQuery } from "@tanstack/react-query";
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";

interface UseSwapDialogDataOptions {
  enabled?: boolean;
}

export function useSwapDialogData(options?: UseSwapDialogDataOptions) {
  const { enabled = true } = options ?? {};

  const ethPriceQuery = useQuery({
    queryKey: ["eth-price"],
    queryFn: getEthPriceInUSD,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    ethPriceInUSD: ethPriceQuery.data ?? null,
    isEthPriceLoading: ethPriceQuery.isLoading,
    isLoading: ethPriceQuery.isLoading,

    ethPriceError: ethPriceQuery.error,
    refetchEthPrice: ethPriceQuery.refetch,
  };
}


