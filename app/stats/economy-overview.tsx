"use client";

import React from "react";
import { TrendingUp, Users, DollarSign, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { usePoolInfo } from "@/hooks/useLiquidityPositionsOptimized";
import { useGctlApi } from "@/hooks/useGctlApi";
import { useGctlHoldersCount } from "@/hooks/useGctlHoldersCount";
import { useActiveRegionsSummary } from "@/hooks/useActiveRegionsSummary";
import { useEndowmentLPPosition } from "@/hooks/useEndowmentLPPosition";
// removed unused heavy price hook and unused helper

interface EconomyOverviewProps {
  shouldLoad?: boolean;
}

export function EconomyOverview({ shouldLoad = true }: EconomyOverviewProps) {
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

  const totalStakedAcrossRegions = activeSummary?.totalGctlStaked ?? 0;
  const totalGlwDelegated = activeSummary?.totalGlwRewards ?? 0;

  const percentGlwDelegated = React.useMemo(() => {
    if (!circulatingSupply || circulatingSupply === 0) return 0;
    return (totalGlwDelegated / circulatingSupply) * 100;
  }, [totalGlwDelegated, circulatingSupply]);

  const usdcLiquidity = poolReserves.usdg || 0;
  const isGlwDataLoading = isCirculatingSupplyLoading || isPoolLoading;
  const isGctlDataLoading =
    isGctlPriceLoading ||
    isGctlPriceFetching ||
    isGctlCirculatingSupplyLoading ||
    isGctlCirculatingSupplyFetching ||
    isGctlHoldersLoading ||
    isActiveSummaryLoading;

  const gctlMarketCap = gctlCirculatingSupplyNumber * gctlPriceNumber;

  const isInitialLoading =
    (isGlwDataLoading && !circulatingSupply) ||
    (isGctlDataLoading && !gctlCirculatingSupplyNumber) ||
    (isEndowmentLoading && endowmentLpBalance === 0 && endowmentUsdg === 0);

  if (!shouldLoad || isInitialLoading) {
    return (
      <div className="grid gap-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="h-4 w-1/2 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Economy Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Macro health, participation, and reward flows
          </p>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">GLW Supply & Liquidity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  GLW Circulating Market Cap
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGlwDataLoading
                  ? "--"
                  : `$${(marketCap / 1_000_000).toFixed(1)}M`}
              </div>
              <div className="text-xs text-muted-foreground">
                Circulating:{" "}
                {isGlwDataLoading
                  ? "--"
                  : `${circulatingSupply.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} GLW`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  % of GLW Delegated
                </div>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGlwDataLoading ? "--" : `${percentGlwDelegated.toFixed(1)}%`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isGlwDataLoading
                  ? "--"
                  : `${totalGlwDelegated.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} delegated / ${circulatingSupply.toLocaleString(
                      undefined,
                      {
                        maximumFractionDigits: 0,
                      }
                    )} circulating`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  USDC Liquidity (Uniswap)
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
                  : `Pool GLW: ${poolReserves.glw.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  Liquidity Provided by Glow Endowment
                </div>
                <Coins className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isEndowmentLoading
                  ? "--"
                  : endowmentLpBalance === 0
                  ? "No LP tokens"
                  : `${endowmentUsdg.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} USDC`}
              </div>
              <div className="text-xs text-muted-foreground">
                and{" "}
                {endowmentGlw.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                GLW
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">
          GCTL Supply & Participation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  Number of GCTL Tokens
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
                Minted to date
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
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
                Based on mint price
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
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
                      }
                    )} outstanding`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  GCTL Holders
                </div>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGctlDataLoading ? "--" : gctlHoldersCount.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                Active participants
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Group 3: Yield & Flows */}
      {/* <div>
        <h3 className="text-lg font-semibold mb-4">Yield & Flows</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
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
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
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
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
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
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
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
