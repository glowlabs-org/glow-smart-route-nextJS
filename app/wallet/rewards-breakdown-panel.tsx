"use client";

import React, { useState } from "react";
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
import { Gift, ChevronRight, ExternalLink } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface RewardsBreakdownPanelProps {
  walletAddress: string | undefined;
}

export function RewardsBreakdownPanel({
  walletAddress,
}: RewardsBreakdownPanelProps) {
  const [selectedFarmForDetails, setSelectedFarmForDetails] = useState<{
    farmId: string;
    farmName: string;
    type: "launchpad" | "mining-center" | "other";
  } | null>(null);

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
  const otherFarms = data.otherFarmsWithRewards?.farms || [];
  const recentPurchases = data.recentPurchasesWithoutRewards || [];

  const pendingFarms = recentPurchases
    .map((purchase) => {
      const farmMetadata = purchasedFarms.find(
        (f) => f.farmId === purchase.farmId
      );
      if (!farmMetadata) return null;
      return {
        ...purchase,
        farmMetadata,
      };
    })
    .filter((f) => f !== null);

  const formatPDRewards = (value: string, asset: string | null): string => {
    try {
      const decimals = asset === "USDG" || asset === "GCTL" ? 1e6 : 1e18;
      const num = Number(value) / decimals;
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return "0.00";
    }
  };

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

  const weeksWithRewards = data.weekRange.weeksWithRewards;

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
    const avgWeeklyEarnings = totalEarnings / weeksWithRewards;
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

  const selectedFarmDetails = selectedFarmForDetails
    ? selectedFarmForDetails.type === "other"
      ? data?.otherFarmsWithRewards.farms.find(
          (f) => f.farmId === selectedFarmForDetails.farmId
        )
      : data?.farmDetails.find(
          (f) =>
            f.farmId === selectedFarmForDetails.farmId &&
            f.type === selectedFarmForDetails.type
        )
    : null;

  return (
    <>
      {/* Weekly Breakdown Dialog */}
      <Dialog
        open={selectedFarmForDetails !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedFarmForDetails(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedFarmForDetails?.farmName}</DialogTitle>
            <DialogDescription>
              Weekly rewards breakdown for this{" "}
              {selectedFarmForDetails?.type === "launchpad"
                ? "delegation"
                : selectedFarmForDetails?.type === "mining-center"
                ? "miner"
                : "farm"}
            </DialogDescription>
          </DialogHeader>

          {selectedFarmDetails?.weeklyBreakdown && (
            <div className="space-y-4">
              <div className="rounded-lg border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Week</th>
                        <th className="text-right p-3 font-medium">
                          Emissions
                        </th>
                        <th className="text-right p-3 font-medium">
                          Protocol Deposit
                        </th>
                        <th className="text-right p-3 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFarmDetails.weeklyBreakdown
                        .slice()
                        .reverse()
                        .map(
                          (week: {
                            weekNumber: number;
                            inflationRewards: string;
                            protocolDepositRewards: string;
                            totalRewards: string;
                          }) => {
                            const isOtherFarm =
                              selectedFarmForDetails?.type === "other";
                            const asset = isOtherFarm
                              ? (selectedFarmDetails as any)?.asset
                              : null;
                            const pdAsset =
                              !asset || asset === "GLW" ? "GLW" : asset;

                            return (
                              <tr
                                key={week.weekNumber}
                                className="border-b last:border-0"
                              >
                                <td className="p-3 font-medium">
                                  {week.weekNumber}
                                </td>
                                <td className="p-3 text-right">
                                  {formatGLW(week.inflationRewards)} GLW
                                </td>
                                <td className="p-3 text-right">
                                  {!asset || asset === "GLW"
                                    ? formatGLW(week.protocolDepositRewards)
                                    : formatPDRewards(
                                        week.protocolDepositRewards,
                                        asset
                                      )}{" "}
                                  {pdAsset}
                                </td>
                                <td className="p-3 text-right font-semibold">
                                  {formatGLW(week.inflationRewards)}{" "}
                                  {Number(week.protocolDepositRewards) > 0 &&
                                    (!asset || asset === "GLW") && (
                                      <>
                                        +{" "}
                                        {formatGLW(week.protocolDepositRewards)}
                                      </>
                                    )}{" "}
                                  GLW
                                  {Number(week.protocolDepositRewards) > 0 &&
                                    asset &&
                                    asset !== "GLW" && (
                                      <span className="text-xs text-muted-foreground ml-1">
                                        +{" "}
                                        {formatPDRewards(
                                          week.protocolDepositRewards,
                                          asset
                                        )}{" "}
                                        {asset}
                                      </span>
                                    )}
                                </td>
                              </tr>
                            );
                          }
                        )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/50 font-semibold">
                        <td className="p-3">Total</td>
                        <td className="p-3 text-right">
                          {formatGLW(selectedFarmDetails.totalInflationRewards)}{" "}
                          GLW
                        </td>
                        <td className="p-3 text-right">
                          {(() => {
                            const isOtherFarm =
                              selectedFarmForDetails?.type === "other";
                            const asset = isOtherFarm
                              ? (selectedFarmDetails as any)?.asset
                              : null;
                            const pdAsset =
                              !asset || asset === "GLW" ? "GLW" : asset;

                            return (
                              <>
                                {!asset || asset === "GLW"
                                  ? formatGLW(
                                      selectedFarmDetails.totalProtocolDepositRewards
                                    )
                                  : formatPDRewards(
                                      selectedFarmDetails.totalProtocolDepositRewards,
                                      asset
                                    )}{" "}
                                {pdAsset}
                              </>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-right">
                          {(() => {
                            const isOtherFarm =
                              selectedFarmForDetails?.type === "other";
                            const asset = isOtherFarm
                              ? (selectedFarmDetails as any)?.asset
                              : null;

                            if (!asset || asset === "GLW") {
                              return (
                                <>
                                  {formatGLW(
                                    (
                                      Number(
                                        selectedFarmDetails.totalInflationRewards
                                      ) +
                                      Number(
                                        selectedFarmDetails.totalProtocolDepositRewards
                                      )
                                    ).toString()
                                  )}{" "}
                                  GLW
                                </>
                              );
                            }

                            return (
                              <>
                                {formatGLW(
                                  selectedFarmDetails.totalInflationRewards
                                )}{" "}
                                GLW
                                {Number(
                                  selectedFarmDetails.totalProtocolDepositRewards
                                ) > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    +{" "}
                                    {formatPDRewards(
                                      selectedFarmDetails.totalProtocolDepositRewards,
                                      asset
                                    )}{" "}
                                    {asset}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              variant="default"
              size="default"
              onClick={() => {
                const claimsPanel = document.getElementById("claims-panel");
                if (claimsPanel) {
                  claimsPanel.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }
              }}
              className="w-full sm:w-auto"
            >
              <Gift className="w-4 h-4 mr-2" />
              Claim Rewards
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
                    Total Earned from Miners and Delegations
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
                      <span className="font-medium">
                        {formattedLastWeek} GLW
                      </span>
                      <span className="text-muted-foreground text-xs">
                        last week
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      over {weeksWithRewards}{" "}
                      {weeksWithRewards === 1 ? "week" : "weeks"}
                    </div>
                  </div>

                  {totalEarnings > 0 && (hasDelegations || hasMiners) && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted">
                        {hasDelegations && (
                          <div
                            className="bg-accent"
                            style={{
                              width: `${
                                (Number(data.rewards.delegator.allWeeks) /
                                  totalEarnings) *
                                100
                              }%`,
                            }}
                          />
                        )}
                        {hasMiners && (
                          <div
                            className="bg-[#fcd0aa]"
                            style={{
                              width: `${
                                (Number(data.rewards.miner.allWeeks) /
                                  totalEarnings) *
                                100
                              }%`,
                            }}
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        {hasDelegations && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-accent" />
                            <span className="text-muted-foreground">
                              Delegations:{" "}
                              <span className="font-medium text-foreground">
                                {(
                                  (Number(data.rewards.delegator.allWeeks) /
                                    totalEarnings) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </span>
                          </div>
                        )}
                        {hasMiners && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#fcd0aa]" />
                            <span className="text-muted-foreground">
                              Mining:{" "}
                              <span className="font-medium text-foreground">
                                {(
                                  (Number(data.rewards.miner.allWeeks) /
                                    totalEarnings) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Delegations */}
            {delegations.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Delegations</h3>
                  <span className="text-sm text-muted-foreground">
                    Total Earned:{" "}
                    <span className="font-semibold text-foreground">
                      {formatGLW(data.rewards.delegator.allWeeks)} GLW
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {delegations.map((farm, idx) => {
                    const farmMetadata = getFarmMetadata(farm.farmId);
                    const regionName = getRegionName(farm.farmId);
                    const farmName =
                      farmMetadata?.name ||
                      `Farm ${farm.farmId.substring(0, 8)}`;
                    const mainImg =
                      farmMetadata?.afterInstallPictures?.[0]?.url ||
                      "/images/sections/residential.jpg";

                    return (
                      <Card key={farm.farmId} className="overflow-hidden">
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
                                  Weeks Remaining
                                </span>
                                <span className="font-semibold">
                                  {100 - farm.totalWeeksEarned}
                                </span>
                              </div>
                              <div className="flex justify-between items-center pb-2 border-b">
                                <span className="text-xs text-muted-foreground">
                                  Last Week
                                </span>
                                <span className="font-medium">
                                  {formatGLW(farm.lastWeekRewards)} GLW
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex h-8 w-full rounded-md overflow-hidden bg-muted">
                                  <div
                                    className="bg-accent flex items-center justify-center"
                                    style={{
                                      width: `${
                                        Number(farm.totalEarnedSoFar) > 0
                                          ? (Number(
                                              farm.totalInflationRewards
                                            ) /
                                              Number(farm.totalEarnedSoFar)) *
                                            100
                                          : 50
                                      }%`,
                                    }}
                                  />
                                  <div
                                    className="bg-[#fcd0aa] flex items-center justify-center"
                                    style={{
                                      width: `${
                                        Number(farm.totalEarnedSoFar) > 0
                                          ? (Number(
                                              farm.totalProtocolDepositRewards
                                            ) /
                                              Number(farm.totalEarnedSoFar)) *
                                            100
                                          : 50
                                      }%`,
                                    }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-accent" />
                                    <span className="text-muted-foreground">
                                      Emissions:{" "}
                                      <span className="font-medium text-foreground">
                                        {formatGLW(farm.totalInflationRewards)}{" "}
                                        GLW
                                      </span>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#fcd0aa]" />
                                    <span className="text-muted-foreground">
                                      PD:{" "}
                                      <span className="font-medium text-foreground">
                                        {formatGLW(
                                          farm.totalProtocolDepositRewards
                                        )}{" "}
                                        GLW
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">
                                  Total Earned
                                </span>
                                <span className="font-semibold">
                                  {formatGLW(farm.totalEarnedSoFar)} GLW
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedFarmForDetails({
                                    farmId: farm.farmId,
                                    farmName,
                                    type: "launchpad",
                                  });
                                }}
                              >
                                See Details
                                <ChevronRight className="w-4 h-4 ml-2" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  window.open(
                                    `https://glow.org/audits/${farm.farmId}`,
                                    "_blank"
                                  );
                                }}
                              >
                                See Audit
                                <ExternalLink className="w-4 h-4 ml-2" />
                              </Button>
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Mining</h3>
                  <span className="text-sm text-muted-foreground">
                    Total Earned:{" "}
                    <span className="font-semibold text-foreground">
                      {formatGLW(data.rewards.miner.allWeeks)} GLW
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {miners.map((farm, idx) => {
                    const farmMetadata = getFarmMetadata(farm.farmId);
                    const regionName = getRegionName(farm.farmId);
                    const farmName =
                      farmMetadata?.name ||
                      `Farm ${farm.farmId.substring(0, 8)}`;
                    const mainImg =
                      farmMetadata?.afterInstallPictures?.[0]?.url ||
                      "/images/sections/residential.jpg";

                    return (
                      <Card key={farm.farmId} className="overflow-hidden">
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
                                  Last Week
                                </span>
                                <span className="font-medium">
                                  {formatGLW(farm.lastWeekRewards)} GLW
                                </span>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t">
                                <span className="text-xs text-muted-foreground">
                                  Total Earned
                                </span>
                                <span className="font-semibold">
                                  {formatGLW(farm.totalEarnedSoFar)} GLW
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedFarmForDetails({
                                    farmId: farm.farmId,
                                    farmName,
                                    type: "mining-center",
                                  });
                                }}
                              >
                                See Details
                                <ChevronRight className="w-4 h-4 ml-2" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  window.open(
                                    `https://glow.org/audits/${farm.farmId}`,
                                    "_blank"
                                  );
                                }}
                              >
                                See Audit
                                <ExternalLink className="w-4 h-4 ml-2" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Other Farms with Rewards */}
            {otherFarms.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Other Rewards</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Farms where you have reward splits (e.g., farm owner
                      rewards)
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Total Earned:</span>
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-foreground">
                          {formatGLW(
                            otherFarms
                              .reduce(
                                (sum, farm) =>
                                  sum + Number(farm.totalInflationRewards),
                                0
                              )
                              .toString()
                          )}{" "}
                          GLW
                        </span>
                        {otherFarms.some(
                          (f) => Number(f.totalProtocolDepositRewards) > 0
                        ) && (
                          <span className="text-xs">
                            + PD in various assets
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {otherFarms.map((farm, idx) => {
                    const farmMetadata = getFarmMetadata(farm.farmId);
                    const regionName = getRegionName(farm.farmId);
                    const farmName =
                      farm.farmName ||
                      farmMetadata?.name ||
                      `Farm ${farm.farmId.substring(0, 8)}`;
                    const mainImg =
                      farmMetadata?.afterInstallPictures?.[0]?.url ||
                      "/images/sections/residential.jpg";

                    return (
                      <Card key={farm.farmId} className="overflow-hidden">
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
                              {farm.weeksLeft !== null && (
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">
                                    Weeks Remaining
                                  </span>
                                  <span className="font-semibold">
                                    {farm.weeksLeft}
                                  </span>
                                </div>
                              )}
                              {farm.asset && (
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">
                                    PD Asset
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="font-medium"
                                  >
                                    {farm.asset}
                                  </Badge>
                                </div>
                              )}
                              <div className="flex justify-between items-center pb-2 border-b">
                                <span className="text-xs text-muted-foreground">
                                  Last Week
                                </span>
                                <span className="font-medium">
                                  {formatGLW(farm.lastWeekRewards)} GLW
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex h-8 w-full rounded-md overflow-hidden bg-muted">
                                  {(() => {
                                    const inflationGLW =
                                      Number(farm.totalInflationRewards) / 1e18;
                                    const pdDecimals =
                                      farm.asset === "USDG" ||
                                      farm.asset === "GCTL"
                                        ? 1e6
                                        : 1e18;
                                    const pdAmount =
                                      Number(farm.totalProtocolDepositRewards) /
                                      pdDecimals;
                                    const total = inflationGLW + pdAmount;
                                    const inflationPercent =
                                      total > 0
                                        ? (inflationGLW / total) * 100
                                        : 50;
                                    const pdPercent =
                                      total > 0 ? (pdAmount / total) * 100 : 50;

                                    return (
                                      <>
                                        <div
                                          className="bg-accent flex items-center justify-center"
                                          style={{
                                            width: `${inflationPercent}%`,
                                          }}
                                        />
                                        <div
                                          className="bg-[#fcd0aa] flex items-center justify-center"
                                          style={{
                                            width: `${pdPercent}%`,
                                          }}
                                        />
                                      </>
                                    );
                                  })()}
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-accent" />
                                    <span className="text-muted-foreground">
                                      Emissions:{" "}
                                      <span className="font-medium text-foreground">
                                        {formatGLW(farm.totalInflationRewards)}{" "}
                                        GLW
                                      </span>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#fcd0aa]" />
                                    <span className="text-muted-foreground">
                                      PD:{" "}
                                      <span className="font-medium text-foreground">
                                        {formatPDRewards(
                                          farm.totalProtocolDepositRewards,
                                          farm.asset
                                        )}{" "}
                                        {farm.asset || "GLW"}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t">
                                <span className="text-xs text-muted-foreground">
                                  Total Earned on V2
                                </span>
                                <div className="flex flex-col items-end gap-1">
                                  {!farm.asset || farm.asset === "GLW" ? (
                                    <span className="font-semibold">
                                      {formatGLW(
                                        (
                                          Number(farm.totalInflationRewards) +
                                          Number(
                                            farm.totalProtocolDepositRewards
                                          )
                                        ).toString()
                                      )}{" "}
                                      GLW
                                    </span>
                                  ) : (
                                    <>
                                      <span className="font-semibold">
                                        {formatGLW(farm.totalInflationRewards)}{" "}
                                        GLW
                                      </span>
                                      {Number(
                                        farm.totalProtocolDepositRewards
                                      ) > 0 && (
                                        <span className="text-xs font-medium text-muted-foreground">
                                          +{" "}
                                          {formatPDRewards(
                                            farm.totalProtocolDepositRewards,
                                            farm.asset
                                          )}{" "}
                                          {farm.asset}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setSelectedFarmForDetails({
                                  farmId: farm.farmId,
                                  farmName:
                                    farm.farmName ||
                                    `Farm ${farm.farmId.substring(0, 8)}`,
                                  type: "other",
                                });
                              }}
                            >
                              See Details
                              <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                window.open(
                                  `https://glow.org/audits/${farm.farmId}`,
                                  "_blank"
                                );
                              }}
                            >
                              See Audit
                              <ExternalLink className="w-4 h-4 ml-2" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending Rewards */}
            {pendingFarms.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Pending Rewards</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Recent purchases that will start earning rewards in
                      upcoming weeks
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {pendingFarms.map((pending, idx) => {
                    const regionName = getRegionName(pending.farmId);
                    const farmName =
                      pending.farmMetadata.name ||
                      `Farm ${pending.farmId.substring(0, 8)}`;
                    const mainImg =
                      pending.farmMetadata.afterInstallPictures?.[0]?.url ||
                      "/images/sections/residential.jpg";

                    const estimatedWeeklyReward =
                      pending.farmMetadata.userWeeklyRewards
                        ?.glwInflationRewards || "0";
                    const estimatedWeeklyPD =
                      pending.farmMetadata.userWeeklyRewards
                        ?.protocolDepositRewards || "0";
                    const weeklyRewardFormatted = formatGLW(
                      estimatedWeeklyReward
                    );
                    const weeklyPDFormatted = formatGLW(estimatedWeeklyPD);

                    return (
                      <Card
                        key={`${pending.farmId}-${pending.types.join("-")}`}
                        className="overflow-hidden"
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
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-base">
                                  {farmName}
                                </h3>
                                <Badge variant="secondary" className="text-xs">
                                  Pending
                                </Badge>
                              </div>
                              {regionName && (
                                <p className="text-sm text-muted-foreground">
                                  {regionName}
                                </p>
                              )}
                            </div>

                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">
                                  Type
                                </span>
                                <div className="flex gap-1">
                                  {pending.types.map((type) => (
                                    <Badge
                                      key={type}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {type === "launchpad"
                                        ? "Delegation"
                                        : "Mining"}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2 pt-2 border-t">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">
                                    Est. Weekly Emissions
                                  </span>
                                  <span className="font-medium">
                                    {weeklyRewardFormatted} GLW
                                  </span>
                                </div>
                                {Number(estimatedWeeklyPD) > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">
                                      Est. Weekly PD
                                    </span>
                                    <span className="font-medium">
                                      {weeklyPDFormatted} GLW
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t">
                                  <span className="text-xs text-muted-foreground font-semibold">
                                    Est. Total Weekly
                                  </span>
                                  <span className="font-semibold">
                                    {formatGLW(
                                      (
                                        Number(estimatedWeeklyReward) +
                                        Number(estimatedWeeklyPD)
                                      ).toString()
                                    )}{" "}
                                    GLW
                                  </span>
                                </div>
                              </div>
                              <div className="rounded-lg bg-muted/50 p-3 mt-3">
                                <p className="text-xs text-muted-foreground text-center">
                                  Will start earning in the next completed week
                                </p>
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-4"
                              onClick={() => {
                                window.open(
                                  `https://glow.org/audits/${pending.farmId}`,
                                  "_blank"
                                );
                              }}
                            >
                              See Audit
                              <ExternalLink className="w-4 h-4 ml-2" />
                            </Button>
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
    </>
  );
}
