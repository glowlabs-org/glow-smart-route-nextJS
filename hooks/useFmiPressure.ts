"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/hooks/query-keys";

export interface FmiPressureBucket {
  glw: string;
  usdg: string;
  swaps: number;
}

export interface FmiPressureNet {
  glw: string;
  usdg: string;
}

export interface FmiPressureResponse {
  range: string;
  seconds: number;
  buy: FmiPressureBucket;
  sell: FmiPressureBucket;
  net: FmiPressureNet;
}

export function useFmiPressure(params: {
  range?: string;
  address?: string;
  enabled?: boolean;
} = {}) {
  const { range = "7d", address, enabled = true } = params;

  return useQuery({
    queryKey: QUERY_KEYS.fmi.pressure(range, address ?? null),
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<FmiPressureResponse | null> => {
      const search = new URLSearchParams();
      if (range) search.set("range", range);
      if (address) search.set("address", address);
      const res = await fetch(`/api/fmi-pressure?${search.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load FMI pressure (${res.status})`);
      }
      const data = await res.json();
      return data?.buySellPressure ?? null;
    },
  });
}
