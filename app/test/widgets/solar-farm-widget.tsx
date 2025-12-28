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
import { Cpu, Zap, LayoutGrid, Sun, Rocket, Layers } from "lucide-react";
import Link from "next/link";
import { useGlowLaunchpad } from "@/hooks/useGlowLaunchpad";
import { useMiningCenter } from "@/hooks/useMiningCenter";
import { useAccount } from "wagmi";

// --- Shadcn UI Components ---
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { FarmsPerformanceDialogContent } from "./farms-performance-dialog";
import { useRewardsBreakdown } from "@/hooks/useRewardsBreakdown";
import { cn } from "@/lib/utils";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";
import { countActiveListings } from "@/utils/launchpad";
import {
  AnimatedCountdown,
  useCountdownTo,
} from "@/app/components/animated-countdown";

interface HistoryDataPoint {
  weekNumber: number;
  week: string;
  minerReward: number;
  delegationReward: number;
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
    const total = minerVal + delVal;
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
          <div className="h-px bg-border my-1" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono uppercase">
              Total
            </span>
            <span className="text-sm font-bold text-foreground font-mono">
              {formatGlwPrecise(total)} GLW
            </span>
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
  const { applications: minersApplications } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
  });

  const activeListingsCount = React.useMemo(() => {
    return (
      countActiveListings(launchpadApplications) +
      countActiveListings(minersApplications)
    );
  }, [launchpadApplications, minersApplications]);

  const historyData = React.useMemo<HistoryDataPoint[]>(() => {
    if (!data) return [];

    const buckets = new Map<
      number,
      { minerReward: number; delegationReward: number }
    >();

    for (const farm of data.farmDetails) {
      const isMiner = farm.type === "mining-center";
      for (const week of farm.weeklyBreakdown) {
        const prev = buckets.get(week.weekNumber) ?? {
          minerReward: 0,
          delegationReward: 0,
        };

        const totalGlw = parseGlwFromWei(week.totalRewards);
        buckets.set(week.weekNumber, {
          minerReward: prev.minerReward + (isMiner ? totalGlw : 0),
          delegationReward: prev.delegationReward + (isMiner ? 0 : totalGlw),
        });
      }
    }

    const points = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, value]) => {
        const total = value.minerReward + value.delegationReward;
        return {
          weekNumber,
          week: `Wk ${weekNumber}`,
          minerReward: value.minerReward,
          delegationReward: value.delegationReward,
          total,
        };
      });

    return points.slice(-10);
  }, [data]);

  const stats = React.useMemo(() => {
    const last = historyData.at(-1)?.total ?? 0;
    const prev = historyData.at(-2)?.total ?? 0;
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
      activeMiners,
      activeDelegations,
    };
  }, [data, historyData]);

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

    const totalGlwDelegatedAfter = Number(
      data.delegatedAfterWeekRange?.totalGlwDelegatedAfter ?? 0
    );
    const totalUsdcSpentAfter = Number(
      data.delegatedAfterWeekRange?.totalUsdcSpentAfter ?? 0
    );

    return (
      hasMiners ||
      hasDelegations ||
      hasPendingPurchases ||
      totalGlwDelegatedAfter > 0 ||
      totalUsdcSpentAfter > 0
    );
  }, [data]);

  const isEmptyButConnected =
    hasWallet &&
    !isLoading &&
    !isError &&
    historyData.length === 0 &&
    !hasAnyRewardsOrActivity;

  const handleBatchCountdownComplete = React.useCallback(() => {
    setNextBatchAtMs(getNextTuesdayAt1pmET().getTime());
  }, []);
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
        total: 2000,
      },
      {
        weekNumber: 2,
        week: "Wk 2",
        minerReward: 900,
        delegationReward: 1000,
        total: 1900,
      },
      {
        weekNumber: 3,
        week: "Wk 3",
        minerReward: 1400,
        delegationReward: 700,
        total: 2100,
      },
      {
        weekNumber: 4,
        week: "Wk 4",
        minerReward: 800,
        delegationReward: 900,
        total: 1700,
      },
      {
        weekNumber: 5,
        week: "Wk 5",
        minerReward: 1500,
        delegationReward: 1100,
        total: 2600,
      },
      {
        weekNumber: 6,
        week: "Wk 6",
        minerReward: 1100,
        delegationReward: 950,
        total: 2050,
      },
      {
        weekNumber: 7,
        week: "Wk 7",
        minerReward: 1300,
        delegationReward: 900,
        total: 2200,
      },
      {
        weekNumber: 8,
        week: "Wk 8",
        minerReward: 1000,
        delegationReward: 850,
        total: 1850,
      },
      {
        weekNumber: 9,
        week: "Wk 9",
        minerReward: 1600,
        delegationReward: 900,
        total: 2500,
      },
      {
        weekNumber: 10,
        week: "Wk 10",
        minerReward: 1250,
        delegationReward: 1050,
        total: 2300,
      },
    ],
    []
  );

  return (
    <Dialog>
      {/* --- DASHBOARD CARD --- */}
      <Card className="h-full lg:max-h-[380px] flex flex-col overflow-hidden pt-0 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
        {!isEmptyButConnected && (
          <CardHeader className="pb-2 border-b border-border/60 bg-muted/20 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="tracking-tight text-sm font-bold text-foreground uppercase font-mono">
                  Glow Mining
                </CardTitle>
                <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground font-mono">
                  Last 10 Weeks
                </span>
              </div>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!hasWallet || isEmptyButConnected}
                  className="h-7 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
                >
                  <LayoutGrid className="w-3 h-3" />
                  View Details
                </Button>
              </DialogTrigger>
            </div>
          </CardHeader>
        )}

        <CardContent
          className={cn(
            "flex-1 min-h-0 flex flex-col gap-6",
            !isEmptyButConnected ? "p-6 pt-2" : "p-0"
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
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
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

                    <div className="flex items-center gap-4 bg-muted/30 px-4 py-2 rounded-xl border border-border">
                      <div className="flex flex-col items-end">
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
                      <div className="w-px h-8 bg-border" />
                      <div className="flex flex-col items-end">
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
                          fill="var(--color-miner-yellow)"
                          radius={[0, 0, 4, 4]}
                          animationDuration={1500}
                        />
                        <Bar
                          dataKey="delegationReward"
                          stackId="a"
                          fill="var(--color-glow-purple)"
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
          ) : isLoading ? (
            <SolarFarmSkeleton />
          ) : isError ? (
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
                  key={isLaunchpadOpen ? "launchpad-open" : "launchpad-closed"}
                  open={isLaunchpadOpen}
                  onOpenChange={setIsLaunchpadOpen}
                />
              </div>
            </div>
          ) : !data || historyData.length === 0 ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-center">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                No weekly rewards data yet
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">
                Once you have miner/delegation rewards, your last 10 weeks will
                appear here.
              </div>
            </div>
          ) : (
            <>
              {/* Dashboard Stats */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                    Current Weekly Payout
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Sun className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                      <span className="text-3xl font-bold text-foreground tracking-tight font-mono">
                        {formatGlwCompact(stats.weeklyPayout)}
                      </span>
                      <span className="text-sm font-bold text-muted-foreground font-mono">
                        GLW
                      </span>
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

                <div className="flex items-center gap-4 bg-muted/30 px-4 py-2 rounded-xl border border-border">
                  <div className="flex flex-col items-end">
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
                  <div className="w-px h-8 bg-border" />
                  <div className="flex flex-col items-end">
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
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 w-full min-h-[160px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historyData} barSize={24}>
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
                      radius={[4, 4, 0, 0]}
                      animationDuration={1500}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <FarmsPerformanceDialogContent
        walletAddress={walletAddress ?? undefined}
      />
    </Dialog>
  );
}
