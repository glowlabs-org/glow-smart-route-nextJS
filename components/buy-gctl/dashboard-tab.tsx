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
  RegionWithMetadata,
  StakedEvent,
} from "@glowlabs-org/utils/browser";

interface DashboardTabProps {
  walletAddress?: string;
  mintedEvents: MintedEvent[];
  stakeEvents: StakedEvent[];
  regions: RegionWithMetadata[];
  pendingTransfers: PendingTransfer[];
  isMintedEventsLoading: boolean;
  isStakedEventsLoading: boolean;
  isRegionsLoading: boolean;
  isPendingTransfersLoading: boolean;
}

export function DashboardTab({
  walletAddress,
  mintedEvents,
  stakeEvents,
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

    const totalGctlStaked = stakeEvents
      .filter((event) => event.direction === "stake")
      .reduce((sum, event) => {
        return sum + parseFloat(formatUnits(BigInt(event.amount), 6));
      }, 0);

    const uniqueHolders = new Set(
      mintedEvents.map((event) => event.wallet.toLowerCase())
    ).size;

    // Capital Flows
    const totalUsdcReceived = mintedEvents
      .filter((event) => event.currency === "USDG")
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
    <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden w-full">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Network Dashboard</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time network metrics and analytics
            </p>
          </div>
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Live
          </span>
        </div>
      </div>

      <div className="p-6 pt-0 space-y-8">
        {/* Supply & Stake Overview */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Supply & Stake Overview</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total GCTL Minted */}
            <div className="bg-muted/30 rounded-2xl border border-border p-4 hover:border-border/60 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Total GCTL Minted
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-40 bg-muted/50" />
              ) : (
                <div className="text-3xl font-bold text-foreground">
                  {formatLargeNumber(metrics.totalGctlMinted)}
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-2">
                GCTL tokens
              </div>
            </div>

            {/* Total GCTL Staked */}
            <div className="bg-muted/30 rounded-2xl border border-border p-4 hover:border-border/60 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Total GCTL Staked
                </div>
                <Coins className="w-5 h-5 text-blue-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-40 bg-muted/50" />
              ) : (
                <div className="text-3xl font-bold text-foreground">
                  {formatLargeNumber(metrics.totalGctlStaked)}
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-2">
                GCTL staked
              </div>
            </div>

            {/* Staking Rate */}
            <div className="bg-muted/30 rounded-2xl border border-border p-4 hover:border-border/60 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Staking Rate
                </div>
                <PieChart className="w-5 h-5 text-purple-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-40 bg-muted/50" />
              ) : (
                <div className="text-3xl font-bold text-foreground">
                  {metrics.stakingRate.toFixed(2)}%
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-2">
                of supply
              </div>
            </div>

            {/* Unique Holders */}
            <div className="bg-muted/30 rounded-2xl border border-border p-4 hover:border-border/60 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Unique Holders
                </div>
                <Users className="w-5 h-5 text-orange-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-40 bg-muted/50" />
              ) : (
                <div className="text-3xl font-bold text-foreground">
                  {metrics.uniqueHolders.toLocaleString()}
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-2">
                addresses
              </div>
            </div>
          </div>
        </div>

        {/* Regional Staking Breakdown */}
        {metrics.regionBreakdown.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">
                Regional Staking Distribution
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.regionBreakdown.slice(0, 6).map((region) => (
                <div
                  key={region.id}
                  className="bg-muted/30 rounded-2xl p-4 border border-border hover:border-border/60 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-primary" />
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
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Capital Flows</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total USDC Received */}
            <div className="bg-muted/30 rounded-2xl p-6 border border-border hover:border-border/60 transition-all duration-300">
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
            <div className="bg-muted/30 rounded-2xl p-6 border border-border hover:border-border/60 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Transactions
                </div>
                <BarChart3 className="w-5 h-5 text-teal-500" />
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

            <div className="bg-muted/30 rounded-2xl p-6 border border-border hover:border-border/60 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Protocol Deposits Paid
                </div>
                <DollarSign className="w-5 h-5 text-violet-500" />
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
        <div className="bg-muted/30 rounded-2xl border border-border">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold">Network Health</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-background/40 backdrop-blur-sm rounded-xl border border-border/50 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Active Regions
                  </div>
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 bg-muted/50" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {regions.filter((r) => r.isActive).length}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-2">
                  regions
                </div>
              </div>
              <div className="bg-background/40 backdrop-blur-sm rounded-xl border border-border/50 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Avg. Stake per Region
                  </div>
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 bg-muted/50" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {regions.length > 0
                      ? formatLargeNumber(
                          metrics.totalGctlStaked / regions.length
                        )
                      : "0"}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-2">
                  GCTL avg
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
