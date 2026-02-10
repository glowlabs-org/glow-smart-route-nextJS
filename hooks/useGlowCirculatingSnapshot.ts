"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/hooks/query-keys";

export interface GlowCirculatingSnapshotRow {
  week: number;
  is_partial?: boolean;
  circulating_wei: string;
  circulating_glw: string;
  breakdown: {
    total_supply_wei: string;
    carbon_credit_auction_wei: string;
    grants_treasury_wei: string;
    veto_council_wei: string;
    gca_and_miner_pool_wei: string;
    glow_contract_wei: string;
    early_liquidity_wei: string;
    pol_glw_in_positions_wei: string;
    vaulted_delegated_wei: string;
    miner_allocated_wei: string;
    miner_claimed_wei: string;
    yet_to_be_claimed_wei: string;
  };
}

export interface GlowCirculatingSnapshotResponse {
  range: string;
  weekRange: { startWeek: number; endWeek: number };
  includePartialWeek?: boolean;
  series: GlowCirculatingSnapshotRow[];
  indexingComplete?: boolean;
}

export function useGlowCirculatingSnapshot(
  params: {
    range?: string;
    includePartialWeek?: boolean;
    enabled?: boolean;
  } = {}
) {
  const { range = "12w", includePartialWeek = false, enabled = true } = params;

  return useQuery({
    queryKey: QUERY_KEYS.glow.circulating(range, includePartialWeek),
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<GlowCirculatingSnapshotResponse | null> => {
      const search = new URLSearchParams();
      if (range) search.set("range", range);
      if (includePartialWeek) search.set("includePartialWeek", "true");

      const res = await fetch(`/api/glow-circulating?${search.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load circulating snapshots (${res.status})`);
      }
      return (await res.json()) as GlowCirculatingSnapshotResponse;
    },
  });
}

