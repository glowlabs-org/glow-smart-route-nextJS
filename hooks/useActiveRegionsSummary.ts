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
  snapshots: Array<{
    epoch: number;
    gctlStaked: number;
    pendingUnstake: number;
    pendingRestakeOut: number;
    pendingRestakeIn: number;
  }>;
}

export interface ActiveRegionsSummaryData {
  totalGctlStaked: number;
  totalGlwRewards: number;
  regions: ActiveRegionSummaryDerived[];
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
  snapshots: ActiveRegionsSummaryResponse["regions"][number]["snapshots"],
  currentStaked: number
): number {
  if (!snapshots || snapshots.length < 2 || currentStaked === 0) return 0;

  // Get the most recent snapshot and the one before it
  const sortedSnapshots = [...snapshots].sort((a, b) => b.epoch - a.epoch);
  const currentSnapshot = sortedSnapshots[0];
  const previousSnapshot = sortedSnapshots[1];

  if (!currentSnapshot || !previousSnapshot) return 0;

  const currentGctl = parseGctlAmount(currentSnapshot.totals.gctlStaked);
  const previousGctl = parseGctlAmount(previousSnapshot.totals.gctlStaked);

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
    const stakedGctl = parseGctlAmount(region.gctlStaked);
    const glwPerWeek = parseGlwAmount(region.glwRewardPerWeek);
    const rewardSharePercent = parseNumber(region.rewardShare);
    const pendingUnstake = parseGctlAmount(region.pendingUnstake);
    const pendingRestakeOut = parseGctlAmount(region.pendingRestakeOut);
    const pendingRestakeIn = parseGctlAmount(region.pendingRestakeIn);
    const churnEpoch = getChurnEpoch(region.snapshots, stakedGctl);

    const snapshots = region.snapshots.map((snapshot) => ({
      epoch: snapshot.epoch,
      gctlStaked: parseGctlAmount(snapshot.totals.gctlStaked),
      pendingUnstake: parseGctlAmount(snapshot.totals.pendingUnstake),
      pendingRestakeOut: parseGctlAmount(snapshot.totals.pendingRestakeOut),
      pendingRestakeIn: parseGctlAmount(snapshot.totals.pendingRestakeIn),
    }));

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
      snapshots,
    } satisfies ActiveRegionSummaryDerived;
  });

  return {
    totalGctlStaked,
    totalGlwRewards,
    regions,
  } satisfies ActiveRegionsSummaryData;
}

export function useActiveRegionsSummary() {
  const query = useQuery({
    queryKey: QUERY_KEYS.activeSummary(),
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
  } as const;
}
