"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Cpu, Zap, LayoutGrid, Sun, Rocket, Layers, Gift } from "lucide-react";
import Link from "next/link";
import {
  useGlowLaunchpad,
  useMiningCenter,
  useMiningScore,
  useRewardsBreakdown,
  useRewardScore,
  useSponsorListings,
  useSplitsActivity,
} from "@/hooks";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

// --- Shadcn UI Components ---
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { FarmsPerformanceDialogContent } from "./farms-performance-dialog";
import { cn } from "@/lib/utils";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";
import { countActiveListings } from "@/utils/launchpad";
import {
  AnimatedCountdown,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import {
  attachEstimatedWeeklyLaunchpadRewards,
  attachEstimatedWeeklyMiningCenterRewards,
  deriveLaunchpadSponsorshipsInProgress,
  deriveMiningCenterSponsorshipsInProgress,
  getAggregatedEstimatedWeeklyGlw,
} from "@/utils/sponsorships-in-progress";
import { QUERY_KEYS } from "@/hooks/query-keys";

interface HistoryDataPoint {
  weekNumber: number;
  week: string;
  minerReward: number;
  delegationReward: number;
  otherReward: number;
  protocolDepositUsd: number;
  total: number;
}

function formatGlwCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatGlwPrecise(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTrendPercent(params: { current: number; previous: number }) {
  const { current, previous } = params;
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous <= 0
  ) {
    return "—";
  }
  const percent = ((current - previous) / previous) * 100;
  if (!Number.isFinite(percent)) return "—";
  const prefix = percent >= 0 ? "+" : "";
  return `${prefix}${percent.toFixed(1)}%`;
}

function parseGlwFromWei(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num / 1e18;
}

function parseUsdFromBaseUnits(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num / 1e6;
}

function formatUsdPrecise(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SolarFarmSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-10 w-56" />
        </div>
        <Skeleton className="h-12 w-40 rounded-xl" />
      </div>
      <Skeleton className="h-[180px] w-full rounded-xl" />
    </div>
  );
}

// --- SUB-COMPONENTS ---

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    const minerVal =
      payload.find((p) => p.dataKey === "minerReward")?.value ?? 0;
    const delVal =
      payload.find((p) => p.dataKey === "delegationReward")?.value ?? 0;
    const otherVal =
      payload.find((p) => p.dataKey === "otherReward")?.value ?? 0;
    const pdUsd =
      payload.find((p) => p.dataKey === "protocolDepositUsd")?.value ?? 0;
    const total = minerVal + delVal + otherVal;
    return (
      <div className="bg-popover text-popover-foreground border border-border p-3 rounded-xl shadow-xl min-w-[160px]">
        <p className="text-muted-foreground text-[10px] font-mono uppercase mb-2">
          {label}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--color-glow-yellow)" }}
              />
              <span className="text-xs text-muted-foreground font-mono">
                Miners
              </span>
            </div>
            <span className="text-xs font-bold text-foreground font-mono">
              {formatGlwPrecise(minerVal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--color-glow-purple)" }}
              />
              <span className="text-xs text-muted-foreground font-mono">
                Delegation
              </span>
            </div>
            <span className="text-xs font-bold text-foreground font-mono">
              {formatGlwPrecise(delVal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--color-glow-green)" }}
              />
              <span className="text-xs text-muted-foreground font-mono">
                Other
              </span>
            </div>
            <span className="text-xs font-bold text-foreground font-mono">
              {formatGlwPrecise(otherVal)}
            </span>
          </div>
          {pdUsd > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--color-glow-orange)" }}
                />
                <span className="text-xs text-muted-foreground font-mono">
                  PD Rewards (USDG)
                </span>
              </div>
              <span className="text-xs font-bold text-foreground font-mono">
                {formatUsdPrecise(pdUsd)}
              </span>
            </div>
          ) : null}
          <div className="h-px bg-border my-1" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono uppercase">
              Total
            </span>
            <div className="flex flex-col items-end ml-1">
              <span className="text-sm font-bold text-foreground font-mono">
                {formatGlwPrecise(total)} GLW
              </span>
              {pdUsd > 0 ? (
                <span className="text-[11px] font-bold text-muted-foreground font-mono">
                  {formatUsdPrecise(pdUsd)} USDG
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// --- MAIN COMPONENT ---

interface SolarFarmWidgetProps {
  walletAddress?: string | null;
}

export default function SolarFarmWidget({
  walletAddress,
}: SolarFarmWidgetProps) {
  const queryClient = useQueryClient();
  const { isConnecting, isReconnecting } = useAccount();
  const hasWallet = Boolean(walletAddress);
  const isWalletConnecting = isConnecting || isReconnecting;
  const [isLaunchpadOpen, setIsLaunchpadOpen] = React.useState(false);
  const [nextBatchAtMs, setNextBatchAtMs] = React.useState(() =>
    getNextTuesdayAt1pmET().getTime()
  );

  const { data, isLoading, isError, refetch } = useRewardsBreakdown({
    walletAddress: walletAddress ?? null,
    enabled: hasWallet,
  });

  const { applications: launchpadApplications } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
  });
  const { applications: minersApplications } = useSponsorListings({
    filters: { paymentCurrency: "USDC", type: "mining-center" },
  });

  const {
    activity: splitsActivity,
    isLoading: isSplitsActivityLoading,
    isError: isSplitsActivityError,
  } = useSplitsActivity({
    walletAddress: walletAddress ?? undefined,
    enabled: hasWallet,
    limit: 200,
  });

  const sponsorshipsInProgress = React.useMemo(() => {
    return deriveLaunchpadSponsorshipsInProgress({
      splitsActivity,
      sponsorListings: launchpadApplications,
    });
  }, [launchpadApplications, splitsActivity]);

  const applicationsForRewards = React.useMemo(() => {
    return sponsorshipsInProgress
      .map((item) => item.application)
      .filter((app): app is NonNullable<typeof app> => app !== null);
  }, [sponsorshipsInProgress]);

  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: applicationsForRewards,
    paymentCurrency: "GLW",
    enabled: hasWallet && applicationsForRewards.length > 0,
    walletAddress: walletAddress ?? null,
  });

  const sponsorshipsInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyLaunchpadRewards({
      sponsorshipsInProgress,
      rewardScoreMap,
    });
  }, [rewardScoreMap, sponsorshipsInProgress]);

  const aggregatedEstimatedWeeklyGlwLaunchpad = React.useMemo(() => {
    return getAggregatedEstimatedWeeklyGlw(sponsorshipsInProgressWithEstimates);
  }, [sponsorshipsInProgressWithEstimates]);

  const hasMiningCenterSplits = React.useMemo(() => {
    return splitsActivity.some((s) => s.fractionType === "mining-center");
  }, [splitsActivity]);

  const { applications: miningCenterApplications } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
    enabled: hasWallet && hasMiningCenterSplits,
  });

  const miningCenterInProgress = React.useMemo(() => {
    return deriveMiningCenterSponsorshipsInProgress({
      splitsActivity,
      sponsorListings: miningCenterApplications,
    });
  }, [miningCenterApplications, splitsActivity]);

  const miningCenterAppsForMiningScore = React.useMemo(() => {
    return miningCenterInProgress
      .map((item) => item.application)
      .filter((app): app is NonNullable<typeof app> => app !== null);
  }, [miningCenterInProgress]);

  const { miningScoreMap, isLoading: isMiningScoreLoading } = useMiningScore({
    applications: miningCenterAppsForMiningScore,
    enabled: hasWallet && miningCenterAppsForMiningScore.length > 0,
  });

  const miningCenterInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyMiningCenterRewards({
      sponsorshipsInProgress: miningCenterInProgress,
      miningScoreMap,
    });
  }, [miningCenterInProgress, miningScoreMap]);

  const aggregatedEstimatedWeeklyGlwMiningCenter = React.useMemo(() => {
    return getAggregatedEstimatedWeeklyGlw(miningCenterInProgressWithEstimates);
  }, [miningCenterInProgressWithEstimates]);

  const isWidgetLoading = isLoading || isSplitsActivityLoading;
  const isWidgetError = isError || isSplitsActivityError;

  const activeListingsCount = React.useMemo(() => {
    return (
      countActiveListings(launchpadApplications) +
      countActiveListings(minersApplications)
    );
  }, [launchpadApplications, minersApplications]);

  const rewardsHistoryData = React.useMemo<HistoryDataPoint[]>(() => {
    if (!data) return [];

    const buckets = new Map<
      number,
      {
        minerReward: number;
        delegationReward: number;
        otherReward: number;
        protocolDepositUsd: number;
      }
    >();

    for (const farm of data.farmDetails) {
      const isMiner = farm.type === "mining-center";
      for (const week of farm.weeklyBreakdown) {
        const prev = buckets.get(week.weekNumber) ?? {
          minerReward: 0,
          delegationReward: 0,
          otherReward: 0,
          protocolDepositUsd: 0,
        };

        const totalGlw = parseGlwFromWei(week.totalRewards);
        buckets.set(week.weekNumber, {
          minerReward: prev.minerReward + (isMiner ? totalGlw : 0),
          delegationReward: prev.delegationReward + (isMiner ? 0 : totalGlw),
          otherReward: prev.otherReward,
          protocolDepositUsd: prev.protocolDepositUsd,
        });
      }
    }

    for (const farm of data.otherFarmsWithRewards?.farms ?? []) {
      const asset = farm.asset;
      const isPdUsdAsset = asset === "USDG";
      for (const week of farm.weeklyBreakdown) {
        const prev = buckets.get(week.weekNumber) ?? {
          minerReward: 0,
          delegationReward: 0,
          otherReward: 0,
          protocolDepositUsd: 0,
        };

        const inflationGlw = parseGlwFromWei(week.inflationRewards);
        const pdUsd = isPdUsdAsset
          ? parseUsdFromBaseUnits(week.protocolDepositRewards)
          : 0;
        const pdGlw = !isPdUsdAsset
          ? parseGlwFromWei(week.protocolDepositRewards)
          : 0;
        buckets.set(week.weekNumber, {
          minerReward: prev.minerReward,
          delegationReward: prev.delegationReward,
          otherReward: prev.otherReward + inflationGlw + pdGlw,
          protocolDepositUsd: prev.protocolDepositUsd + pdUsd,
        });
      }
    }

    const points = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, value]) => {
        const total =
          value.minerReward + value.delegationReward + value.otherReward;
        return {
          weekNumber,
          week: `Wk ${weekNumber}`,
          minerReward: value.minerReward,
          delegationReward: value.delegationReward,
          otherReward: value.otherReward,
          protocolDepositUsd: value.protocolDepositUsd,
          total,
        };
      });

    return points.slice(-10);
  }, [data]);

  const chartData = React.useMemo<HistoryDataPoint[]>(() => {
    const base = [...rewardsHistoryData];
    const totalInProgress =
      aggregatedEstimatedWeeklyGlwLaunchpad +
      aggregatedEstimatedWeeklyGlwMiningCenter;
    if (totalInProgress <= 0) return base;

    const nextWeekNumber = (base.at(-1)?.weekNumber ?? 0) + 1;
    base.push({
      weekNumber: nextWeekNumber,
      week: "In progress",
      minerReward: aggregatedEstimatedWeeklyGlwMiningCenter,
      delegationReward: aggregatedEstimatedWeeklyGlwLaunchpad,
      otherReward: 0,
      protocolDepositUsd: 0,
      total: totalInProgress,
    });
    return base;
  }, [
    aggregatedEstimatedWeeklyGlwLaunchpad,
    aggregatedEstimatedWeeklyGlwMiningCenter,
    rewardsHistoryData,
  ]);

  const stats = React.useMemo(() => {
    const last = rewardsHistoryData.at(-1)?.total ?? 0;
    const prev = rewardsHistoryData.at(-2)?.total ?? 0;
    const lastPdUsd = rewardsHistoryData.at(-1)?.protocolDepositUsd ?? 0;
    const trendPercent =
      Number.isFinite(last) && Number.isFinite(prev) && prev > 0
        ? ((last - prev) / prev) * 100
        : null;

    const activeMiners = data
      ? data.farmStatistics.minerOnlyFarms + data.farmStatistics.bothTypesFarms
      : 0;
    const activeDelegations = data
      ? data.farmStatistics.delegatorOnlyFarms +
        data.farmStatistics.bothTypesFarms
      : 0;

    return {
      weeklyPayout: last,
      trend: formatTrendPercent({ current: last, previous: prev }),
      trendPercent,
      weeklyProtocolDepositUsd: lastPdUsd,
      activeMiners,
      activeDelegations,
      activeOtherRewards:
        data?.otherFarmsWithRewards?.count ??
        data?.otherFarmsWithRewards?.farms.length ??
        0,
    };
  }, [data, rewardsHistoryData]);

  const hasAnyRewardsOrActivity = React.useMemo(() => {
    if (!data) return false;

    const hasMiners =
      data.farmStatistics.minerOnlyFarms + data.farmStatistics.bothTypesFarms >
      0;
    const hasDelegations =
      data.farmStatistics.delegatorOnlyFarms +
        data.farmStatistics.bothTypesFarms >
      0;

    const hasPendingPurchases =
      (data.recentPurchasesWithoutRewards?.length ?? 0) > 0;

    const hasOtherRewards = (data.otherFarmsWithRewards?.count ?? 0) > 0;

    const totalGlwDelegatedAfter = Number(
      data.delegatedAfterWeekRange?.totalGlwDelegatedAfter ?? 0
    );
    const totalUsdcSpentAfter = Number(
      data.delegatedAfterWeekRange?.totalUsdcSpentAfter ?? 0
    );

    return (
      hasMiners ||
      hasDelegations ||
      hasOtherRewards ||
      hasPendingPurchases ||
      totalGlwDelegatedAfter > 0 ||
      totalUsdcSpentAfter > 0
    );
  }, [data]);

  const hasInProgressSponsorships =
    sponsorshipsInProgressWithEstimates.length > 0 ||
    miningCenterInProgressWithEstimates.length > 0 ||
    (isRewardScoresLoading && sponsorshipsInProgress.length > 0) ||
    (isMiningScoreLoading && miningCenterInProgress.length > 0);

  const isEmptyButConnected =
    hasWallet &&
    !isWidgetLoading &&
    !isWidgetError &&
    rewardsHistoryData.length === 0 &&
    !hasAnyRewardsOrActivity &&
    !hasInProgressSponsorships;

  const handleBatchCountdownComplete = React.useCallback(() => {
    setNextBatchAtMs(getNextTuesdayAt1pmET().getTime());
    void (async () => {
      try {
        await queryClient.refetchQueries({
          queryKey: QUERY_KEYS.listings.allSponsors,
        });
      } catch {}
    })();
  }, [queryClient]);
  const remainingMs = useCountdownTo({
    targetAtMs: nextBatchAtMs,
    onComplete: handleBatchCountdownComplete,
  });

  const placeholderHistoryData = React.useMemo<HistoryDataPoint[]>(
    () => [
      {
        weekNumber: 1,
        week: "Wk 1",
        minerReward: 1200,
        delegationReward: 800,
        otherReward: 250,
        protocolDepositUsd: 125,
        total: 2250,
      },
      {
        weekNumber: 2,
        week: "Wk 2",
        minerReward: 900,
        delegationReward: 1000,
        otherReward: 200,
        protocolDepositUsd: 80,
        total: 2100,
      },
      {
        weekNumber: 3,
        week: "Wk 3",
        minerReward: 1400,
        delegationReward: 700,
        otherReward: 300,
        protocolDepositUsd: 140,
        total: 2400,
      },
      {
        weekNumber: 4,
        week: "Wk 4",
        minerReward: 800,
        delegationReward: 900,
        otherReward: 150,
        protocolDepositUsd: 60,
        total: 1850,
      },
      {
        weekNumber: 5,
        week: "Wk 5",
        minerReward: 1500,
        delegationReward: 1100,
        otherReward: 400,
        protocolDepositUsd: 160,
        total: 3000,
      },
      {
        weekNumber: 6,
        week: "Wk 6",
        minerReward: 1100,
        delegationReward: 950,
        otherReward: 225,
        protocolDepositUsd: 95,
        total: 2275,
      },
      {
        weekNumber: 7,
        week: "Wk 7",
        minerReward: 1300,
        delegationReward: 900,
        otherReward: 275,
        protocolDepositUsd: 110,
        total: 2475,
      },
      {
        weekNumber: 8,
        week: "Wk 8",
        minerReward: 1000,
        delegationReward: 850,
        otherReward: 180,
        protocolDepositUsd: 75,
        total: 2030,
      },
      {
        weekNumber: 9,
        week: "Wk 9",
        minerReward: 1600,
        delegationReward: 900,
        otherReward: 420,
        protocolDepositUsd: 190,
        total: 2920,
      },
      {
        weekNumber: 10,
        week: "Wk 10",
        minerReward: 1250,
        delegationReward: 1050,
        otherReward: 260,
        protocolDepositUsd: 105,
        total: 2560,
      },
    ],
    []
  );

  return (
    <Dialog>
      {/* --- DASHBOARD CARD --- */}
      <Card className="h-full lg:max-h-[380px] overflow-hidden flex flex-col gap-2 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
        {!isEmptyButConnected && (
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold tracking-tight text-foreground">
                Glow Mining
              </div>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasWallet || isEmptyButConnected}
                  className="h-8 rounded-full px-3 text-[11px] font-mono tracking-wider gap-2"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>View Details</span>
                </Button>
              </DialogTrigger>
            </div>
          </CardHeader>
        )}

        <CardContent className="flex-1 min-h-0 p-0">
          <div
            className={cn(
              "flex-1 min-h-0 flex flex-col gap-6",
              !isEmptyButConnected ? "p-4 pt-2 sm:p-6" : "p-0"
            )}
          >
            {!hasWallet ? (
              isWalletConnecting ? (
                <SolarFarmSkeleton />
              ) : (
                <div className="relative flex-1 min-h-0">
                  <div
                    aria-hidden
                    className="pointer-events-none select-none blur-[10px] opacity-60"
                  >
                    {/* Dashboard Stats (placeholder) */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                          Current Weekly Payout
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Sun className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                            <span className="text-3xl font-bold text-foreground tracking-tight font-mono">
                              2,300
                            </span>
                            <span className="text-sm font-bold text-muted-foreground font-mono">
                              GLW
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 font-mono border border-emerald-500/20">
                            +8.2%
                          </span>
                        </div>
                      </div>

                      <div className="w-full sm:w-auto bg-muted/30 px-3 py-2 sm:px-4 rounded-xl border border-border">
                        <div className="grid grid-cols-3 divide-x divide-border">
                          <div className="flex flex-col items-center sm:items-end px-2 sm:px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg font-bold text-foreground font-mono">
                                3
                              </span>
                              <Cpu className="w-4 h-4 text-miner-yellow" />
                            </div>
                            <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                              Miners
                            </span>
                          </div>
                          <div className="flex flex-col items-center sm:items-end px-2 sm:px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg font-bold text-foreground font-mono">
                                2
                              </span>
                              <Zap className="w-4 h-4 text-glow-purple" />
                            </div>
                            <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                              Delegations
                            </span>
                          </div>
                          <div className="flex flex-col items-center sm:items-end px-2 sm:px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg font-bold text-foreground font-mono">
                                1
                              </span>
                              <Gift className="w-4 h-4 text-[color:var(--color-glow-green)]" />
                            </div>
                            <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                              Other
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chart (placeholder) */}
                    <div className="mt-6 h-[190px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={placeholderHistoryData} barSize={24}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="var(--border)"
                            opacity={0.5}
                          />
                          <XAxis
                            dataKey="week"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fill: "var(--muted-foreground)",
                              fontSize: 10,
                              fontFamily: "monospace",
                            }}
                            dy={10}
                          />
                          <Bar
                            dataKey="minerReward"
                            stackId="a"
                            fill="var(--color-glow-yellow)"
                            radius={[0, 0, 4, 4]}
                            animationDuration={1500}
                          />
                          <Bar
                            dataKey="delegationReward"
                            stackId="a"
                            fill="var(--color-glow-purple)"
                            radius={[0, 0, 0, 0]}
                            animationDuration={1500}
                          />
                          <Bar
                            dataKey="otherReward"
                            stackId="a"
                            fill="var(--color-glow-green)"
                            radius={[4, 4, 0, 0]}
                            animationDuration={1500}
                          />
                          <Bar
                            dataKey="protocolDepositUsd"
                            fill="var(--color-glow-orange)"
                            radius={[4, 4, 0, 0]}
                            animationDuration={1500}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2">
                    <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Connect your wallet
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Connect your wallet to view mining performance.
                    </div>
                  </div>
                </div>
              )
            ) : isWidgetLoading ? (
              <SolarFarmSkeleton />
            ) : isWidgetError ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Unable to load rewards breakdown
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono"
                  onClick={() => refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : isEmptyButConnected ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden p-6 flex flex-col pb-0">
                  <div className="relative flex flex-col items-center justify-center text-center flex-1 gap-6">
                    <div className="space-y-2">
                      <div className="text-lg font-bold text-foreground">
                        No Active Solar Streams
                      </div>
                      <div className="mx-auto max-w-[400px] text-sm text-zinc-400">
                        Your portfolio is currently dormant. Delegate GLW to
                        generate weekly GLW rewards.
                      </div>
                    </div>

                    <div className="w-full max-w-md space-y-3">
                      {activeListingsCount > 0 ? (
                        <Button
                          className="h-12 w-full bg-foreground text-background hover:bg-foreground/90 font-mono dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                          onClick={() => setIsLaunchpadOpen(true)}
                        >
                          <Rocket className="mr-2 h-4 w-4" />
                          Browse Launchpad
                        </Button>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                            Next batch in
                          </div>
                          <div className="solar-farm-next-batch-countdown">
                            <AnimatedCountdown
                              remainingMs={remainingMs}
                              size="xl"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-full max-w-lg">
                      <div className="h-px w-full bg-border/60 mb-4" />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Link
                          href="https://glow.org/blog/guide-to-glow-mining"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group rounded-2xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-[color:var(--color-miner-yellow)]/50"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/50">
                              <Cpu className="h-4 w-4 text-[color:var(--color-miner-yellow-contrast)]" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground transition-colors group-hover:text-[color:var(--color-miner-yellow-contrast)]">
                                How Mining Works
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                Learn about cash incentives & yield.
                              </div>
                            </div>
                          </div>
                        </Link>

                        <Link
                          href="https://glow.org/blog/guide-to-delegating-glow"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group rounded-2xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-[#C084FC]/50"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/50">
                              <Layers className="h-4 w-4 text-[#C084FC]" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground transition-colors group-hover:text-[#C084FC]">
                                Guide to Delegation
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                Learn about deposit recovery & surplus.
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>

                  <LaunchpadDialog
                    key={
                      isLaunchpadOpen ? "launchpad-open" : "launchpad-closed"
                    }
                    open={isLaunchpadOpen}
                    onOpenChange={setIsLaunchpadOpen}
                  />
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-center">
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  No weekly rewards data yet
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  Once you have miner/delegation rewards, your last 10 weeks
                  will appear here.
                </div>
              </div>
            ) : (
              <>
                {/* Dashboard Stats */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                      Current Weekly Payout
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Sun className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                        <div className="flex flex-col leading-none">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-foreground tracking-tight font-mono">
                              {formatGlwCompact(stats.weeklyPayout)}
                            </span>
                            <span className="text-sm font-bold text-muted-foreground font-mono">
                              GLW
                            </span>
                          </div>
                          {stats.weeklyProtocolDepositUsd > 0 ? (
                            <div className="text-[11px] font-bold text-muted-foreground font-mono">
                              +{" "}
                              {formatUsdPrecise(stats.weeklyProtocolDepositUsd)}{" "}
                              USDG
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {/* <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border",
                        stats.trendPercent === null
                          ? "bg-muted text-muted-foreground border-border"
                          : stats.trendPercent >= 0
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                      )}
                    >
                      {stats.trend}
                    </span> */}
                    </div>
                  </div>

                  <DialogTrigger asChild>
                    <button
                      type="button"
                      aria-label="Open farm performance details"
                      className={cn(
                        "w-full sm:w-auto bg-muted/30 px-3 py-2 sm:px-4 rounded-xl border border-border transition-colors cursor-pointer",
                        "hover:bg-muted/40 hover:border-border/80",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      )}
                    >
                      <div className="grid grid-cols-3 divide-x divide-border">
                        <div className="flex flex-col items-center sm:items-end px-2 sm:px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg font-bold text-foreground font-mono">
                              {stats.activeMiners}
                            </span>
                            <Cpu className="w-4 h-4 text-miner-yellow" />
                          </div>
                          <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                            Miners
                          </span>
                        </div>
                        <div className="flex flex-col items-center sm:items-end px-2 sm:px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg font-bold text-foreground font-mono">
                              {stats.activeDelegations}
                            </span>
                            <Zap className="w-4 h-4 text-glow-purple" />
                          </div>
                          <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                            Delegations
                          </span>
                        </div>
                        <div className="flex flex-col items-center sm:items-end px-2 sm:px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg font-bold text-foreground font-mono">
                              {stats.activeOtherRewards}
                            </span>
                            <Gift className="w-4 h-4 text-[color:var(--color-glow-green)]" />
                          </div>
                          <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                            Other
                          </span>
                        </div>
                      </div>
                    </button>
                  </DialogTrigger>
                </div>

                {/* Chart */}
                <div className="flex-1 w-full min-h-[160px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={24}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="week"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "var(--muted-foreground)",
                          fontSize: 10,
                          fontFamily: "monospace",
                        }}
                        dy={10}
                      />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                      />
                      <Bar
                        dataKey="minerReward"
                        stackId="a"
                        fill="var(--color-glow-yellow)"
                        radius={[0, 0, 4, 4]}
                        animationDuration={1500}
                      />
                      <Bar
                        dataKey="delegationReward"
                        stackId="a"
                        fill="var(--color-glow-purple)"
                        radius={[0, 0, 0, 0]}
                        animationDuration={1500}
                      />
                      <Bar
                        dataKey="otherReward"
                        stackId="a"
                        fill="var(--color-glow-green)"
                        radius={[4, 4, 0, 0]}
                        animationDuration={1500}
                      />
                      <Bar
                        dataKey="protocolDepositUsd"
                        fill="var(--color-glow-orange)"
                        radius={[4, 4, 0, 0]}
                        animationDuration={1500}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <FarmsPerformanceDialogContent
        walletAddress={walletAddress ?? undefined}
      />
    </Dialog>
  );
}
