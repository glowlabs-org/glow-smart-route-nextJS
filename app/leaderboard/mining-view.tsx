"use client";

import React from "react";
import { ArrowUpDown, ChevronRight } from "lucide-react";
import {
  ComposedChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
} from "recharts";
import Decimal from "decimal.js";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
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
  useFarmsPerPieceStats,
  type FarmPerPieceStats,
} from "@/hooks/useFarmsPerPieceStats";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
function formatGLWAmount(value: string): string {
  try {
    const num = new Decimal(value).div(1e18);
    return num.toNumber().toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0.00";
  }
}

function formatUSDAmount(value: string): string {
  try {
    const num = new Decimal(value).div(1e6);
    return num.toNumber().toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0.00";
  }
}

function getDelegatorROI(farm: FarmPerPieceStats): number {
  try {
    return Number(farm.delegator.roi?.allWeeks || "0") / 100;
  } catch {
    return 0;
  }
}

function getMinerROI(farm: FarmPerPieceStats): number {
  try {
    return Number(farm.miner.roi?.allWeeks || "0") / 100;
  } catch {
    return 0;
  }
}

function MiningViewSkeleton() {
  return (
    <div className="space-y-8">
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

interface ROIChartProps {
  farms: FarmPerPieceStats[];
}

function ROIComparisonChart({ farms }: ROIChartProps) {
  const chartData = React.useMemo(() => {
    const farmsWithBothTypes = farms
      .filter(
        (f) =>
          f.delegator.stepsSold > 0 &&
          f.miner.stepsSold > 0 &&
          (f.participants.uniqueDelegators > 0 ||
            f.participants.uniqueMiners > 0)
      )
      .sort(
        (a, b) =>
          b.participants.uniqueDelegators +
          b.participants.uniqueMiners -
          (a.participants.uniqueDelegators + a.participants.uniqueMiners)
      )
      .slice(0, 20);

    return farmsWithBothTypes.map((farm) => {
      const delegatorROI = getDelegatorROI(farm);
      const minerROI = getMinerROI(farm);

      return {
        farm: `${farm.farmId.slice(0, 6)}...`,
        fullFarmId: farm.farmId,
        farmName: farm.farmName || "Unknown Farm",
        delegatorROI,
        minerROI,
        delegatorInvested: new Decimal(farm.delegator.weightedPieceSizeGlw)
          .times(farm.delegator.stepsSold)
          .div(1e18)
          .toNumber(),
        minerInvested: new Decimal(farm.miner.weightedPiecePriceUsdc)
          .times(farm.miner.stepsSold)
          .div(1e6)
          .toNumber(),
      };
    });
  }, [farms]);

  const chartConfig = {
    delegatorROI: {
      label: "Delegator Rewards",
      color: "#dcc4ff",
    },
    minerROI: {
      label: "Miner Rewards",
      color: "#ccffd4",
    },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
        No farms with both delegators and miners found
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
          tickFormatter={(value) => `${value.toFixed(2)}x`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `${value.toFixed(2)}x`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="min-w-[260px]"
              labelFormatter={(_, payload) => {
                const farmName = payload?.[0]?.payload?.farmName || "";
                const farmId = payload?.[0]?.payload?.fullFarmId || "";
                return (
                  <div className="space-y-1">
                    <div className="font-semibold">{farmName}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {farmId
                        ? `${farmId.slice(0, 10)}...${farmId.slice(-8)}`
                        : ""}
                    </div>
                  </div>
                );
              }}
              formatter={(value, name, payload) => {
                const numValue = Number(value);

                if (name === "delegatorROI" || name === "Delegator Rewards") {
                  const invested = payload?.payload?.delegatorInvested ?? 0;
                  return [
                    <div key="delegator-roi" className="space-y-1">
                      <div className="font-semibold">
                        {numValue.toFixed(2)}x
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {invested.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        GLW invested
                      </div>
                    </div>,
                    "Delegator Rewards",
                  ];
                } else if (name === "minerROI" || name === "Miner Rewards") {
                  const invested = payload?.payload?.minerInvested ?? 0;
                  return [
                    <div key="miner-roi" className="space-y-1">
                      <div className="font-semibold">
                        {numValue.toFixed(2)}x
                      </div>
                      <div className="text-xs text-muted-foreground">
                        $
                        {invested.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        invested
                      </div>
                    </div>,
                    "Miner Rewards",
                  ];
                }
                return [String(value), String(name)];
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          yAxisId="left"
          dataKey="delegatorROI"
          fill="var(--color-delegatorROI)"
          radius={[4, 4, 0, 0]}
          name="Delegator Rewards"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="minerROI"
          stroke="var(--color-minerROI)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-minerROI)" }}
          name="Miner Rewards"
        />
      </ComposedChart>
    </ChartContainer>
  );
}

type SortOption = "rewardScore" | "delegated" | "mined" | "risk";
type FarmFilterOption = "all" | "delegation-only" | "mining-only" | "both";
type DetailView = "delegation" | "mining";

interface HealthStatus {
  label: "Ahead" | "On track" | "Behind" | "At risk";
  badgeClass: string;
  barClass: string;
  textClass: string;
  score: number;
  description: string;
}

interface FarmSummaryRow {
  farmId: string;
  farmName: string;
  appId: string;
  regionLabel: string;
  tags: string[];
  rewardScore: number;
  rewardDelta: number;
  combinedGlw: number;
  health: HealthStatus;
  hasDelegation: boolean;
  hasMining: boolean;
  delegation: {
    totalDelegated: number;
    earnedToDate: number;
    recoveryPercent: number;
    expectedPercent: number;
    weeksEarned: number;
    totalWeeks: number;
    stepsSold: number;
    paidPerStep: number;
    earnedPerStep: number;
    roiPercent: number;
    wallets: number;
    breakdown: FarmPerPieceStats["delegator"]["weeklyBreakdown"];
    lastWeekRewards: number;
  };
  mining: {
    totalSpent: number;
    earnedToDate: number;
    breakEvenPercent: number;
    weeksEarned: number;
    totalWeeks: number;
    stepsSold: number;
    paidPerStepUsd: number;
    earnedPerStep: number;
    roiPercent: number;
    wallets: number;
    breakdown: FarmPerPieceStats["miner"]["weeklyBreakdown"];
    lastWeekRewards: number;
  };
}

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 200) return 200;
  return value;
}

function titleCase(value: string | null | undefined) {
  if (!value) return "Unassigned";
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatWeeksLabel(weeksEarned: number, totalWeeks: number) {
  if (weeksEarned === 0 && totalWeeks === 0) return "0 weeks elapsed";
  if (totalWeeks === 0) return `${weeksEarned} weeks elapsed`;
  return `${weeksEarned} / ${totalWeeks} weeks elapsed`;
}

function calculateRewardScore({
  recoveryPercent,
  breakEvenPercent,
  hasDelegation,
  hasMining,
}: {
  recoveryPercent: number;
  breakEvenPercent: number;
  hasDelegation: boolean;
  hasMining: boolean;
}) {
  const delegationWeight = hasDelegation ? 0.6 : 0;
  const miningWeight = hasMining ? 0.4 : 0;
  const totalWeight = delegationWeight + miningWeight || 1;
  const weightedScore =
    recoveryPercent * delegationWeight + breakEvenPercent * miningWeight;
  return Math.round(weightedScore / totalWeight);
}

function evaluateHealthStatus({
  recoveryPercent,
  expectedPercent,
  minerROI,
  hasDelegation,
  hasMining,
}: {
  recoveryPercent: number;
  expectedPercent: number;
  minerROI: number;
  hasDelegation: boolean;
  hasMining: boolean;
}): HealthStatus {
  const delta = recoveryPercent - expectedPercent;
  const roi = minerROI;

  const ahead =
    (hasDelegation ? delta >= 10 : true) && (hasMining ? roi >= 90 : true);
  const onTrack =
    (hasDelegation ? delta >= -5 : true) && (hasMining ? roi >= 60 : true);
  const behind =
    (hasDelegation ? delta >= -20 : true) && (hasMining ? roi >= 40 : true);

  if (ahead) {
    return {
      label: "Ahead",
      badgeClass:
        "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
      barClass: "bg-emerald-400",
      textClass: "text-emerald-300",
      score: 3,
      description: "Both tracks outperform projections",
    };
  }

  if (onTrack) {
    return {
      label: "On track",
      badgeClass:
        "bg-yellow-500/10 text-yellow-200 border border-yellow-500/30",
      barClass: "bg-yellow-400",
      textClass: "text-yellow-200",
      score: 2,
      description: "Roughly matching the expected curve",
    };
  }

  if (behind) {
    return {
      label: "Behind",
      badgeClass:
        "bg-orange-500/10 text-orange-200 border border-orange-500/30",
      barClass: "bg-orange-400",
      textClass: "text-orange-200",
      score: 1,
      description: "Needs attention to catch up",
    };
  }

  return {
    label: "At risk",
    badgeClass: "bg-red-500/10 text-red-200 border border-red-500/30",
    barClass: "bg-red-500",
    textClass: "text-red-200",
    score: 0,
    description: "Significant gap vs expectations",
  };
}

function buildFarmTags(
  farm: FarmPerPieceStats,
  hasDelegation: boolean,
  hasMining: boolean
) {
  const tags = [];

  if (hasDelegation) {
    tags.push(
      farm.delegator.weeksEarned > 0 ? "Delegation Live" : "Delegation Pending"
    );
  }

  if (hasMining) {
    tags.push("Mining");
  }

  tags.push("Launched");
  return tags;
}

const FILTER_OPTIONS: Array<{
  value: FarmFilterOption;
  label: string;
  helper: string;
}> = [
  { value: "all", label: "All", helper: "Show every farm" },
  {
    value: "delegation-only",
    label: "Delegation only",
    helper: "Farms with delegators but no miners",
  },
  {
    value: "mining-only",
    label: "Mining only",
    helper: "Farms incentivizing miners only",
  },
  {
    value: "both",
    label: "Both",
    helper: "Delegation + mining live together",
  },
];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "rewardScore", label: "Highest Reward Score" },
  { value: "delegated", label: "Most delegated GLW" },
  { value: "mined", label: "Most GLW mined" },
  { value: "risk", label: "Most at risk" },
];

export function MiningView() {
  const [sortBy, setSortBy] = React.useState<
    "rewards" | "participants" | "weeksLeft"
  >("rewards");
  const [selectedFarmForDetails, setSelectedFarmForDetails] = React.useState<{
    farmId: string;
    farmName: string;
    type: "delegator" | "miner";
  } | null>(null);

  const { data, isLoading, isFetching, isError } = useFarmsPerPieceStats({
    enabled: true,
  });

  const farmsWithEfficiency = React.useMemo(() => {
    if (!data?.farms) return [];

    return data.farms
      .filter(
        (farm) => farm.delegator.stepsSold > 0 || farm.miner.stepsSold > 0
      )
      .map((farm) => {
        const delegatorROI = getDelegatorROI(farm);
        const minerROI = getMinerROI(farm);

        const avgROI =
          farm.delegator.stepsSold > 0 && farm.miner.stepsSold > 0
            ? (delegatorROI + minerROI) / 2
            : farm.delegator.stepsSold > 0
            ? delegatorROI
            : minerROI;

        const totalDelegated = new Decimal(farm.delegator.weightedPieceSizeGlw)
          .times(farm.delegator.stepsSold)
          .div(1e18)
          .toNumber();

        const totalMinerSpent = new Decimal(farm.miner.weightedPiecePriceUsdc)
          .times(farm.miner.stepsSold)
          .div(1e6)
          .toNumber();

        return {
          ...farm,
          delegatorROI,
          minerROI,
          avgROI,
          totalDelegated,
          totalMinerSpent,
        };
      });
  }, [data]);

  const sortedFarms = React.useMemo(() => {
    const farmsToSort = [...farmsWithEfficiency];

    farmsToSort.sort((a, b) => {
      if (sortBy === "rewards") {
        const aRewards = new Decimal(
          a.delegator.rewardsPerPiece?.total?.allWeeks || "0"
        ).plus(a.miner.rewardsPerPiece?.total?.allWeeks || "0");

        const bRewards = new Decimal(
          b.delegator.rewardsPerPiece?.total?.allWeeks || "0"
        ).plus(b.miner.rewardsPerPiece?.total?.allWeeks || "0");

        return bRewards.comparedTo(aRewards);
      } else if (sortBy === "participants") {
        return (
          b.participants.uniqueDelegators +
          b.participants.uniqueMiners -
          (a.participants.uniqueDelegators + a.participants.uniqueMiners)
        );
      } else if (sortBy === "weeksLeft") {
        const aWeeksLeft =
          a.delegator.stepsSold > 0 ? a.delegator.weeksLeft : a.miner.weeksLeft;

        const bWeeksLeft =
          b.delegator.stepsSold > 0 ? b.delegator.weeksLeft : b.miner.weeksLeft;

        return bWeeksLeft - aWeeksLeft;
      }
      return b.avgROI - a.avgROI;
    });

    return farmsToSort;
  }, [farmsWithEfficiency, sortBy]);

  const selectedFarmData = React.useMemo(() => {
    if (!selectedFarmForDetails || !data?.farms) return null;
    return data.farms.find((f) => f.farmId === selectedFarmForDetails.farmId);
  }, [selectedFarmForDetails, data]);

  const selectedBreakdown = React.useMemo(() => {
    if (!selectedFarmData || !selectedFarmForDetails) return null;
    return selectedFarmForDetails.type === "delegator"
      ? selectedFarmData.delegator.weeklyBreakdown
      : selectedFarmData.miner.weeklyBreakdown;
  }, [selectedFarmData, selectedFarmForDetails]);

  if (isLoading) {
    return <MiningViewSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          Unable to load mining data right now.
        </p>
      </div>
    );
  }

  return (
    <>
      <Dialog
        open={selectedFarmForDetails !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedFarmForDetails(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedFarmForDetails?.farmName}</DialogTitle>
            <DialogDescription>
              Weekly rewards breakdown for{" "}
              {selectedFarmForDetails?.type === "delegator"
                ? "delegators"
                : "miners"}
            </DialogDescription>
          </DialogHeader>

          {selectedBreakdown && selectedBreakdown.length > 0 && (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Week</th>
                      <th className="text-right p-3 font-medium">Emissions</th>
                      <th className="text-right p-3 font-medium">
                        Protocol Deposit
                      </th>
                      <th className="text-right p-3 font-medium">Asset</th>
                      <th className="text-right p-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBreakdown
                      .slice()
                      .reverse()
                      .map((week: any) => {
                        const inflation = new Decimal(week.inflationRewards)
                          .div(1e18)
                          .toNumber();
                        const protocolDeposit = new Decimal(
                          week.protocolDepositRewards
                        )
                          .div(1e18)
                          .toNumber();
                        const total = new Decimal(week.totalRewards)
                          .div(1e18)
                          .toNumber();

                        return (
                          <tr
                            key={week.weekNumber}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="p-3 font-semibold">
                              {week.weekNumber}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {inflation.toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                              })}{" "}
                              GLW
                            </td>
                            <td className="p-3 text-right font-mono">
                              {protocolDeposit.toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                              })}{" "}
                              {week.protocolDepositAsset || "GLW"}
                            </td>
                            <td className="p-3 text-right">
                              <Badge variant="outline" className="text-xs">
                                {week.protocolDepositAsset || "GLW"}
                              </Badge>
                            </td>
                            <td className="p-3 text-right font-mono font-semibold">
                              {total.toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                              })}{" "}
                              GLW
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Farm Performance Overview
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Individual farm breakdown ordered by rewards efficiency
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select
                value={sortBy}
                onValueChange={(value) =>
                  setSortBy(value as "rewards" | "participants" | "weeksLeft")
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rewards">Total Rewards</SelectItem>
                  <SelectItem value="participants">Participants</SelectItem>
                  <SelectItem value="weeksLeft">Weeks Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isFetching ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-64 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedFarms.map((farm) => {
                const delegatorTotalRewards = new Decimal(
                  farm.delegator.rewardsPerPiece?.total?.allWeeks || "0"
                )
                  .times(farm.delegator.stepsSold)
                  .div(1e18)
                  .toNumber();

                const delegatorInflation = new Decimal(
                  farm.delegator.rewardsPerPiece?.inflation?.allWeeks || "0"
                )
                  .times(farm.delegator.stepsSold)
                  .div(1e18)
                  .toNumber();

                const delegatorPD = new Decimal(
                  farm.delegator.rewardsPerPiece?.protocolDeposit?.allWeeks ||
                    "0"
                )
                  .times(farm.delegator.stepsSold)
                  .div(1e18)
                  .toNumber();

                const minerTotalRewards = new Decimal(
                  farm.miner.rewardsPerPiece?.total?.allWeeks || "0"
                )
                  .times(farm.miner.stepsSold)
                  .div(1e18)
                  .toNumber();

                const minerInflation = new Decimal(
                  farm.miner.rewardsPerPiece?.inflation?.allWeeks || "0"
                )
                  .times(farm.miner.stepsSold)
                  .div(1e18)
                  .toNumber();

                const minerPD = new Decimal(
                  farm.miner.rewardsPerPiece?.protocolDeposit?.allWeeks || "0"
                )
                  .times(farm.miner.stepsSold)
                  .div(1e18)
                  .toNumber();

                const delegatorLastWeek = new Decimal(
                  farm.delegator.rewardsPerPiece?.total?.lastWeek || "0"
                )
                  .times(farm.delegator.stepsSold)
                  .div(1e18)
                  .toNumber();

                const minerLastWeek = new Decimal(
                  farm.miner.rewardsPerPiece?.total?.lastWeek || "0"
                )
                  .times(farm.miner.stepsSold)
                  .div(1e18)
                  .toNumber();

                const totalCombinedRewards =
                  delegatorTotalRewards + minerTotalRewards;

                return (
                  <Card
                    key={farm.farmId}
                    className="border-border/60 hover:border-primary/50 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_320px]"
                  >
                    <CardHeader className="pb-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-tight">
                            {farm.farmName || "Unknown Farm"}
                          </CardTitle>
                        </div>
                        <div className="flex gap-1.5">
                          {farm.fractionTypes.includes("launchpad") && (
                            <Badge variant="secondary" className="text-xs">
                              Launchpad
                            </Badge>
                          )}
                          {farm.fractionTypes.includes("mining-center") && (
                            <Badge variant="outline" className="text-xs">
                              Mining
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {farm.delegator.stepsSold > 0 && (
                        <div className="space-y-3 border border-[#dcc4ff]/20 rounded-lg p-3">
                          <div className="flex items-center justify-between pb-2 border-b border-[#dcc4ff]/20">
                            <span className="text-xs font-semibold text-[#9b7ac7] dark:text-[#dcc4ff] uppercase tracking-wide">
                              Delegators
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {farm.participants.uniqueDelegators}{" "}
                              {farm.participants.uniqueDelegators === 1
                                ? "wallet"
                                : "wallets"}
                            </span>
                          </div>

                          <div className="space-y-3 rounded-lg p-3">
                            <div className="flex justify-between items-baseline">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                Delegated
                              </span>
                              <span className="font-mono font-bold text-base">
                                {farm.totalDelegated.toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                <span className="text-sm font-normal">GLW</span>
                              </span>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                Earned
                              </span>
                              <span className="font-mono font-bold text-base text-[#9b7ac7] dark:text-[#dcc4ff]">
                                {delegatorTotalRewards.toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                <span className="text-sm font-normal">GLW</span>
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium uppercase tracking-wide">
                                Performance
                              </span>
                              <span
                                className={`text-xs font-semibold ${
                                  Number(farm.delegator.roi?.allWeeks || "0") >=
                                  100
                                    ? "text-[#9b7ac7] dark:text-[#dcc4ff]"
                                    : Number(
                                        farm.delegator.roi?.allWeeks || "0"
                                      ) >= 50
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-orange-600 dark:text-orange-400"
                                }`}
                              >
                                {Number(farm.delegator.roi?.allWeeks || "0") >=
                                100
                                  ? "Profitable"
                                  : Number(
                                      farm.delegator.roi?.allWeeks || "0"
                                    ) >= 50
                                  ? "On Track"
                                  : "Building"}
                              </span>
                            </div>
                            <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted border border-border">
                              <div
                                className={`transition-all ${
                                  Number(farm.delegator.roi?.allWeeks || "0") >=
                                  100
                                    ? "bg-[#dcc4ff]"
                                    : Number(
                                        farm.delegator.roi?.allWeeks || "0"
                                      ) >= 50
                                    ? "bg-yellow-500"
                                    : "bg-orange-500"
                                }`}
                                style={{
                                  width: `${Math.min(
                                    Number(farm.delegator.roi?.allWeeks || "0"),
                                    100
                                  )}%`,
                                }}
                              />
                              {Number(farm.delegator.roi?.allWeeks || "0") >
                                100 && (
                                <div
                                  className="bg-[#9b7ac7]"
                                  style={{
                                    width: `${Math.min(
                                      Number(
                                        farm.delegator.roi?.allWeeks || "0"
                                      ) - 100,
                                      100
                                    )}%`,
                                  }}
                                />
                              )}
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-mono font-semibold text-[#9b7ac7] dark:text-[#dcc4ff]">
                                {Number(
                                  farm.delegator.roi?.allWeeks || "0"
                                ).toFixed(1)}
                                % Rewards
                              </span>
                              <span className="text-muted-foreground">
                                {farm.delegator.weeksEarned}w earned /{" "}
                                {farm.delegator.weeksLeft}w left
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                            <div className="space-y-1.5">
                              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                Steps
                              </div>
                              <div className="font-mono font-semibold text-base">
                                {farm.delegator.stepsSold}
                              </div>
                            </div>
                            <div className="space-y-1.5 text-right">
                              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                Last Week
                              </div>
                              <div className="font-mono font-semibold text-base">
                                {delegatorLastWeek.toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                <span className="text-xs font-normal">GLW</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                Paid/Step
                              </div>
                              <div className="font-mono font-semibold text-sm">
                                {formatGLWAmount(
                                  farm.delegator.weightedPieceSizeGlw
                                )}{" "}
                                <span className="text-xs font-normal">GLW</span>
                              </div>
                            </div>
                            <div className="space-y-1.5 text-right">
                              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                Earned/Step
                              </div>
                              <div className="font-mono font-semibold text-sm text-[#9b7ac7] dark:text-[#dcc4ff]">
                                {(
                                  delegatorTotalRewards /
                                  farm.delegator.stepsSold
                                ).toLocaleString("en-US", {
                                  maximumFractionDigits: 2,
                                })}{" "}
                                <span className="text-xs font-normal">GLW</span>
                              </div>
                            </div>
                          </div>

                          {farm.delegator.weeklyBreakdown &&
                            farm.delegator.weeklyBreakdown.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-3"
                                onClick={() => {
                                  setSelectedFarmForDetails({
                                    farmId: farm.farmId,
                                    farmName: farm.farmName || "Unknown Farm",
                                    type: "delegator",
                                  });
                                }}
                              >
                                See Details
                                <ChevronRight className="w-4 h-4 ml-2" />
                              </Button>
                            )}
                        </div>
                      )}

                      {farm.miner.stepsSold > 0 && (
                        <div className="space-y-3 border border-[#ccffd4]/20 rounded-lg p-3">
                          <div className="flex items-center justify-between pb-2 border-b border-[#ccffd4]/20">
                            <span className="text-xs font-semibold text-[#5fb56f] dark:text-[#ccffd4] uppercase tracking-wide">
                              Miners
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {farm.participants.uniqueMiners}{" "}
                              {farm.participants.uniqueMiners === 1
                                ? "wallet"
                                : "wallets"}
                            </span>
                          </div>

                          <div className="space-y-3 rounded-lg p-3">
                            <div className="flex justify-between items-baseline">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                Spent (USDC)
                              </span>
                              <span className="font-mono font-bold text-base">
                                $
                                {farm.totalMinerSpent.toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                Earned
                              </span>
                              <span className="font-mono font-bold text-base text-[#5fb56f] dark:text-[#ccffd4]">
                                {minerTotalRewards.toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                <span className="text-sm font-normal">GLW</span>
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium uppercase tracking-wide">
                                Performance
                              </span>
                              <span
                                className={`text-xs font-semibold ${
                                  Number(farm.miner.roi?.allWeeks || "0") >= 100
                                    ? "text-[#5fb56f] dark:text-[#ccffd4]"
                                    : Number(farm.miner.roi?.allWeeks || "0") >=
                                      50
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-orange-600 dark:text-orange-400"
                                }`}
                              >
                                {Number(farm.miner.roi?.allWeeks || "0") >= 100
                                  ? "Profitable"
                                  : Number(farm.miner.roi?.allWeeks || "0") >=
                                    50
                                  ? "On Track"
                                  : "Building"}
                              </span>
                            </div>
                            <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted border border-border">
                              <div
                                className={`transition-all ${
                                  Number(farm.miner.roi?.allWeeks || "0") >= 100
                                    ? "bg-[#ccffd4]"
                                    : Number(farm.miner.roi?.allWeeks || "0") >=
                                      50
                                    ? "bg-yellow-500"
                                    : "bg-orange-500"
                                }`}
                                style={{
                                  width: `${Math.min(
                                    Number(farm.miner.roi?.allWeeks || "0"),
                                    100
                                  )}%`,
                                }}
                              />
                              {Number(farm.miner.roi?.allWeeks || "0") >
                                100 && (
                                <div
                                  className="bg-[#5fb56f]"
                                  style={{
                                    width: `${Math.min(
                                      Number(farm.miner.roi?.allWeeks || "0") -
                                        100,
                                      100
                                    )}%`,
                                  }}
                                />
                              )}
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-mono font-semibold text-[#5fb56f] dark:text-[#ccffd4]">
                                {Number(
                                  farm.miner.roi?.allWeeks || "0"
                                ).toFixed(1)}
                                % Rewards
                              </span>
                              <span className="text-muted-foreground">
                                {farm.miner.weeksEarned}w earned /{" "}
                                {farm.miner.weeksLeft}w left
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                            <div className="space-y-1.5">
                              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                Steps
                              </div>
                              <div className="font-mono font-semibold text-base">
                                {farm.miner.stepsSold}
                              </div>
                            </div>
                            <div className="space-y-1.5 text-right">
                              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                Last Week
                              </div>
                              <div className="font-mono font-semibold text-base">
                                {minerLastWeek.toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                <span className="text-xs font-normal">GLW</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                Paid/Step
                              </div>
                              <div className="font-mono font-semibold text-sm">
                                $
                                {formatUSDAmount(
                                  farm.miner.weightedPiecePriceUsdc
                                )}
                              </div>
                            </div>
                            <div className="space-y-1.5 text-right">
                              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                Earned/Step
                              </div>
                              <div className="font-mono font-semibold text-sm text-[#5fb56f] dark:text-[#ccffd4]">
                                {(
                                  minerTotalRewards / farm.miner.stepsSold
                                ).toLocaleString("en-US", {
                                  maximumFractionDigits: 2,
                                })}{" "}
                                <span className="text-xs font-normal">GLW</span>
                              </div>
                            </div>
                          </div>

                          {farm.miner.weeklyBreakdown &&
                            farm.miner.weeklyBreakdown.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-3"
                                onClick={() => {
                                  setSelectedFarmForDetails({
                                    farmId: farm.farmId,
                                    farmName: farm.farmName || "Unknown Farm",
                                    type: "miner",
                                  });
                                }}
                              >
                                See Details
                                <ChevronRight className="w-4 h-4 ml-2" />
                              </Button>
                            )}
                        </div>
                      )}

                      {totalCombinedRewards > 0 &&
                        farm.delegator.stepsSold > 0 &&
                        farm.miner.stepsSold > 0 && (
                          <div className="pt-4 border-t border-dashed">
                            <div className="flex justify-between items-center bg-muted/30 rounded-lg p-3">
                              <span className="text-xs font-semibold uppercase tracking-wide">
                                Combined Total
                              </span>
                              <span className="font-mono font-bold text-lg">
                                {totalCombinedRewards.toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                <span className="text-sm font-normal">GLW</span>
                              </span>
                            </div>
                          </div>
                        )}

                      {farm.delegator.stepsSold === 0 &&
                        farm.miner.stepsSold === 0 && (
                          <div className="text-center text-sm text-muted-foreground py-4">
                            No active delegations or mining
                          </div>
                        )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
