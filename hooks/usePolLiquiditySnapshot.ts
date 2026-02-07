"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/hooks/query-keys";

export interface PolLiquiditySnapshotRow {
  week: number;
  pol_usdg: string;
  pol_glw: string;
  pol_lq: string; // liquidity units in base units (currently 1e12)
}

export interface PolLiquiditySnapshotResponse {
  range: string;
  weekRange: { startWeek: number; endWeek: number };
  series: PolLiquiditySnapshotRow[];
  indexingComplete?: boolean;
}

export function usePolLiquiditySnapshot(params: {
  range?: string;
  enabled?: boolean;
} = {}) {
  const { range = "12w", enabled = true } = params;

  return useQuery({
    queryKey: QUERY_KEYS.pol.liquiditySnapshot(range, null),
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<PolLiquiditySnapshotResponse | null> => {
      const search = new URLSearchParams();
      if (range) search.set("range", range);
      const res = await fetch(`/api/pol-liquidity-snapshot?${search.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load PoL liquidity snapshots (${res.status})`);
      }
      return (await res.json()) as PolLiquiditySnapshotResponse;
    },
  });
}
