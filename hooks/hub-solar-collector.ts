"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";

const WATTS_PER_PANEL = 400;

// Backend response types
interface SolarCollectorStatsResponse {
  totalWatts: number;
  wattsByRegion: Record<number, number>;
  panelsByRegion: Record<number, number>;
  panels: number;
  ghostProgress: number;
  streakStatus: {
    weeks: number;
    isActive: boolean;
    atRisk: boolean;
    multiplier: number;
  };
  stronghold: {
    regionId: number;
    userPower: number;
    totalNetworkPower: number;
    powerPercentile: number;
    rank: number;
    totalWallets: number;
  } | null;
  recentDrop: {
    farmId: string;
    farmName: string | null;
    regionId: number;
    timestamp: string;
    farmSizeWatts: number;
    wattsCaptured: number;
  } | null;
  weeklyHistory: Array<{
    weekNumber: number;
    wattsCaptured: number;
    cumulativeWatts: number;
    regionalShare: Record<
      number,
      {
        sharePercent: number;
        userPower: number;
        networkPower: number;
        wattsCaptured: number;
      }
    >;
  }>;
  weeklyPowerHistory: Array<{
    weekNumber: number;
    regionId: number;
    directPoints: number;
    glowWorthPoints: number;
    rolloverMultiplier: number;
    hasCashMinerBonus: boolean;
    streakBonusMultiplier: number;
    impactStreakWeeks: number;
  }>;
}

// UI-friendly model
export interface SolarCollectorModel {
  hasWallet: boolean;
  shouldShowSkeleton: boolean;
  showEmptyState: boolean;

  totalWatts: number;
  totalPanels: number;
  currentPanelIndex: number;
  wattsToNextPanel: number;

  capturePower: number;
  powerPercentile: number;
  rank: number;
  totalWallets: number;
  streakWeeks: number;
  multiplier: number;

  strongholdRegionId: number | null;
  recentDrop: {
    farmId: string;
    farmName: string;
    regionId: number;
    wattsCaptured: number;
    whenLabel: string;
    farmSizeWatts: number;
  } | null;

  impact: {
    annualEnergyKwh: number;
    treesEquivalent: number;
    homesPowered: number;
  };
  weeklyHistory: SolarCollectorStatsResponse["weeklyHistory"];
  weeklyPowerHistory: SolarCollectorStatsResponse["weeklyPowerHistory"];
  wattsByRegion: Record<number, number>;
}

function formatWhenLabel(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} Days Ago`;
  if (diffDays < 14) return "Last Week";

  const weeksAgo = Math.floor(diffDays / 7);
  if (weeksAgo < 5) return `${weeksAgo} Weeks Ago`;

  // Format as "Jan 10"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function calculateImpact(totalWatts: number) {
  // 1. Conversion Constants from Solar-Fleet Specs
  const SOLAR_CAPACITY_FACTOR = 0.18;
  const HOURS_PER_YEAR = 8760;
  const US_HOME_KW_CONTINUOUS = 1.17; // 10,260 kWh/yr
  const TONNES_CO2_PER_YEAR_PER_TREE = 0.022;
  const LB_CO2_PER_MWH_FALLBACK = 1000;
  const LB_TO_TONNES = 0.00045359237;

  // 2. Power & Energy Calculations
  const capacityKw = totalWatts / 1000;
  const avgContinuousPowerKw = capacityKw * SOLAR_CAPACITY_FACTOR;
  const annualEnergyKwh = Math.round(avgContinuousPowerKw * HOURS_PER_YEAR);
  const annualEnergyMwh = annualEnergyKwh / 1000;

  // 3. Metric: Homes Powered
  // Formula: averageContinuousPower(kW) / homeConsumption(kW)
  const homesPowered =
    Math.round((avgContinuousPowerKw / US_HOME_KW_CONTINUOUS) * 10) / 10;

  // 4. Metric: Trees Equivalent
  // Formula: annualTonnesCO2 / 0.022
  const annualTonnesCO2 =
    annualEnergyMwh * LB_CO2_PER_MWH_FALLBACK * LB_TO_TONNES;
  const treesEquivalent = Math.round(
    annualTonnesCO2 / TONNES_CO2_PER_YEAR_PER_TREE
  );

  return { annualEnergyKwh, treesEquivalent, homesPowered };
}

async function fetchSolarCollectorApi<T>(params: {
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
}): Promise<T> {
  const url = new URL(params.path, window.location.origin);

  for (const [key, value] of Object.entries(params.query || {})) {
    if (value === null || value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
    ) {
      throw new Error((payload as { error: string }).error);
    }

    throw new Error(
      typeof payload === "string"
        ? payload
        : `Request failed (${response.status})`
    );
  }

  return payload as T;
}

export function useSolarCollectorQuery(args: {
  walletAddress: string | null | undefined;
  enabled?: boolean;
  includeCurrentWeekPower?: boolean;
}) {
  const {
    walletAddress,
    enabled = true,
    includeCurrentWeekPower = false,
  } = args;
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;

  const query = useQuery({
    queryKey: QUERY_KEYS.solarCollector.stats(
      normalizedWalletAddress,
      includeCurrentWeekPower
    ),
    enabled: Boolean(enabled && normalizedWalletAddress),
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    retry: 0,
    queryFn: async (): Promise<SolarCollectorStatsResponse> => {
      if (!normalizedWalletAddress) throw new Error("Missing wallet address");

      return await fetchSolarCollectorApi<SolarCollectorStatsResponse>({
        path: "/api/solar-collector/stats",
        query: {
          walletAddress: normalizedWalletAddress,
          includeCurrentWeekPower: includeCurrentWeekPower ? "1" : "0",
        },
      });
    },
  });

  // Map backend response to UI model
  const model: SolarCollectorModel = (() => {
    const hasWallet = Boolean(normalizedWalletAddress);
    const shouldShowSkeleton = query.isLoading;
    const showEmptyState = !shouldShowSkeleton && (!hasWallet || !query.data);

    if (shouldShowSkeleton) {
      return {
        hasWallet,
        shouldShowSkeleton: true,
        showEmptyState: false,
        totalWatts: 0,
        totalPanels: 0,
        currentPanelIndex: 1,
        wattsToNextPanel: WATTS_PER_PANEL,
        capturePower: 0,
        powerPercentile: 0,
        rank: 0,
        totalWallets: 0,
        streakWeeks: 0,
        multiplier: 1,
        strongholdRegionId: null,
        recentDrop: null,
        impact: { annualEnergyKwh: 0, treesEquivalent: 0, homesPowered: 0 },
        weeklyHistory: [],
        weeklyPowerHistory: [],
        wattsByRegion: {},
      };
    }

    if (showEmptyState) {
      return {
        hasWallet,
        shouldShowSkeleton: false,
        showEmptyState: true,
        totalWatts: 0,
        totalPanels: 0,
        currentPanelIndex: 1,
        wattsToNextPanel: WATTS_PER_PANEL,
        capturePower: 0,
        powerPercentile: 0,
        rank: 0,
        totalWallets: 0,
        streakWeeks: 0,
        multiplier: 1,
        strongholdRegionId: null,
        recentDrop: null,
        impact: { annualEnergyKwh: 0, treesEquivalent: 0, homesPowered: 0 },
        weeklyHistory: [],
        weeklyPowerHistory: [],
        wattsByRegion: {},
      };
    }

    const data = query.data!;
    const totalPanels = data.panels;
    const currentPanelIndex = totalPanels + 1;
    const currentGhostWatts = data.totalWatts % WATTS_PER_PANEL;
    const wattsToNextPanel = WATTS_PER_PANEL - currentGhostWatts;

    const capturePower = data.stronghold?.userPower || 0;
    const powerPercentile = data.stronghold?.powerPercentile || 0;
    const rank = data.stronghold?.rank || 0;
    const totalWallets = data.stronghold?.totalWallets || 0;
    const streakWeeks = data.streakStatus.weeks;
    const multiplier = data.streakStatus.multiplier;
    const strongholdRegionId = data.stronghold?.regionId ?? null;

    const recentDrop = data.recentDrop
      ? {
          farmId: data.recentDrop.farmId,
          farmName: data.recentDrop.farmName || "Unknown Farm",
          regionId: data.recentDrop.regionId,
          wattsCaptured: data.recentDrop.wattsCaptured,
          whenLabel: formatWhenLabel(data.recentDrop.timestamp),
          farmSizeWatts: data.recentDrop.farmSizeWatts,
        }
      : null;

    const impact = calculateImpact(data.totalWatts);

    return {
      hasWallet,
      shouldShowSkeleton: false,
      showEmptyState: false,
      totalWatts: data.totalWatts,
      totalPanels,
      currentPanelIndex,
      wattsToNextPanel,
      capturePower,
      powerPercentile,
      rank,
      totalWallets,
      streakWeeks,
      multiplier,
      strongholdRegionId,
      recentDrop,
      impact,
      weeklyHistory: data.weeklyHistory,
      weeklyPowerHistory: data.weeklyPowerHistory,
      wattsByRegion: data.wattsByRegion,
    };
  })();

  return {
    model,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}
