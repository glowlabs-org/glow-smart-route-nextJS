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
} from "@/hooks/useGlowLaunchpad";
import { cn } from "@/lib/utils";

interface SponsoredFarmsActivityProps {
  className?: string;
}

export function SponsoredFarmsActivity({
  className,
}: SponsoredFarmsActivityProps) {
  const { activity, summary, isLoading, isError, error } = useSplitsActivity({
    limit: 50, // Show recent 50 purchases
  });

  if (isLoading) {
    return (
      <div className={className}>
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              <CardContent className="p-0">
                <div className="grid grid-cols-2 gap-1">
                  <Skeleton className="col-span-2 w-full h-56" />
                  <Skeleton className="w-full h-28" />
                  <Skeleton className="w-full h-28" />
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Amount Purchased
          </div>
          <div className="text-2xl font-semibold text-black dark:text-white">
            {formatNumber(summary.totalStepsPurchased, 0)}
          </div>
        </div>
        <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Total Spent
          </div>
          <div className="text-2xl font-semibold text-black dark:text-white">
            {formatNumber(
              parseFloat(formatUnits(BigInt(summary.totalAmountSpent), 18)),
              0
            )}{" "}
            <span className="text-lg font-normal">GLW</span>
          </div>
        </div>
        <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Farms
          </div>
          <div className="text-2xl font-semibold text-black dark:text-white">
            {formatNumber(summary.uniqueFractions, 0)}
          </div>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Reward Score</TableHead>
              <TableHead className="text-right">Total Paid</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activity.map((purchase) => {
              // Format purchase amount
              const purchaseAmount = formatUnits(
                BigInt(purchase.totalValue),
                18
              );
              const stepPrice = formatUnits(BigInt(purchase.stepPrice), 18);

              // Format purchase date
              const purchaseDate = new Date(
                purchase.purchaseDate
              ).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              // Format buyer address for display
              const buyerDisplay = `${purchase.buyer.slice(
                0,
                6
              )}...${purchase.buyer.slice(-4)}`;

              return (
                <TableRow
                  key={`${purchase.transactionHash}-${purchase.fractionId}`}
                  className="h-14"
                >
                  <TableCell>
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {purchaseDate}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      {buyerDisplay}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatNumber(purchase.stepsPurchased, 0)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {purchase.rewardScore !== null &&
                      purchase.rewardScore !== undefined
                        ? formatNumber(purchase.rewardScore, 0)
                        : "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatNumber(parseFloat(purchaseAmount), 2)} GLW
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-medium inline-block">
                      Confirmed
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
