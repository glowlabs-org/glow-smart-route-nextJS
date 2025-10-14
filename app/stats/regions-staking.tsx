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

interface RegionSnapshot {
  epoch: number;
  gctlStaked: number;
  pendingUnstake: number;
  pendingRestakeOut: number;
  pendingRestakeIn: number;
}

interface RegionData {
  id: string | number;
  name: string;
  slug: string;
  isUs: boolean;
  glwPerWeek: number;
  stakedGctl: number;
  churnEpoch: number;
  snapshots?: RegionSnapshot[];
}

interface RegionsStakingProps {
  regions: RegionData[];
  totalStakedGctl: number;
  isLoading: boolean;
  isError: boolean;
}

function ChurnBar({ percent }: { percent: number }) {
  const getChurnLabel = (p: number) => {
    if (p <= 5) return { label: "Calm", color: "bg-green-500" };
    if (p <= 20) return { label: "Shifting", color: "bg-yellow-500" };
    return { label: "High", color: "bg-red-500" };
  };

  const { label, color } = getChurnLabel(percent);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-sm font-semibold">{percent}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${color} transition-all`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Restaking/unbonding started in last 72 hours</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface RegionChartProps {
  snapshots: RegionSnapshot[];
  regionName: string;
}

function RegionChart({ snapshots, regionName }: RegionChartProps) {
  const chartData = React.useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    // Process snapshots and sort by epoch
    return (
      snapshots
        .map((snapshot) => ({
          epoch: snapshot.epoch,
          // Round to 2 decimals
          staked: Math.round(snapshot.gctlStaked * 100) / 100,
          // Format epoch for display (you might want to convert to date)
          epochLabel: `Epoch ${snapshot.epoch}`,
        }))
        .sort((a, b) => a.epoch - b.epoch)
        // Take last 10 epochs for better visibility
        .slice(-10)
    );
  }, [snapshots]);

  const chartConfig = {
    staked: {
      label: "Staked GCTL",
      color: "#303cae",
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
          left: 0,
          right: 0,
          top: 5,
          bottom: 0,
        }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="epoch"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(value) => `E${value}`}
        />
        <YAxis hide domain={["dataMin - 5000", "dataMax + 1000"]} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="w-[150px]"
              labelFormatter={(value) => `Epoch ${value}`}
              formatter={(value: any) => [
                `${value.toLocaleString()} GCTL`,
                "Staked",
              ]}
            />
          }
        />
        <Area
          dataKey="staked"
          type="natural"
          fill="var(--color-staked)"
          fillOpacity={0.2}
          stroke="var(--color-staked)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function RegionsStaking({
  regions,
  totalStakedGctl,
  isLoading,
  isError,
}: RegionsStakingProps) {
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

      {isLoading ? (
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
            .map((region, index) => (
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-center px-4 py-2 bg-primary/5 rounded-lg border border-primary/20">
                            <div className="text-xs text-muted-foreground mb-0.5 font-semibold uppercase tracking-wider">
                              Rank
                            </div>
                            <div className="text-2xl font-bold text-primary">
                              #{index + 1}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ranked by GLW/week output</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* GLW per week - Hero metric */}
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

                  {/* GCTL in Motion - Churn indicator */}
                  <div>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-muted-foreground">
                          GCTL in motion
                        </div>
                      </div>
                      <ChurnBar
                        percent={
                          Number.isFinite(region.churnEpoch)
                            ? Math.round(region.churnEpoch)
                            : 0
                        }
                      />
                    </div>
                  </div>

                  {/* Historical Chart */}
                  {region.snapshots && region.snapshots.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-3">
                        Staking trend
                      </div>
                      <RegionChart
                        snapshots={region.snapshots}
                        regionName={region.name.replace(/\s+/g, "-")}
                      />
                    </div>
                  )}

                  {/* Stats Grid */}
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
                  </div>

                  {/* CTA */}
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
