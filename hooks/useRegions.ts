"use client";

import { useQuery } from "@tanstack/react-query";

import {
  type RegionWithMetadata,
  RegionRouter,
} from "@glowlabs-org/utils/browser";

if (!process.env.NEXT_PUBLIC_CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

// Initialize Region API client
const regionRouter = RegionRouter(
  process.env.NEXT_PUBLIC_CONTROL_API_URL
) as ReturnType<typeof RegionRouter> & {
  fetchRegions: (params?: {
    isActive?: boolean;
  }) => Promise<RegionWithMetadata[]>;
};

// Query Keys
const QUERY_KEYS = {
  regions: () => ["regions"],
} as const;

export function useRegions() {
  // ----------------------- React Query hooks -----------------------------

  // Regions Query
  const {
    data: regions = [],
    refetch: refetchRegions,
    isLoading: isRegionsLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.regions(),
    queryFn: () => regionRouter.fetchRegions(),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  // --------------------------- Exports -----------------------------------
  return {
    // Data
    regions,
    refetchRegions,
    // Loading states
    isRegionsLoading,
  } as const;
}
