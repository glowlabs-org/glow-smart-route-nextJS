"use client";
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Users,
  DollarSign,
  MapPin,
  Coins,
  BarChart3,
  PieChart,
} from "lucide-react";
import { formatUnits } from "viem";
import { useGctlApi } from "@/hooks/useGctlApi";

interface DashboardTabProps {
  walletAddress?: string;
}

export function DashboardTab({ walletAddress }: DashboardTabProps) {
  const {
    mintedEvents,
    stakedEvents,
    regions,
    pendingTransfers,
    gctlPrice,
    isMintedEventsLoading,
    isStakedEventsLoading,
    isRegionsLoading,
    isPendingTransfersLoading,
    isGctlPriceLoading,
  } = useGctlApi(walletAddress);

  // Calculate metrics
  const metrics = useMemo(() => {
    // Supply & Stake Overview
    const totalGctlMinted = mintedEvents.reduce((sum, event) => {
      return sum + parseFloat(formatUnits(BigInt(event.gctlMinted), 6));
    }, 0);

    const totalGctlStaked = regions.reduce((sum, region) => {
      return (
        sum + parseFloat(formatUnits(BigInt(region.currentGctlStake || "0"), 6))
      );
    }, 0);

    const uniqueHolders = new Set(
      mintedEvents.map((event) => event.wallet.toLowerCase())
    ).size;

    // Capital Flows
    const totalUsdcReceived = mintedEvents
      .filter((event) => event.currency === "USDC")
      .reduce((sum, event) => {
        return sum + parseFloat(formatUnits(BigInt(event.amountRaw), 6));
      }, 0);

    // Protocol Fees Paid
    const totalProtocolFeesPaid = pendingTransfers
      .filter((transfer) => transfer.type === "PayProtocolFee")
      .reduce((sum, transfer) => {
        return sum + parseFloat(formatUnits(BigInt(transfer.amountRaw), 6));
      }, 0);

    // Region breakdown
    const regionBreakdown = regions
      .map((region) => ({
        ...region,
        stakeAmount: parseFloat(
          formatUnits(BigInt(region.currentGctlStake || "0"), 6)
        ),
        stakePercentage:
          totalGctlStaked > 0
            ? (parseFloat(
                formatUnits(BigInt(region.currentGctlStake || "0"), 6)
              ) /
                totalGctlStaked) *
              100
            : 0,
      }))
      .filter((region) => region.stakeAmount > 0)
      .sort((a, b) => b.stakeAmount - a.stakeAmount);

    return {
      totalGctlMinted,
      totalGctlStaked,
      uniqueHolders,
      totalUsdcReceived,
      totalProtocolFeesPaid,
      regionBreakdown,
      stakingRate:
        totalGctlMinted > 0 ? (totalGctlStaked / totalGctlMinted) * 100 : 0,
    };
  }, [mintedEvents, regions, pendingTransfers]);

  const isLoading =
    isMintedEventsLoading ||
    isStakedEventsLoading ||
    isRegionsLoading ||
    isPendingTransfersLoading ||
    isGctlPriceLoading;

  const formatLargeNumber = (value: number, decimals: number = 2): string => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(decimals)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(decimals)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(decimals)}K`;
    return value.toFixed(decimals);
  };

  return (
    <Card className="border border-border bg-white/95 backdrop-blur-sm w-full">
      <CardHeader className="pb-6 border-b border-border/50">
        <CardTitle className="text-2xl font-bold text-foreground flex items-center">
          Network Dashboard
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            Real-time GCTL network metrics
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-8">
        {/* Supply & Stake Overview */}
        <div className="space-y-6">
          <div className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              Supply & Stake Overview
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total GCTL Minted */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-green-200">
              <CardContent className="p-4 text-center">
                <div className="text-sm font-medium text-green-700 mb-2">
                  Total GCTL Minted
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-32 mx-auto" />
                ) : (
                  <div className="text-2xl font-bold text-green-900">
                    {formatLargeNumber(metrics.totalGctlMinted)}
                  </div>
                )}
                <div className="text-xs text-green-600 mt-1">GCTL</div>
              </CardContent>
            </Card>

            {/* Total GCTL Staked */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4 text-center">
                <div className="text-sm font-medium text-blue-700 mb-2">
                  Total GCTL Staked
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-32 mx-auto" />
                ) : (
                  <div className="text-2xl font-bold text-blue-900">
                    {formatLargeNumber(metrics.totalGctlStaked)}
                  </div>
                )}
                <div className="text-xs text-blue-600 mt-1">GCTL</div>
              </CardContent>
            </Card>

            {/* Staking Rate */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-4 text-center">
                <div className="text-sm font-medium text-purple-700 mb-2">
                  Staking Rate
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-32 mx-auto" />
                ) : (
                  <div className="text-2xl font-bold text-purple-900">
                    {metrics.stakingRate.toFixed(2)}%
                  </div>
                )}
                <div className="text-xs text-purple-600 mt-1">of supply</div>
              </CardContent>
            </Card>

            {/* Unique Holders */}
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-4 text-center">
                <div className="text-sm font-medium text-orange-700 mb-2">
                  Unique Holders
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-32 mx-auto" />
                ) : (
                  <div className="text-2xl font-bold text-orange-900">
                    {metrics.uniqueHolders.toLocaleString()}
                  </div>
                )}
                <div className="text-xs text-orange-600 mt-1">addresses</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Regional Staking Breakdown */}
        {metrics.regionBreakdown.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">
                Regional Staking Distribution
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.regionBreakdown.slice(0, 6).map((region) => (
                <Card key={region.id} className="border-muted">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{region.flag}</span>
                        <div>
                          <div className="font-semibold text-foreground">
                            {region.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {region.stakePercentage.toFixed(1)}% of total stake
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Staked Amount
                        </span>
                        <span className="font-semibold">
                          {formatLargeNumber(region.stakeAmount)} GCTL
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all duration-300"
                          style={{
                            width: `${Math.min(region.stakePercentage, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Capital Flows */}
        <div className="space-y-6">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              Capital Flows
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total USDC Received */}
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-indigo-700">
                    USDC from GCTL Purchases
                  </div>
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                </div>
                {isLoading ? (
                  <Skeleton className="h-10 w-40" />
                ) : (
                  <div className="text-3xl font-bold text-indigo-900">
                    ${formatLargeNumber(metrics.totalUsdcReceived)}
                  </div>
                )}
                <div className="text-sm text-indigo-600 mt-2">
                  From{" "}
                  {mintedEvents.filter((e) => e.currency === "USDC").length}{" "}
                  transactions
                </div>
              </CardContent>
            </Card>

            {/* Transaction Volume */}
            <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-teal-700">
                    Total Transactions
                  </div>
                  <PieChart className="w-5 h-5 text-teal-600" />
                </div>
                {isLoading ? (
                  <Skeleton className="h-10 w-40" />
                ) : (
                  <div className="text-3xl font-bold text-teal-900">
                    {mintedEvents.length.toLocaleString()}
                  </div>
                )}
                <div className="text-sm text-teal-600 mt-2">
                  GCTL minting events
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Protocol Fees Section */}
          <div className="grid grid-cols-1 gap-4">
            {/* Protocol Fees Paid */}
            <Card className="bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-violet-700">
                    Protocol Deposits Paid
                  </div>
                  <Coins className="w-5 h-5 text-violet-600" />
                </div>
                {isLoading ? (
                  <Skeleton className="h-10 w-40" />
                ) : (
                  <div className="text-3xl font-bold text-violet-900">
                    ${formatLargeNumber(metrics.totalProtocolFeesPaid)}
                  </div>
                )}
                <div className="text-sm text-violet-600 mt-2">
                  From{" "}
                  {
                    pendingTransfers.filter((t) => t.type === "PayProtocolFee")
                      .length
                  }{" "}
                  protocol fee payments
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Network Health Indicators */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div className="space-y-3">
                <h4 className="font-bold text-blue-900 text-lg">
                  Network Health
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-blue-800">
                  <div className="text-center p-3 bg-white/50 rounded-lg">
                    <div className="text-xs text-blue-600 mb-1">
                      Active Regions
                    </div>
                    <div className="text-xl font-bold">
                      {regions.filter((r) => r.isActive).length}
                    </div>
                  </div>
                  {/* <div className="text-center p-3 bg-white/50 rounded-lg">
                    <div className="text-xs text-blue-600 mb-1">
                      Total Solar Farms
                    </div>
                    <div className="text-xl font-bold">
                      {regions.reduce(
                        (sum, r) => sum + (r.solarFarmCount || 0),
                        0
                      )}
                    </div>
                  </div> */}
                  <div className="text-center p-3 bg-white/50 rounded-lg">
                    <div className="text-xs text-blue-600 mb-1">
                      Avg. Stake per Region
                    </div>
                    <div className="text-xl font-bold">
                      {regions.length > 0
                        ? formatLargeNumber(
                            metrics.totalGctlStaked / regions.length
                          )
                        : "0"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
