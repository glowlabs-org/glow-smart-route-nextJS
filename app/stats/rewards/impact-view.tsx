"use client";

import React from "react";
import Link from "next/link";
import { parseAsInteger, parseAsString } from "nuqs";
import { useQueryState } from "nuqs";
import { Copy, Crown, Info, ArrowDown, ArrowUp, Search, X } from "lucide-react";
import {
  CashMinerIcon,
  SteeringIcon,
  VaultIcon,
} from "@/components/impact-icons";
import { useAccount } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  AnimatedCountdownDhms,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ImpactScoreBreakdownDialog } from "@/components/dialogs/impact-score-breakdown-dialog";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { MintAndStakeGctlDialog } from "@/components/dialogs/mint-and-stake-gctl-dialog";
import { ConnectButton } from "@/components/connect-button";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { useEnsNames } from "@/hooks/useEnsNames";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import {
  useImpactLeaderboardQuery,
  useImpactScoreQuery,
  type ImpactGlowScoreLeaderboardRow,
} from "@/hooks";
import { formatNumber } from "@/utils/format";
import { copyTextToClipboard } from "@/utils/clipboard";
import {
  formatGlwFromWei,
  formatImpactPoints,
  formatTopPercentile,
  safeNumber,
  shortAddress,
} from "@/utils/impact";
import {
  ImpactMultipliersIcons,
  ImpactPointSourcesIcons,
  type ImpactIndicatorsState,
} from "@/components/impact-score/impact-indicators";

function safeBigIntFromString(value?: string) {
  if (!value) return BigInt(0);
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

function getIndicatorsStateFromRow(
  row: Pick<
    ImpactGlowScoreLeaderboardRow,
    | "hasMinerMultiplier"
    | "hasSteeringStake"
    | "hasVaultBonus"
    | "endWeekMultiplier"
    | "glowWorthWei"
    | "composition"
  >,
): ImpactIndicatorsState {
  const hasMinerMultiplier = Boolean(row.hasMinerMultiplier);
  const baseMultiplier = hasMinerMultiplier ? 3 : 1;
  const endWeekMultiplier = Number(row.endWeekMultiplier ?? 1);
  const streakBonusMultiplier = Math.max(0, endWeekMultiplier - baseMultiplier);
  const hasImpactStreak = streakBonusMultiplier > 0;

  return {
    hasMinerMultiplier,
    hasImpactStreak,
    streakBonusMultiplier,
    hasSteeringStake: Boolean(row.hasSteeringStake),
    hasEmissionsEarned: safeNumber(row.composition?.inflationPoints) > 0,
    hasVaultBonus: Boolean(row.hasVaultBonus),
    hasGlwWorth: safeBigIntFromString(row.glowWorthWei) > 0n,
  };
}

function getIndicatorsStateFromProjection(
  projection: {
    hasMinerMultiplier: boolean;
    hasSteeringStake: boolean;
    impactStreakWeeks?: number;
    streakBonusMultiplier?: number;
    projectedPoints: {
      delegatedGlwWei: string;
      glowWorthWei: string;
      inflationGlwWei: string;
    };
  } | null,
): ImpactIndicatorsState {
  if (!projection) {
    return {
      hasMinerMultiplier: false,
      hasImpactStreak: false,
      streakBonusMultiplier: 0,
      hasSteeringStake: false,
      hasEmissionsEarned: false,
      hasVaultBonus: false,
      hasGlwWorth: false,
    };
  }

  const hasMinerMultiplier = Boolean(projection.hasMinerMultiplier);
  const streakBonusMultiplier = projection.streakBonusMultiplier ?? 0;
  const hasImpactStreak =
    (projection.impactStreakWeeks ?? 0) > 0 && streakBonusMultiplier > 0;

  const hasDelegations = (() => {
    try {
      return BigInt(projection.projectedPoints.delegatedGlwWei) > BigInt(0);
    } catch {
      return false;
    }
  })();

  const hasInflationEarnings = (() => {
    try {
      return BigInt(projection.projectedPoints.inflationGlwWei) > BigInt(0);
    } catch {
      return false;
    }
  })();

  return {
    hasMinerMultiplier,
    hasImpactStreak,
    streakBonusMultiplier,
    hasSteeringStake: Boolean(projection.hasSteeringStake),
    hasEmissionsEarned: hasInflationEarnings,
    hasVaultBonus: hasDelegations,
    hasGlwWorth:
      safeBigIntFromString(projection.projectedPoints.glowWorthWei) > 0n,
  };
}

function SortIcon(props: { dir: "asc" | "desc" }) {
  const { dir } = props;
  return dir === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5" />
  );
}

function ConnectWalletRankingEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-background dark:bg-muted/30 p-6 md:p-8">
      <div className="flex flex-col items-center justify-center text-center gap-4">
        {/* Decorative placeholder metrics */}
        <div className="flex items-center gap-6 opacity-40">
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Points
            </div>
            <div className="font-mono text-2xl font-semibold text-muted-foreground/60 tabular-nums">
              —
            </div>
          </div>
          <div className="h-8 w-px bg-border/60" />
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Rank
            </div>
            <div className="font-mono text-2xl font-semibold text-muted-foreground/60 tabular-nums">
              —
            </div>
          </div>
          <div className="h-8 w-px bg-border/60" />
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Percentile
            </div>
            <div className="font-mono text-2xl font-semibold text-muted-foreground/60 tabular-nums">
              —
            </div>
          </div>
        </div>

        {/* CTA section */}
        <div className="mt-2 space-y-3">
          <div className="text-sm font-semibold text-foreground">
            Connect to see your ranking
          </div>
          <div className="text-xs text-muted-foreground max-w-[20rem]">
            View your impact score, track your progress, and compete on the
            leaderboard.
          </div>
          <ConnectButton
            variant="default"
            size="medium"
            className="w-full max-w-xs mt-2"
          />
        </div>
      </div>
    </div>
  );
}

function getNextCacheUpdateAtMs() {
  try {
    const now = new Date();
    const nowUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
    );

    // Find next Sunday at 01:00 UTC
    const currentDayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentHour = now.getUTCHours();

    // If it's Sunday before 01:00, next update is today at 01:00
    if (currentDayOfWeek === 0 && currentHour < 1) {
      return Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        1,
        0,
        0,
      );
    }

    // Otherwise, find next Sunday
    const daysUntilNextSunday =
      currentDayOfWeek === 0 ? 7 : 7 - currentDayOfWeek;
    const nextSundayDate = new Date(now);
    nextSundayDate.setUTCDate(now.getUTCDate() + daysUntilNextSunday);

    return Date.UTC(
      nextSundayDate.getUTCFullYear(),
      nextSundayDate.getUTCMonth(),
      nextSundayDate.getUTCDate(),
      1,
      0,
      0,
    );
  } catch {
    return Date.now() + 7 * 24 * 60 * 60 * 1000;
  }
}

function ImpactHeroSkeleton(props: { remainingMsToCacheUpdate: number }) {
  const { remainingMsToCacheUpdate } = props;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40 rounded-md" />
          <Skeleton className="h-7 w-72 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Skeleton className="h-9 w-28 rounded-full" />
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 dark:bg-muted/20 px-3 py-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Next update
            </div>
            <AnimatedCountdownDhms
              remainingMs={remainingMsToCacheUpdate}
              size="sm"
              showLabels
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/20 dark:border-border/40 bg-transparent dark:bg-muted/30 py-0">
          <CardContent className="px-6 py-6 space-y-5">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 text-sm font-semibold">
                  Current ranking
                </div>
                <Skeleton className="h-12 w-44 rounded-xl" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
              <div className="flex flex-col items-end gap-3">
                <Skeleton className="h-10 w-28 rounded-full" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">Progress</div>
              <div className="relative h-14 rounded-xl border border-border/40 bg-background dark:bg-muted/20 overflow-hidden">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.06)_0,rgba(0,0,0,0.06)_10px,transparent_10px,transparent_20px)] dark:bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_10px,transparent_10px,transparent_20px)]" />
                <div className="absolute top-1/2 -translate-y-1/2 right-4">
                  <Skeleton className="h-7 w-14 rounded-lg" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-64 rounded-md" />
                <Skeleton className="h-9 w-28 rounded-2xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/20 dark:border-border/40 bg-transparent dark:bg-muted/30 py-0">
          <CardContent className="px-6 py-6 space-y-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <Info className="h-4 w-4" />
              Active multipliers & bonuses
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/60 bg-background dark:bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-56 rounded-md" />
                  <Skeleton className="h-3 w-72 rounded-md" />
                </div>
                <Skeleton className="h-9 w-full rounded-2xl sm:w-28" />
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/60 bg-background dark:bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-56 rounded-md" />
                  <Skeleton className="h-3 w-72 rounded-md" />
                </div>
                <Skeleton className="h-9 w-full rounded-2xl sm:w-28" />
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-border/60 bg-background dark:bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-44 rounded-md" />
                <Skeleton className="h-5 w-28 rounded-md" />
              </div>
              <Skeleton className="h-3 w-80 rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ImpactHero(props: {
  weekRange: { startWeek: number; endWeek: number } | null;
  totalWalletCount: number;
  globalRankByWallet: Map<string, number>;
  rows: ImpactGlowScoreLeaderboardRow[];
  onOpenBreakdown: (walletAddress: string) => void;
  remainingMsToCacheUpdate: number;
  isLeaderboardLoading: boolean;
  isRefreshing: boolean;
  address: `0x${string}` | undefined;
  selfScoreQuery: ReturnType<typeof useImpactScoreQuery>;
}) {
  const {
    weekRange,
    totalWalletCount,
    globalRankByWallet,
    rows,
    onOpenBreakdown,
    remainingMsToCacheUpdate,
    isLeaderboardLoading,
    isRefreshing,
    address,
    selfScoreQuery,
  } = props;

  const normalizedAddress = address?.toLowerCase() ?? "";

  const selfLeaderboardRow = React.useMemo(() => {
    if (!normalizedAddress) return null;
    return rows.find(
      (r) => r.walletAddress?.toLowerCase() === normalizedAddress,
    );
  }, [rows, normalizedAddress]);

  const { usdcBalance, usdgBalance } = useWalletTokenBalances(address);
  const { spotPrice: glowSpotPrice } = useGlowSpotPrice();

  const [isLaunchpadOpen, setIsLaunchpadOpen] = React.useState(false);
  const [isMintAndStakeOpen, setIsMintAndStakeOpen] = React.useState(false);
  const [isBuyGlowOpen, setIsBuyGlowOpen] = React.useState(false);

  const isSelfLoading =
    Boolean(address) && (selfScoreQuery.isLoading || selfScoreQuery.isFetching);

  // Prioritize current week data from selfScoreQuery over cached leaderboard data
  const selfPoints = selfScoreQuery.data?.totals?.totalPoints
    ? safeNumber(selfScoreQuery.data.totals.totalPoints)
    : selfLeaderboardRow
      ? safeNumber(selfLeaderboardRow.totalPoints)
      : 0;
  const isZeroScore =
    Boolean(address) &&
    !isSelfLoading &&
    !selfScoreQuery.isError &&
    (!Number.isFinite(selfPoints) || selfPoints <= 0);

  // Calculate estimated current rank based on current points vs cached leaderboard
  const estimatedCurrentRank = React.useMemo(() => {
    if (!normalizedAddress || !selfPoints || selfPoints <= 0) return null;

    // Find how many people in cached leaderboard have MORE points than current score
    const ranksAhead = rows.filter(
      (row: ImpactGlowScoreLeaderboardRow) =>
        safeNumber(row.totalPoints) > selfPoints,
    ).length;

    return ranksAhead + 1;
  }, [normalizedAddress, selfPoints, rows]);

  const selfGlobalRank = normalizedAddress
    ? (globalRankByWallet.get(normalizedAddress) ?? null)
    : null;

  // Use estimated rank if current points suggest a better position
  const displayRank =
    estimatedCurrentRank &&
    selfGlobalRank &&
    estimatedCurrentRank < selfGlobalRank
      ? estimatedCurrentRank
      : selfGlobalRank;

  const selfPercentile =
    displayRank && totalWalletCount > 0
      ? (displayRank / totalWalletCount) * 100
      : NaN;
  const listThresholdPercentile =
    totalWalletCount > 0
      ? (Math.min(rows.length, totalWalletCount) / totalWalletCount) * 100
      : NaN;

  // Find the next rank with MORE points than current score (since current score is live, not cached)
  const targetRank = React.useMemo(() => {
    if (!selfPoints || selfPoints <= 0) {
      return selfGlobalRank
        ? Math.max(1, selfGlobalRank - 1)
        : Math.min(200, rows.length);
    }

    // Use estimated rank to find target (one rank better)
    if (estimatedCurrentRank && estimatedCurrentRank > 1) {
      return estimatedCurrentRank - 1;
    }

    // Fallback: use cached global rank
    if (selfGlobalRank && selfGlobalRank > 1) {
      return selfGlobalRank - 1;
    }

    // Already at or near rank 1
    return 1;
  }, [selfPoints, estimatedCurrentRank, selfGlobalRank]);

  // Find the target row from the cached leaderboard
  const targetRow = React.useMemo(() => {
    // Try to find by rank (targetRank - 1 because array is 0-indexed)
    if (targetRank > 0 && targetRank <= rows.length) {
      return rows[targetRank - 1] ?? null;
    }

    // If target rank is outside cached rows, find first row with more points
    const higherRankRow = rows.find(
      (row) => safeNumber(row.totalPoints) > selfPoints,
    );

    return higherRankRow ?? null;
  }, [rows, targetRank, selfPoints]);

  const targetPoints = safeNumber(targetRow?.totalPoints);
  const pointsToTarget =
    targetPoints > selfPoints ? targetPoints - selfPoints : null;
  const progressToTarget =
    targetPoints > 0 && targetPoints > selfPoints
      ? Math.min(selfPoints / targetPoints, 1)
      : targetPoints > 0 && selfPoints >= targetPoints
        ? 1
        : 0;
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(progressToTarget * 100)),
  );
  const progressBadgeLeft = Math.min(98, Math.max(12, progressPercent));

  const projection = selfScoreQuery.data?.currentWeekProjection ?? null;
  const hasMinerMultiplier = Boolean(projection?.hasMinerMultiplier);
  const hasSteeringStake = Boolean(projection?.hasSteeringStake);
  const impactStreakWeeks = projection?.impactStreakWeeks ?? 0;
  const streakBonusMultiplier = projection?.streakBonusMultiplier ?? 0;
  const baseMultiplier =
    projection?.baseMultiplier ?? (hasMinerMultiplier ? 3 : 1);
  const totalMultiplier =
    projection?.totalMultiplier ?? baseMultiplier + streakBonusMultiplier;
  const hasStreakBonus = impactStreakWeeks > 0 && streakBonusMultiplier > 0;
  const projectedDelegatedGlwWei = projection?.projectedPoints?.delegatedGlwWei;
  const hasDelegations = (() => {
    if (!projectedDelegatedGlwWei) return false;
    try {
      return BigInt(projectedDelegatedGlwWei) > BigInt(0);
    } catch {
      return false;
    }
  })();

  if (isLeaderboardLoading)
    return (
      <ImpactHeroSkeleton remainingMsToCacheUpdate={remainingMsToCacheUpdate} />
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
            Glow Impact Leaderboard
          </h2>
          {weekRange ? (
            <div className="text-sm text-muted-foreground font-mono">
              Weeks {weekRange.startWeek}–{weekRange.endWeek}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isRefreshing ? (
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground animate-pulse">
              Updating…
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-border/30 dark:border-border/50 bg-muted/50 dark:bg-muted/60 px-3 py-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Next update
              </span>
              <AnimatedCountdownDhms
                remainingMs={remainingMsToCacheUpdate}
                size="xs"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/20 dark:border-border/40 bg-transparent dark:bg-muted/30 py-0">
          <CardContent className="px-6 py-6 space-y-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-sm font-semibold">
                Current ranking
              </div>

              {!address ? (
                <ConnectWalletRankingEmptyState />
              ) : isSelfLoading ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-background dark:bg-muted/30 p-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-16 rounded-md" />
                      <Skeleton className="h-10 w-36 rounded-xl" />
                      <Skeleton className="h-3 w-24 rounded-md" />
                    </div>
                    <div className="space-y-2 sm:text-right">
                      <Skeleton className="h-3 w-16 rounded-md sm:ml-auto" />
                      <Skeleton className="h-10 w-32 rounded-xl sm:ml-auto" />
                      <Skeleton className="h-3 w-20 rounded-md sm:ml-auto" />
                    </div>
                  </div>
                </div>
              ) : selfScoreQuery.isError ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-background dark:bg-muted/30 p-6 text-center">
                  <div className="text-sm text-muted-foreground">
                    Unable to load your score.
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/40 bg-background dark:bg-muted/30 p-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        Points
                      </div>
                      <div className="font-mono text-3xl md:text-4xl font-semibold tracking-tight tabular-nums">
                        {formatNumber(selfPoints, { maximumFractionDigits: 2 })}{" "}
                        <span className="text-sm text-muted-foreground font-normal">
                          pts
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {shortAddress(address)}
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1 sm:text-right">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        Ranking
                      </div>
                      <div className="font-mono text-2xl md:text-3xl font-semibold tracking-tight tabular-nums">
                        {displayRank ? (
                          <>#{displayRank.toLocaleString("en-US")}</>
                        ) : (
                          <>
                            Below Top{" "}
                            {formatTopPercentile(listThresholdPercentile)}
                          </>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {displayRank ? (
                          <>
                            Top {formatTopPercentile(selfPercentile)}
                            {estimatedCurrentRank &&
                            selfGlobalRank &&
                            estimatedCurrentRank < selfGlobalRank ? (
                              <span className="ml-1 text-[color:var(--color-glow-green)]">
                                ↑
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <>Rank not available outside current list</>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isZeroScore ? (
              <div className="rounded-2xl border border-border/40 bg-background dark:bg-muted/30 p-6 md:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                      Fastest boost
                    </div>
                    <div className="text-lg font-semibold tracking-tight">
                      Buy GLW to immediately start earning points
                    </div>
                    <div className="text-sm text-muted-foreground max-w-[42rem]">
                      Buying GLW increases GlowWorth, which adds continuous
                      worth points to your score.
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <Button
                      type="button"
                      size="lg"
                      className="w-full sm:w-auto font-mono"
                      onClick={() => setIsBuyGlowOpen(true)}
                    >
                      Buy GLW
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {address &&
            !isSelfLoading &&
            !selfScoreQuery.isError &&
            !isZeroScore ? (
              <div className="space-y-3">
                {targetRank > 0 && targetRow && targetPoints > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Progress</div>
                    <div className="relative h-14 rounded-xl border border-border/40 bg-background dark:bg-muted/20 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-[#4ADE80]"
                        style={{ width: `${progressPercent}%` }}
                      />
                      <div
                        className="absolute inset-y-0 right-0"
                        style={{ left: `${progressPercent}%` }}
                      >
                        <div className="h-full w-full bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.06)_0,rgba(0,0,0,0.06)_10px,transparent_10px,transparent_20px)] dark:bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_10px,transparent_10px,transparent_20px)]" />
                      </div>
                      <div
                        className="absolute top-1/2 -translate-y-1/2"
                        style={{ left: `${progressBadgeLeft}%` }}
                      >
                        <div className="translate-x-[-100%] rounded-lg border border-[#4ADE80]/40 bg-background/70 px-2.5 py-1 text-xs font-mono tabular-nums text-foreground backdrop-blur-sm">
                          {progressPercent}%
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground font-mono">
                        {pointsToTarget && pointsToTarget > 0 ? (
                          <>
                            {new Intl.NumberFormat("en-US", {
                              maximumFractionDigits: 0,
                            }).format(pointsToTarget)}{" "}
                            pts to reach Rank #
                            {targetRank.toLocaleString("en-US")}
                          </>
                        ) : targetRank === 1 ? (
                          <>You're on track for Rank #1! 🏆</>
                        ) : (
                          <>On track for higher rank</>
                        )}
                      </div>
                      {weekRange ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-2xl px-4"
                          onClick={() => onOpenBreakdown(address)}
                        >
                          See details
                        </Button>
                      ) : null}
                    </div>
                    {estimatedCurrentRank &&
                    selfGlobalRank &&
                    estimatedCurrentRank < selfGlobalRank ? (
                      <div className="text-xs text-muted-foreground font-mono">
                        <span className="text-[color:var(--color-glow-green)]">
                          ↑ Climbing
                        </span>{" "}
                        · Official rank updates weekly on Sunday at 01:00 UTC
                      </div>
                    ) : null}
                  </div>
                ) : weekRange ? (
                  <div className="flex items-center justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-2xl px-4"
                      onClick={() => onOpenBreakdown(address)}
                    >
                      See details
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {address && isSelfLoading ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Progress</div>
                  <div className="relative h-14 rounded-xl border border-border/40 bg-background dark:bg-muted/20 overflow-hidden">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.06)_0,rgba(0,0,0,0.06)_10px,transparent_10px,transparent_20px)] dark:bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_10px,transparent_10px,transparent_20px)]" />
                    <div className="absolute top-1/2 -translate-y-1/2 right-4">
                      <Skeleton className="h-7 w-14 rounded-lg" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-64 rounded-md" />
                    <Skeleton className="h-9 w-28 rounded-2xl" />
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/20 dark:border-border/40 bg-transparent dark:bg-muted/30 py-0">
          <CardContent className="px-6 py-6 space-y-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <Info className="h-4 w-4" />
              Active multipliers & bonuses
            </div>

            <div className="space-y-2">
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between transition-colors",
                  hasMinerMultiplier
                    ? "border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/10"
                    : "border-dashed border-border/60 bg-background dark:bg-muted/30",
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CashMinerIcon
                      className={cn(
                        "h-6 w-6",
                        hasMinerMultiplier
                          ? "text-[color:var(--color-miner)]"
                          : "text-muted-foreground",
                      )}
                    />
                    <div className="text-sm font-semibold">
                      3× Cash Miner Multiplier
                    </div>
                    {isSelfLoading ? (
                      <Skeleton className="h-5 w-20 rounded-full ml-2" />
                    ) : (
                      <span
                        className={cn(
                          "ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                          hasMinerMultiplier
                            ? "border-[color:var(--color-miner)]/35 bg-[color:var(--color-miner)]/15 text-foreground"
                            : "border-border/60 bg-muted/50 dark:bg-muted/60 text-muted-foreground",
                        )}
                      >
                        {hasMinerMultiplier ? "ACTIVE" : "INACTIVE"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    If active, rollover points are tripled for this week.
                  </div>
                </div>
                <Button
                  variant={hasMinerMultiplier ? "outline" : "default"}
                  className="h-9 w-full rounded-2xl px-4 sm:w-auto shrink-0"
                  type="button"
                  onClick={() => setIsLaunchpadOpen(true)}
                >
                  Buy Miner
                </Button>
              </div>

              <div
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between transition-colors",
                  hasSteeringStake
                    ? "border-[#22D3EE]/30 bg-[#22D3EE]/10"
                    : "border-dashed border-border/60 bg-background dark:bg-muted/30",
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <SteeringIcon
                      className={cn(
                        "h-6 w-6",
                        hasSteeringStake
                          ? "text-[#22D3EE]"
                          : "text-muted-foreground",
                      )}
                    />
                    <div className="text-sm font-semibold">
                      Steering Power (sGCTL)
                    </div>
                    {isSelfLoading ? (
                      <Skeleton className="h-5 w-20 rounded-full ml-2" />
                    ) : (
                      <span
                        className={cn(
                          "ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                          hasSteeringStake
                            ? "border-[#22D3EE]/30 bg-[#22D3EE]/10 text-foreground"
                            : "border-border/60 bg-muted/50 dark:bg-muted/60 text-muted-foreground",
                        )}
                      >
                        {hasSteeringStake ? "ACTIVE" : "INACTIVE"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Earn 3× points per GLW steered with staked GCTL.
                  </div>
                </div>
                <Button
                  variant={hasSteeringStake ? "outline" : "default"}
                  className="h-9 w-full rounded-2xl px-4 sm:w-auto shrink-0"
                  type="button"
                  onClick={() => setIsMintAndStakeOpen(true)}
                >
                  Stake GCTL
                </Button>
              </div>
            </div>

            <div
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between transition-colors",
                hasDelegations
                  ? "border-delegation-purple/30 bg-delegation-purple/10"
                  : "border-dashed border-border/60 bg-background dark:bg-muted/30",
              )}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <VaultIcon
                    className={cn(
                      "h-6 w-6",
                      hasDelegations
                        ? "text-delegation-purple"
                        : "text-muted-foreground",
                    )}
                  />
                  <div className="text-sm font-semibold">
                    Delegate GLW (Emissions + vault bonus)
                  </div>
                  {isSelfLoading ? (
                    <Skeleton className="h-5 w-20 rounded-full ml-2" />
                  ) : (
                    <span
                      className={cn(
                        "ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                        hasDelegations
                          ? "border-delegation-purple/30 bg-delegation-purple/10 text-foreground"
                          : "border-border/60 bg-muted/50 dark:bg-muted/60 text-muted-foreground",
                      )}
                    >
                      {hasDelegations ? "ACTIVE" : "INACTIVE"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Delegate GLW to start earning Emissions and vault bonus
                  points.
                </div>
              </div>

              {isSelfLoading ? (
                <Skeleton className="h-9 w-full rounded-2xl sm:w-28" />
              ) : (
                <Button
                  variant={address && hasDelegations ? "outline" : "default"}
                  className="h-9 w-full rounded-2xl px-4 sm:w-auto shrink-0"
                  type="button"
                  onClick={() => setIsLaunchpadOpen(true)}
                >
                  Delegate GLW
                </Button>
              )}
            </div>

            {/* Example CTA removed per request */}
          </CardContent>
        </Card>
      </div>

      <LaunchpadDialog
        key={isLaunchpadOpen ? "launchpad-open" : "launchpad-closed"}
        open={isLaunchpadOpen}
        onOpenChange={setIsLaunchpadOpen}
      />

      <MintAndStakeGctlDialog
        key={
          isMintAndStakeOpen ? "mint-and-stake-open" : "mint-and-stake-closed"
        }
        open={isMintAndStakeOpen}
        onOpenChange={setIsMintAndStakeOpen}
        usdcBalance={usdcBalance}
        usdgBalance={usdgBalance}
      />

      <BuyGlowDialog
        key={isBuyGlowOpen ? "buy-glow-open" : "buy-glow-closed"}
        open={isBuyGlowOpen}
        onOpenChange={setIsBuyGlowOpen}
        usdcBalance={usdcBalance}
        glowSpotPrice={glowSpotPrice || 0}
        source="impact_view"
        defaultUsdcAmount="20"
      />
    </div>
  );
}

export function ImpactView() {
  const { address } = useAccount();
  const normalizedAddress = address?.toLowerCase() ?? "";

  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsString.withDefault("totalPoints"),
  );
  const [dir, setDir] = useQueryState("dir", parseAsString.withDefault("desc"));

  const sortKey = (() => {
    if (sort === "lastWeekPoints") return "lastWeekPoints" as const;
    if (sort === "glowWorth") return "glowWorth" as const;
    return "totalPoints" as const;
  })();
  const sortDir = dir === "asc" ? ("asc" as const) : ("desc" as const);

  const leaderboardQuery = useImpactLeaderboardQuery({
    limit: 1000,
    sort: sortKey,
    dir: sortDir,
  });

  const weekRange = leaderboardQuery.data?.weekRange ?? null;
  const currentWeek = React.useMemo(() => getCurrentEpoch(), []);

  // Fetch current week data for live score (not cached)
  const selfScoreQuery = useImpactScoreQuery({
    walletAddress: address ?? null,
    weekRange: weekRange
      ? { startWeek: weekRange.startWeek, endWeek: currentWeek }
      : null,
    enabled: Boolean(address && weekRange),
    toastTitle: "Failed to load your Impact Score",
  });

  const selfProjection = selfScoreQuery.data?.currentWeekProjection ?? null;

  const isLeaderboardRefreshing =
    leaderboardQuery.isFetching && !leaderboardQuery.isLoading;

  const allRows = React.useMemo(() => {
    const rawWallets = leaderboardQuery.data?.wallets ?? [];
    return rawWallets.filter(
      (row): row is ImpactGlowScoreLeaderboardRow =>
        "walletAddress" in row && !("isSystemRow" in row),
    );
  }, [leaderboardQuery.data?.wallets]);

  const totalWalletCount =
    leaderboardQuery.data?.totalWalletCount ?? allRows.length;
  const totalWalletCountDisplay =
    leaderboardQuery.data?.totalWalletCount ?? null;
  const searchLower = search.trim().toLowerCase();

  const allWalletAddresses = React.useMemo(
    () => allRows.map((row) => row.walletAddress),
    [allRows],
  );

  const { ensNames: allEnsNames } = useEnsNames({
    addresses: allWalletAddresses.slice(),
    enabled: allWalletAddresses.length > 0,
  });

  const globalRankByWallet = React.useMemo(() => {
    const map = new Map<string, number>();
    allRows.forEach((row, idx) => {
      map.set(row.walletAddress.toLowerCase(), row.globalRank ?? idx + 1);
    });
    return map;
  }, [allRows]);

  const filteredRows = React.useMemo(() => {
    if (!searchLower) return allRows;
    return allRows.filter((row) => {
      const address = row.walletAddress.toLowerCase();
      const ensName = allEnsNames[row.walletAddress]?.toLowerCase() || "";
      return address.includes(searchLower) || ensName.includes(searchLower);
    });
  }, [allRows, allEnsNames, searchLower]);

  const handleSortClick = React.useCallback(
    (nextSort: "lastWeekPoints" | "totalPoints" | "glowWorth") => {
      try {
        if (sort === nextSort) {
          setDir(sortDir === "asc" ? "desc" : "asc");
        } else {
          setSort(nextSort);
          setDir("desc");
        }
        setPage(1);
      } catch {
        // ignore
      }
    },
    [setDir, setPage, setSort, sort, sortDir],
  );

  // Sorting is backend-driven; filtering preserves backend order.
  const orderedRows = filteredRows;

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(orderedRows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, orderedRows.length);

  const pageRows = React.useMemo(
    () => orderedRows.slice(startIdx, endIdx),
    [endIdx, orderedRows, startIdx],
  );

  const topWallet = React.useMemo(() => {
    if (allRows.length === 0) return null;
    let best = allRows[0]!;
    let bestPoints = safeNumber(best.totalPoints);
    for (const row of allRows) {
      const p = safeNumber(row.totalPoints);
      if (p > bestPoints) {
        best = row;
        bestPoints = p;
      }
    }
    return best;
  }, [allRows]);

  const [cacheUpdateAtMs, setCacheUpdateAtMs] = React.useState(() =>
    getNextCacheUpdateAtMs(),
  );

  const remainingMsToCacheUpdate = useCountdownTo({
    targetAtMs: cacheUpdateAtMs,
    onComplete: () => setCacheUpdateAtMs(getNextCacheUpdateAtMs()),
  });

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedWallet, setSelectedWallet] = React.useState<string | null>(
    null,
  );

  const handleRowClick = React.useCallback((walletAddress: string) => {
    setSelectedWallet(walletAddress);
    setIsDialogOpen(true);
  }, []);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-card dark:bg-card border border-border/20 p-8 lg:p-12 space-y-6">
        <ImpactHero
          weekRange={weekRange}
          totalWalletCount={totalWalletCount}
          globalRankByWallet={globalRankByWallet}
          rows={allRows}
          onOpenBreakdown={handleRowClick}
          remainingMsToCacheUpdate={remainingMsToCacheUpdate}
          isLeaderboardLoading={leaderboardQuery.isLoading}
          isRefreshing={isLeaderboardRefreshing}
          address={address}
          selfScoreQuery={selfScoreQuery}
        />
      </div>

      <div className="rounded-3xl border border-border/20 overflow-hidden bg-card">
        <div className="flex flex-col gap-4 px-8 py-6 border-b border-border/20 dark:border-border/40 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              Leaderboard
            </h3>
            {leaderboardQuery.isLoading ? (
              <Skeleton className="h-4 w-80 rounded-md" />
            ) : weekRange ? (
              <div className="text-sm text-muted-foreground font-mono">
                Weeks {weekRange.startWeek}–{weekRange.endWeek}
                <span className="text-muted-foreground/40"> · </span>
                Showing {orderedRows.length === 0 ? 0 : `${startIdx + 1}–${endIdx}`} of{" "}
                {orderedRows.length.toLocaleString("en-US")}
                {searchLower
                  ? ` (filtered from ${allRows.length.toLocaleString("en-US")})`
                  : ""}
                <span className="text-muted-foreground/40"> · </span>
                {totalWalletCountDisplay == null
                  ? "—"
                  : totalWalletCountDisplay.toLocaleString("en-US")}{" "}
                wallets
              </div>
            ) : null}
          </div>

          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ENS or 0x…"
              value={search}
              onChange={(e) => {
                try {
                  setSearch(e.target.value);
                  setPage(1);
                } catch {
                  // ignore
                }
              }}
              className="pl-9 pr-9"
              disabled={leaderboardQuery.isLoading}
            />
            {search ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => {
                  try {
                    setSearch("");
                    setPage(1);
                  } catch {
                    // ignore
                  }
                }}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {leaderboardQuery.isLoading ? (
          <>
            <div className="md:hidden p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-16 rounded-md" />
                      <Skeleton className="h-4 w-40 rounded-md" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                  <Skeleton className="h-10 w-32 rounded-xl" />
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-3 w-28 rounded-md" />
                    <Skeleton className="h-3 w-28 rounded-md" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-7 w-7 rounded-lg" />
                    <Skeleton className="h-7 w-7 rounded-lg" />
                    <Skeleton className="h-7 w-7 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block p-8 space-y-4">
              <Table>
                <TableHeader className="bg-muted/30 dark:bg-muted/50">
                  <TableRow>
                    <TableHead className="w-20 h-11 px-3">
                      <Skeleton className="h-3 w-16 rounded-md" />
                    </TableHead>
                    <TableHead className="h-11 px-3">
                      <Skeleton className="h-3 w-20 rounded-md" />
                    </TableHead>
                    <TableHead className="h-11 px-3 text-right">
                      <Skeleton className="h-3 w-20 rounded-md ml-auto" />
                    </TableHead>
                    <TableHead className="h-11 px-3 text-right hidden md:table-cell">
                      <Skeleton className="h-3 w-20 rounded-md ml-auto" />
                    </TableHead>
                    <TableHead className="h-11 px-3 text-right hidden lg:table-cell">
                      <Skeleton className="h-3 w-20 rounded-md ml-auto" />
                    </TableHead>
                    <TableHead className="h-11 px-3 hidden lg:table-cell w-[220px] max-w-[260px]">
                      <Skeleton className="h-3 w-24 rounded-md" />
                    </TableHead>
                    <TableHead className="h-11 px-3 hidden md:table-cell w-[140px] max-w-[160px]">
                      <Skeleton className="h-3 w-24 rounded-md" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-4 px-3">
                        <Skeleton className="h-4 w-20 rounded-md" />
                      </TableCell>
                      <TableCell className="py-4 px-3">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-28 rounded-md" />
                          <Skeleton className="h-3 w-24 rounded-md" />
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-3 text-right">
                        <Skeleton className="h-4 w-24 rounded-md ml-auto" />
                      </TableCell>
                      <TableCell className="py-4 px-3 text-right hidden md:table-cell">
                        <Skeleton className="h-4 w-20 rounded-md ml-auto" />
                      </TableCell>
                      <TableCell className="py-4 px-3 text-right hidden lg:table-cell">
                        <Skeleton className="h-4 w-20 rounded-md ml-auto" />
                      </TableCell>
                      <TableCell className="py-4 px-3 hidden lg:table-cell">
                        <div className="flex gap-2">
                          <Skeleton className="h-7 w-7 rounded-lg" />
                          <Skeleton className="h-7 w-7 rounded-lg" />
                          <Skeleton className="h-7 w-7 rounded-lg" />
                          <Skeleton className="h-7 w-7 rounded-lg" />
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-3 hidden md:table-cell">
                        <div className="flex gap-2">
                          <Skeleton className="h-7 w-7 rounded-lg" />
                          <Skeleton className="h-7 w-7 rounded-lg" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : leaderboardQuery.isError ? (
          <div className="p-6 text-sm text-muted-foreground">
            Unable to load leaderboard.
          </div>
        ) : (
          <>
            <div
              className={cn(
                "md:hidden p-6",
                isLeaderboardRefreshing && "opacity-60",
              )}
            >
              <div className="space-y-3">
                {pageRows.map((row) => {
                  const globalRank =
                    row.globalRank ??
                    globalRankByWallet.get(row.walletAddress.toLowerCase()) ??
                    null;
                  const percentile =
                    globalRank && totalWalletCount > 0
                      ? (globalRank / totalWalletCount) * 100
                      : NaN;
                  const isRank1 = globalRank === 1;
                  const isRank2 = globalRank === 2;
                  const isRank3 = globalRank === 3;
                  const isTop3 = isRank1 || isRank2 || isRank3;

                  const ensName = allEnsNames[row.walletAddress] ?? null;
                  const isConnectedUser =
                    normalizedAddress &&
                    row.walletAddress.toLowerCase() === normalizedAddress;
                  const indicatorsState = isConnectedUser
                    ? getIndicatorsStateFromProjection(selfProjection)
                    : getIndicatorsStateFromRow(row);

                  return (
                    <div
                      key={row.walletAddress}
                      className={cn(
                        "p-4 rounded-xl cursor-pointer relative overflow-hidden transition-all border",
                        isConnectedUser &&
                          "bg-[color:var(--color-glow-orange)]/12 dark:bg-[color:var(--color-glow-orange)]/8 border-[color:var(--color-glow-orange)]/30 z-10",
                        isRank1 &&
                          !isConnectedUser &&
                          "bg-[color:var(--color-glow-yellow)]/20 dark:bg-[color:var(--color-glow-yellow)]/10 border-[color:var(--color-glow-yellow)]/30",
                        isRank2 &&
                          !isConnectedUser &&
                          "bg-[color:var(--color-glow-green)]/20 dark:bg-[color:var(--color-glow-green)]/10 border-[color:var(--color-glow-green)]/30",
                        isRank3 &&
                          !isConnectedUser &&
                          "bg-[color:var(--color-glow-purple)]/20 dark:bg-[color:var(--color-glow-purple)]/10 border-[color:var(--color-glow-purple)]/30",
                        !isConnectedUser &&
                          !isTop3 &&
                          "border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50",
                        "hover:bg-muted/40 dark:hover:bg-muted/60",
                      )}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleRowClick(row.walletAddress)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        handleRowClick(row.walletAddress);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            {isRank1 ? (
                              <span className="text-[10px] font-bold font-mono text-[color:var(--color-glow-black)] dark:text-[color:var(--color-glow-black)] bg-[color:var(--color-glow-yellow)]/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Rank 1
                              </span>
                            ) : isRank2 ? (
                              <span className="text-[10px] font-bold font-mono text-[color:var(--color-glow-black)] dark:text-[color:var(--color-glow-black)] bg-[color:var(--color-glow-green)]/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Rank 2
                              </span>
                            ) : isRank3 ? (
                              <span className="text-[10px] font-bold font-mono text-[color:var(--color-glow-black)] dark:text-[color:var(--color-glow-black)] bg-[color:var(--color-glow-purple)]/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Rank 3
                              </span>
                            ) : (
                              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                                {globalRank && globalRank <= 3 ? (
                                  <>#{globalRank.toLocaleString("en-US")}</>
                                ) : (
                                  <>Top {formatTopPercentile(percentile)}</>
                                )}
                              </span>
                            )}
                            <span
                              className={cn(
                                "min-w-0 truncate font-mono text-sm",
                                isTop3 && "font-bold",
                              )}
                            >
                              {ensName ?? shortAddress(row.walletAddress)}
                            </span>
                            {isConnectedUser ? (
                              <Badge
                                variant="outline"
                                className="ml-1 text-[10px] font-mono uppercase tracking-wider border-[color:var(--color-glow-orange)]/40 bg-[color:var(--color-glow-orange)]/15 text-[color:var(--color-glow-orange)]"
                              >
                                You
                              </Badge>
                            ) : null}
                          </div>
                          {ensName ? (
                            <div className="text-xs font-mono text-muted-foreground">
                              {shortAddress(row.walletAddress)}
                            </div>
                          ) : null}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyTextToClipboard(row.walletAddress, {
                              successMessage: "Copied",
                            });
                          }}
                          aria-label="Copy wallet address"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>

                      <div
                        className={cn(
                          "mt-3 font-mono text-3xl font-bold tracking-tight tabular-nums relative z-10",
                          isRank1
                            ? "text-[color:var(--color-glow-black)] dark:text-[color:var(--color-glow-yellow)]"
                            : "text-foreground",
                        )}
                      >
                        {formatImpactPoints(row.totalPoints, 2)}
                        <span className="ml-2 text-xs font-mono text-muted-foreground">
                          pts
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-mono text-muted-foreground">
                        <div className="truncate">
                          Last week:{" "}
                          <span className="tabular-nums">
                            {row.lastWeekPoints
                              ? formatImpactPoints(row.lastWeekPoints, 2)
                              : "—"}
                          </span>
                        </div>
                        <div className="truncate">
                          Glow:{" "}
                          <span className="tabular-nums">
                            {formatGlwFromWei(row.glowWorthWei)}
                          </span>{" "}
                          GLW
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                              Multipliers
                            </div>
                            <ImpactMultipliersIcons state={indicatorsState} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                              Point sources
                            </div>
                            <ImpactPointSourcesIcons
                              state={indicatorsState}
                              className="justify-end"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className={cn(
                "hidden md:block p-8",
                isLeaderboardRefreshing && "opacity-60",
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 dark:bg-muted/50 hover:bg-muted/40">
                    <TableHead className="w-20 h-11 px-4 text-xs font-mono uppercase tracking-wider text-muted-foreground rounded-tl-xl">
                      Rank
                    </TableHead>
                    <TableHead className="h-11 px-3 text-xs font-mono uppercase tracking-wider text-muted-foreground min-w-[220px]">
                      Wallet
                    </TableHead>
                    <TableHead className="h-11 px-3 text-right w-[180px]">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground"
                        onClick={() => handleSortClick("totalPoints")}
                      >
                        Total Points
                        {sortKey === "totalPoints" ? (
                          <span className="ml-1 inline-flex">
                            <SortIcon dir={sortDir} />
                          </span>
                        ) : null}
                      </Button>
                    </TableHead>
                    <TableHead className="h-11 px-3 text-right hidden md:table-cell w-[160px]">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground"
                        onClick={() => handleSortClick("lastWeekPoints")}
                      >
                        Last week
                        {sortKey === "lastWeekPoints" ? (
                          <span className="ml-1 inline-flex">
                            <SortIcon dir={sortDir} />
                          </span>
                        ) : null}
                      </Button>
                    </TableHead>
                    <TableHead className="h-11 px-3 text-right hidden lg:table-cell w-[160px]">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground"
                        onClick={() => handleSortClick("glowWorth")}
                      >
                        Glow Worth
                        {sortKey === "glowWorth" ? (
                          <span className="ml-1 inline-flex">
                            <SortIcon dir={sortDir} />
                          </span>
                        ) : null}
                      </Button>
                    </TableHead>
                    <TableHead className="h-11 px-3 text-xs font-mono uppercase tracking-wider text-muted-foreground hidden lg:table-cell w-[220px] max-w-[260px]">
                      Point Sources
                    </TableHead>
                    <TableHead className="h-11 px-3 text-xs font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell w-[140px] max-w-[160px] rounded-tr-xl">
                      Multipliers
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => {
                    const globalRank =
                      row.globalRank ??
                      globalRankByWallet.get(row.walletAddress.toLowerCase()) ??
                      null;
                    const percentile =
                      globalRank && totalWalletCount > 0
                        ? (globalRank / totalWalletCount) * 100
                        : NaN;
                    const isRank1 = globalRank === 1;
                    const isRank2 = globalRank === 2;
                    const isRank3 = globalRank === 3;
                    const isTop3 = isRank1 || isRank2 || isRank3;

                    const isConnectedUser =
                      normalizedAddress &&
                      row.walletAddress.toLowerCase() === normalizedAddress;
                    const indicatorsState = isConnectedUser
                      ? getIndicatorsStateFromProjection(selfProjection)
                      : getIndicatorsStateFromRow(row);

                    return (
                      <TableRow
                        key={row.walletAddress}
                        className={cn(
                          "cursor-pointer transition-colors relative",
                          isConnectedUser &&
                            "bg-[color:var(--color-glow-orange)]/12 dark:bg-[color:var(--color-glow-orange)]/8 ring-1 ring-inset ring-[color:var(--color-glow-orange)]/30",
                          isRank1 &&
                            !isConnectedUser &&
                            "bg-[color:var(--color-glow-yellow)]/20 dark:bg-[color:var(--color-glow-yellow)]/10 hover:bg-[color:var(--color-glow-yellow)]/30 dark:hover:bg-[color:var(--color-glow-yellow)]/15",
                          isRank2 &&
                            !isConnectedUser &&
                            "bg-[color:var(--color-glow-green)]/20 dark:bg-[color:var(--color-glow-green)]/10 hover:bg-[color:var(--color-glow-green)]/30 dark:hover:bg-[color:var(--color-glow-green)]/15",
                          isRank3 &&
                            !isConnectedUser &&
                            "bg-[color:var(--color-glow-purple)]/20 dark:bg-[color:var(--color-glow-purple)]/10 hover:bg-[color:var(--color-glow-purple)]/30 dark:hover:bg-[color:var(--color-glow-purple)]/15",
                          !isTop3 &&
                            !isConnectedUser &&
                            "hover:bg-muted/40 dark:hover:bg-muted/60",
                        )}
                        onClick={() => handleRowClick(row.walletAddress)}
                      >
                        <TableCell className="font-mono text-xs py-3 px-3">
                          {isRank1 ? (
                            <span className="text-[10px] font-bold font-mono text-[color:var(--color-glow-black)] dark:text-[color:var(--color-glow-black)] bg-[color:var(--color-glow-yellow)]/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Rank 1
                            </span>
                          ) : isRank2 ? (
                            <span className="text-[10px] font-bold font-mono text-[color:var(--color-glow-black)] dark:text-[color:var(--color-glow-black)] bg-[color:var(--color-glow-green)]/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Rank 2
                            </span>
                          ) : isRank3 ? (
                            <span className="text-[10px] font-bold font-mono text-[color:var(--color-glow-black)] dark:text-[color:var(--color-glow-black)] bg-[color:var(--color-glow-purple)]/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Rank 3
                            </span>
                          ) : (
                            <div className="text-muted-foreground">
                              Top {formatTopPercentile(percentile)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono py-3 px-3">
                          <div className="inline-flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              {allEnsNames[row.walletAddress] ? (
                                <>
                                  {allEnsNames[row.walletAddress] && (
                                    <span
                                      className={cn(
                                        "text-sm font-medium",
                                        isTop3 && "font-bold text-foreground",
                                      )}
                                    >
                                      {allEnsNames[row.walletAddress]}
                                    </span>
                                  )}
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {shortAddress(row.walletAddress)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span
                                    className={cn(
                                      "font-mono text-sm",
                                      isTop3 && "font-bold text-foreground",
                                    )}
                                  >
                                    {shortAddress(row.walletAddress)}
                                  </span>
                                </>
                              )}
                            </div>
                            {isConnectedUser ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono uppercase tracking-wider border-[color:var(--color-glow-orange)]/40 bg-[color:var(--color-glow-orange)]/15 text-[color:var(--color-glow-orange)]"
                              >
                                You
                              </Badge>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyTextToClipboard(row.walletAddress, {
                                  successMessage: "Copied",
                                });
                              }}
                              aria-label="Copy wallet address"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono tabular-nums py-3 px-3 text-base font-semibold",
                            isRank1
                              ? "text-[color:var(--color-glow-black)] dark:text-[color:var(--color-glow-yellow)]"
                              : "text-foreground",
                          )}
                        >
                          {formatImpactPoints(row.totalPoints, 0)}
                        </TableCell>
                        <TableCell className="py-3 px-3 hidden md:table-cell text-right font-mono tabular-nums text-sm text-muted-foreground">
                          {row.lastWeekPoints
                            ? formatImpactPoints(row.lastWeekPoints, 0)
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right font-mono tabular-nums py-3 px-3 text-sm text-muted-foreground">
                          {formatGlwFromWei(row.glowWorthWei)}{" "}
                          <span className="text-xs text-muted-foreground">
                            GLW
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-3 hidden lg:table-cell">
                          <ImpactPointSourcesIcons state={indicatorsState} />
                        </TableCell>
                        <TableCell className="py-3 px-3 hidden md:table-cell">
                          <ImpactMultipliersIcons state={indicatorsState} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {!leaderboardQuery.isLoading && orderedRows.length > 0 ? (
          <div className="flex flex-col gap-3 px-8 py-6 border-t border-border/20 dark:border-border/40">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground font-mono">
                Page {safePage} of {totalPages}
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage(Math.max(1, safePage - 1))}
                      disabled={safePage <= 1}
                    />
                  </PaginationItem>

                  {totalPages <= 7 ? (
                    Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (pageNum) => (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            isActive={safePage === pageNum}
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )
                  ) : (
                    <>
                      <PaginationItem>
                        <PaginationLink
                          isActive={safePage === 1}
                          onClick={() => setPage(1)}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>

                      {safePage > 3 ? (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : null}

                      {Array.from({ length: 3 }, (_, i) => safePage - 1 + i)
                        .filter((p) => p > 1 && p < totalPages)
                        .map((pageNum) => (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              isActive={safePage === pageNum}
                              onClick={() => setPage(pageNum)}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        ))}

                      {safePage < totalPages - 2 ? (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : null}

                      <PaginationItem>
                        <PaginationLink
                          isActive={safePage === totalPages}
                          onClick={() => setPage(totalPages)}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setPage(Math.min(totalPages, safePage + 1))
                      }
                      disabled={safePage >= totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        ) : null}
      </div>

      <ImpactScoreBreakdownDialog
        open={isDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsDialogOpen(nextOpen);
          if (!nextOpen) setSelectedWallet(null);
        }}
        walletAddress={selectedWallet}
        weekRange={weekRange}
        title="Impact Score Breakdown"
        showCurrentWeekProjection={false}
      />
    </div>
  );
}
