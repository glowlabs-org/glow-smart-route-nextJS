"use client";

import { useQuery } from "@tanstack/react-query";

export interface FractionRecord {
  id: string;
  applicationId: string;
  createdBy: string;
  stepPrice: string;
  totalSteps: string;
  splitsSold: string;
  expirationAt: string;
  status: string;
  type: "launchpad" | "mining-center";
  rewardScore: number | null;
  token: string;
  remainingSteps: string;
  remainingValue: string;
}

export interface AvailabilitySummary {
  totalCount: number;
  totalStepsRemaining: string;
  totalValueRemaining: string;
}

export interface FractionsAvailabilityResponse {
  type: "launchpad" | "mining-center";
  summary: AvailabilitySummary;
  fractions: FractionRecord[];
}

export interface FractionsAvailabilityGroupedResponse {
  launchpad: FractionsAvailabilityResponse;
  miningCenter: FractionsAvailabilityResponse;
}

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

if (!HUB_URL) {
  throw new Error("NEXT_PUBLIC_HUB_URL is not set");
}

export interface UseFractionsAvailabilityParams {
  type?: "launchpad" | "mining-center";
  enabled?: boolean;
}

export function useFractionsAvailability(
  params: UseFractionsAvailabilityParams = {}
) {
  const { type, enabled = true } = params;

  const queryKey = ["fractions", "available", type ?? "all"] as const;

  const query = useQuery<
    FractionsAvailabilityResponse | FractionsAvailabilityGroupedResponse
  >({
    queryKey,
    enabled,
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (type) {
        searchParams.append("type", type);
      }
      const response = await fetch(
        `${HUB_URL}/fractions/available?${searchParams.toString()}`
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch fractions availability: ${response.status} - ${errorText}`
        );
      }
      return (await response.json()) as
        | FractionsAvailabilityResponse
        | FractionsAvailabilityGroupedResponse;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}
