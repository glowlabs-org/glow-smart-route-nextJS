"use client";

import { useQuery } from "@tanstack/react-query";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";
import { getGlowMarketCap } from "@/web3/web3/queries/getGlowMarketCap";
import { publicClient } from "@/web3/web3/clients/publicClient";

export function useGlowCirculatingSupply(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const { spotPrice, isLoading: isSpotPriceLoading } = useGlowSpotPrice({
    query: {
      enabled,
      refetchInterval: enabled ? QUERY_CONFIG.DEFAULT.staleTime : false,
    },
  });

  const marketCapQuery = useQuery({
    queryKey: QUERY_KEYS.prices.marketCap(),
    queryFn: async () => {
      try {
        return await getGlowMarketCap(spotPrice, publicClient);
      } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error(String(error));
      }
    },
    enabled: enabled && Number.isFinite(spotPrice) && spotPrice > 0,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnMount: enabled,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
  });

  const data = marketCapQuery.data;

  return {
    circulatingSupply: data?.circulatingSupply ?? 0,
    totalSupply: data?.totalSupply ?? 0,
    marketCap: data?.marketCap ?? 0,
    glowPrice: Number.isFinite(spotPrice) ? spotPrice : 0,
    isLoading: isSpotPriceLoading || marketCapQuery.isLoading,
    isFetching: marketCapQuery.isFetching,
    error: marketCapQuery.error,
    refetchMarketCap: marketCapQuery.refetch,
  };
}
