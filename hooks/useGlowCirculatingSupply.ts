"use client";

import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";
import { getHeadlineStats } from "@/web3/web3/queries/getHeadlineStats";

export function useGlowCirculatingSupply() {
  const chainId = useChainId();

  const { data, isLoading, error } = useQuery({
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
    enabled: true,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // 1 minute
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  return {
    circulatingSupply: data?.circulatingSupply ?? 0,
    totalSupply: data?.totalSupply ?? 0,
    marketCap: data?.marketCap ?? 0,
    glowPrice: data?.glowPrice ?? 0,
    isLoading,
    error,
  };
}
