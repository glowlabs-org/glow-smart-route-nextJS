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
  Rocket,
  Target,
  CheckCircle2,
} from "lucide-react";
import { formatUnits } from "viem";
import { useGctlApi } from "@/hooks/useGctlApi";
import { useKickstarters } from "@/hooks/useKickstarters";
import {
  DECIMALS_BY_TOKEN,
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
  const { kickstarters, isKickstartersLoading } = useKickstarters();

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

    // Capital Flows - breakdown by currency
    const purchasesByCurrency = mintedEvents.reduce((acc, event) => {
      const currency = event.currency;
      const decimals =
        DECIMALS_BY_TOKEN[currency as keyof typeof DECIMALS_BY_TOKEN] || 18;
      const amount = parseFloat(formatUnits(BigInt(event.amountRaw), decimals));

      if (!acc[currency]) {
        acc[currency] = 0;
      }
      acc[currency] += amount;

      return acc;
    }, {} as Record<string, number>);

    // Protocol Fees Paid - breakdown by currency
    const protocolFeesByCurrency = pendingTransfers
      .filter((transfer) => transfer.type === "PayProtocolFee")
      .reduce((acc, transfer) => {
        const currency = transfer.currency;
        const amount = parseFloat(
          formatUnits(
            BigInt(transfer.amountRaw),
            DECIMALS_BY_TOKEN[currency as keyof typeof DECIMALS_BY_TOKEN] || 18
          )
        );

        if (!acc[currency]) {
          acc[currency] = 0;
        }
        acc[currency] += amount;

        return acc;
      }, {} as Record<string, number>);

    // Region breakdown - using staked data from RegionWithMetadata
    const regionBreakdown = regions
      .map((region) => {
        const stakeAmount = parseFloat(
          formatUnits(BigInt(region.staked || "0"), 6)
        );
        return {
          ...region,
          stakeAmount,
          stakePercentage:
            totalGctlStaked > 0 ? (stakeAmount / totalGctlStaked) * 100 : 0,
        };
      })
      .filter((region) => region.stakeAmount > 0)
      .sort((a, b) => b.stakeAmount - a.stakeAmount);

    // Kickstarter metrics
    const kickstarterMetrics = {
      total: kickstarters.length,
      active: kickstarters.filter((k) => k.status === "collecting-support")
        .length,
      completed: kickstarters.filter((k) => k.status === "completed").length,
      totalStakeTarget: kickstarters.reduce((sum, k) => {
        return sum + parseFloat(formatUnits(BigInt(k.stakeTargetGctl), 6));
      }, 0),
    };

    return {
      totalGctlMinted,
      totalGctlStaked,
      uniqueHolders,
      purchasesByCurrency,
      protocolFeesByCurrency,
      regionBreakdown,
      kickstarterMetrics,
      stakingRate:
        totalGctlMinted > 0 ? (totalGctlStaked / totalGctlMinted) * 100 : 0,
    };
  }, [mintedEvents, stakeEvents, regions, pendingTransfers, kickstarters]);

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
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Regional Staking Distribution
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="w-4 h-4" />
                <span>
                  Avg:{" "}
                  {isLoading ? (
                    <Skeleton className="inline-block h-4 w-16 bg-muted/50" />
                  ) : (
                    <span className="font-semibold text-foreground">
                      {regions.length > 0
                        ? formatLargeNumber(
                            metrics.totalGctlStaked / regions.length
                          )
                        : "0"}{" "}
                      GCTL
                    </span>
                  )}
                </span>
              </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Purchases by Currency */}
            <div className="bg-muted/30 rounded-2xl p-6 border border-border hover:border-border/60 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-muted-foreground">
                  USDC from GCTL Minting
                </div>
                <TrendingUp className="w-5 h-5 text-indigo-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-40 bg-muted/50" />
              ) : (
                <div className="space-y-2">
                  {Object.entries(metrics.purchasesByCurrency).length > 0 ? (
                    Object.entries(metrics.purchasesByCurrency).map(
                      ([currency, amount]) => (
                        <div
                          key={currency}
                          className="flex items-baseline justify-between"
                        >
                          <span className="text-2xl font-bold text-foreground">
                            {formatLargeNumber(amount)}
                          </span>
                          <span className="text-lg font-semibold text-muted-foreground ml-2">
                            {currency}
                          </span>
                        </div>
                      )
                    )
                  ) : (
                    <div className="text-3xl font-bold text-foreground">0</div>
                  )}
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-2">
                From {mintedEvents.length} transactions
              </div>
            </div>

            {/* Protocol Deposits Paid */}
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
                <div className="space-y-2">
                  {Object.entries(metrics.protocolFeesByCurrency).length > 0 ? (
                    Object.entries(metrics.protocolFeesByCurrency).map(
                      ([currency, amount]) => (
                        <div
                          key={currency}
                          className="flex items-baseline justify-between"
                        >
                          <span className="text-2xl font-bold text-foreground">
                            {formatLargeNumber(amount)}
                          </span>
                          <span className="text-lg font-semibold text-muted-foreground ml-2">
                            {currency}
                          </span>
                        </div>
                      )
                    )
                  ) : (
                    <div className="text-3xl font-bold text-foreground">0</div>
                  )}
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

        {/* Kickstarter Overview */}
        {kickstarters.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Region Kickstarters</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Kickstarters */}
              <div className="bg-muted/30 rounded-2xl p-6 border border-border hover:border-border/60 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Total Kickstarters
                  </div>
                  <Rocket className="w-5 h-5 text-orange-500" />
                </div>
                {isKickstartersLoading ? (
                  <Skeleton className="h-10 w-20 bg-muted/50" />
                ) : (
                  <div className="text-3xl font-bold text-foreground">
                    {metrics.kickstarterMetrics.total}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-2">
                  Region campaigns
                </div>
              </div>

              {/* Active Kickstarters */}
              <div className="bg-muted/30 rounded-2xl p-6 border border-border hover:border-border/60 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Active Campaigns
                  </div>
                  <Target className="w-5 h-5 text-blue-500" />
                </div>
                {isKickstartersLoading ? (
                  <Skeleton className="h-10 w-20 bg-muted/50" />
                ) : (
                  <div className="text-3xl font-bold text-foreground">
                    {metrics.kickstarterMetrics.active}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-2">
                  Collecting support
                </div>
              </div>

              {/* Completed Kickstarters */}
              <div className="bg-muted/30 rounded-2xl p-6 border border-border hover:border-border/60 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Completed
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                {isKickstartersLoading ? (
                  <Skeleton className="h-10 w-20 bg-muted/50" />
                ) : (
                  <div className="text-3xl font-bold text-foreground">
                    {metrics.kickstarterMetrics.completed}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-2">
                  Successful regions
                </div>
              </div>
            </div>

            {/* Active Kickstarters List */}
            {metrics.kickstarterMetrics.active > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {kickstarters
                  .filter((k) => k.status === "collecting-support")
                  .slice(0, 4)
                  .map((kickstarter) => (
                    <div
                      key={kickstarter.id}
                      className="bg-muted/30 rounded-2xl p-4 border border-border hover:border-border/60 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-foreground mb-1">
                            {kickstarter.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {kickstarter.code}
                          </div>
                        </div>
                        <Rocket className="w-4 h-4 text-orange-500 flex-shrink-0 mt-1" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Stake Target
                          </span>
                          <span className="font-semibold">
                            {formatLargeNumber(
                              parseFloat(
                                formatUnits(
                                  BigInt(kickstarter.stakeTargetGctl),
                                  6
                                )
                              )
                            )}{" "}
                            GCTL
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Required Farms
                          </span>
                          <span className="font-semibold">
                            {kickstarter.requiredFarmCount}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Status</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            Active
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
