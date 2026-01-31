"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/hooks/query-keys";

export interface PolLiquiditySnapshotRow {
  week: number;
  startTimestamp: number;
  endTimestamp: number;
  minted: string;
  burned: string;
  netLiquidity: string;
  balanceLiquidity: string;
}

export interface PolLiquiditySnapshotResponse {
  range: string;
  weekRange: { startWeek: number; endWeek: number };
  wallets: string[];
  currentTotalLiquidity: string;
  currentTotalSupply: string;
  series: PolLiquiditySnapshotRow[];
}

export function usePolLiquiditySnapshot(params: {
  range?: string;
  wallets?: string[];
  enabled?: boolean;
} = {}) {
  const { range = "12w", wallets, enabled = true } = params;

  return useQuery({
    queryKey: QUERY_KEYS.pol.liquiditySnapshot(range, wallets ?? null),
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<PolLiquiditySnapshotResponse | null> => {
      const search = new URLSearchParams();
      if (range) search.set("range", range);
      if (wallets && wallets.length > 0) {
        search.set("wallets", wallets.join(","));
      }
      const res = await fetch(`/api/pol-liquidity-snapshot?${search.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load PoL liquidity snapshots (${res.status})`);
      }
      return (await res.json()) as PolLiquiditySnapshotResponse;
    },
  });
}
