"use client";

import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";
import { getHeadlineStats } from "@/web3/web3/queries/getHeadlineStats";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";

export function useGlowCirculatingSupply(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const chainId = useChainId();

  const headlineStatsQuery = useQuery({
    queryKey: QUERY_KEYS.prices.headline(chainId),
    queryFn: getHeadlineStats,
    enabled,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnMount: enabled,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
  });

  const data = headlineStatsQuery.data;

  return {
    circulatingSupply: data?.circulatingSupply ?? 0,
    totalSupply: data?.totalSupply ?? 0,
    marketCap: data?.marketCap ?? 0,
    glowPrice: data?.glowPrice ?? 0,
    isLoading: headlineStatsQuery.isLoading,
    isFetching: headlineStatsQuery.isFetching,
    error: headlineStatsQuery.error,
  };
}