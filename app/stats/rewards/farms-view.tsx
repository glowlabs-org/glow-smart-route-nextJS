"use client";

import React from "react";
import {
  Activity,
  ArrowUpDown,
  LineChart,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useFarmsEfficiencyScores,
  useFarmWeeklyRewards,
  useFarmWeeklyRewardsBatch,
  formatRewardValue,
} from "@/hooks/useFarmsRewards";
import { getCurrentEpoch } from "@/utils/getCurrentEpoch";
import { useRegions } from "@/hooks/useRegions";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useGlowPrices } from "@/hooks/useGlowPrices";
import Decimal from "decimal.js";

function RewardsSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}

export function MetricCard({ title, value, icon, children }: MetricCardProps) {
  return (
    <Card className="h-full border-border/60 shadow-none">
      <CardContent className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {value}
            </p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon}
          </span>
        </div>
        {children && (
          <div className="text-xs text-muted-foreground space-y-1">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getCurrencyPrice(
  currency: string,
  glwPrice: number | null,
  gctlPrice: number | null
): number {
  if (currency === "USDG" || currency === "USDC") return 1;
  if (currency === "GLW") return glwPrice || 0;
  if (currency === "GCTL" || currency === "SGCTL") return gctlPrice || 0;
  return 0;
}

interface FarmsRewardsChartProps {
  farms: Array<{
    farmId: string;
    efficiencyScore: number;
    protocolDepositUsd6: string;
    weeklyImpactAssetsWad: string;
    weeklyGlwRewards?: number;
    weeklyProtocolDeposit?: number;
    weeklyProtocolDepositRewards?: number;
    paymentCurrency?: string;
    regionId?: number;
    totalRewardsUsd?: number;
  }>;
  glwPrice: number | null;
}

function FarmsRewardsChart({ farms, glwPrice }: FarmsRewardsChartProps) {
  const chartData = React.useMemo(() => {
    return farms.slice(0, 20).map((farm, index) => {
      const totalRewardsUsd = farm.totalRewardsUsd ?? 0;
      const efficiency = farm.efficiencyScore;

      return {
        farm: `${farm.farmId.slice(0, 6)}...`,
        fullFarmId: farm.farmId,
        totalRewardsUsd,
        efficiency,
        glwRewards: farm.weeklyGlwRewards ?? 0,
        protocolDepositRewards: farm.weeklyProtocolDepositRewards ?? 0,
        paymentCurrency: farm.paymentCurrency,
        index: index + 1,
      };
    });
  }, [farms]);

  const chartConfig = {
    totalRewardsUsd: {
      label: "Total Rewards (USD)",
      color: "hsl(142, 71%, 45%)",
    },
    efficiency: {
      label: "Efficiency Score",
      color: "hsl(25, 95%, 53%)",
    },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
        No data available for chart
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-80 w-full">
      <ComposedChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 12, right: 12, top: 12, bottom: 80 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="farm"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) =>
            value >= 1000
              ? `$${(value / 1000).toFixed(1)}k`
              : `$${value.toFixed(0)}`
          }
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => value.toFixed(1)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="min-w-[220px]"
              labelFormatter={(_, payload) => {
                const farmId = payload?.[0]?.payload?.fullFarmId || "";
                return (
                  <div className="font-mono text-xs mb-2 pb-2 border-b border-border/50">
                    {farmId
                      ? `${farmId.slice(0, 10)}...${farmId.slice(-8)}`
                      : ""}
                  </div>
                );
              }}
              formatter={(value, name, payload) => {
                const numValue = Number(value);

                if (
                  name === "totalRewardsUsd" ||
                  name === "Total Rewards (USD)"
                ) {
                  const formatted = numValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                  const glwRewards = payload?.payload?.glwRewards ?? 0;
                  const pdRewards =
                    payload?.payload?.protocolDepositRewards ?? 0;
                  const currency = payload?.payload?.paymentCurrency || "";
                  return [
                    <div className="space-y-1">
                      <div className="font-semibold">${formatted}</div>
                      <div className="text-xs text-muted-foreground">
                        {glwRewards.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        GLW +{" "}
                        {pdRewards.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {currency}
                      </div>
                    </div>,
                    "Total Rewards (USD)",
                  ];
                } else if (
                  name === "efficiency" ||
                  name === "Efficiency Score"
                ) {
                  const formatted = numValue.toFixed(2);
                  return [
                    <span className="font-semibold">{formatted}</span>,
                    "Efficiency Score",
                  ];
                }
                return [String(value), String(name)];
              }}
            />
          }
        />
        <Bar
          yAxisId="left"
          dataKey="totalRewardsUsd"
          fill="var(--color-totalRewardsUsd)"
          radius={[4, 4, 0, 0]}
          name="Total Rewards (USD)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="efficiency"
          stroke="var(--color-efficiency)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-efficiency)" }}
          name="Efficiency Score"
        />
      </ComposedChart>
    </ChartContainer>
  );
}

interface FarmsViewProps {
  selectedFarmId: string;
  onSelectFarm: (farmId: string) => void;
}

export function FarmsView({ selectedFarmId, onSelectFarm }: FarmsViewProps) {
  const [sortBy, setSortBy] = React.useState<
    "efficiency" | "glwRewards" | "totalRewardsUsd" | "protocolDeposit"
  >("totalRewardsUsd");
  const [selectedRegionId, setSelectedRegionId] = React.useState<
    number | "all"
  >("all");

  const { regions, isRegionsLoading } = useRegions();
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { gctlMintPrice } = useGlowPrices();

  const {
    data: efficiencyData,
    isLoading: isEfficiencyLoading,
    isFetching: isEfficiencyFetching,
    isError: isEfficiencyError,
  } = useFarmsEfficiencyScores({ enabled: true });

  const farmIds = React.useMemo(() => {
    if (!efficiencyData) return [];
    const farmsList = Array.isArray(efficiencyData)
      ? efficiencyData
      : [efficiencyData];
    return farmsList.map((f) => f.farmId);
  }, [efficiencyData]);

  const currentWeek = getCurrentEpoch();

  const {
    data: batchWeeklyRewardsData,
    isLoading: isBatchWeeklyRewardsLoading,
    isFetching: isBatchWeeklyRewardsFetching,
  } = useFarmWeeklyRewardsBatch({
    farmIds,
    startWeek: 97,
    endWeek: currentWeek - 2,
    enabled: farmIds.length > 0,
  });

  const {
    data: weeklyRewardsData,
    isLoading: isWeeklyRewardsLoading,
    isFetching: isWeeklyRewardsFetching,
    isError: isWeeklyRewardsError,
  } = useFarmWeeklyRewards({
    farmId: selectedFarmId,
    enabled: !!selectedFarmId,
    limit: 52,
  });

  const farms = React.useMemo(() => {
    if (!efficiencyData) return [];
    const farmsList = Array.isArray(efficiencyData)
      ? efficiencyData
      : [efficiencyData];

    const farmsWithRewards = farmsList.map((farm) => {
      const batchResult = batchWeeklyRewardsData?.results?.[farm.farmId];
      let weeklyGlwRewards = 0;
      let weeklyProtocolDeposit = 0;
      let weeklyProtocolDepositRewards = 0;
      let paymentCurrency: string | undefined;
      let regionId: number | undefined;
      let totalRewardsUsd = 0;

      if (
        batchResult &&
        "rewards" in batchResult &&
        batchResult.rewards.length > 0
      ) {
        const sortedRewards = [...batchResult.rewards].sort(
          (a, b) => b.weekNumber - a.weekNumber
        );
        const mostRecentWeekReward = sortedRewards[0];

        weeklyGlwRewards = new Decimal(mostRecentWeekReward.glowInflationTotal)
          .div(1e18)
          .toNumber();
        weeklyProtocolDeposit = new Decimal(
          mostRecentWeekReward.protocolDepositPaidTotal
        )
          .div(1e6)
          .toNumber();

        paymentCurrency = mostRecentWeekReward.paymentCurrency;
        const decimals = paymentCurrency === "GLW" ? 1e18 : 1e6;
        weeklyProtocolDepositRewards = new Decimal(
          mostRecentWeekReward.protocolDepositRewardsDistributed
        )
          .div(decimals)
          .toNumber();
        regionId = batchResult.regionId;

        const glwRewardsUsd = weeklyGlwRewards * (glwSpotPrice || 0);
        const pdCurrencyPrice = getCurrencyPrice(
          paymentCurrency,
          glwSpotPrice,
          gctlMintPrice
        );
        const pdRewardsUsd = weeklyProtocolDepositRewards * pdCurrencyPrice;
        totalRewardsUsd = glwRewardsUsd + pdRewardsUsd;
      }

      return {
        ...farm,
        weeklyGlwRewards,
        weeklyProtocolDeposit,
        weeklyProtocolDepositRewards,
        paymentCurrency,
        regionId,
        totalRewardsUsd,
      };
    });

    const filtered =
      selectedRegionId === "all"
        ? farmsWithRewards
        : farmsWithRewards.filter((farm) => farm.regionId === selectedRegionId);

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "efficiency") {
        return b.efficiencyScore - a.efficiencyScore;
      } else if (sortBy === "glwRewards") {
        return (b.weeklyGlwRewards ?? 0) - (a.weeklyGlwRewards ?? 0);
      } else if (sortBy === "totalRewardsUsd") {
        return (b.totalRewardsUsd ?? 0) - (a.totalRewardsUsd ?? 0);
      } else {
        return Number(b.protocolDepositUsd6) - Number(a.protocolDepositUsd6);
      }
    });

    return sorted;
  }, [
    efficiencyData,
    batchWeeklyRewardsData,
    sortBy,
    selectedRegionId,
    glwSpotPrice,
    gctlMintPrice,
  ]);

  const weeklyRewardsChartData = React.useMemo(() => {
    if (!weeklyRewardsData?.rewards) return [];

    return weeklyRewardsData.rewards
      .sort((a, b) => a.weekNumber - b.weekNumber)
      .map((reward) => ({
        week: `W${reward.weekNumber}`,
        weekNumber: reward.weekNumber,
        glwInflation: Number(formatRewardValue(reward.glowInflationTotal, 18)),
        protocolDeposit: Number(
          formatRewardValue(reward.protocolDepositPaidTotal, 6)
        ),
        expectedProduction: Number(
          formatRewardValue(reward.expectedProductionTotal, 18)
        ),
        paymentCurrency: reward.paymentCurrency,
      }));
  }, [weeklyRewardsData]);

  const selectedFarm = React.useMemo(() => {
    return farms.find((f) => f.farmId === selectedFarmId);
  }, [farms, selectedFarmId]);

  const totalLastWeekRewardsUsd = React.useMemo(() => {
    return farms.reduce((sum, f) => sum + (f.totalRewardsUsd ?? 0), 0);
  }, [farms]);

  const regionUsdTotals = React.useMemo(() => {
    if (!batchWeeklyRewardsData?.results || !efficiencyData)
      return new Map<number, number>();

    const regionTotals = new Map<number, number>();
    const farmsList = Array.isArray(efficiencyData)
      ? efficiencyData
      : [efficiencyData];

    farmsList.forEach((farm) => {
      const batchResult = batchWeeklyRewardsData.results[farm.farmId];
      if (
        batchResult &&
        "regionId" in batchResult &&
        "rewards" in batchResult
      ) {
        const regionId = batchResult.regionId;
        if (batchResult.rewards.length > 0) {
          const sortedRewards = [...batchResult.rewards].sort(
            (a, b) => b.weekNumber - a.weekNumber
          );
          const mostRecentReward = sortedRewards[0];

          const glwRewards = new Decimal(mostRecentReward.glowInflationTotal)
            .div(1e18)
            .toNumber();

          const paymentCurrency = mostRecentReward.paymentCurrency;
          const decimals = paymentCurrency === "GLW" ? 1e18 : 1e6;
          const pdRewards = new Decimal(
            mostRecentReward.protocolDepositRewardsDistributed
          )
            .div(decimals)
            .toNumber();

          const glwRewardsUsd = glwRewards * (glwSpotPrice || 0);
          const pdCurrencyPrice = getCurrencyPrice(
            paymentCurrency,
            glwSpotPrice,
            gctlMintPrice
          );
          const pdRewardsUsd = pdRewards * pdCurrencyPrice;
          const totalRewardsUsd = glwRewardsUsd + pdRewardsUsd;

          regionTotals.set(
            regionId,
            (regionTotals.get(regionId) || 0) + totalRewardsUsd
          );
        }
      }
    });

    return regionTotals;
  }, [batchWeeklyRewardsData, efficiencyData, glwSpotPrice, gctlMintPrice]);

  const chartConfig = {
    glwInflation: {
      label: "GLW Inflation",
      color: "hsl(142, 71%, 45%)",
    },
    protocolDeposit: {
      label: "Protocol Deposit",
      color: "hsl(217, 91%, 60%)",
    },
  } satisfies ChartConfig;

  if (isEfficiencyLoading) {
    return <RewardsSkeleton />;
  }

  if (isEfficiencyError) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          Unable to load farms data right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title={
            selectedRegionId === "all"
              ? "Total Farms"
              : `Farms in ${
                  regions.find((r) => r.id === selectedRegionId)?.name ||
                  "Region"
                }`
          }
          value={farms.length.toLocaleString()}
          icon={<Activity className="h-5 w-5" />}
        >
          <p>
            {selectedRegionId === "all"
              ? "Tracked farms with efficiency scores"
              : "Farms with efficiency scores in this region"}
          </p>
        </MetricCard>

        <MetricCard
          title="Last Week Rewards"
          value={`$${totalLastWeekRewardsUsd.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}`}
          icon={<TrendingUp className="h-5 w-5" />}
        >
          <p>
            {selectedRegionId === "all"
              ? "Total rewards distributed to all farms"
              : `Rewards distributed to ${
                  regions.find((r) => r.id === selectedRegionId)?.name ||
                  "region"
                } farms`}
          </p>
        </MetricCard>

        <MetricCard
          title="Average Efficiency"
          value={
            farms.length > 0
              ? (
                  farms.reduce((sum, f) => sum + f.efficiencyScore, 0) /
                  farms.length
                ).toFixed(2)
              : "0.00"
          }
          icon={<Zap className="h-5 w-5" />}
        >
          <p>Carbon credits per $100k deposit/week</p>
        </MetricCard>

        {selectedFarm && weeklyRewardsData ? (
          <MetricCard
            title="Weeks Active"
            value={weeklyRewardsData.summary.weeksActive.toString()}
            icon={<LineChart className="h-5 w-5" />}
          >
            <p>Selected farm: {selectedFarmId.slice(0, 8)}...</p>
          </MetricCard>
        ) : (
          <MetricCard
            title="Top Farm Efficiency"
            value={
              farms.length > 0
                ? Math.max(...farms.map((f) => f.efficiencyScore)).toFixed(2)
                : "0.00"
            }
            icon={<LineChart className="h-5 w-5" />}
          >
            <p>Highest performing farm</p>
          </MetricCard>
        )}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <CardTitle>Weekly Rewards & Efficiency Overview</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedRegionId === "all"
                    ? "Comparing top 20 farms by last week's total rewards (USD) and their efficiency scores."
                    : `Top 20 farms in ${
                        regions.find((r) => r.id === selectedRegionId)?.name ||
                        "this region"
                      } by last week's total rewards (USD) and efficiency scores.`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={sortBy}
                  onValueChange={(value) =>
                    setSortBy(
                      value as
                        | "efficiency"
                        | "glwRewards"
                        | "totalRewardsUsd"
                        | "protocolDeposit"
                    )
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalRewardsUsd">
                      Total Rewards (USD)
                    </SelectItem>
                    <SelectItem value="efficiency">Efficiency Score</SelectItem>
                    <SelectItem value="glwRewards">GLW Rewards</SelectItem>
                    <SelectItem value="protocolDeposit">
                      Protocol Deposit
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Region:</span>
              <Select
                value={String(selectedRegionId)}
                onValueChange={(value) =>
                  setSelectedRegionId(value === "all" ? "all" : Number(value))
                }
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Regions
                    {regionUsdTotals.size > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ($
                        {Array.from(regionUsdTotals.values())
                          .reduce((sum, val) => sum + val, 0)
                          .toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })}
                        /week )
                      </span>
                    )}
                  </SelectItem>
                  {regions
                    .filter((region) => regionUsdTotals.has(region.id))
                    .sort(
                      (a, b) =>
                        (regionUsdTotals.get(b.id) || 0) -
                        (regionUsdTotals.get(a.id) || 0)
                    )
                    .map((region) => {
                      const usdTotal = regionUsdTotals.get(region.id) || 0;
                      return (
                        <SelectItem key={region.id} value={String(region.id)}>
                          {region.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            ($
                            {usdTotal.toLocaleString("en-US", {
                              maximumFractionDigits: 0,
                            })}
                            /week)
                          </span>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEfficiencyFetching || isBatchWeeklyRewardsFetching ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <FarmsRewardsChart farms={farms} glwPrice={glwSpotPrice} />
          )}
        </CardContent>
      </Card>

      {selectedFarmId && selectedFarm && (
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <CardTitle>Farm {selectedFarmId.slice(0, 8)}...</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Historical weekly rewards distribution
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {selectedFarmId}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => onSelectFarm("")}
                size="sm"
              >
                Clear Selection
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isWeeklyRewardsLoading || isWeeklyRewardsFetching ? (
              <Skeleton className="h-80 w-full" />
            ) : isWeeklyRewardsError ? (
              <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
                Failed to load weekly rewards data
              </div>
            ) : weeklyRewardsChartData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
                No weekly rewards data available
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <ComposedChart
                  accessibilityLayer
                  data={weeklyRewardsChartData}
                  margin={{ left: 12, right: 12, top: 12, bottom: 40 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) =>
                      value >= 1000
                        ? `${(value / 1000).toFixed(1)}k`
                        : value.toString()
                    }
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="min-w-[200px]"
                        labelFormatter={(_, payload) => {
                          const weekNum = payload?.[0]?.payload?.weekNumber;
                          return (
                            <div className="font-semibold mb-2 pb-2 border-b border-border/50">
                              Week {weekNum}
                            </div>
                          );
                        }}
                        formatter={(value, name) => {
                          const numValue = Number(value);
                          const formatted = numValue.toLocaleString("en-US", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          });

                          if (
                            name === "glwInflation" ||
                            name === "GLW Inflation"
                          ) {
                            return [
                              <span className="font-semibold">
                                {formatted} GLW
                              </span>,
                              "GLW Inflation",
                            ];
                          } else if (
                            name === "protocolDeposit" ||
                            name === "Protocol Deposit"
                          ) {
                            return [
                              <span className="font-semibold">
                                ${formatted}
                              </span>,
                              "Protocol Deposit",
                            ];
                          }
                          return [String(value), String(name)];
                        }}
                      />
                    }
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="glwInflation"
                    fill="var(--color-glwInflation)"
                    radius={[4, 4, 0, 0]}
                    name="GLW Inflation"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="protocolDeposit"
                    stroke="var(--color-protocolDeposit)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "var(--color-protocolDeposit)" }}
                    name="Protocol Deposit"
                  />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Farm Efficiency Leaderboard</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedRegionId === "all"
              ? "All farms ranked by carbon credit production efficiency"
              : `${
                  regions.find((r) => r.id === selectedRegionId)?.name ||
                  "Region"
                } farms ranked by carbon credit production efficiency`}
          </p>
        </CardHeader>
        <CardContent>
          {isEfficiencyFetching ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Farm ID</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">
                      Efficiency Score
                    </TableHead>
                    <TableHead className="text-right">Last Week GLW</TableHead>
                    <TableHead className="text-right">
                      Protocol Deposit Rewards
                    </TableHead>
                    <TableHead className="text-right">
                      Protocol Deposit (USD)
                    </TableHead>
                    <TableHead className="text-right">
                      Weekly Carbon Credits
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {farms.map((farm, index) => (
                    <TableRow
                      key={farm.farmId}
                      className={
                        selectedFarmId === farm.farmId
                          ? "bg-muted/50"
                          : "cursor-pointer hover:bg-muted/30"
                      }
                      onClick={() => onSelectFarm(farm.farmId)}
                    >
                      <TableCell className="font-semibold">
                        #{index + 1}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {farm.farmId.slice(0, 8)}...{farm.farmId.slice(-4)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {farm.regionId ? (
                          <Badge variant="secondary" className="text-xs">
                            {regions.find((r) => r.id === farm.regionId)
                              ?.name || `Region ${farm.regionId}`}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            N/A
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            farm.efficiencyScore >= 10
                              ? "default"
                              : farm.efficiencyScore >= 5
                              ? "secondary"
                              : "outline"
                          }
                          className="font-mono"
                        >
                          {farm.efficiencyScore.toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {farm.weeklyGlwRewards
                          ? `${farm.weeklyGlwRewards.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} GLW`
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {farm.weeklyProtocolDepositRewards &&
                        farm.paymentCurrency ? (
                          <>
                            {farm.weeklyProtocolDepositRewards.toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}{" "}
                            <span className="text-muted-foreground">
                              {farm.paymentCurrency}
                            </span>
                          </>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${formatRewardValue(farm.protocolDepositUsd6, 6)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatRewardValue(farm.weeklyImpactAssetsWad, 18)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFarm(farm.farmId);
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedFarmId && weeklyRewardsData && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Weekly Rewards Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Detailed weekly performance data for the selected farm
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead>Payment Currency</TableHead>
                    <TableHead className="text-right">
                      GLW Inflation Total
                    </TableHead>
                    <TableHead className="text-right">
                      Protocol Deposit Paid
                    </TableHead>
                    <TableHead className="text-right">
                      Expected Production
                    </TableHead>
                    <TableHead className="text-right">
                      Rewards Distributed
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyRewardsData.rewards
                    .sort((a, b) => b.weekNumber - a.weekNumber)
                    .map((reward) => (
                      <TableRow key={reward.weekNumber}>
                        <TableCell className="font-semibold">
                          Week {reward.weekNumber}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {reward.paymentCurrency}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatRewardValue(reward.glowInflationTotal, 18)} GLW
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          $
                          {formatRewardValue(
                            reward.protocolDepositPaidTotal,
                            6
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatRewardValue(
                            reward.expectedProductionTotal,
                            18
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          $
                          {formatRewardValue(
                            reward.protocolDepositRewardsDistributed,
                            6
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            {weeklyRewardsData.summary && (
              <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border/40">
                <p className="text-sm font-semibold mb-2">Summary</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Weeks Active</p>
                    <p className="font-mono font-semibold">
                      {weeklyRewardsData.summary.weeksActive}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total GLW Inflation</p>
                    <p className="font-mono font-semibold">
                      {formatRewardValue(
                        weeklyRewardsData.summary.totalGlowInflation,
                        18
                      )}{" "}
                      GLW
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Deposit Paid</p>
                    <p className="font-mono font-semibold">
                      $
                      {formatRewardValue(
                        weeklyRewardsData.summary.totalProtocolDepositPaid,
                        6
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Production</p>
                    <p className="font-mono font-semibold">
                      {formatRewardValue(
                        weeklyRewardsData.summary.totalExpectedProduction,
                        18
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
