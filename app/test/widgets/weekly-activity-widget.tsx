"use client";

import React from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useSplitsActivity,
  type SplitActivity,
  useRewardsBreakdown,
  useImpactLeaderboardQuery,
} from "@/hooks";
import {
  buildWeeklyDelegations,
  getCurrentWeekNumber,
  getGlwFromWei,
  getWeekNumberFromTimestamp,
  weekToTimestamp,
} from "@/lib/rewards/weekly-delegations";
import { useAccount } from "wagmi";

type WeekStatus = "missed" | "delegated" | "miner" | "both";

function getWeekStyle(status: WeekStatus) {
  if (status === "delegated") return "bg-[#C084FC]/25";
  if (status === "miner") return "bg-[color:var(--color-miner-yellow)]/25";
  if (status === "both") return "bg-[#4ADE80]/25";
  return "bg-muted";
}

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

const V2_START_ISO = "2025-10-11T00:00:00Z";
const V2_START_WEEK = getWeekNumberFromTimestamp(
  new Date(V2_START_ISO).getTime()
);

interface WeekCell {
  id: string;
  week: number;
  status: WeekStatus;
  weekStart: Date;
  rangeLabel: string;
}

function groupDelegationsByWeek(splits: SplitActivity[]) {
  const map = new Map<number, number>();
  splits
    .filter((split) => split.fractionType === "launchpad")
    .forEach((split) => {
      const amount = getGlwFromWei(split.amount);
      if (amount <= 0) return;
      const weekNumber = getWeekNumberFromTimestamp(split.timestamp);
      map.set(weekNumber, (map.get(weekNumber) ?? 0) + amount);
    });
  return map;
}

function formatWeekRange(date: Date) {
  const end = new Date(date);
  end.setDate(date.getDate() + 6);
  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}, ${end.getFullYear()}`;
}

function getWeekStatus(params: {
  hasDelegation: boolean;
  hasMinerPurchase: boolean;
}): WeekStatus {
  const { hasDelegation, hasMinerPurchase } = params;
  if (hasDelegation && hasMinerPurchase) return "both";
  if (hasDelegation) return "delegated";
  if (hasMinerPurchase) return "miner";
  return "missed";
}

function getWeekStatusLabel(params: {
  status: WeekStatus;
  week: number;
  currentWeek: number;
}) {
  const { status, week, currentWeek } = params;
  if (status === "missed" && week === currentWeek) return "Current";
  if (status === "delegated") return "Delegator";
  if (status === "miner") return "Miner";
  if (status === "both") return "Both";
  return "Missed";
}

interface WeeklyActivityWidgetProps {
  walletAddress?: string | null;
  hideIfEmpty?: boolean;
}

const PLACEHOLDER_ACTIVE_WEEKS = 17;
const DISPLAY_WEEKS_CAP = 24;
const GRID_COLUMNS = 8;

const PLACEHOLDER_CELLS: WeekStatus[] = [
  "missed",
  "delegated",
  "miner",
  "both",
  "missed",
  "missed",
  "delegated",
  "missed",
  "miner",
  "missed",
  "both",
  "delegated",
  "missed",
  "missed",
  "delegated",
  "miner",
  "missed",
  "both",
  "missed",
  "delegated",
  "missed",
  "miner",
  "missed",
  "both",
];

function WeeklyActivitySkeleton() {
  return (
    <Card className="overflow-hidden h-full lg:max-h-[380px] bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
      <CardHeader className="pb-0">
        <CardTitle className="text-center">Weekly Streak</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 p-4 py-0">
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="flex flex-col items-center justify-center text-center select-none">
            <Skeleton className="h-12 w-20 rounded-xl" />
            <Skeleton className="mt-2 h-3 w-32 rounded-md" />
          </div>
          <div className="flex flex-1 min-h-0 items-center justify-center">
            <Skeleton className="h-[128px] w-full rounded-xl" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function WeeklyActivityWidget({
  walletAddress,
  hideIfEmpty = true,
}: WeeklyActivityWidgetProps) {
  const weeksCount = DISPLAY_WEEKS_CAP;
  const hasWallet = Boolean(walletAddress);
  const { isConnecting, isReconnecting } = useAccount();
  const isWalletConnecting = isConnecting || isReconnecting;

  const impactLeaderboardQuery = useImpactLeaderboardQuery({
    enabled: Boolean(HUB_URL && hasWallet),
  });

  const {
    data: rewardsData,
    isLoading: isRewardsLoading,
    isError: isRewardsError,
  } = useRewardsBreakdown({
    walletAddress: walletAddress || null,
    enabled: hasWallet,
  });

  const {
    activity: splitsActivity = [],
    isLoading: isSplitsLoading,
    isError: isSplitsError,
  } = useSplitsActivity({
    walletAddress: walletAddress || undefined,
    enabled: hasWallet,
    limit: 200,
  });

  const rewardsDelegations = React.useMemo(
    () => buildWeeklyDelegations(rewardsData),
    [rewardsData]
  );

  const splitDelegations = React.useMemo(() => {
    if (!splitsActivity.length) return new Map<number, number>();
    return groupDelegationsByWeek(splitsActivity);
  }, [splitsActivity]);

  const minerWeeks = React.useMemo(() => {
    const set = new Set<number>();
    splitsActivity.forEach((split) => {
      if (split.fractionType !== "mining-center") return;
      set.add(getWeekNumberFromTimestamp(split.timestamp));
    });
    return set;
  }, [splitsActivity]);

  const weeklyDelegations = React.useMemo(() => {
    return splitDelegations.size > 0 ? splitDelegations : rewardsDelegations;
  }, [rewardsDelegations, splitDelegations]);

  const currentWeek = React.useMemo(() => getCurrentWeekNumber(), []);
  const impactEndWeek = impactLeaderboardQuery.data?.weekRange?.endWeek ?? null;

  const lastKnownWeek = React.useMemo(() => {
    const latestRewardsWeek = rewardsData?.weekRange?.endWeek ?? 0;
    const latestDelegationWeek = weeklyDelegations.size
      ? Math.max(...Array.from(weeklyDelegations.keys()))
      : 0;
    const latestMinerWeek = minerWeeks.size
      ? Math.max(...Array.from(minerWeeks.values()))
      : 0;
    return Math.max(
      currentWeek,
      impactEndWeek ?? 0,
      latestRewardsWeek,
      latestDelegationWeek,
      latestMinerWeek
    );
  }, [
    currentWeek,
    impactEndWeek,
    minerWeeks,
    rewardsData?.weekRange?.endWeek,
    weeklyDelegations,
  ]);

  const weekRange = React.useMemo(() => {
    if (!hasWallet) return null;
    const endWeek = lastKnownWeek;
    const startWeek = Math.max(V2_START_WEEK, endWeek - (weeksCount - 1));
    if (startWeek > endWeek) return null;
    const displayWeeksCount = endWeek - startWeek + 1;
    const gridRows = Math.max(1, Math.ceil(displayWeeksCount / GRID_COLUMNS));
    return {
      startWeek,
      endWeek,
      displayWeeksCount,
      gridColumns: GRID_COLUMNS,
      gridRows,
      gridSize: GRID_COLUMNS * gridRows,
    };
  }, [hasWallet, lastKnownWeek, weeksCount]);

  const weekCells = React.useMemo<WeekCell[]>(() => {
    if (!hasWallet) return [];
    if (!weekRange) return [];
    const { startWeek, endWeek } = weekRange;

    const cells: WeekCell[] = [];
    for (let week = startWeek; week <= endWeek; week++) {
      const weekStart = new Date(weekToTimestamp(week));
      const hasDelegation = (weeklyDelegations.get(week) ?? 0) > 0;
      const hasMinerPurchase = minerWeeks.has(week);
      const status = getWeekStatus({ hasDelegation, hasMinerPurchase });

      cells.push({
        id: `week-${week}`,
        week,
        status,
        weekStart,
        rangeLabel: formatWeekRange(weekStart),
      });
    }

    return cells;
  }, [hasWallet, minerWeeks, weekRange, weeklyDelegations]);

  const activeWeeks = React.useMemo(
    () => weekCells.filter((w) => w.status !== "missed").length,
    [weekCells]
  );

  const streakWeeks = React.useMemo(() => {
    if (!weekRange) return 0;
    if (!weekCells.length) return 0;

    const statusByWeek = new Map<number, WeekStatus>();
    weekCells.forEach((cell) => statusByWeek.set(cell.week, cell.status));

    const currentStatus = statusByWeek.get(currentWeek) ?? "missed";
    const endWeekForStreak =
      currentStatus === "missed" ? currentWeek - 1 : currentWeek;

    let streak = 0;
    for (let week = endWeekForStreak; week >= weekRange.startWeek; week--) {
      const status = statusByWeek.get(week);
      if (!status) break;
      if (status === "missed") break;
      streak++;
    }

    return streak;
  }, [currentWeek, weekCells, weekRange]);

  const statusCounts = React.useMemo(() => {
    let miner = 0;
    let delegated = 0;
    let both = 0;
    let missed = 0;
    weekCells.forEach((cell) => {
      if (cell.status === "miner") miner++;
      else if (cell.status === "delegated") delegated++;
      else if (cell.status === "both") both++;
      else missed++;
    });
    return { miner, delegated, both, missed };
  }, [weekCells]);

  const isLoading = hasWallet && (isRewardsLoading || isSplitsLoading);
  const isError = hasWallet && (isRewardsError || isSplitsError);

  const shouldHide =
    hasWallet &&
    !isWalletConnecting &&
    !isLoading &&
    !isError &&
    (weekCells.length === 0 || activeWeeks === 0);
  if (shouldHide && hideIfEmpty) return null;

  if (!hasWallet && isWalletConnecting) return <WeeklyActivitySkeleton />;

  return (
    <Card className="overflow-hidden h-full lg:max-h-[380px] bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
      <CardHeader className="pb-0">
        <CardTitle className="text-center">Weekly Streak</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 p-4 py-0">
        <div className="flex flex-col flex-1 min-h-0">
          {!hasWallet ? (
            <div className="flex flex-col flex-1 min-h-0 gap-4">
              <div className="flex flex-col items-center justify-center text-center select-none">
                <div className="font-mono text-5xl font-bold tracking-tight text-foreground leading-none blur-[2px] opacity-60">
                  {PLACEHOLDER_ACTIVE_WEEKS}
                  <span className="ml-2 text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider align-middle">
                    Wks
                  </span>
                </div>
                <div className="mt-2 font-mono text-xs text-muted-foreground blur-[1px] opacity-60">
                  Last {weeksCount} Weeks
                </div>
              </div>

              <div
                aria-hidden
                className="flex flex-1 min-h-0 items-center justify-center blur-[1.5px] opacity-60"
              >
                <div className="grid grid-cols-8 grid-rows-3 gap-2">
                  {PLACEHOLDER_CELLS.map((status, idx) => (
                    <div
                      key={`placeholder-${idx}`}
                      className={cn(
                        "h-7 w-7 sm:h-8 sm:w-8 rounded-[6px] border border-border/60",
                        getWeekStyle(status)
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-auto rounded-xl border border-border bg-muted/20 p-3 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Connect your wallet
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Connect your wallet to see your streak.
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col flex-1 min-h-0 gap-4">
              <div className="flex flex-col items-center justify-center text-center select-none">
                <Skeleton className="h-12 w-20 rounded-xl" />
                <Skeleton className="mt-2 h-3 w-32 rounded-md" />
              </div>
              <div className="flex flex-1 min-h-0 items-center justify-center">
                <Skeleton className="h-[128px] w-full rounded-xl" />
              </div>
            </div>
          ) : isError ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center gap-2 py-10">
              <div className="text-sm text-destructive">
                Unable to load weekly activity.
              </div>
            </div>
          ) : shouldHide ? (
            <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center gap-2 px-4">
              <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                No streak yet
              </div>
              <div className="text-sm text-muted-foreground max-w-[320px]">
                Delegate GLW or buy miners to start building your weekly streak.
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center text-center select-none">
                <div className="font-mono text-5xl font-bold tracking-tight text-foreground leading-none">
                  {streakWeeks}
                  <span className="ml-2 text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider align-middle">
                    Wks
                  </span>
                </div>
                <div className="mt-2 font-mono text-xs text-muted-foreground">
                  Current Streak
                </div>
              </div>

              <div className="mt-4 flex flex-1 min-h-0 items-center justify-center">
                <TooltipProvider delayDuration={200}>
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${
                        weekRange?.gridColumns ?? GRID_COLUMNS
                      }, minmax(0, 1fr))`,
                    }}
                  >
                    {weekCells.map((cell) => {
                      const isCurrentWeek = cell.week === currentWeek;
                      return (
                        <Tooltip key={cell.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "h-7 w-7 sm:h-8 sm:w-8 rounded-[6px] border border-border/60",
                                "outline-none focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                "hover:ring-2 hover:ring-foreground/10 hover:ring-offset-2 hover:ring-offset-background",
                                isCurrentWeek && "ring-1 ring-foreground/10",
                                getWeekStyle(cell.status)
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="center"
                            sideOffset={10}
                            className="rounded-xl border border-foreground/10 dark:border-zinc-800 bg-popover/95 px-3 py-2"
                          >
                            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
                              {cell.rangeLabel}
                            </div>
                            <div className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
                              {getWeekStatusLabel({
                                status: cell.status,
                                week: cell.week,
                                currentWeek,
                              })}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                    {Array.from({
                      length: Math.max(
                        0,
                        (weekRange?.gridSize ?? 0) - weekCells.length
                      ),
                    }).map((_, idx) => (
                      <div
                        key={`filler-${idx}`}
                        aria-hidden
                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-[6px] border border-border/60 bg-muted/40"
                      />
                    ))}
                  </div>
                </TooltipProvider>
              </div>

              <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono uppercase">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[color:var(--color-miner-yellow)] opacity-80 border border-border/40" />
                        <span>Miner</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#C084FC] opacity-80 border border-border/40" />
                        <span>Delegator</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#4ADE80] opacity-80 border border-border/40" />
                        <span>Both</span>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Streak {streakWeeks}/{weekCells.length}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-border/60 bg-background/40 px-2 py-1">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Miner
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-foreground">
                        {statusCounts.miner}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/40 px-2 py-1">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Delegator
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-foreground">
                        {statusCounts.delegated}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/40 px-2 py-1">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Both
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-foreground">
                        {statusCounts.both}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
