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
} from "@/hooks/useGlowLaunchpad";
import { cn } from "@/lib/utils";

interface SponsoredFarmsActivityProps {
  className?: string;
  fractionType?: "mining-center" | "launchpad";
  activityOverride?: SplitActivity[];
  summaryOverride?: SplitsActivityResponse["summary"];
  isLoadingOverride?: boolean;
  walletAddress?: string;
}

export function SponsoredFarmsActivity({
  className,
  fractionType,
  activityOverride,
  summaryOverride,
  isLoadingOverride,
  walletAddress,
}: SponsoredFarmsActivityProps) {
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

  const activity = activityOverride ?? fetchedActivity;
  const summary = summaryOverride ?? fetchedSummary;
  const isLoading = isLoadingOverride ?? fetchedIsLoading;
  const isError = fetchedIsError && !(activityOverride && summaryOverride);
  const error = fetchedError;

  // Determine if we should show reward scores (only for launchpad)
  const showRewardScore = !fractionType || fractionType === "launchpad";

  if (isLoading) {
    return (
      <div className={cn(className, "p-4")}>
        {/* Summary Stats Skeleton */}
        <div
          className={cn(
            "mb-6 grid gap-4",
            showRewardScore
              ? "grid-cols-2 md:grid-cols-4"
              : "grid-cols-1 md:grid-cols-3"
          )}
        >
          {showRewardScore && (
            <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-8 w-20" />
            </div>
          )}
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-24" />
          </div>
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
        <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
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
    <div className={cn(className, "p-4")}>
      {/* Summary Stats */}
      <div
        className={cn(
          "mb-6 grid gap-4",
          showRewardScore
            ? "grid-cols-2 md:grid-cols-4"
            : "grid-cols-1 md:grid-cols-3"
        )}
      >
        {showRewardScore && (
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Avg Reward Score
            </div>
            <div className="text-2xl font-semibold text-black dark:text-white">
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
        <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Amount
          </div>
          <div className="text-2xl font-semibold text-black dark:text-white">
            {formatNumber(summary.totalStepsPurchased, 0)}
          </div>
        </div>
        <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Total GLW Delegated
          </div>
          <div className="text-2xl font-semibold text-black dark:text-white">
            {(() => {
              const decimals = fractionType === "mining-center" ? 6 : 18;
              const currency =
                fractionType === "mining-center" ? "USDC" : "GLW";
              return (
                <>
                  {formatNumber(
                    parseFloat(
                      formatUnits(BigInt(summary.totalAmountSpent), decimals)
                    ),
                    0
                  )}{" "}
                  <span className="text-lg font-normal">{currency}</span>
                </>
              );
            })()}
          </div>
        </div>
        {fractionType === "mining-center" ? (
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Miners
            </div>
            <div className="text-2xl font-semibold text-black dark:text-white">
              {formatNumber(summary.uniqueFractions, 0)}
            </div>
          </div>
        ) : fractionType === "launchpad" ? (
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Farms
            </div>
            <div className="text-2xl font-semibold text-black dark:text-white">
              {formatNumber(summary.uniqueFractions, 0)}
            </div>
          </div>
        ) : (
          <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              USDC Spent by Miners
            </div>
            <div className="text-2xl font-semibold text-black dark:text-white">
              {(() => {
                const usdc = activity
                  .filter((p) => p.fractionType === "mining-center")
                  .reduce((sum, p) => {
                    const value = parseFloat(
                      formatUnits(BigInt(p.totalValue), 6)
                    );
                    return sum + value;
                  }, 0);
                return (
                  <>
                    {formatNumber(usdc, 0)}{" "}
                    <span className="text-lg font-normal">USDC</span>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Activity Table */}
      <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left min-w-[120px]">Total</TableHead>
              <TableHead className="text-left min-w-[100px]">Amount</TableHead>
              <TableHead className="min-w-[120px]">Date</TableHead>
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

              const purchaseDate = new Date(
                purchase.purchaseDate
              ).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              const buyerDisplay = `${purchase.buyer.slice(
                0,
                6
              )}...${purchase.buyer.slice(-4)}`;

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
                  <TableCell className="text-left">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {formatNumber(purchase.stepsPurchased, 0)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
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
