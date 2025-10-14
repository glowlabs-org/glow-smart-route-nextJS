"use client";

import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";
import { getHeadlineStats } from "@/web3/web3/queries/getHeadlineStats";

export function useGlowCirculatingSupply(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const chainId = useChainId();

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["glow-circulating-supply", chainId],
    queryFn: async () => {
      const stats = await getHeadlineStats();

      return {
        circulatingSupply: stats.circulatingSupply,
        totalSupply: stats.totalSupply,
        marketCap: stats.marketCap,
        glowPrice: stats.glowPrice,
      };
    },
    enabled,
    staleTime: 30_000, // 30 seconds
    refetchInterval: enabled ? 60_000 : false, // 1 minute
    refetchOnMount: enabled,
    refetchOnWindowFocus: false,
  });

  return {
    circulatingSupply: data?.circulatingSupply ?? 0,
    totalSupply: data?.totalSupply ?? 0,
    marketCap: data?.marketCap ?? 0,
    glowPrice: data?.glowPrice ?? 0,
    isLoading,
    isFetching,
    error,
  };
}
