"use client";

import { useQuery } from "@tanstack/react-query";

export type PolFarmRevenueSeriesPoint = {
  week: number;
  total_lq: string;
  miner_sales_lq: string;
  gctl_mints_lq: string;
  pol_yield_lq: string;
};

export type PolFarmRevenueSeriesResponse = {
  range: string;
  weekRange: { startWeek: number; endWeek: number };
  farm_id: string;
  series: PolFarmRevenueSeriesPoint[];
};

export function usePolFarmRevenueSeries(params: {
  farmId: string | null;
  range?: string;
  enabled?: boolean;
}) {
  const { farmId, range = "20w", enabled = true } = params;

  return useQuery({
    queryKey: ["pol-farm-revenue-series", farmId, range] as const,
    enabled: enabled && Boolean(farmId),
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<PolFarmRevenueSeriesResponse | null> => {
      const search = new URLSearchParams();
      search.set("farmId", farmId!);
      search.set("range", range);
      const res = await fetch(`/api/pol-revenue-farm-series?${search.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load farm revenue series (${res.status})`);
      }
      return (await res.json()) as PolFarmRevenueSeriesResponse;
    },
  });
}
