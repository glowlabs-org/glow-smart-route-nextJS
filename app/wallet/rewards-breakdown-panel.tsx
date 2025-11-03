"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import {
  useRewardsBreakdown,
  formatGLW,
  formatUSDC,
} from "@/hooks/useRewardsBreakdown";
import { useWalletFarms } from "@/hooks/useWalletFarms";
import { useRegions } from "@/hooks/useRegions";
import { FallbackImage } from "@/components/ui/fallback-image";
import { useGlowSpotPrice } from "@/hooks/useGlowPrices";
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";

interface RewardsBreakdownPanelProps {
  walletAddress: string | undefined;
}

export function RewardsBreakdownPanel({
  walletAddress,
}: RewardsBreakdownPanelProps) {
  const { data, isLoading, isError, refetch } = useRewardsBreakdown({
    walletAddress: walletAddress || null,
    enabled: Boolean(walletAddress),
  });

  const { farms: purchasedFarms } = useWalletFarms({
    walletAddress: walletAddress || undefined,
    enabled: Boolean(walletAddress),
  });

  const { regions } = useRegions();

  const { spotPrice } = useGlowSpotPrice();

  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold">
            Miners & Delegations
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Loading your rewards data...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-32 mb-3" />
                  <Skeleton className="h-8 w-40 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-10 w-48" />
                </CardContent>
              </Card>
            </div>
            <div>
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-0">
                      <Skeleton className="w-full h-40" />
                      <div className="p-5 space-y-4">
                        <Skeleton className="h-5 w-32" />
                        <div className="space-y-2.5">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return null;
  }

  const delegations = data.farmDetails.filter((f) => f.type === "launchpad");
  const miners = data.farmDetails.filter((f) => f.type === "mining-center");

  const totalEarnings =
    Number(data.rewards.delegator.allWeeks) +
    Number(data.rewards.miner.allWeeks);
  const formattedTotalEarnings = formatGLW(totalEarnings.toString());

  const totalEarningsInDollars =
    spotPrice !== null
      ? Number(formatUnits(BigInt(totalEarnings), DECIMALS_BY_TOKEN["GLW"])) *
        spotPrice
      : null;

  const delegatedGLW = formatGLW(
    (
      Number(data.totals.totalGlwDelegated) +
      Number(data.delegatedAfterWeekRange.totalGlwDelegatedAfter)
    ).toString()
  );
  const spentUSDC = formatUSDC(data.totals.totalUsdcSpentByMiners);

  const pendingDelegatedGLW = formatGLW(
    data.delegatedAfterWeekRange.totalGlwDelegatedAfter
  );
  const pendingSpentUSDC = formatUSDC(
    data.delegatedAfterWeekRange.totalUsdcSpentAfter
  );
  const hasPendingDelegations =
    Number(data.delegatedAfterWeekRange.totalGlwDelegatedAfter) > 0;
  const hasPendingMining =
    Number(data.delegatedAfterWeekRange.totalUsdcSpentAfter) > 0;

  const hasDelegations = delegations.length > 0 || hasPendingDelegations;
  const hasMiners = miners.length > 0 || hasPendingMining;

  const lastWeekTotal =
    Number(data.rewards.delegator.lastWeek) +
    Number(data.rewards.miner.lastWeek);
  const formattedLastWeek = formatGLW(lastWeekTotal.toString());

  const lastWeekDelegator = formatGLW(data.rewards.delegator.lastWeek);
  const lastWeekMiner = formatGLW(data.rewards.miner.lastWeek);

  const totalWeeks = data.weekRange.endWeek - data.weekRange.startWeek + 1;
  const earningsBeforeLastWeek = totalEarnings - lastWeekTotal;
  const avgWeeklyBeforeLastWeek =
    totalWeeks > 1 ? earningsBeforeLastWeek / (totalWeeks - 1) : 0;

  const weekOverWeekChange =
    avgWeeklyBeforeLastWeek > 0
      ? ((lastWeekTotal - avgWeeklyBeforeLastWeek) / avgWeeklyBeforeLastWeek) *
        100
      : 0;

  const calculatePaybackWeeks = (
    invested: string,
    earned: string,
    weeks: number
  ): string => {
    const investedNum = Number(invested);
    const earnedNum = Number(earned);
    if (earnedNum === 0 || weeks === 0) return "∞";
    const avgWeeklyEarnings = earnedNum / weeks;
    const weeksToPayback = investedNum / avgWeeklyEarnings;
    if (weeksToPayback < 0 || !isFinite(weeksToPayback)) return "∞";
    return weeksToPayback.toFixed(1);
  };

  const delegatorPaybackWeeks = calculatePaybackWeeks(
    data.totals.totalGlwDelegated,
    data.rewards.delegator.allWeeks,
    totalWeeks
  );

  const calculatePaybackFromAPY = (apyPercent: string): string => {
    const apy = Number(apyPercent);
    if (apy === 0 || !isFinite(apy)) return "∞";
    const paybackWeeks = (100 / apy) * 52;
    return paybackWeeks.toFixed(1);
  };

  const minerPaybackWeeks = calculatePaybackFromAPY(data.apy.minerApyPercent);

  const calculateTotalPayback = (): string => {
    if (lastWeekTotal === 0) return "∞";
    const totalInvestedInGLW = Number(data.totals.totalGlwDelegated);
    const avgWeeklyEarnings = totalEarnings / totalWeeks;
    if (avgWeeklyEarnings === 0) return "∞";
    const weeksToPayback = totalInvestedInGLW / avgWeeklyEarnings;
    if (weeksToPayback < 0 || !isFinite(weeksToPayback)) return "∞";
    return weeksToPayback.toFixed(1);
  };

  const totalPaybackWeeks = hasDelegations
    ? calculateTotalPayback()
    : minerPaybackWeeks;

  const getPaybackColor = (weeks: string): string => {
    if (weeks === "∞") return "text-muted-foreground";
    const weeksNum = Number(weeks);
    if (weeksNum <= 52) return "text-green-600 dark:text-green-400";
    if (weeksNum <= 104) return "text-orange-500 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getPaybackBadgeClass = (weeks: string): string => {
    if (weeks === "∞")
      return "bg-muted text-muted-foreground border-muted-foreground/20";
    const weeksNum = Number(weeks);
    if (weeksNum <= 52)
      return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-800";
    if (weeksNum <= 104)
      return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border-orange-200 dark:border-orange-800";
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800";
  };

  const getDescription = () => {
    if (hasDelegations && hasMiners) {
      return "Detailed breakdown of your delegations and miners";
    }
    if (hasDelegations) {
      return "Detailed breakdown of your delegations";
    }
    if (hasMiners) {
      return "Detailed breakdown of your miners";
    }
    return "Detailed breakdown of your rewards";
  };

  const getFarmMetadata = (farmId: string) => {
    return purchasedFarms.find((f) => f.farmId === farmId);
  };

  const getRegionName = (farmId: string) => {
    const farm = getFarmMetadata(farmId);
    if (!farm) return null;
    const region = regions.find((r) => r.id === farm.regionId);
    return region?.name || `Region ${farm.regionId}`;
  };

  return (
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-2xl font-bold">
              Miners & Delegations
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {getDescription()}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="default"
            onClick={() => refetch()}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {/* Overview and Total */}
          <div className={`grid gap-4 grid-cols-1 md:grid-cols-2`}>
            {hasDelegations && (
              <Card>
                <CardContent className="p-6 py-2">
                  <div className="text-sm text-muted-foreground mb-3">
                    Delegated
                  </div>
                  <div className="text-4xl font-bold mb-3">
                    {delegatedGLW} GLW
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    across {delegations.length}{" "}
                    {delegations.length === 1 ? "farm" : "farms"}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-muted/30">
              <CardContent className="p-6 py-2">
                <div className="text-sm text-muted-foreground mb-3">
                  Total Earned
                </div>
                <div className="text-4xl font-bold mb-3">
                  {formattedTotalEarnings} GLW
                  {totalEarningsInDollars !== null && (
                    <span className="text-xl text-muted-foreground ml-2">
                      ≈ $
                      {totalEarningsInDollars.toLocaleString("en-US", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-medium">{formattedLastWeek} GLW</span>
                    <span className="text-muted-foreground text-xs">
                      last week
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Week {data.weekRange.startWeek}–{data.weekRange.endWeek}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Delegations */}
          {delegations.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Delegations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {delegations.map((farm, idx) => {
                  const farmMetadata = getFarmMetadata(farm.farmId);
                  const regionName = getRegionName(farm.farmId);
                  const farmName =
                    farmMetadata?.name || `Farm ${farm.farmId.substring(0, 8)}`;
                  const mainImg =
                    farmMetadata?.afterInstallPictures?.[0]?.url ||
                    "/images/sections/residential.jpg";

                  return (
                    <Card
                      key={farm.farmId}
                      className="overflow-hidden cursor-pointer hover:border-foreground/20 transition-colors"
                      onClick={() =>
                        (window.location.href = `https://glow.org/audits/${farm.farmId}`)
                      }
                    >
                      <CardContent className="p-0">
                        <FallbackImage
                          src={mainImg}
                          widthForProxy={800}
                          quality={70}
                          alt={`${farmName} main`}
                          className="w-full h-40 object-cover"
                          loading={idx < 3 ? "eager" : "lazy"}
                          decoding="async"
                          fetchPriority={idx < 3 ? "high" : "auto"}
                        />

                        <div className="p-5 space-y-4">
                          <div>
                            <h3 className="font-semibold text-base mb-1">
                              {farmName}
                            </h3>
                            {regionName && (
                              <p className="text-sm text-muted-foreground">
                                {regionName}
                              </p>
                            )}
                          </div>

                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                Delegated
                              </span>
                              <span className="font-semibold">
                                {formatGLW(farm.amountInvested)} GLW
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                Total Earned
                              </span>
                              <span className="font-semibold">
                                {formatGLW(farm.totalEarnedSoFar)} GLW
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                              <span className="text-xs text-muted-foreground">
                                Last Week
                              </span>
                              <span className="font-medium">
                                {formatGLW(farm.lastWeekRewards)} GLW
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                              <span className="text-xs text-muted-foreground">
                                Current Payback
                              </span>
                              <Badge
                                className={`text-xs font-semibold ${getPaybackBadgeClass(
                                  calculatePaybackWeeks(
                                    farm.amountInvested,
                                    farm.totalEarnedSoFar,
                                    farm.totalWeeksEarned
                                  )
                                )}`}
                              >
                                {calculatePaybackWeeks(
                                  farm.amountInvested,
                                  farm.totalEarnedSoFar,
                                  farm.totalWeeksEarned
                                )}
                                w
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mining */}
          {miners.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Mining</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {miners.map((farm, idx) => {
                  const farmMetadata = getFarmMetadata(farm.farmId);
                  const regionName = getRegionName(farm.farmId);
                  const farmName =
                    farmMetadata?.name || `Farm ${farm.farmId.substring(0, 8)}`;
                  const mainImg =
                    farmMetadata?.afterInstallPictures?.[0]?.url ||
                    "/images/sections/residential.jpg";

                  return (
                    <Card
                      key={farm.farmId}
                      className="overflow-hidden cursor-pointer hover:border-foreground/20 transition-colors"
                      onClick={() =>
                        (window.location.href = `https://glow.org/audits/${farm.farmId}`)
                      }
                    >
                      <CardContent className="p-0">
                        <FallbackImage
                          src={mainImg}
                          widthForProxy={800}
                          quality={70}
                          alt={`${farmName} main`}
                          className="w-full h-40 object-cover"
                          loading={idx < 3 ? "eager" : "lazy"}
                          decoding="async"
                          fetchPriority={idx < 3 ? "high" : "auto"}
                        />

                        <div className="p-5 space-y-4">
                          <div>
                            <h3 className="font-semibold text-base mb-1">
                              {farmName}
                            </h3>
                            {regionName && (
                              <p className="text-sm text-muted-foreground">
                                {regionName}
                              </p>
                            )}
                          </div>

                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                Weeks Remaining
                              </span>
                              <span className="font-semibold">
                                {99 - farm.totalWeeksEarned}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                Total Earned
                              </span>
                              <span className="font-semibold">
                                {formatGLW(farm.totalEarnedSoFar)} GLW
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                              <span className="text-xs text-muted-foreground">
                                Last Week
                              </span>
                              <span className="font-medium">
                                {formatGLW(farm.lastWeekRewards)} GLW
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                              <span className="text-xs text-muted-foreground">
                                Current Payback
                              </span>
                              <Badge
                                className={`text-xs font-semibold ${getPaybackBadgeClass(
                                  calculatePaybackFromAPY(farm.apy)
                                )}`}
                              >
                                {calculatePaybackFromAPY(farm.apy)}w
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
