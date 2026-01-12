"use client";

import React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
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

const GCTL_SCALE = 1_000_000;

function toGctl(amount: string | number | null | undefined): number {
  if (amount === null || amount === undefined) return 0;
  const numeric = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numeric)) return 0;
  return numeric / GCTL_SCALE;
}

interface RegionChartProps {
  region?: RegionData;
  aggregate?: {
    epochs: number[];
    timestamps: number[];
    totalGctlStaked: string[];
    eventTypes: string[];
    regionIds: number[];
  };
}

function RegionChart({ region, aggregate }: RegionChartProps) {
  const regionId = React.useMemo(
    () => (region ? Number(region.id) : undefined),
    [region]
  );

  const historySeries = React.useMemo(() => {
    if (!region?.history || region.history.length === 0) return [];
    return region.history
      .map((point) => ({
        timestamp: point.timestamp * 1000,
        staked: Number(point.gctlStaked.toFixed(2)),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [region?.history]);

  const chartData = React.useMemo(() => {
    if (!regionId) return [];

    const events: Array<{ timestamp: number; staked: number }> = [];

    if (aggregate && aggregate.timestamps.length > 0) {
      const pointByTimestamp = new Map<number, number>();

      for (let index = 0; index < aggregate.timestamps.length; index += 1) {
        if (aggregate.regionIds[index] !== regionId) continue;
        const timestamp = aggregate.timestamps[index] * 1000;
        const staked = Number(
          toGctl(aggregate.totalGctlStaked[index]).toFixed(2)
        );
        pointByTimestamp.set(timestamp, staked);
      }

      Array.from(pointByTimestamp.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([timestamp, staked]) => {
          events.push({ timestamp, staked });
        });
    }

    if (events.length === 0) {
      return historySeries.map(({ timestamp, staked }) => {
        const date = new Date(timestamp);
        return {
          timestamp,
          staked,
          dateLabel: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          fullDate: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        };
      });
    }

    const series: Array<{ timestamp: number; staked: number }> = [...events];
    const firstEventTimestamp =
      events[0]?.timestamp ?? Number.POSITIVE_INFINITY;
    const lastEventTimestamp =
      events[events.length - 1]?.timestamp ?? Number.NEGATIVE_INFINITY;

    if (historySeries.length > 0) {
      const baseline = historySeries
        .filter((point) => point.timestamp < firstEventTimestamp)
        .pop();
      if (baseline) {
        series.unshift(baseline);
      }

      const trailing = historySeries
        .filter((point) => point.timestamp > lastEventTimestamp)
        .pop();
      if (trailing) {
        series.push(trailing);
      }
    }

    return series
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter((point, index, array) => {
        if (index === 0) return true;
        return point.timestamp !== array[index - 1].timestamp;
      })
      .map(({ timestamp, staked }) => {
        const date = new Date(timestamp);
        return {
          timestamp,
          staked,
          dateLabel: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          fullDate: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        };
      })
      .slice(-20);
  }, [aggregate, historySeries, regionId]);

  const chartConfig = {
    staked: {
      label: "Staked GCTL",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
        No historical data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-32 w-full">
      <AreaChart
        accessibilityLayer
        data={chartData}
        margin={{
          left: 12,
          right: 12,
          top: 12,
          bottom: 0,
        }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="dateLabel"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          domain={["dataMin - 50000", "dataMax + 1000"]}
          tickFormatter={(value) =>
            value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="w-[150px]"
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.fullDate || ""
              }
              formatter={(value: any) => [
                `${value.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })} GCTL`,
                "Staked",
              ]}
            />
          }
        />
        <Area
          dataKey="staked"
          type="linear"
          fill="var(--color-staked)"
          fillOpacity={0.2}
          stroke="var(--color-staked)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
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
  const aggregate = activeSummary?.aggregate;

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">GCTL Staking by Region</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Control distribution and GLW/week allocation
          </p>
        </div>
      </div>

      {!shouldLoad || isLoading || isFetching || isCompletedLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-10 w-40 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            Unable to load regional staking data right now.
          </p>
        </div>
      ) : !regions || regions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
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
                className="group  hover:border-border hover:shadow-lg transition-all pt-0"
              >
                <CardHeader className="border-b border-border/50 bg-muted/30 pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={region.isUs ? "default" : "secondary"}
                          className="text-xs font-semibold"
                        >
                          {region.isUs ? "US" : "Non-US"}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-bold">{region.name}</h3>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">
                      GLW per week
                    </div>
                    <div className="flex items-baseline gap-3">
                      <div className="text-5xl font-bold tracking-tight">
                        {region.glwPerWeek.toLocaleString()}
                      </div>
                      <div className="text-xl text-muted-foreground">GLW</div>
                    </div>
                  </div>

                  {/* {aggregate && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-3">
                        Staking trend
                      </div>
                      <RegionChart region={region} aggregate={aggregate} />
                    </div>
                  )} */}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="text-xs text-muted-foreground mb-2">
                        Staked GCTL
                      </div>
                      <div className="text-2xl font-bold">
                        {region.stakedGctl.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="text-xs text-muted-foreground mb-2">
                        Share of total
                      </div>
                      <div className="text-2xl font-bold">
                        {totalStakedGctl === 0
                          ? "0%"
                          : `${(
                              (region.stakedGctl / totalStakedGctl) *
                              100
                            ).toFixed(1)}%`}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="text-xs text-muted-foreground mb-2">
                        Total PDs
                      </div>
                      <div className="text-2xl font-bold">
                        $
                        {region.totalProtocolDepositsUsd.toLocaleString(
                          undefined,
                          {
                            maximumFractionDigits: 0,
                          }
                        )}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="text-xs text-muted-foreground mb-2">
                        GCTL/PD
                      </div>
                      <div className="text-2xl font-bold">
                        {region.totalProtocolDepositsUsd === 0
                          ? "—"
                          : (
                              region.stakedGctl /
                              region.totalProtocolDepositsUsd
                            ).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://impact.glow.org/vcr/${region.slug}`}
                    target="_blank"
                  >
                    <Button
                      className="w-full rounded-full"
                      size="default"
                      variant="outline"
                    >
                      Stake GCTL
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
