"use client";
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Result, Ok, Err } from "ts-results";
import {
  type Region,
  type RegionWithMetadata,
  type ActivationConfig,
  type CreateRegionPayload,
  RegionRouter,
} from "@glowlabs-org/utils/browser";

if (!process.env.NEXT_PUBLIC_CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

// Initialize Region API client
const regionRouter = RegionRouter(process.env.NEXT_PUBLIC_CONTROL_API_URL);

/**
 * Extract a useful error message from an unknown error value.
 */
function parseApiError(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  const possible: any = error;
  return possible?.error?.message ?? possible?.message ?? "Unknown error";
}

// Query Keys
const QUERY_KEYS = {
  regions: () => ["regions"],
  activationConfig: (regionCode: string) => ["activation-config", regionCode],
  regionByCode: (code: string) => ["region-by-code", code],
} as const;

export function useRegion() {
  const queryClient = useQueryClient();

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

  // Activation Config Query Hook - can be called conditionally
  const useActivationConfig = (regionCode: string) => {
    return useQuery({
      queryKey: QUERY_KEYS.activationConfig(regionCode),
      queryFn: () => regionRouter.fetchActivationConfig(regionCode),
      enabled: !!regionCode,
      staleTime: 5 * 60 * 1000, // 5 minutes - configs don't change often
      retry: 2,
    });
  };

  // ----------------------- Mutation hooks --------------------------------

  // ----------------------- Derived functions -----------------------------

  // Get region by code (synchronous, from cached data)
  const getRegionByCode = useCallback(
    (code: string): RegionWithMetadata | null => {
      try {
        // This function works with the already fetched regions data
        return regionRouter.getRegionByCode(code);
      } catch (error) {
        console.error("Error getting region by code:", error);
        return null;
      }
    },
    [regions] // Depend on regions data
  );

  // ----------------------- Legacy API functions (for compatibility) ------

  const fetchRegions = useCallback(async (): Promise<
    Result<Region[], string>
  > => {
    try {
      const result = await refetchRegions();
      return new Ok(result.data || []);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [refetchRegions]);

  const fetchActivationConfig = useCallback(
    async (regionCode: string): Promise<Result<ActivationConfig, string>> => {
      try {
        const data = await regionRouter.fetchActivationConfig(regionCode);
        // Invalidate and refetch to update cache
        await queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.activationConfig(regionCode),
        });
        return new Ok(data);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    [queryClient]
  );

  // --------------------------- Exports -----------------------------------
  return {
    // Data
    regions,

    // Loading states
    isRegionsLoading,

    // Functions
    getRegionByCode,

    // Legacy functions (for backward compatibility)
    fetchRegions,
    fetchActivationConfig,

    // React Query hook for conditional usage
    useActivationConfig,
  } as const;
}
