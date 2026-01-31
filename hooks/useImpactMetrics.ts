"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_CONFIG } from "@/hooks/query-config";

export interface ImpactMetrics {
  totalWeeklyExpectedCarbonCredits: number;
  solarPanelsInstalled: number;
  totalCarbonCredits30Years: number;
  totalFarms: number;
  totalWatts: number;
  adultTreesEquivalent: number;
  flightsOffset: number;
  homesPowered: number;
  healthCostAvoidedUSD: number;
  asthmaAttacksPrevented: number;
  waterSavedGallons: number;
  dailyNeedsHumans: number;
}

export function useImpactMetrics(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const query = useQuery<ImpactMetrics | null>({
    queryKey: ["impact-metrics"],
    enabled,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchInterval: enabled ? QUERY_CONFIG.DEFAULT.staleTime : false,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    queryFn: async () => {
      try {
        const res = await fetch("/api/impact-metrics", {
          cache: "no-store",
        });
        if (!res.ok) return null;
        return (await res.json()) as ImpactMetrics;
      } catch {
        return null;
      }
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}
