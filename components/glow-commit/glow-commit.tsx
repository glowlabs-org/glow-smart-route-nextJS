"use client";

import React from "react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSplitsActivity, type SplitActivity, useRewardsBreakdown } from "@/hooks";
import {
  buildWeeklyDelegations,
  getCurrentWeekNumber,
  getGlwFromWei,
  getWeekNumberFromTimestamp,
  weekToTimestamp,
} from "@/lib/rewards/weekly-delegations";
import { cn } from "@/lib/utils";

const V2_START_ISO = "2025-10-11T00:00:00Z";
const V2_START_WEEK = getWeekNumberFromTimestamp(
  new Date(V2_START_ISO).getTime()
);

const BASE_PURPLE_RGB = "220,196,255"; // #dcc4ff
const BASE_GREEN_RGB = "204,255,212"; // #ccffd4
const EMPTY_RGB = {
  light: "235,237,240", // GitHub light mode empty color #ebedf0
  dark: "45,51,59", // GitHub dark mode empty color #2d333b
} as const;
const CELL_SIZE = 64; // Significantly bigger

const COLOR_SCALE = [
  { min: 20_000, alpha: 0.95, label: "Whale (20k+)" },
  { min: 5_000, alpha: 0.65, label: "Medium (5k - 19k)" },
  { min: 1, alpha: 0.4, label: "Light (1 - 4k)" },
  { min: 0, alpha: 0, label: "0 GLW" },
] as const;

type WeekVariant = "none" | "delegation" | "miner" | "hybrid";

interface GlowCommitProps {
  walletAddress?: string;
  weeksToDisplay?: number;
}

interface WeekCell {
  week: number;
  amount: number;
  date: Date;
  shade: (typeof COLOR_SCALE)[number];
  variant: WeekVariant;
  rangeLabel: string;
  monthLabel: string;
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

function resolveShade(value: number) {
  const match = COLOR_SCALE.find((stop) => value >= stop.min);
  return match ?? COLOR_SCALE[COLOR_SCALE.length - 1];
}

function formatWeekRange(date: Date) {
  const end = new Date(date);
  end.setDate(date.getDate() + 6);
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}, ${end.getFullYear()}`;
}

function describeActivity(cell: WeekCell) {
  if (cell.variant === "hybrid") {
    return `Delegation + miner • ${cell.amount.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })} GLW`;
  }
  if (cell.variant === "miner") {
    return "Miner purchase only";
  }
  if (cell.variant === "delegation") {
    return `${cell.amount.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })} GLW delegated`;
  }
  return "No activity";
}

export function GlowCommit({ walletAddress, weeksToDisplay }: GlowCommitProps) {
  const { resolvedTheme } = useTheme();
  const themeAwareEmptyRgb =
    resolvedTheme === "dark" ? EMPTY_RGB.dark : EMPTY_RGB.light;
  const hasWallet = Boolean(walletAddress);
  const { data, isLoading, isError } = useRewardsBreakdown({
    walletAddress: walletAddress || null,
    enabled: hasWallet,
  });
  const {
    activity: splitsActivity = [],
    isLoading: splitsLoading,
    isError: splitsError,
  } = useSplitsActivity({
    walletAddress: walletAddress || undefined,
    enabled: hasWallet,
    limit: 200,
  });

  const rewardsDelegations = React.useMemo(
    () => buildWeeklyDelegations(data),
    [data]
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
  }, [splitDelegations, rewardsDelegations]);

  const currentWeek = React.useMemo(() => getCurrentWeekNumber(), []);
  const lastKnownWeek = React.useMemo(() => {
    const latestDataWeek = data?.weekRange?.endWeek ?? 0;
    const latestDelegationWeek = weeklyDelegations.size
      ? Math.max(...Array.from(weeklyDelegations.keys()))
      : 0;
    return Math.max(latestDataWeek, latestDelegationWeek, currentWeek);
  }, [data?.weekRange?.endWeek, weeklyDelegations, currentWeek]);

  const weekCells = React.useMemo<WeekCell[]>(() => {
    if (!hasWallet) return [];
    // Default to ~3 months if not specified to fill the card nicely
    const displayCount = weeksToDisplay || 13;
    const finalWeek = lastKnownWeek;
    // Calculate start based on the display count but never before V2 launch.
    const startWeek = Math.max(V2_START_WEEK, finalWeek - (displayCount - 1));

    const cells: WeekCell[] = [];

    for (let week = startWeek; week <= finalWeek; week++) {
      const amount = weeklyDelegations.get(week) ?? 0;
      const date = new Date(weekToTimestamp(week));
      const hasMinerPurchase = minerWeeks.has(week);
      const variant: WeekVariant =
        amount > 0 && hasMinerPurchase
          ? "hybrid"
          : hasMinerPurchase
          ? "miner"
          : amount > 0
          ? "delegation"
          : "none";

      const monthLabel = date.toLocaleDateString("en-US", { month: "short" });

      cells.push({
        week,
        amount,
        date,
        shade: resolveShade(amount),
        variant,
        rangeLabel: formatWeekRange(date),
        monthLabel,
      });
    }
    return cells;
  }, [hasWallet, weeksToDisplay, lastKnownWeek, weeklyDelegations, minerWeeks]);

  const longestStreak = React.useMemo(() => {
    if (!hasWallet) return 0;
    let currentStreak = 0;
    let maxStreak = 0;
    for (let week = V2_START_WEEK; week <= lastKnownWeek; week++) {
      const amount = weeklyDelegations.get(week) ?? 0;
      const hasMinerActivity = minerWeeks.has(week);
      const hasAnyActivity = amount > 0 || hasMinerActivity;
      if (hasAnyActivity) {
        currentStreak += 1;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    }
    return maxStreak;
  }, [hasWallet, lastKnownWeek, weeklyDelegations, minerWeeks]);

  const handleShareOnX = React.useCallback(() => {
    if (typeof window === "undefined" || !walletAddress) return;

    const shareText =
      longestStreak > 0
        ? `My longest Glow mining streak is ${longestStreak} week${
            longestStreak === 1 ? "" : "s"
          }! 🔥`
        : "Tracking my Glow mining streak!";
    const fullText = `${shareText} #GlowCommit @glowFND`;

    const shareUrl = `https://app.glow.org/share/streak/${walletAddress}`;
    const encodedText = encodeURIComponent(fullText);
    const encodedUrl = encodeURIComponent(shareUrl);
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
  }, [longestStreak, walletAddress]);

  // Group cells by month strictly for the row-based layout
  const monthGroups = React.useMemo(() => {
    const groups: { label: string; cells: WeekCell[] }[] = [];
    if (weekCells.length === 0) return groups;

    let currentLabel = weekCells[0].monthLabel;
    let currentCells: WeekCell[] = [];

    weekCells.forEach((cell) => {
      if (cell.monthLabel !== currentLabel) {
        groups.push({ label: currentLabel, cells: currentCells });
        currentLabel = cell.monthLabel;
        currentCells = [];
      }
      currentCells.push(cell);
    });
    // Push the last group
    if (currentCells.length > 0) {
      groups.push({ label: currentLabel, cells: currentCells });
    }
    return groups;
  }, [weekCells]);

  const legend = React.useMemo(
    () => ({
      delegationGradient: `linear-gradient(90deg, rgba(${BASE_PURPLE_RGB}, 0.3) 0%, rgba(${BASE_PURPLE_RGB}, 0.6) 50%, rgba(${BASE_PURPLE_RGB}, 0.95) 100%)`,
      miner: { backgroundColor: `rgba(${BASE_GREEN_RGB}, 0.85)` },
      hybrid: {
        backgroundImage: "linear-gradient(135deg,  #ccffd4 45%, #dcc4ff 100%)",
        backgroundSize: "100% 100%",
        animation: "glow-gradient 8s ease-in-out infinite",
        boxShadow: "0 0 12px rgba(147, 197, 253, 0.35)",
      },
      none: { backgroundColor: `rgb(${themeAwareEmptyRgb})` },
      delegation: { backgroundColor: `rgba(${BASE_PURPLE_RGB}, 1)` },
    }),
    [themeAwareEmptyRgb]
  );

  function getCellVisuals(cell: WeekCell) {
    if (cell.variant === "delegation") {
      return {
        style: {
          backgroundColor: `rgba(${BASE_PURPLE_RGB}, ${cell.shade.alpha})`,
          boxShadow:
            cell.shade.alpha > 0.8 ? "0 0 10px rgba(220,196,255,0.35)" : "",
        },
        className: "",
      };
    }
    if (cell.variant === "miner") {
      return {
        style: { backgroundColor: `rgba(${BASE_GREEN_RGB}, 0.85)` },
        className: "",
      };
    }
    if (cell.variant === "hybrid") {
      return {
        style: {
          backgroundImage:
            "linear-gradient(135deg,  #ccffd4 45%, #dcc4ff 100%)",
          backgroundSize: "100% 100%",
          animation: "glow-gradient 8s ease-in-out infinite",
          boxShadow: "0 0 18px rgba(147, 197, 253, 0.35)",
        },
        className: "",
      };
    }
    return {
      style: { backgroundColor: `rgb(${themeAwareEmptyRgb})` },
      className: "",
    };
  }

  return (
    // Fixed width container to prevent stretching and keep it compact
    <Card className="w-[520px] max-w-full">
      <div className="py-4 rounded-xl">
        <CardHeader className="items-center space-y-4 text-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-6xl font-black leading-none tracking-tight text-foreground">
              {longestStreak}
            </span>
            <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground font-semibold">
              longest mining streak
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!hasWallet ? (
            <p className="text-sm text-muted-foreground">
              Connect a wallet to start tracking weekly commitments.
            </p>
          ) : isLoading || splitsLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : isError || splitsError ? (
            <p className="text-sm text-destructive">
              Unable to load delegation history. Please try again shortly.
            </p>
          ) : weekCells.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No delegations recorded yet. Your first week will appear once you
              delegate GLW.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg bg-muted/30 p-6">
                <div className="flex flex-col gap-3">
                  {monthGroups.map((group, groupIdx) => (
                    <div
                      key={group.label + groupIdx}
                      className="flex items-start"
                    >
                      {/* Left Column: Month Label */}
                      <div className="w-12 shrink-0 pt-[10px] text-xs font-bold uppercase text-muted-foreground">
                        {group.label}
                      </div>

                      {/* Right Column: Week Cells */}
                      <div className="flex flex-wrap gap-[6px]">
                        {group.cells.map((cell) => {
                          const { style, className } = getCellVisuals(cell);
                          const tooltipTitle = cell.rangeLabel;
                          const tooltipBody = describeActivity(cell);

                          return (
                            <div
                              key={`week-${cell.week}`}
                              className="group relative"
                            >
                              <div
                                className={cn(
                                  "relative rounded-[4px] border border-border/50 transition duration-150 ease-out",
                                  "hover:scale-105 hover:brightness-110 hover:shadow-md",
                                  className
                                )}
                                style={{
                                  ...style,
                                  width: CELL_SIZE,
                                  height: CELL_SIZE,
                                }}
                              >
                                <span className="sr-only">
                                  {tooltipTitle} • {tooltipBody}
                                </span>
                              </div>

                              <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 min-w-[180px] -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity duration-100 group-hover:opacity-100">
                                <div className="font-semibold text-foreground">
                                  {tooltipTitle}
                                </div>
                                <div className="text-muted-foreground">
                                  {tooltipBody}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-4 w-4 rounded-[4px] border border-border/50"
                      style={legend.delegation}
                    />
                    <span>Delegation only</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-4 w-4 rounded-[4px] border border-border/50"
                      style={legend.miner}
                    />
                    <span>Miner only</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-4 w-4 rounded-[4px] border border-border/50"
                      style={legend.hybrid}
                    />
                    <span>Delegation + miner</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-4 w-4 rounded-[4px] border border-border/50"
                      style={legend.none}
                    />
                    <span>No activity</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </div>
      {hasWallet && weekCells.length > 0 && (
        <div className="px-6 pb-6">
          <Button
            variant="outline"
            className="w-full justify-center gap-2 text-sm font-semibold"
            onClick={handleShareOnX}
          >
            Share on X
          </Button>
        </div>
      )}
    </Card>
  );
}
