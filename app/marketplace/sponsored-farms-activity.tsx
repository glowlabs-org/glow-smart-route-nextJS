"use client";

import React from "react";
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

  if (kpiCount === 4)
    return "grid-cols-2 md:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]";
  if (kpiCount === 3) return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";

  return "grid-cols-1";
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
    "font-semibold text-black dark:text-white tabular-nums min-w-0",
    isWidget ? "text-xl leading-none" : "text-2xl"
  );

  const kpiLabelClassName = cn(
    "text-sm text-gray-600 dark:text-gray-400 mb-1 min-w-0 truncate whitespace-nowrap"
  );

  const nowMs = Date.now();

  const buyerAddresses = React.useMemo(() => {
    return activity.map((purchase) => purchase.buyer);
  }, [activity]);

  const { ensNames } = useEnsNames({
    addresses: buyerAddresses,
    enabled: buyerAddresses.length > 0,
  });

  if (isLoading) {
    return (
      <div className={cn(className, "p-4 w-full min-w-0")}>
        {/* Summary Stats Skeleton */}
        <div className={cn("mb-6 grid gap-4 w-full min-w-0", kpiGridClassName)}>
          {showRewardScore && (
            <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-8 w-20" />
            </div>
          )}
          {shouldShowContributorsKpi ? (
            <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24" />
            </div>
          ) : null}
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
            <Skeleton className="h-4 w-40 mb-2" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>

        {/* Activity Table Skeleton */}
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
      </div>
    );
  }

  if (isError) {
    return (
      <div className={className}>
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
      <div className={className}>
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
    <div className={cn(className, "p-4 w-full min-w-0 overflow-hidden")}>
      {/* Summary Stats */}
      <div className={cn("mb-6 grid gap-4 w-full min-w-0", kpiGridClassName)}>
        {showRewardScore && (
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4 min-w-0">
            <div className={kpiLabelClassName}>Avg Reward Score</div>
            <div className={kpiValueClassName}>
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
          </div>
        )}
        {shouldShowContributorsKpi ? (
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4 min-w-0">
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
        <div className="bg-muted dark:bg-muted/30 rounded-xl p-4 min-w-0">
          <div className={kpiLabelClassName}>
            {fractionType === "mining-center"
              ? "Total USDC Spent"
              : "Total GLW Delegated"}
          </div>
          <div className={cn(kpiValueClassName, "flex items-baseline gap-2")}>
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
        </div>
        {fractionType === "mining-center" ? (
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4 min-w-0">
            <div className={kpiLabelClassName}>Miners</div>
            <div className={kpiValueClassName}>
              {formatNumber(summary.uniqueFractions, 0)}
            </div>
          </div>
        ) : fractionType === "launchpad" ? (
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4 min-w-0">
            <div className={kpiLabelClassName}>Farms</div>
            <div className={kpiValueClassName}>
              {formatNumber(summary.uniqueFractions, 0)}
            </div>
          </div>
        ) : (
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4 min-w-0">
            <div className={kpiLabelClassName}>USDC Spent by Miners</div>
            <div className={cn(kpiValueClassName, "flex items-baseline gap-2")}>
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
          </div>
        )}
      </div>

      {/* Activity Table */}
      <div
        className={cn(
          "bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto",
          constrainHeight ? "overflow-y-auto max-h-[min(55vh,520px)]" : null
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left min-w-[120px]">Total</TableHead>
              <TableHead className="text-right w-[6ch]">Amount</TableHead>
              <TableHead className="text-left w-[8ch]">Date</TableHead>
              {showRewardScore && (
                <TableHead className="text-center min-w-[120px]">
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
            {activity.map((purchase) => {
              // Mining centers use USDC (6 decimals), launchpad uses GLW (18 decimals)
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

              return (
                <TableRow
                  key={`${purchase.transactionHash}-${purchase.fractionId}`}
                  className="h-14"
                >
                  <TableCell className="text-left">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {formatNumber(parseFloat(purchaseAmount), 2)} {currency}
                    </div>
                  </TableCell>
                  <TableCell className="text-right w-[6ch]">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap">
                      {String(purchase.stepsPurchased)}
                    </div>
                  </TableCell>
                  <TableCell className="text-left w-[8ch]">
                    <div className="text-sm text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap">
                      {purchaseDate}
                    </div>
                  </TableCell>
                  {showRewardScore && (
                    <TableCell className="text-center">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {purchase.rewardScore !== null &&
                        purchase.rewardScore !== undefined
                          ? formatNumber(purchase.rewardScore, 0)
                          : "—"}
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {purchase.farmName}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium inline-block whitespace-nowrap",
                        purchase.fractionType === "mining-center"
                          ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                          : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      )}
                    >
                      {purchase.fractionType === "mining-center"
                        ? "Mining Center"
                        : "Launchpad"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-sm font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {buyerDisplay}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
