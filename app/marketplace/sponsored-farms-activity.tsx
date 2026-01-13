"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUnits } from "viem";
import { formatNumber } from "./utils";
import {
  useSplitsActivity,
  type SplitActivity,
  type SplitsActivityResponse,
} from "@/hooks";
import { useFractionsSummary } from "@/hooks";
import { parseFractionsSummary } from "@/lib/fractions";
import { cn } from "@/lib/utils";
import { useEnsNames } from "@/hooks/useEnsNames";
import { shortAddress } from "@/utils/impact";

import { Button } from "@/components/ui/button";
import { CashMinerIcon, DelegationIcon } from "@/components/impact-icons";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface SponsoredFarmsActivityProps {
  className?: string;
  fractionType?: "mining-center" | "launchpad";
  variant?: "widget" | "full";
  activityOverride?: SplitActivity[];
  summaryOverride?: SplitsActivityResponse["summary"];
  isLoadingOverride?: boolean;
  walletAddress?: string;
  constrainHeight?: boolean;
  maxRows?: number;
  showViewAll?: boolean;
  onViewAllClick?: () => void;
  showKpis?: boolean;
}

function formatCompactNumber(value: number, maximumFractionDigits: number) {
  try {
    if (!Number.isFinite(value)) return "0";
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }).format(value);
  } catch {
    return String(value);
  }
}

function formatTimeAgoShort(timestampMs: number, nowMs: number) {
  const diffMs = nowMs - timestampMs;
  if (!Number.isFinite(diffMs)) return "—";
  if (diffMs < 45_000) return "now";

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

function getKpiGridClassName(params: {
  isWidget: boolean;
  showRewardScore: boolean;
  shouldShowContributorsKpi: boolean;
  hasThirdKpi: boolean;
}) {
  const { isWidget, showRewardScore, shouldShowContributorsKpi, hasThirdKpi } =
    params;

  const kpiCount =
    Number(showRewardScore) +
    Number(shouldShowContributorsKpi) +
    1 +
    Number(hasThirdKpi);

  if (isWidget) {
    return "grid-cols-3";
  }

  if (kpiCount === 4) return "grid-cols-2 lg:grid-cols-4";
  if (kpiCount === 3) return "grid-cols-2 md:grid-cols-3";

  return "grid-cols-2";
}

export function SponsoredFarmsActivity({
  className,
  fractionType,
  variant = "full",
  activityOverride,
  summaryOverride,
  isLoadingOverride,
  walletAddress,
  constrainHeight,
  maxRows,
  showViewAll,
  onViewAllClick,
  showKpis = true,
}: SponsoredFarmsActivityProps) {
  const isWidget = variant === "widget";

  const {
    activity: fetchedActivity,
    summary: fetchedSummary,
    isLoading: fetchedIsLoading,
    isError: fetchedIsError,
    error: fetchedError,
  } = useSplitsActivity({
    limit: 100, // Show recent 50 purchases
    fractionType,
    walletAddress,
    enabled: !(activityOverride && summaryOverride),
  });

  // Get fractions summary for total GLW delegated and USDC spent
  const { summary: fractionsSummary, isLoading: fractionsSummaryLoading } =
    useFractionsSummary({ enabled: !walletAddress });

  const activity = activityOverride ?? fetchedActivity;
  const summary = summaryOverride ?? fetchedSummary;
  const isLoading = isLoadingOverride ?? fetchedIsLoading;
  const isError = fetchedIsError && !(activityOverride && summaryOverride);
  const error = fetchedError;

  // Parse fractions summary
  const {
    totalDelegatedGlw,
    totalMiningCenterValue,
    launchpadContributors,
    miningCenterContributors,
  } = React.useMemo(
    () => parseFractionsSummary(fractionsSummary),
    [fractionsSummary]
  );

  // Determine if we should show reward scores (only for launchpad)
  const showRewardScore = !fractionType || fractionType === "launchpad";
  const shouldShowContributorsKpi = !isWidget;
  const hasThirdKpi = true;

  const kpiGridClassName = getKpiGridClassName({
    isWidget,
    showRewardScore,
    shouldShowContributorsKpi,
    hasThirdKpi,
  });

  const kpiValueClassName = cn(
    "font-semibold text-foreground tabular-nums min-w-0",
    isWidget ? "text-xl leading-none" : "text-lg md:text-2xl"
  );

  const kpiLabelClassName = cn(
    "text-xs md:text-sm text-muted-foreground mb-1 min-w-0 truncate whitespace-nowrap"
  );

  const nowMs = Date.now();

  const displayedActivity = React.useMemo(() => {
    if (!maxRows) return activity;
    return activity.slice(0, maxRows);
  }, [activity, maxRows]);

  const buyerAddresses = React.useMemo(() => {
    return displayedActivity.map((purchase) => purchase.buyer);
  }, [displayedActivity]);

  const { ensNames } = useEnsNames({
    addresses: buyerAddresses,
    enabled: buyerAddresses.length > 0,
  });

  if (isLoading) {
    return (
      <div className={cn(isWidget ? "w-full min-w-0" : "p-4 w-full min-w-0", className)}>
        {/* Summary Stats Skeleton */}
        {showKpis && (
          <div
            className={cn(isWidget ? "mb-4 grid gap-3 w-full min-w-0 grid-cols-3" : "mb-6 grid gap-4 w-full min-w-0", !isWidget && kpiGridClassName)}
          >
            {showRewardScore && (
              <div className={cn("rounded-xl p-3", isWidget ? "bg-muted/30 border border-border/60" : "bg-muted dark:bg-muted/30 p-4")}>
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-6 w-12" />
                {isWidget && <Skeleton className="h-2 w-20 mt-1" />}
              </div>
            )}
            {!isWidget && shouldShowContributorsKpi ? (
              <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </div>
            ) : null}
            <div className={cn("rounded-xl p-3", isWidget ? "bg-muted/30 border border-border/60" : "bg-muted dark:bg-muted/30 p-4")}>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-6 w-16" />
              {isWidget && <Skeleton className="h-2 w-16 mt-1" />}
            </div>
            <div className={cn("rounded-xl p-3", isWidget ? "bg-muted/30 border border-border/60" : "bg-muted dark:bg-muted/30 p-4")}>
              <Skeleton className="h-3 w-12 mb-2" />
              <Skeleton className="h-6 w-10" />
              {isWidget && <Skeleton className="h-2 w-14 mt-1" />}
            </div>
          </div>
        )}

        {/* Activity Table Skeleton */}
        {isWidget ? (
          <div className="space-y-3 w-full min-w-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 p-3"
              >
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <Skeleton className="h-3 w-24 rounded-xl" />
                    <Skeleton className="h-3 w-12 rounded-xl shrink-0" />
                  </div>
                  <div className="flex justify-between gap-2">
                    <Skeleton className="h-3 w-32 rounded-xl" />
                    <Skeleton className="h-3 w-20 rounded-xl shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className={cn(
              "bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto",
              constrainHeight ? "overflow-y-auto max-h-[min(55vh,520px)]" : null
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right min-w-[120px]">
                    Total
                  </TableHead>
                  <TableHead className="text-right min-w-[100px]">
                    Amount
                  </TableHead>
                  <TableHead className="min-w-[120px]">Date</TableHead>
                  {showRewardScore && (
                    <TableHead className="text-right min-w-[120px]">
                      Reward Score
                    </TableHead>
                  )}
                  <TableHead className="min-w-[100px] hidden md:table-cell">
                    Farm
                  </TableHead>
                  <TableHead className="min-w-[100px] hidden md:table-cell">
                    Type
                  </TableHead>
                  <TableHead className="min-w-[100px] hidden lg:table-cell">
                    Wallet
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="h-14">
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-20 ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-16 ml-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    {showRewardScore && (
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                    )}
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn(isWidget ? "w-full min-w-0" : "", className)}>
        <div className="text-center py-8">
          <p className="text-destructive text-sm">
            Error loading purchase activity: {error?.message}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Please try again later
          </p>
        </div>
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className={cn(isWidget ? "w-full min-w-0" : "", className)}>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">
            No purchase activity found.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Recent share purchases will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(className, isWidget ? "w-full min-w-0" : "p-4 w-full min-w-0 overflow-hidden")}>
      {/* Summary Stats KPIs */}
      {showKpis && (
        <div className={cn(isWidget ? "mb-4 grid gap-3 w-full min-w-0 grid-cols-3" : "mb-6 grid gap-4 w-full min-w-0", !isWidget && kpiGridClassName)}>
          {showRewardScore && (
          <div className={cn("rounded-xl p-3 min-w-0", isWidget ? "bg-muted/30 border border-border/60" : "bg-muted dark:bg-muted/30 md:p-4")}>
            <div className={cn("text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 min-w-0 truncate whitespace-nowrap", !isWidget && kpiLabelClassName)}>
              {isWidget ? "Avg Score" : "Avg Reward Score"}
            </div>
            <div className={cn("font-semibold text-foreground tabular-nums min-w-0", isWidget ? "text-xl leading-none" : kpiValueClassName)}>
              {(() => {
                const validRewardScores = activity.filter(
                  (purchase) =>
                    purchase.rewardScore !== null &&
                    purchase.rewardScore !== undefined
                );
                if (validRewardScores.length === 0) return "—";

                const totalRewardScore = validRewardScores.reduce(
                  (sum, purchase) => sum + (purchase.rewardScore || 0),
                  0
                );
                const avgRewardScore =
                  totalRewardScore / validRewardScores.length;
                return formatNumber(avgRewardScore, 0);
              })()}
            </div>
            {isWidget && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                reward score
              </div>
            )}
          </div>
        )}
        {!isWidget && shouldShowContributorsKpi ? (
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-3 md:p-4 min-w-0">
            <div className={kpiLabelClassName}>
              {fractionType === "mining-center"
                ? "Buyers"
                : fractionType === "launchpad"
                ? "Delegators"
                : "Contributors"}
            </div>
            <div className={kpiValueClassName}>
              {fractionType === "mining-center"
                ? formatNumber(miningCenterContributors, 0)
                : fractionType === "launchpad"
                ? formatNumber(launchpadContributors, 0)
                : formatNumber(
                    launchpadContributors + miningCenterContributors,
                    0
                  )}
            </div>
          </div>
        ) : null}
        <div className={cn("rounded-xl p-3 min-w-0", isWidget ? "bg-muted/30 border border-border/60" : "bg-muted dark:bg-muted/30 md:p-4")}>
          <div className={cn("text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 min-w-0 truncate whitespace-nowrap", !isWidget && kpiLabelClassName)}>
            {fractionType === "mining-center"
              ? isWidget ? "USDC Spent" : "Total USDC Spent"
              : isWidget ? "GLW Delegated" : "Total GLW Delegated"}
          </div>
          <div className={cn("flex items-baseline gap-1.5", isWidget ? "font-semibold text-foreground tabular-nums min-w-0 text-xl leading-none" : kpiValueClassName)}>
            {fractionType === "mining-center" ? (
              <>
                <span className="min-w-0 truncate">
                  {isWidget
                    ? formatCompactNumber(totalMiningCenterValue, 1)
                    : formatNumber(totalMiningCenterValue, 0)}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-normal",
                    isWidget ? "text-sm" : "text-lg"
                  )}
                >
                  USDC
                </span>
              </>
            ) : (
              <>
                <span className="min-w-0 truncate">
                  {isWidget
                    ? formatCompactNumber(totalDelegatedGlw, 1)
                    : formatNumber(totalDelegatedGlw, 0)}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-normal",
                    isWidget ? "text-sm" : "text-lg"
                  )}
                >
                  GLW
                </span>
              </>
            )}
          </div>
          {isWidget && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              total volume
            </div>
          )}
        </div>
        {fractionType === "mining-center" ? (
          <div className={cn("rounded-xl p-3 min-w-0", isWidget ? "bg-muted/30 border border-border/60" : "bg-muted dark:bg-muted/30 md:p-4")}>
            <div className={cn("text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 min-w-0 truncate whitespace-nowrap", !isWidget && kpiLabelClassName)}>
              Miners
            </div>
            <div className={cn("font-semibold text-foreground tabular-nums min-w-0", isWidget ? "text-xl leading-none" : kpiValueClassName)}>
              {formatNumber(summary.uniqueFractions, 0)}
            </div>
            {isWidget && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                purchased
              </div>
            )}
          </div>
        ) : fractionType === "launchpad" ? (
          <div className={cn("rounded-xl p-3 min-w-0", isWidget ? "bg-muted/30 border border-border/60" : "bg-muted dark:bg-muted/30 md:p-4")}>
            <div className={cn("text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 min-w-0 truncate whitespace-nowrap", !isWidget && kpiLabelClassName)}>
              Farms
            </div>
            <div className={cn("font-semibold text-foreground tabular-nums min-w-0", isWidget ? "text-xl leading-none" : kpiValueClassName)}>
              {formatNumber(summary.uniqueFractions, 0)}
            </div>
            {isWidget && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                funded
              </div>
            )}
          </div>
        ) : (
          <div className={cn("rounded-xl p-3 min-w-0", isWidget ? "bg-muted/30 border border-border/60" : "bg-muted dark:bg-muted/30 md:p-4")}>
            <div className={cn("text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 min-w-0 truncate whitespace-nowrap", !isWidget && kpiLabelClassName)}>
              {isWidget ? "Miners USDC" : "USDC Spent by Miners"}
            </div>
            <div
              className={cn("flex items-baseline gap-1.5", isWidget ? "font-semibold text-foreground tabular-nums min-w-0 text-xl leading-none" : kpiValueClassName)}
            >
              <span className="min-w-0 truncate">
                {isWidget
                  ? formatCompactNumber(totalMiningCenterValue, 1)
                  : formatNumber(totalMiningCenterValue, 0)}
              </span>
              <span
                className={cn(
                  "shrink-0 font-normal",
                  isWidget ? "text-sm" : "text-lg"
                )}
              >
                USDC
              </span>
            </div>
            {isWidget && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                miner volume
              </div>
            )}
          </div>
        )}
        </div>
      )}

      {/* Activity Content */}
      {isWidget ? (
        <div className="space-y-3 w-full min-w-0">
          {displayedActivity.map((purchase) => {
            // Mining centers use USDC (6 decimals), launchpad uses GLW (18 decimals)
            const decimals = purchase.fractionType === "mining-center" ? 6 : 18;
            const currency =
              purchase.fractionType === "mining-center" ? "USDC" : "GLW";

            const purchaseAmount = formatUnits(
              BigInt(purchase.totalValue),
              decimals
            );

            const purchaseAtMs = new Date(purchase.purchaseDate).getTime();
            const purchaseDate = formatTimeAgoShort(purchaseAtMs, nowMs);

            const ensName = ensNames[purchase.buyer];
            const buyerDisplay = ensName || shortAddress(purchase.buyer);

            const isMiningCenter = purchase.fractionType === "mining-center";

            // Construct audit URL if farmId is present
            const auditUrl = purchase.farmId
              ? `https://glow.org/audits/${purchase.farmId}`
              : "#";

            return (
              <Link
                key={`${purchase.transactionHash}-${purchase.fractionId}`}
                href={auditUrl}
                target={purchase.farmId ? "_blank" : undefined}
                rel={purchase.farmId ? "noopener noreferrer" : undefined}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/10 hover:bg-muted/20 transition-colors group"
              >
                {/* Thumbnail / Icon */}
                <div
                  className={cn(
                    "relative h-10 w-10 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center",
                    isMiningCenter
                      ? "border-[color:var(--color-miner)]/90 bg-[color:var(--color-miner)]/15 text-[color:var(--color-miner)]"
                      : "border-delegation-purple/90 bg-delegation-purple/25 text-delegation-purple"
                  )}
                >
                  {isMiningCenter ? (
                    <CashMinerIcon className="w-6 h-6" />
                  ) : (
                    <DelegationIcon className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                  {/* Top Line: Farm Name + Amount + Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <span className="font-bold text-base truncate text-foreground group-hover:text-glow-orange transition-colors">
                        {purchase.farmName}
                      </span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-xl text-[10px] font-medium uppercase tracking-wider shrink-0 border",
                          isMiningCenter
                            ? "border-[color:var(--color-miner)]/90 bg-[color:var(--color-miner)]/15 text-[color:var(--color-miner)]"
                            : "border-delegation-purple/90 bg-delegation-purple/25 text-delegation-purple"
                        )}
                      >
                        {isMiningCenter ? "Miner" : "Delegation"}
                      </span>
                    </div>
                    <span className="font-mono font-medium tabular-nums text-foreground text-sm whitespace-nowrap shrink-0">
                      {formatNumber(parseFloat(purchaseAmount), 2)} {currency}
                    </span>
                  </div>

                  {/* Bottom Line: User + Date */}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="font-mono truncate max-w-[150px]">
                      {buyerDisplay}
                    </div>
                    <span className="text-[10px] whitespace-nowrap font-mono opacity-80">
                      {purchaseDate}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <>
          {/* Mobile Cards View */}
          <div
            className={cn(
              "md:hidden space-y-3",
              constrainHeight ? "overflow-y-auto max-h-[min(55vh,520px)]" : null
            )}
          >
            {displayedActivity.map((purchase) => {
              const decimals =
                purchase.fractionType === "mining-center" ? 6 : 18;
              const currency =
                purchase.fractionType === "mining-center" ? "USDC" : "GLW";
              const purchaseAmount = formatUnits(
                BigInt(purchase.totalValue),
                decimals
              );
              const purchaseAtMs = new Date(purchase.purchaseDate).getTime();
              const purchaseDate = formatTimeAgoShort(purchaseAtMs, nowMs);
              const ensName = ensNames[purchase.buyer];
              const buyerDisplay = ensName || formatAddress(purchase.buyer);
              const isMiningCenter = purchase.fractionType === "mining-center";
              const auditUrl = purchase.farmId
                ? `https://glow.org/audits/${purchase.farmId}`
                : "#";

              return (
                <Link
                  key={`mobile-${purchase.transactionHash}-${purchase.fractionId}`}
                  href={auditUrl}
                  target={purchase.farmId ? "_blank" : undefined}
                  rel={purchase.farmId ? "noopener noreferrer" : undefined}
                  className="block p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
                          isMiningCenter
                            ? "border-[color:var(--color-miner)]/50 bg-[color:var(--color-miner)]/15 text-[color:var(--color-miner)]"
                            : "border-delegation-purple/50 bg-delegation-purple/15 text-delegation-purple"
                        )}
                      >
                        {isMiningCenter ? (
                          <CashMinerIcon className="w-5 h-5" />
                        ) : (
                          <DelegationIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate text-foreground">
                          {purchase.farmName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {buyerDisplay}
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 border",
                        isMiningCenter
                          ? "border-[color:var(--color-miner)]/50 bg-[color:var(--color-miner)]/15 text-[color:var(--color-miner)]"
                          : "border-delegation-purple/50 bg-delegation-purple/15 text-delegation-purple"
                      )}
                    >
                      {isMiningCenter ? "Miner" : "Delegation"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50 mt-1">
                    <div className="font-mono font-bold text-foreground text-sm">
                      {formatNumber(parseFloat(purchaseAmount), 1)} {currency}
                    </div>
                    <div className="text-muted-foreground font-mono">
                      {purchaseDate}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div
            className={cn(
              "hidden md:block bg-card rounded-xl border border-border overflow-x-auto",
              constrainHeight ? "overflow-y-auto max-h-[min(55vh,520px)]" : null
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left min-w-[120px]">
                    Total
                  </TableHead>
                  <TableHead className="text-right w-[6ch]">Amount</TableHead>
                  <TableHead className="text-left w-[8ch]">Date</TableHead>
                  {showRewardScore && (
                    <TableHead className="text-center min-w-[120px]">
                      Reward Score
                    </TableHead>
                  )}
                  <TableHead className="min-w-[100px]">Farm</TableHead>
                  <TableHead className="min-w-[100px]">Type</TableHead>
                  <TableHead className="min-w-[100px] hidden lg:table-cell">
                    Wallet
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedActivity.map((purchase) => {
                  const decimals =
                    purchase.fractionType === "mining-center" ? 6 : 18;
                  const currency =
                    purchase.fractionType === "mining-center" ? "USDC" : "GLW";
                  const purchaseAmount = formatUnits(
                    BigInt(purchase.totalValue),
                    decimals
                  );
                  const purchaseAtMs = new Date(
                    purchase.purchaseDate
                  ).getTime();
                  const purchaseDate = formatTimeAgoShort(purchaseAtMs, nowMs);
                  const ensName = ensNames[purchase.buyer];
                  const buyerDisplay = ensName || formatAddress(purchase.buyer);
                  const auditUrl = purchase.farmId
                    ? `https://glow.org/audits/${purchase.farmId}`
                    : "#";

                  return (
                    <TableRow
                      key={`${purchase.transactionHash}-${purchase.fractionId}`}
                      className="h-14 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        if (purchase.farmId) {
                          window.open(
                            auditUrl,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }
                      }}
                    >
                      <TableCell className="text-left">
                        <div className="text-sm font-semibold text-foreground whitespace-nowrap">
                          {formatNumber(parseFloat(purchaseAmount), 2)}{" "}
                          {currency}
                        </div>
                      </TableCell>
                      <TableCell className="text-right w-[6ch]">
                        <div className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                          {String(purchase.stepsPurchased)}
                        </div>
                      </TableCell>
                      <TableCell className="text-left w-[8ch]">
                        <div className="text-sm text-foreground tabular-nums whitespace-nowrap">
                          {purchaseDate}
                        </div>
                      </TableCell>
                      {showRewardScore && (
                        <TableCell className="text-center">
                          <div className="text-sm font-semibold text-foreground whitespace-nowrap">
                            {purchase.rewardScore !== null &&
                            purchase.rewardScore !== undefined
                              ? formatNumber(purchase.rewardScore, 0)
                              : "—"}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="text-sm font-mono text-foreground whitespace-nowrap">
                          {purchase.farmName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div
                          className={cn(
                            "px-2 py-1 rounded-xl text-[10px] font-medium uppercase tracking-wider inline-block whitespace-nowrap border",
                            purchase.fractionType === "mining-center"
                              ? "border-[color:var(--color-miner)]/50 bg-[color:var(--color-miner)]/15 text-[color:var(--color-miner)]"
                              : "border-delegation-purple/50 bg-delegation-purple/15 text-delegation-purple"
                          )}
                        >
                          {purchase.fractionType === "mining-center"
                            ? "Miner"
                            : "Delegator"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm font-mono text-foreground whitespace-nowrap">
                          {buyerDisplay}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {showViewAll && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={onViewAllClick}
            className="w-full sm:w-auto"
          >
            See All Activity
          </Button>
        </div>
      )}
    </div>
  );
}
