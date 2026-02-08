"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

// CRM endpoints return lq in base units (currently 1e12).
export function parseLqUnits(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  try {
    if (typeof value === "string" && value.includes(".")) {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof value === "number" && !Number.isInteger(value)) {
      return Number.isFinite(value) ? value : null;
    }

    const raw = typeof value === "number" ? BigInt(Math.trunc(value)) : BigInt(value);
    const asString = formatUnits(raw, 12);
    const asNumber = Number(asString);
    return Number.isFinite(asNumber) ? asNumber : null;
  } catch {
    return null;
  }
}

export interface PolRevenueAggregateResponse {
  lifetime_lq?: string;
  ninety_day_lq?: string;
  ninety_day_yield_lq?: string;
  ninety_day_apy?: number | string; // fractional (e.g. 0.1234) OR percent (e.g. 12.34)
  active_farms?: number;
}

export interface PolRevenueFarmRow {
  farm_id?: string;
  farm_name?: string;
  audit_week?: number | string | null;
  zone_id?: number | string | null;
  panels?: number;
  image_url?: string | null;
  lifetime_lq?: string;
  ninety_day_lq?: string;
  ninety_day_delta_pct?: number;
  cc_per_week?: number | string | null;
  credits_total?: number | string | null;
}

export interface PolRevenueFarmsResponse {
  farms?: PolRevenueFarmRow[];
}

export interface PolRevenueRegionRow {
  zone_id?: number | string | null;
  lifetime_lq?: string;
  ninety_day_lq?: string;
  farm_count?: number;
  cc_per_week?: number | string | null;
  staked_gctl?: string | null; // atomic 1e6 (GCTL has 6 decimals)
}

export interface PolRevenueRegionsResponse {
  regions?: PolRevenueRegionRow[];
}

export function usePolRevenueAggregate(params: { enabled?: boolean } = {}) {
  const { enabled = true } = params;

  return useQuery({
    queryKey: ["pol-revenue-aggregate"] as const,
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<PolRevenueAggregateResponse | null> => {
      const res = await fetch("/api/pol-revenue-aggregate");
      if (!res.ok) throw new Error(`Failed to load PoL revenue aggregate (${res.status})`);
      return (await res.json()) as PolRevenueAggregateResponse;
    },
  });
}

export function usePolRevenueFarms(params: { enabled?: boolean } = {}) {
  const { enabled = true } = params;

  return useQuery({
    queryKey: ["pol-revenue-farms"] as const,
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<PolRevenueFarmsResponse | null> => {
      const res = await fetch("/api/pol-revenue-farms");
      if (!res.ok) throw new Error(`Failed to load PoL revenue farms (${res.status})`);
      return (await res.json()) as PolRevenueFarmsResponse;
    },
  });
}

export function usePolRevenueRegions(params: { enabled?: boolean } = {}) {
  const { enabled = true } = params;

  return useQuery({
    queryKey: ["pol-revenue-regions"] as const,
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<PolRevenueRegionsResponse | null> => {
      const res = await fetch("/api/pol-revenue-regions");
      if (!res.ok) throw new Error(`Failed to load PoL revenue regions (${res.status})`);
      return (await res.json()) as PolRevenueRegionsResponse;
    },
  });
}
