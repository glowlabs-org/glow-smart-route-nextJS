"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/hooks/query-keys";

export interface PolLiquiditySeriesRow {
  weekNumber: number;
  asOfTimestamp: number | null;
  spotPriceUsdgPerGlw: string | null;
  endowmentLq: string; // lq atomic (1e12)
  botActiveLq: string; // lq atomic (1e12)
  totalLq: string; // lq atomic (1e12)
  totalUsdUsdc6: string | null; // USD atomic (1e6)
}

export interface PolLiquiditySeriesResponse {
  range: string;
  weekRange: { startWeek: number; endWeek: number };
  series: PolLiquiditySeriesRow[];
  indexingComplete?: boolean;
}

export function usePolLiquidity(params: { range?: string; enabled?: boolean } = {}) {
  const { range = "12w", enabled = true } = params;

  return useQuery({
    queryKey: QUERY_KEYS.pol.liquidity(range),
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<PolLiquiditySeriesResponse | null> => {
      const search = new URLSearchParams();
      if (range) search.set("range", range);
      const res = await fetch(`/api/pol-liquidity?${search.toString()}`);
      if (!res.ok) throw new Error(`Failed to load PoL liquidity (${res.status})`);
      return (await res.json()) as PolLiquiditySeriesResponse;
    },
  });
}

