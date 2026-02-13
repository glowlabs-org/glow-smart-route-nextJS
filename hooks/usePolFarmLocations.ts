"use client";

import { useQuery } from "@tanstack/react-query";

export interface PolFarmLocationRow {
  farmId: string;
  name: string;
  zoneId: number | null;
  zoneName: string | null;
  panels: number;
  lat: number | null;
  lng: number | null;
}

export interface PolFarmLocationsResponse {
  farms: PolFarmLocationRow[];
  summary?: {
    farmCount: number;
    mappedFarmCount: number;
    uniqueZones: number;
    zones: Array<{
      zoneId: number;
      zoneName: string;
      farmCount: number;
      panelCount: number;
    }>;
  };
}

export function usePolFarmLocations(params: { enabled?: boolean } = {}) {
  const { enabled = true } = params;

  return useQuery({
    queryKey: ["pol-farm-locations"] as const,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<PolFarmLocationsResponse | null> => {
      const response = await fetch("/api/pol-farm-locations");
      if (!response.ok) {
        throw new Error(`Failed to load PoL farm locations (${response.status})`);
      }
      return (await response.json()) as PolFarmLocationsResponse;
    },
  });
}
