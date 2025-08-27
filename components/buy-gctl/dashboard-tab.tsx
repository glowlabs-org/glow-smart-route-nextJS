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
  Activity,
} from "lucide-react";
import { formatUnits } from "viem";
import { useGctlApi } from "@/hooks/useGctlApi";
import {
  MintedEvent,
  PendingTransfer,
  Region,
} from "@glowlabs-org/utils/browser";

interface DashboardTabProps {
  walletAddress?: string;
  mintedEvents: MintedEvent[];
  regions: Region[];
  pendingTransfers: PendingTransfer[];
  isMintedEventsLoading: boolean;
  isStakedEventsLoading: boolean;
  isRegionsLoading: boolean;
  isPendingTransfersLoading: boolean;
}

export function DashboardTab({
  walletAddress,
  mintedEvents,
  regions,
  pendingTransfers,
  isMintedEventsLoading,
  isStakedEventsLoading,
  isRegionsLoading,
  isPendingTransfersLoading,
}: DashboardTabProps) {
  const { isGctlPriceLoading } = useGctlApi(walletAddress);

  // Calculate metrics
  const metrics = useMemo(() => {
    // Supply & Stake Overview
    const totalGctlMinted = mintedEvents.reduce((sum, event) => {
      return sum + parseFloat(formatUnits(BigInt(event.gctlMinted), 6));
    }, 0);

    const totalGctlStaked = regions.reduce((sum, region) => {
      return (
        //TODO: fix this
        sum + parseFloat(formatUnits(BigInt("0"), 6))
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
          //TODO: fix this
          formatUnits(BigInt("0"), 6)
        ),
        stakePercentage:
          totalGctlStaked > 0
            ? (parseFloat(
                //TODO: fix this
                formatUnits(BigInt("0"), 6)
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
    <div className="bg-card/60 backdrop-blur-xl rounded-3xl border border-border overflow-hidden w-full">
      <div className="p-6 pb-4 border-b border-border/20">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Network Dashboard
          </h2>
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Activity className="w-3 h-3" />
            Real-time metrics
          </span>
        </div>
      </div>

      <div className="p-6 space-y-8">
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
            <div className="group relative bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-2xl p-4 border border-green-500/20 hover:border-green-500/30 transition-all duration-300">
              <div className="text-center">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Total GCTL Minted
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-32 mx-auto bg-muted/50" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {formatLargeNumber(metrics.totalGctlMinted)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">GCTL</div>
              </div>
            </div>

            {/* Total GCTL Staked */}
            <div className="group relative bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-2xl p-4 border border-blue-500/20 hover:border-blue-500/30 transition-all duration-300">
              <div className="text-center">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Total GCTL Staked
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-32 mx-auto bg-muted/50" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {formatLargeNumber(metrics.totalGctlStaked)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">GCTL</div>
              </div>
            </div>

            {/* Staking Rate */}
            <div className="group relative bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-2xl p-4 border border-purple-500/20 hover:border-purple-500/30 transition-all duration-300">
              <div className="text-center">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Staking Rate
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-32 mx-auto bg-muted/50" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {metrics.stakingRate.toFixed(2)}%
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  of supply
                </div>
              </div>
            </div>

            {/* Unique Holders */}
            <div className="group relative bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-2xl p-4 border border-orange-500/20 hover:border-orange-500/30 transition-all duration-300">
              <div className="text-center">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Unique Holders
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-32 mx-auto bg-muted/50" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {metrics.uniqueHolders.toLocaleString()}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  addresses
                </div>
              </div>
            </div>
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
                <div
                  key={region.id}
                  className="group bg-muted/30 rounded-2xl p-4 border border-border hover:border-border/60 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
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
                    <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primary to-primary/70 rounded-full h-2 transition-all duration-300"
                        style={{
                          width: `${Math.min(region.stakePercentage, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
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
            <div className="group bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 rounded-2xl p-6 border border-indigo-500/20 hover:border-indigo-500/30 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-muted-foreground">
                  USDC from GCTL Purchases
                </div>
                <TrendingUp className="w-5 h-5 text-indigo-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-40 bg-muted/50" />
              ) : (
                <div className="text-3xl font-bold text-foreground">
                  ${formatLargeNumber(metrics.totalUsdcReceived)}
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-2">
                From {mintedEvents.filter((e) => e.currency === "USDC").length}{" "}
                transactions
              </div>
            </div>

            {/* Transaction Volume */}
            <div className="group bg-gradient-to-br from-teal-500/10 to-teal-500/5 rounded-2xl p-6 border border-teal-500/20 hover:border-teal-500/30 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Transactions
                </div>
                <PieChart className="w-5 h-5 text-teal-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-40 bg-muted/50" />
              ) : (
                <div className="text-3xl font-bold text-foreground">
                  {mintedEvents.length.toLocaleString()}
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-2">
                GCTL minting events
              </div>
            </div>
          </div>

          {/* Protocol Fees Section */}
          <div className="grid grid-cols-1 gap-4">
            {/* Protocol Fees Paid */}
            <div className="group bg-gradient-to-br from-violet-500/10 to-violet-500/5 rounded-2xl p-6 border border-violet-500/20 hover:border-violet-500/30 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Protocol Deposits Paid
                </div>
                <Coins className="w-5 h-5 text-violet-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-40 bg-muted/50" />
              ) : (
                <div className="text-3xl font-bold text-foreground">
                  ${formatLargeNumber(metrics.totalProtocolFeesPaid)}
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-2">
                From{" "}
                {
                  pendingTransfers.filter((t) => t.type === "PayProtocolFee")
                    .length
                }{" "}
                protocol fee payments
              </div>
            </div>
          </div>
        </div>

        {/* Network Health Indicators */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border border-primary/20">
          <div className="p-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="space-y-3 flex-1">
                <h4 className="font-bold text-foreground text-lg">
                  Network Health
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-background/40 backdrop-blur-sm rounded-xl border border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">
                      Active Regions
                    </div>
                    <div className="text-xl font-bold text-foreground">
                      {/* TODO: fix this */}
                      {regions.length}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-background/40 backdrop-blur-sm rounded-xl border border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">
                      Avg. Stake per Region
                    </div>
                    <div className="text-xl font-bold text-foreground">
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
          </div>
        </div>
      </div>
    </div>
  );
}
