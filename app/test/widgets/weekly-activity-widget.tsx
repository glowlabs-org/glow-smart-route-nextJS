"use client";

import React from "react";

import { useQuery } from "@tanstack/react-query";
import { isAddress } from "viem";

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
  type ImpactGlowScoreResponse,
} from "@/hooks";
import {
  buildWeeklyDelegations,
  getCurrentWeekNumber,
  getGlwFromWei,
  getUsdcFromWei,
  getWeekNumberFromTimestamp,
  weekToTimestamp,
} from "@/lib/rewards/weekly-delegations";
import {
  normalizeDelegationCurrency,
  parseTokenAmountFromBaseUnits,
} from "@/utils/launchpad-rewards";
import { useV2PointsBalance } from "@/hooks/v2-points";
import { useAccount } from "wagmi";

type WeekStatus = "missed" | "delegated" | "miner" | "both";

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
  delegationAmounts: {
    GLW: number;
    SGCTL: number;
  };
  minerAmount: number;
}

function getLaunchpadSplitAmount(split: SplitActivity) {
  const currency = normalizeDelegationCurrency(split.currency);
  const decimals =
    split.currencyDecimals ?? (currency === "SGCTL" ? 6 : 18);
  return {
    currency,
    amount: parseTokenAmountFromBaseUnits(split.amount, decimals),
  };
}

function formatDelegationAmounts(amounts: WeekCell["delegationAmounts"]) {
  const parts: string[] = [];
  if (amounts.GLW > 0) {
    parts.push(
      `${amounts.GLW.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })} GLW`
    );
  }
  if (amounts.SGCTL > 0) {
    parts.push(
      `${amounts.SGCTL.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })} SGCTL`
    );
  }
  return parts.join(" + ");
}

function groupDelegationsByWeek(splits: SplitActivity[]) {
  const map = new Map<number, WeekCell["delegationAmounts"]>();
  splits
    .filter((split) => split.fractionType === "launchpad")
    .forEach((split) => {
      const { currency, amount } = getLaunchpadSplitAmount(split);
      if (amount <= 0) return;
      const weekNumber = getWeekNumberFromTimestamp(split.timestamp);
      const existing = map.get(weekNumber) ?? { GLW: 0, SGCTL: 0 };
      existing[currency] += amount;
      map.set(weekNumber, existing);
    });
  return map;
}

function groupMinerPurchasesByWeek(splits: SplitActivity[]) {
  const map = new Map<number, number>();
  splits
    .filter((split) => split.fractionType === "mining-center")
    .forEach((split) => {
      const amount = getUsdcFromWei(split.amount);
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
  variant?: "default" | "flow" | "minimal";
}

// V2 streak caps at 20 weeks; show one slot per week up to that cap.
const DISPLAY_WEEKS_CAP = 20;
const GRID_COLUMNS = 5;

function WeeklyActivitySkeleton() {
  return (
    <Card className="overflow-hidden h-full bg-card dark:bg-card border-border/20 pt-6 pb-0">
      <CardHeader className="py-0 px-6">
        <CardTitle className="text-center">Weekly Streak</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 px-6 pb-6">
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="flex flex-col items-center justify-center text-center select-none">
            <Skeleton className="h-12 w-20 rounded-xl" />
            <Skeleton className="mt-2 h-3 w-32 rounded-xl" />
          </div>
          <div className="flex flex-1 min-h-0 items-center justify-center">
            <Skeleton className="h-10 w-48 rounded-xl" />
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
  variant = "default",
}: WeeklyActivityWidgetProps) {
  const weeksCount = DISPLAY_WEEKS_CAP;
  const hasWallet = Boolean(walletAddress);
  const isFlow = variant === "flow";
  const isMinimal = variant === "minimal";
  const { isConnecting, isReconnecting } = useAccount();
  const isWalletConnecting = isConnecting || isReconnecting;

  // V2 streak is the authoritative streak count (seed-aware, derived from
  // the points ledger). The on-chain week cells below are still shown as a
  // visual delegation/miner history.
  const { data: v2Balance } = useV2PointsBalance(walletAddress);

  const impactLeaderboardQuery = useImpactLeaderboardQuery({
    enabled: hasWallet,
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

  const isValidWalletAddress =
    Boolean(walletAddress) && isAddress(walletAddress as string);

  const impactScoreQuery = useQuery({
    queryKey: ["impact-glow-score", walletAddress, "no-weekly"],
    enabled: Boolean(hasWallet && isValidWalletAddress),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
    queryFn: async (): Promise<ImpactGlowScoreResponse> => {
      if (!walletAddress) throw new Error("Missing wallet address");
      const url = new URL("/api/impact/glow-score", window.location.origin);
      url.searchParams.set("walletAddress", walletAddress);
      url.searchParams.set("includeWeekly", "0");
      url.searchParams.set("includeProjection", "1");
      url.searchParams.set("includeReferral", "0");

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      return (await response.json()) as ImpactGlowScoreResponse;
    },
  });

  const rewardsDelegations = React.useMemo(
    () => {
      const fallback = new Map<number, WeekCell["delegationAmounts"]>();
      buildWeeklyDelegations(rewardsData).forEach((amount, week) => {
        fallback.set(week, { GLW: amount, SGCTL: 0 });
      });
      return fallback;
    },
    [rewardsData]
  );

  const splitDelegations = React.useMemo(() => {
    if (!splitsActivity.length) {
      return new Map<number, WeekCell["delegationAmounts"]>();
    }
    return groupDelegationsByWeek(splitsActivity);
  }, [splitsActivity]);

  const minerPurchases = React.useMemo(() => {
    if (!splitsActivity.length) return new Map<number, number>();
    return groupMinerPurchasesByWeek(splitsActivity);
  }, [splitsActivity]);

  const minerWeeks = React.useMemo(() => {
    return new Set(minerPurchases.keys());
  }, [minerPurchases]);

  const weeklyDelegations = React.useMemo(() => {
    return splitDelegations.size > 0 ? splitDelegations : rewardsDelegations;
  }, [rewardsDelegations, splitDelegations]);

  const currentWeek = React.useMemo(() => getCurrentWeekNumber(), []);

  const currentMultiplier = React.useMemo(() => {
    const impactScore = impactScoreQuery.data;

    const projection = impactScore?.currentWeekProjection ?? null;
    if (projection) {
      const hasActedThisWeek = projection.hasImpactActionThisWeek ?? true;

      let hasCashMinerBonus: boolean;
      let streakBonusMultiplier: number;

      if (hasActedThisWeek) {
        hasCashMinerBonus = projection.hasMinerMultiplier;
        streakBonusMultiplier = projection.streakBonusMultiplier ?? 0;
      } else {
        // No action yet this week; use previous week's state because the user
        // still has the rest of the epoch to maintain these multipliers.
        const streakFromPrev = projection.streakAsOfPreviousWeek ?? 0;
        streakBonusMultiplier = streakFromPrev > 0
          ? Math.min(streakFromPrev * 0.25, 1.0)
          : 0;
        hasCashMinerBonus = minerWeeks.has(currentWeek - 1);
      }

      const baseMultiplier = hasCashMinerBonus ? 3 : 1;
      const totalMultiplier = baseMultiplier + streakBonusMultiplier;
      return {
        base: baseMultiplier,
        streakBonus: streakBonusMultiplier,
        total: totalMultiplier,
        hasCashMinerBonus,
        isFromApi: true,
      };
    }

    return null;
  }, [impactScoreQuery.data, minerWeeks, currentWeek]);

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
      const delegationAmounts = weeklyDelegations.get(week) ?? {
        GLW: 0,
        SGCTL: 0,
      };
      const minerAmount = minerPurchases.get(week) ?? 0;
      const hasDelegation =
        delegationAmounts.GLW > 0 || delegationAmounts.SGCTL > 0;
      const hasMinerPurchase = minerAmount > 0;
      const status = getWeekStatus({ hasDelegation, hasMinerPurchase });

      cells.push({
        id: `week-${week}`,
        week,
        status,
        weekStart,
        rangeLabel: formatWeekRange(weekStart),
        delegationAmounts,
        minerAmount,
      });
    }

    return cells;
  }, [hasWallet, minerPurchases, weekRange, weeklyDelegations]);

  const activeWeeks = React.useMemo(
    () => weekCells.filter((w) => w.status !== "missed").length,
    [weekCells]
  );

  const { streakWeeks, isStreakAtRisk } = React.useMemo(() => {
    if (!weekRange) return { streakWeeks: 0, isStreakAtRisk: false };
    if (!weekCells.length) return { streakWeeks: 0, isStreakAtRisk: false };

    const statusByWeek = new Map<number, WeekStatus>();
    weekCells.forEach((cell) => statusByWeek.set(cell.week, cell.status));

    const currentStatus = statusByWeek.get(currentWeek) ?? "missed";
    const currentWeekIsMissed = currentStatus === "missed";
    const endWeekForStreak = currentWeekIsMissed
      ? currentWeek - 1
      : currentWeek;

    let streak = 0;
    for (let week = endWeekForStreak; week >= weekRange.startWeek; week--) {
      const status = statusByWeek.get(week);
      if (!status) break;
      if (status === "missed") break;
      streak++;
    }

    const atRisk = streak > 0 && currentWeekIsMissed;

    return { streakWeeks: streak, isStreakAtRisk: atRisk };
  }, [currentWeek, weekCells, weekRange]);

  // Prefer the V2 streak when available; fall back to the on-chain
  // cell-derived streak otherwise.
  const v2Streak = v2Balance?.currentStreak ?? null;
  const displayStreakWeeks = v2Streak ? v2Streak.streakWeek : streakWeeks;
  const displayAtRisk = v2Streak
    ? displayStreakWeeks > 0 && !v2Streak.qualified
    : isStreakAtRisk;

  const displayMultiplier = React.useMemo(() => {
    if (currentMultiplier) return currentMultiplier;

    if (streakWeeks > 0) {
      const streakBonus = Math.min(streakWeeks * 0.25, 1.0);
      return {
        base: 1,
        streakBonus,
        total: 1 + streakBonus,
        hasCashMinerBonus: false,
        isFromApi: false,
      };
    }

    return null;
  }, [currentMultiplier, streakWeeks]);

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
    <Card
      className={cn(
        "overflow-hidden w-full pt-6 pb-0",
        isMinimal
          ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl h-full"
          : isFlow
          ? "bg-card/30 border-border/20 min-h-[280px]"
          : "h-full bg-card dark:bg-card border-border/20"
      )}
    >
      <CardHeader className="py-0 px-6">
        <CardTitle className="text-center">Weekly Streak</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 px-6 pb-6">
        <div className="flex flex-col flex-1 min-h-0">
          {!hasWallet ? (
            <>
              <div className="flex flex-col items-center justify-center text-center select-none">
                <div className="font-mono text-5xl font-bold tracking-tight text-muted-foreground/40 leading-none">
                  —
                  <span className="ml-2 text-sm font-mono font-semibold text-muted-foreground/40 uppercase tracking-wider align-middle">
                    Wks
                  </span>
                </div>
                <div className="mt-2 font-mono text-xs text-muted-foreground/60">
                  Current Streak
                </div>
              </div>

              <div className="mt-4 flex flex-1 min-h-0 items-center justify-center">
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: DISPLAY_WEEKS_CAP }, (_, i) => i).map(
                    (idx) => (
                      <div
                        key={`empty-${idx}`}
                        className={cn(
                          "relative h-8 w-8 sm:h-9 sm:w-9 rounded-lg",
                          "border-2 border-dashed border-foreground/10 bg-foreground/[0.02]",
                          idx === DISPLAY_WEEKS_CAP - 1 &&
                            "ring-2 ring-foreground/10"
                        )}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-foreground/70 font-mono uppercase tracking-wider">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-miner)]" />
                      <span>Miner</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-delegation-purple" />
                      <span>Delegator</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#4ADE80]" />
                      <span>Both</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary">
                    Connect wallet
                  </div>
                </div>
              </div>
            </>
          ) : isLoading ? (
            <div className="flex flex-col flex-1 min-h-0 gap-4">
              <div className="flex flex-col items-center justify-center text-center select-none">
                <Skeleton className="h-12 w-20 rounded-xl" />
                <Skeleton className="mt-2 h-3 w-32 rounded-xl" />
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
            <>
              <div className="flex flex-col items-center justify-center text-center select-none">
                <div className="font-mono text-5xl font-bold tracking-tight text-foreground leading-none">
                  0
                  <span className="ml-2 text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider align-middle">
                    Wks
                  </span>
                </div>
                <div className="mt-2 font-mono text-xs text-muted-foreground">
                  Current Streak
                </div>
              </div>

              <div className="mt-4 flex flex-1 min-h-0 items-center justify-center">
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: DISPLAY_WEEKS_CAP }, (_, i) => i).map(
                    (idx) => (
                      <div
                        key={`empty-${idx}`}
                        className={cn(
                          "relative h-8 w-8 sm:h-9 sm:w-9 rounded-lg",
                          "border-2 border-dashed border-foreground/10 bg-foreground/[0.02]",
                          idx === DISPLAY_WEEKS_CAP - 1 &&
                            "ring-2 ring-foreground/10"
                        )}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 shrink-0 text-primary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <div className="text-xs text-primary">
                    Delegate GLW or buy a miner to start your streak!
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center text-center select-none">
                <div className="font-mono text-6xl font-semibold tracking-tight text-foreground leading-none">
                  {displayStreakWeeks}
                  <span className="ml-2 text-sm font-mono font-medium text-muted-foreground/50 uppercase tracking-widest align-middle">
                    Wks
                  </span>
                </div>
                <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                  Current Streak
                </div>
              </div>

              <div className="mt-4 flex flex-1 min-h-0 items-center justify-center">
                <TooltipProvider delayDuration={200}>
                  <div className="grid grid-cols-5 gap-1.5">
                    {weekCells.map((cell) => {
                      const isCurrentWeek = cell.week === currentWeek;
                      const isMissed = cell.status === "missed";
                      const isMissedPastWeek = isMissed && !isCurrentWeek;

                      return (
                        <Tooltip key={cell.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "relative h-8 w-8 sm:h-9 sm:w-9 rounded-lg",
                                "outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                "hover:ring-2 hover:ring-foreground/20 hover:ring-offset-2 hover:ring-offset-background",
                                "transition-shadow",
                                isMissed
                                  ? "border-2 border-dashed border-foreground/15 bg-foreground/[0.03]"
                                  : "border border-foreground/10",
                                cell.status === "delegated" &&
                                  "bg-delegation-purple",
                                cell.status === "miner" &&
                                  "bg-[color:var(--color-miner)]",
                                cell.status === "both" && "bg-[#4ADE80]",
                                isCurrentWeek && "ring-2 ring-foreground/20",
                                isCurrentWeek &&
                                  displayAtRisk &&
                                  "ring-2 ring-amber-500/70 border-amber-500/50"
                              )}
                            >
                              {isMissedPastWeek && (
                                <svg
                                  className="absolute inset-0 w-full h-full text-foreground/20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                >
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                </svg>
                              )}
                            </div>
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
                            {cell.status !== "missed" && (
                              <div className="mt-2 space-y-1 pt-2 border-t border-border/50">
                                {(cell.delegationAmounts.GLW > 0 ||
                                  cell.delegationAmounts.SGCTL > 0) && (
                                  <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="text-muted-foreground">
                                      Delegated
                                    </span>
                                    <span className="font-mono font-semibold tabular-nums text-delegation-purple">
                                      {formatDelegationAmounts(
                                        cell.delegationAmounts
                                      )}
                                    </span>
                                  </div>
                                )}
                                {cell.minerAmount > 0 && (
                                  <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="text-muted-foreground">
                                      Miner
                                    </span>
                                    <span className="font-mono font-semibold tabular-nums text-miner">
                                      {cell.minerAmount.toLocaleString(
                                        undefined,
                                        {
                                          minimumFractionDigits: 0,
                                          maximumFractionDigits: 2,
                                        }
                                      )}{" "}
                                      USDC
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>

              {displayAtRisk ? (
                <div className="mt-4 space-y-2">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 shrink-0 text-amber-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          <span className="font-semibold">Streak at risk!</span>{" "}
                          Delegate GLW or buy a miner this week.
                        </div>
                      </div>
                      {displayMultiplier && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 cursor-help shrink-0">
                              <svg
                                className="h-3 w-3 text-primary"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                              </svg>
                              <span className="font-mono font-bold text-[10px] text-primary tabular-nums uppercase tracking-wider">
                                {displayMultiplier.total.toFixed(2)}×
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="center"
                            sideOffset={8}
                            className="rounded-xl border border-foreground/10 dark:border-zinc-800 bg-popover/95 px-3 py-2"
                          >
                            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              Current Multiplier
                            </div>
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-muted-foreground">
                                  Base
                                </span>
                                <span className="font-mono font-semibold tabular-nums">
                                  {displayMultiplier.base}×
                                  {displayMultiplier.hasCashMinerBonus && (
                                    <span className="ml-1 text-[10px] text-[color:var(--color-miner)]">
                                      (Miner)
                                    </span>
                                  )}
                                </span>
                              </div>
                              {displayMultiplier.streakBonus > 0 && (
                                <div className="flex items-center justify-between gap-4 text-xs">
                                  <span className="text-muted-foreground">
                                    Streak
                                  </span>
                                  <span className="font-mono font-semibold tabular-nums text-delegation-purple">
                                    +{displayMultiplier.streakBonus.toFixed(2)}×
                                  </span>
                                </div>
                              )}
                              <div className="pt-1 border-t border-border/50 flex items-center justify-between gap-4 text-xs">
                                <span className="text-muted-foreground font-semibold">
                                  Total
                                </span>
                                <span className="font-mono font-bold tabular-nums text-primary">
                                  {displayMultiplier.total.toFixed(2)}×
                                </span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-foreground/70 font-mono uppercase tracking-wider">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-miner)]" />
                        <span>Miner</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-delegation-purple" />
                        <span>Delegator</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#4ADE80]" />
                        <span>Both</span>
                      </div>
                    </div>
                    {displayMultiplier ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 cursor-help">
                            <svg
                              className="h-3 w-3 text-primary"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            <span className="font-bold text-primary tabular-nums">
                              {displayMultiplier.total.toFixed(2)}×
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="center"
                          sideOffset={8}
                          className="rounded-xl border border-foreground/10 dark:border-zinc-800 bg-popover/95 px-3 py-2"
                        >
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Current Multiplier
                          </div>
                          <div className="mt-1.5 space-y-1">
                            <div className="flex items-center justify-between gap-4 text-xs">
                              <span className="text-muted-foreground">
                                Base
                              </span>
                              <span className="font-mono font-semibold tabular-nums">
                                {displayMultiplier.base}×
                                {displayMultiplier.hasCashMinerBonus && (
                                  <span className="ml-1 text-[10px] text-[color:var(--color-miner)]">
                                    (Miner)
                                  </span>
                                )}
                              </span>
                            </div>
                            {displayMultiplier.streakBonus > 0 && (
                              <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-muted-foreground">
                                  Streak
                                </span>
                                <span className="font-mono font-semibold tabular-nums text-delegation-purple">
                                  +{displayMultiplier.streakBonus.toFixed(2)}×
                                </span>
                              </div>
                            )}
                            <div className="pt-1 border-t border-border/50 flex items-center justify-between gap-4 text-xs">
                              <span className="text-muted-foreground font-semibold">
                                Total
                              </span>
                              <span className="font-mono font-bold tabular-nums text-primary">
                                {displayMultiplier.total.toFixed(2)}×
                              </span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/70">
                        Streak {displayStreakWeeks}/{DISPLAY_WEEKS_CAP}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
