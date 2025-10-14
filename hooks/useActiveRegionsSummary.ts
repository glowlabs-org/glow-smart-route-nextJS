"use client";

import { useQuery } from "@tanstack/react-query";

import {
  type ActiveRegionsSummaryResponse,
  RegionRouter,
} from "@glowlabs-org/utils/browser";

if (!process.env.NEXT_PUBLIC_CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

const regionRouter = RegionRouter(
  process.env.NEXT_PUBLIC_CONTROL_API_URL
) as ReturnType<typeof RegionRouter> & {
  fetchActiveSummary: () => Promise<ActiveRegionsSummaryResponse>;
};

const QUERY_KEYS = {
  activeSummary: () => ["regions", "active-summary"],
} as const;

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

function getChurnEpoch(
  data: ActiveRegionsSummaryResponse["regions"][number]["data"],
  currentStaked: number
): number {
  if (!data || data.length < 2 || currentStaked === 0) return 0;

  // Get the most recent snapshot and the one before it
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

    // Get the latest data point for pending values
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
  const query = useQuery({
    queryKey: QUERY_KEYS.activeSummary(),
    enabled,
    queryFn: async () => {
      try {
        const summary = await regionRouter.fetchActiveSummary();
        return summary;
      } catch (error) {
        throw error instanceof Error
          ? new Error(
              `Failed to fetch active regions summary: ${error.message}`
            )
          : new Error("Failed to fetch active regions summary");
      }
    },
    staleTime: 30 * 1000,
    retry: 2,
  });

  return {
    ...query,
    data: mapSummary(query.data),
    isFetching: query.isFetching,
  } as const;
}
