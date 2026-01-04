"use client";

import React from "react";
import { Share2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  if (status === "missed" && week === currentWeek) return "current";
  return status;
}

interface WeeklyActivityWidgetProps {
  walletAddress?: string | null;
  hideIfEmpty?: boolean;
}

const PLACEHOLDER_ACTIVE_WEEKS = 17;

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
      <CardContent>
        <div className="flex flex-col h-full min-h-0">
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center text-center mb-4">
              <Skeleton className="h-12 w-20 rounded-xl" />
              <Skeleton className="mt-2 h-3 w-32 rounded-md" />
            </div>
            <Skeleton className="h-[92px] w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WeeklyActivityWidget({
  walletAddress,
  hideIfEmpty = true,
}: WeeklyActivityWidgetProps) {
  const weeksCount = 24;
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

  const weekCells = React.useMemo<WeekCell[]>(() => {
    if (!hasWallet) return [];
    const endWeek = lastKnownWeek;
    const startWeek = Math.max(V2_START_WEEK, endWeek - (weeksCount - 1));
    if (startWeek > endWeek) return [];

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
  }, [hasWallet, lastKnownWeek, minerWeeks, weeklyDelegations]);

  const activeWeeks = React.useMemo(
    () => weekCells.filter((w) => w.status !== "missed").length,
    [weekCells]
  );

  const isLoading = hasWallet && (isRewardsLoading || isSplitsLoading);
  const isError = hasWallet && (isRewardsError || isSplitsError);

  const handleShareOnX = React.useCallback(() => {
    if (typeof window === "undefined" || !walletAddress) return;
    const displayedWeeks = weekCells.length;
    const shareText = `🔥 My Glow weekly streak: ${activeWeeks}/${displayedWeeks} weeks`;
    const shareUrl = `https://app.glow.org/share/streak/${walletAddress}`;
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      `${shareText} #GlowCommit @glowFND`
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
  }, [activeWeeks, walletAddress, weekCells.length]);

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
      <CardContent>
        <div className="flex flex-col h-full min-h-0">
          {!hasWallet ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center justify-center text-center mb-2 select-none">
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

              <div aria-hidden className="blur-[1.5px] opacity-60">
                <div className="grid grid-cols-8 grid-rows-3 gap-2">
                  {PLACEHOLDER_CELLS.map((status, idx) => (
                    <div
                      key={`placeholder-${idx}`}
                      className={cn(
                        "h-5 w-5 rounded-[4px] border border-border/60",
                        getWeekStyle(status)
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Connect your wallet
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Connect your wallet to see your streak.
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center text-center mb-4">
                <Skeleton className="h-12 w-20 rounded-xl" />
                <Skeleton className="mt-2 h-3 w-32 rounded-md" />
              </div>
              <Skeleton className="h-[92px] w-full rounded-xl" />
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
              <div className="flex flex-col items-center justify-center text-center mb-4">
                <div className="font-mono text-5xl font-bold tracking-tight text-foreground leading-none">
                  {activeWeeks}
                  <span className="ml-2 text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider align-middle">
                    Wks
                  </span>
                </div>
                <div className="mt-2 font-mono text-xs text-muted-foreground">
                  Last {weekCells.length} Weeks
                </div>
              </div>

              <TooltipProvider delayDuration={200}>
                <div className="grid grid-cols-5 grid-rows-3 gap-2">
                  {weekCells.map((cell) => {
                    return (
                      <Tooltip key={cell.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "h-8 w-8 rounded-[4px] border border-border/60",
                              "hover:ring-2 hover:ring-foreground/10 hover:ring-offset-2 hover:ring-offset-background",
                              getWeekStyle(cell.status)
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="center"
                          sideOffset={10}
                        >
                          <div className="font-mono text-[10px]">
                            <div>{cell.rangeLabel}</div>
                            <div className="text-muted-foreground">
                              {getWeekStatusLabel({
                                status: cell.status,
                                week: cell.week,
                                currentWeek,
                              })}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>

              <div className="mt-auto pt-4 space-y-4">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono uppercase">
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
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleShareOnX}
                  disabled={!walletAddress || weekCells.length === 0}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share on X
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
