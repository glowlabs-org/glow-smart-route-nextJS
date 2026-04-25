"use client";

import React from "react";
import { TrendingUp, Users, DollarSign, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { usePoolInfo } from "@/hooks/useLiquidityPositionsOptimized";
import {
  useActiveRegionsSummary,
  useGctlApi,
  useGctlHoldersCount,
} from "@/hooks";
import { useEndowmentLPPosition } from "@/hooks/useEndowmentLPPosition";
import { useTotalActivelyDelegated } from "@/hooks";
import { formatUnits } from "viem";
import { DelegationIcon } from "@/components/impact-icons";
import { useLang } from "@/lib/i18n";

interface EconomyOverviewProps {
  shouldLoad?: boolean;
}

export function EconomyOverview({ shouldLoad = true }: EconomyOverviewProps) {
  const { t } = useLang();
  const s = t.routes.stats;
  const {
    circulatingSupply,
    marketCap,
    isLoading: isCirculatingSupplyLoading,
  } = useGlowCirculatingSupply({ enabled: shouldLoad });

  const { poolReserves, isLoading: isPoolLoading } = usePoolInfo({
    enabled: shouldLoad,
  });

  const {
    gctlPriceNumber,
    gctlCirculatingSupplyNumber,
    glwPriceNumber,
    isGctlPriceLoading,
    isGctlPriceFetching,
    isGctlCirculatingSupplyLoading,
    isGctlCirculatingSupplyFetching,
  } = useGctlApi(undefined, { enabled: shouldLoad });

  const { holdersCount: gctlHoldersCount, isLoading: isGctlHoldersLoading } =
    useGctlHoldersCount({ enabled: shouldLoad });

  const { data: activeSummary, isLoading: isActiveSummaryLoading } =
    useActiveRegionsSummary({ enabled: shouldLoad });

  const {
    endowmentGlw,
    endowmentUsdg,
    endowmentLpBalance,
    isLoading: isEndowmentLoading,
  } = useEndowmentLPPosition({ enabled: shouldLoad });

  // Fetch total actively delegated GLW
  const {
    data: totalActivelyDelegatedData,
    isLoading: isTotalDelegatedLoading,
    isFetching: isTotalDelegatedFetching,
  } = useTotalActivelyDelegated({
    enabled: shouldLoad,
  });

  const totalStakedAcrossRegions = activeSummary?.totalGctlStaked ?? 0;

  // Calculate total actively delegated GLW
  const totalGlwDelegated = React.useMemo(() => {
    if (!totalActivelyDelegatedData?.totalGlwDelegatedWei) return 0;
    return Number(
      formatUnits(BigInt(totalActivelyDelegatedData.totalGlwDelegatedWei), 18),
    );
  }, [totalActivelyDelegatedData]);

  const percentGlwDelegated = React.useMemo(() => {
    if (!circulatingSupply || circulatingSupply === 0) return 0;
    return (totalGlwDelegated / circulatingSupply) * 100;
  }, [totalGlwDelegated, circulatingSupply]);

  const usdcLiquidity = poolReserves.usdg || 0;
  const isGlwDataLoading =
    isCirculatingSupplyLoading || isPoolLoading || isTotalDelegatedLoading;
  const isGctlDataLoading =
    isGctlPriceLoading ||
    isGctlPriceFetching ||
    isGctlCirculatingSupplyLoading ||
    isGctlCirculatingSupplyFetching ||
    isGctlHoldersLoading ||
    isActiveSummaryLoading;

  const gctlMarketCap = gctlCirculatingSupplyNumber * gctlPriceNumber;

  const isInitialLoading =
    (isGlwDataLoading && !circulatingSupply && !totalActivelyDelegatedData) ||
    (isGctlDataLoading && !gctlCirculatingSupplyNumber) ||
    (isEndowmentLoading && endowmentLpBalance === 0 && endowmentUsdg === 0);

  if (!shouldLoad || isInitialLoading) {
    return (
      <div className="grid gap-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
          <Card
            key={index}
            className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40"
          >
            <CardContent className="!p-8">
              <div className="h-4 w-1/2 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-6">
          {s.supplyAndLiquidity}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 !py-0 !gap-0">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  {s.marketCap}
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGlwDataLoading
                  ? "--"
                  : `$${(marketCap / 1_000_000).toFixed(1)}M`}
              </div>
              <div className="text-xs text-muted-foreground">
                {s.circulatingPrefix}{" "}
                {isGlwDataLoading
                  ? "--"
                  : `${circulatingSupply.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} GLW`}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 !py-0 !gap-0">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  {s.pctDelegated}
                </div>
                <DelegationIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGlwDataLoading ? "--" : `${percentGlwDelegated.toFixed(1)}%`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isGlwDataLoading
                  ? "--"
                  : s.activelyDelegatedOf(
                      totalGlwDelegated.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      }),
                      circulatingSupply.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      }),
                    )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 !py-0 !gap-0">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  {s.usdcLiquidityUniswap}
                </div>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGlwDataLoading
                  ? "--"
                  : `$${usdcLiquidity.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isGlwDataLoading
                  ? "--"
                  : s.poolGlw(
                      poolReserves.glw.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      }),
                    )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 !py-0 !gap-0">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  {s.endowmentLiquidity}
                </div>
                <Coins className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isEndowmentLoading
                  ? "--"
                  : endowmentLpBalance === 0
                    ? s.noLpTokens
                    : `${endowmentUsdg.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })} USDC`}
              </div>
              <div className="text-xs text-muted-foreground">
                {s.andGlw(
                  endowmentGlw.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  }),
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-6">
          {s.gctlOverview}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 !py-0 !gap-0">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  {s.numberOfGctl}
                </div>
                <Coins className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGctlDataLoading
                  ? "--"
                  : gctlCirculatingSupplyNumber.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
              </div>
              <div className="text-xs text-muted-foreground">
                {s.mintedToDate}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 !py-0 !gap-0">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  GCTL Market Cap
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGctlDataLoading
                  ? "--"
                  : `$${gctlMarketCap.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`}
              </div>
              <div className="text-xs text-muted-foreground">
                {s.basedOnMint}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 !py-0 !gap-0">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  % of GCTL Staked
                </div>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGctlDataLoading || gctlCirculatingSupplyNumber === 0
                  ? "--"
                  : `${(
                      (totalStakedAcrossRegions / gctlCirculatingSupplyNumber) *
                      100
                    ).toFixed(1)}%`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isGctlDataLoading
                  ? "--"
                  : `${totalStakedAcrossRegions.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} staked / ${gctlCirculatingSupplyNumber.toLocaleString(
                      undefined,
                      {
                        maximumFractionDigits: 0,
                      },
                    )} outstanding`}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 !py-0 !gap-0">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  GCTL Holders
                </div>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGctlDataLoading ? "--" : gctlHoldersCount.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {s.activeParticipants}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Group 3: Yield & Flows */}
      {/* <div>
        <h3 className="text-lg font-semibold mb-4">Yield & Flows</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  Average Delegator APY
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">22.8%</div>
              <div className="text-xs text-muted-foreground">
                Time-weighted, region-weighted
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  Average Miner APY
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">18.5%</div>
              <div className="text-xs text-muted-foreground">
                All active miners
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  GLW/week → Delegators
                </div>
                <Zap className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">120,500</div>
              <div className="text-xs text-muted-foreground">
                68.9% of 175k total
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="!p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  USDC/week → Miners
                </div>
                <Zap className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">54,500</div>
              <div className="text-xs text-muted-foreground">
                31.1% of 175k total
              </div>
            </CardContent>
          </Card>
        </div>
      </div> */}
    </div>
  );
}
