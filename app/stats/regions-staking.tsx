"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveRegionsSummary } from "@/hooks";
import { useToast } from "@/hooks/use-toast";
import { useCompletedFarms } from "@/hooks/useCompletedFarms";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { formatUnits } from "viem";

interface RegionData {
  id: string | number;
  name: string;
  slug: string;
  isUs: boolean;
  glwPerWeek: number;
  stakedGctl: number;
  churnEpoch: number;
  totalProtocolDepositsUsd: number;
  solarFarmCount: number;
  history: Array<{
    timestamp: number;
    gctlStaked: number;
  }>;
}

interface RegionsStakingProps {
  shouldLoad?: boolean;
}

export function RegionsStaking({ shouldLoad = true }: RegionsStakingProps) {
  const { toast } = useToast();
  const {
    data: activeSummary,
    isLoading,
    isFetching,
    isError,
  } = useActiveRegionsSummary({ enabled: shouldLoad });

  const { farms: completedFarms, isLoading: isCompletedLoading } =
    useCompletedFarms({ enabled: shouldLoad });
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();

  const totalStakedGctl = activeSummary?.totalGctlStaked ?? 0;
  const baseRegions = activeSummary?.regions ?? [];

  const pdsByRegionId = React.useMemo(() => {
    const map = new Map<number, number>();
    if (!completedFarms || completedFarms.length === 0) return map;

    for (const farm of completedFarms) {
      const regionId = farm.zone?.id;
      if (!regionId) continue;

      const currency = farm.paymentCurrency;
      const amount = farm.paymentAmount;
      if (!amount) continue;

      try {
        const decimals =
          DECIMALS_BY_TOKEN[currency as keyof typeof DECIMALS_BY_TOKEN] ?? 6;
        const numericAmount = parseFloat(formatUnits(BigInt(amount), decimals));

        let usdValue = numericAmount;
        if (currency === "GLW" && glwSpotPrice > 0) {
          usdValue = numericAmount * glwSpotPrice;
        }

        map.set(regionId, (map.get(regionId) ?? 0) + usdValue);
      } catch {
        // skip invalid amounts
      }
    }

    return map;
  }, [completedFarms, glwSpotPrice]);

  const regions = React.useMemo(() => {
    return baseRegions.map((region) => ({
      ...region,
      totalProtocolDepositsUsd: pdsByRegionId.get(region.id) ?? 0,
    }));
  }, [baseRegions, pdsByRegionId]);

  React.useEffect(() => {
    if (!shouldLoad || !isError) return;
    toast({
      title: "Failed to load region summary",
      description: "Please try again later",
      variant: "destructive",
    });
  }, [shouldLoad, isError, toast]);

  return (
    <div>
      {!shouldLoad || isLoading || isFetching || isCompletedLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card
              key={i}
              className="bg-card border-border/20 dark:border-border/40 !py-0 !gap-0"
            >
              <CardHeader className="border-b border-border/20 dark:border-border/40 !py-6 !px-8">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-12 rounded-xl" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </CardHeader>
              <CardContent className="!p-8">
                <div className="mb-8">
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
                <Skeleton className="h-10 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-xs text-muted-foreground/60">
            Unable to load regional staking data right now.
          </p>
        </div>
      ) : !regions || regions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-xs text-muted-foreground/60">
            No regions available at this time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {regions
            .slice()
            .sort((a, b) => b.glwPerWeek - a.glwPerWeek)
            .map((region) => (
              <Card
                key={region.id}
                className="group bg-card border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 transition-colors !py-0 !gap-0"
              >
                <CardHeader className="border-b border-border/20 dark:border-border/40 !py-5 !px-6">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={region.isUs ? "default" : "secondary"}
                      className="text-[10px] font-medium"
                    >
                      {region.isUs ? "US" : "Non-US"}
                    </Badge>
                    <h3 className="text-sm font-semibold text-foreground">
                      {region.name}
                    </h3>
                  </div>
                </CardHeader>
                <CardContent className="!p-6">
                  <div className="mb-6">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-1">
                      GLW per week
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                        {region.glwPerWeek.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground/50">
                        GLW
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-muted/30 dark:bg-muted/50 rounded-xl p-4 border border-border/20 dark:border-border/40">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-1">
                        Staked GCTL
                      </div>
                      <div className="text-lg font-bold tracking-tight tabular-nums text-foreground">
                        {region.stakedGctl.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                    <div className="bg-muted/30 dark:bg-muted/50 rounded-xl p-4 border border-border/20 dark:border-border/40">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-1">
                        Share of total
                      </div>
                      <div className="text-lg font-bold tracking-tight tabular-nums text-foreground">
                        {totalStakedGctl === 0
                          ? "0%"
                          : `${(
                              (region.stakedGctl / totalStakedGctl) *
                              100
                            ).toFixed(1)}%`}
                      </div>
                    </div>
                    <div className="bg-muted/30 dark:bg-muted/50 rounded-xl p-4 border border-border/20 dark:border-border/40">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-1">
                        Total PDs
                      </div>
                      <div className="text-lg font-bold tracking-tight tabular-nums text-foreground">
                        $
                        {region.totalProtocolDepositsUsd.toLocaleString(
                          undefined,
                          {
                            maximumFractionDigits: 0,
                          },
                        )}
                      </div>
                    </div>
                    <div className="bg-muted/30 dark:bg-muted/50 rounded-xl p-4 border border-border/20 dark:border-border/40">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-1">
                        GCTL/PD (×1000)
                      </div>
                      <div className="text-lg font-bold tracking-tight tabular-nums text-foreground">
                        {(() => {
                          if (region.totalProtocolDepositsUsd === 0) return "—";
                          const ratio =
                            (region.stakedGctl /
                              region.totalProtocolDepositsUsd) *
                            1000;
                          const rounded = Math.round(ratio);
                          return rounded === 0
                            ? "Low"
                            : rounded.toLocaleString();
                        })()}
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://impact.glow.org/vcr/${region.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <Button className="w-full " variant="outline">
                      <span className="text-xs font-medium">Stake GCTL</span>
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
