"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/hooks/query-keys";

export interface PolSummaryBucket {
  usdg: string; // USDG in base units (typically 1e6)
  glw: string; // GLW in wei (1e18)
  lq: string; // liquidity units in base units (currently 1e12)
}

export interface PolSummaryResponse {
  endowment: PolSummaryBucket;
  botActive: PolSummaryBucket;
  total: {
    lq: string;
    usd: string; // USD in base units (typically 1e6)
    breakdown: { usdg: string; glw: string };
  };
  spotPrice: string; // USDG per GLW
  indexingComplete: boolean;
}

export function usePolSummary(params: { enabled?: boolean } = {}) {
  const { enabled = true } = params;

  return useQuery({
    queryKey: QUERY_KEYS.pol.summary(),
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<PolSummaryResponse | null> => {
      const res = await fetch("/api/pol-summary");
      if (!res.ok) {
        throw new Error(`Failed to load PoL summary (${res.status})`);
      }
      return (await res.json()) as PolSummaryResponse;
    },
  });
}

