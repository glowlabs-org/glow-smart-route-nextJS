"use client";

import { useQuery } from "@tanstack/react-query";
import type { RegionWithMetadata } from "@glowlabs-org/utils/browser";
import type { ActiveRegionsSummaryResponse } from "@glowlabs-org/utils/browser";
import { getControlApiUrl, getRegionRouter } from "@/lib/api/control-routers";

const QUERY_KEYS = {
  regions: () => ["regions"],
  activeSummary: () => ["regions", "active-summary"],
  stakeCap: (regionId?: number) => ["regions", "stake-cap", regionId],
} as const;

export function useRegions() {
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);
  const {
    data: regions = [],
    refetch: refetchRegions,
    isLoading: isRegionsLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.regions(),
    enabled: isConfigured,
    queryFn: () =>
      (getRegionRouter() as any).fetchRegions() as Promise<
        RegionWithMetadata[]
      >,
    staleTime: 30_000,
    retry: 2,
  });

  return {
    regions,
    refetchRegions,
    isRegionsLoading,
  } as const;
}

export interface ActiveRegionSummaryDerived {
  id: number;
  name: string;
  code: string;
  slug: string;
  isUs: boolean;
  stakedGctl: number;
  glwPerWeek: number;
  rewardSharePercent: number;
  pendingUnstake: number;
  pendingRestakeOut: number;
  pendingRestakeIn: number;
  churnEpoch: number;
  totalProtocolDepositsUsd: number;
  solarFarmCount: number;
  history: ActiveRegionHistoryPoint[];
}

export interface ActiveRegionsSummaryData {
  totalGctlStaked: number;
  totalGlwRewards: number;
  regions: ActiveRegionSummaryDerived[];
  aggregate?: {
    epochs: number[];
    timestamps: number[];
    totalGctlStaked: string[];
    eventTypes: string[];
    regionIds: number[];
  };
}

export interface ActiveRegionHistoryPoint {
  epoch: number;
  timestamp: number;
  gctlStaked: number;
}

function parseNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const GCTL_SCALE = 1_000_000;
const GLW_SCALE = 1_000_000_000_000_000_000;
const USDC_SCALE = 1_000_000;

function parseScaledAmount(
  value: string | number | null | undefined,
  scale: number
): number {
  if (scale === 0) return 0;
  const numeric = parseNumber(value);
  return numeric / scale;
}

function parseGctlAmount(value: string | number | null | undefined): number {
  return parseScaledAmount(value, GCTL_SCALE);
}

function parseGlwAmount(value: string | number | null | undefined): number {
  return parseScaledAmount(value, GLW_SCALE);
}

function parseUsdcAmount(value: string | number | null | undefined): number {
  return parseScaledAmount(value, USDC_SCALE);
}

function getChurnEpoch(
  data: ActiveRegionsSummaryResponse["regions"][number]["data"],
  currentStaked: number
): number {
  if (!data || data.length < 2 || currentStaked === 0) return 0;
  const sortedData = [...data].sort((a, b) => b.epoch - a.epoch);
  const currentSnapshot = sortedData[0];
  const previousSnapshot = sortedData[1];
  if (!currentSnapshot || !previousSnapshot) return 0;

  const currentGctl = parseGctlAmount(currentSnapshot.gctlStaked);
  const previousGctl = parseGctlAmount(previousSnapshot.gctlStaked);

  const churn = Math.abs(currentGctl - previousGctl);
  return Math.min((churn / currentStaked) * 100, 100);
}

function mapSummary(
  response: ActiveRegionsSummaryResponse | undefined
): ActiveRegionsSummaryData | undefined {
  if (!response) return undefined;

  const totalGctlStaked = parseGctlAmount(response.total.totalGctlStaked);
  const totalGlwRewards = parseGlwAmount(response.total.totalGlwRewards);

  const regions = response.regions.map((region) => {
    const stakedGctl = parseGctlAmount(region.currentGctlStaked);
    const glwPerWeek = parseGlwAmount(region.glwRewardPerWeek);
    const rewardSharePercent = parseNumber(region.rewardShare);

    const latestDataPoint =
      region.data.length > 0
        ? [...region.data].sort((a, b) => b.epoch - a.epoch)[0]
        : null;

    const pendingUnstake = latestDataPoint
      ? parseGctlAmount(latestDataPoint.pendingUnstake)
      : 0;
    const pendingRestakeOut = latestDataPoint
      ? parseGctlAmount(latestDataPoint.pendingRestakeOut)
      : 0;
    const pendingRestakeIn = latestDataPoint
      ? parseGctlAmount(latestDataPoint.pendingRestakeIn)
      : 0;

    const churnEpoch = getChurnEpoch(region.data, stakedGctl);

    const history: ActiveRegionHistoryPoint[] = region.data
      .map((point) => ({
        epoch: point.epoch,
        timestamp: point.timestamp,
        gctlStaked: parseGctlAmount(point.gctlStaked),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const totalProtocolDepositsUsd = parseUsdcAmount(
      (region as any).totalProtocolDepositsUsd
    );
    const solarFarmCount = parseNumber((region as any).solarFarmCount);

    return {
      id: region.id,
      name: region.name,
      code: region.code,
      slug: region.slug,
      isUs: region.isUs,
      stakedGctl,
      glwPerWeek,
      rewardSharePercent,
      pendingUnstake,
      pendingRestakeOut,
      pendingRestakeIn,
      churnEpoch,
      totalProtocolDepositsUsd,
      solarFarmCount,
      history,
    } satisfies ActiveRegionSummaryDerived;
  });

  return {
    totalGctlStaked,
    totalGlwRewards,
    regions,
    aggregate: response.aggregate,
  } satisfies ActiveRegionsSummaryData;
}

export function useActiveRegionsSummary(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const query = useQuery({
    queryKey: QUERY_KEYS.activeSummary(),
    enabled: enabled && isConfigured,
    staleTime: 30_000,
    retry: 2,
    queryFn: async () =>
      (await (
        getRegionRouter() as any
      ).fetchActiveSummary()) as ActiveRegionsSummaryResponse,
  });

  return {
    ...query,
    data: mapSummary(query.data),
    isFetching: query.isFetching,
  } as const;
}

export interface RegionStakeCapStatus {
  regionId: number;
  isActive: boolean;
  capApplied: boolean;
  windowDays: number;
  windowStart: string;
  cap: string;
  totalStaked: string;
  remaining: string;
}

export function useRegionStakeCap(
  regionId?: number | null,
  options?: { enabled?: boolean }
) {
  const { enabled = true } = options ?? {};
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const query = useQuery({
    queryKey: QUERY_KEYS.stakeCap(regionId ?? undefined),
    enabled:
      enabled &&
      isConfigured &&
      Number.isFinite(regionId) &&
      (regionId ?? 0) > 0,
    staleTime: 30_000,
    retry: 2,
    queryFn: async () => {
      const baseUrl = getControlApiUrl();
      const response = await fetch(
        `${baseUrl}/regions/stake-cap/${regionId}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch region stake cap");
      }
      return (await response.json()) as RegionStakeCapStatus;
    },
  });

  return {
    stakeCap: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  } as const;
}
