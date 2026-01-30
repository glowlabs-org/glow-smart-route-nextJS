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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  useFarmsPerPieceStats,
  type FarmPerPieceStats,
} from "@/hooks/useFarmsPerPieceStats";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";

function MiningStatsSkeleton() {
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
      const delegatorROI = Number(farm.delegator.roi?.allWeeks || "0") / 100;
      const minerROI = Number(farm.miner.roi?.allWeeks || "0") / 100;

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
                }
                if (name === "minerROI" || name === "Miner Rewards") {
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

const CASH_BOUNTY_BY_APPLICATION_ID: Record<string, number | null> = {
  "83b11acc-5207-47b5-a07f-483db5e48871": 1000,
  "9c712552-e0bf-4a30-babd-9962f311929f": 1500,
  "970c24ed-6273-4899-b8a1-c0c3742d9ae9": 1500,
  "ed8eecb0-1509-4d7c-8337-a958e6064b5c": 1500,
  "54c1ce52-15d3-4dbd-85d0-eb06f6feed8a": 1500,
  "8dcf8df9-9d1b-4c10-b648-ac7b2f63dd28": 1500,
  "a315a8e5-dcd7-4e2b-bdba-54a34e03e826": 4000,
  "61e1d3c1-2682-4025-9db8-7d160bedf315": 2500,
  "c41fc798-7cde-461c-a0f5-f9742a701990": 2000,
  "8dd53eae-4dcf-4877-a5aa-492bb1ff72e9": 1500,
  "71c4918e-19dd-4bb7-bcae-b27532eb4c94": 2500,
  "25d454f1-a021-435c-b46a-476fca1b0d45": 1800,
  "6dd28b54-745b-4e51-84fb-a5d9fd1432da": 1600,
  "1987c17d-b927-410a-b1b4-2993beb33dbf": 500,
  "c63b17d1-e3be-4bc4-92b9-f5df3d2b0e92": 2000,
  "737a6761-01ac-46f9-8794-e45d3afd7726": 800,
  "ca7ae649-974e-437d-a843-2a65b08aeb2f": 3000,
  "93eeaf4d-3f43-41e1-8b7f-0f8018ed78d1": 6500,
  "f6963add-86a4-48f0-81a7-5b8b2f0b680f": 1500,
  "7be6c9e7-5ef5-4fd8-b67a-040d6e436822": 2500,
  "b4d5f092-9c99-44ee-a14a-bcf7ed2fc636": 2600,
  "51e2d48b-243c-4909-bc26-2b15b77daed7": 1200,
  "cc098775-8a92-4f28-924e-4c1ba8c7a4f6": null,
};

interface HealthStatus {
  label: "Ahead" | "On track" | "Behind" | "At risk";
  badgeClass: string;
  barClass: string;
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
  cashBountyUsd: number | null;
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
    earnedUsd: number;
    breakEvenPercent: number;
    weeksEarned: number;
    totalWeeks: number;
    stepsSold: number;
    paidPerStepUsd: number;
    earnedPerStep: number;
    earnedPerStepUsd: number;
    roiPercent: number;
    wallets: number;
    breakdown: FarmPerPieceStats["miner"]["weeklyBreakdown"];
    lastWeekRewards: number;
    lastWeekUsd: number;
  };
}

interface TrackStatus {
  label: "Ahead" | "On track" | "Behind" | "At risk" | "Not active";
  barClass: string;
  textClass: string;
  badgeClass: string;
}

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 200) return 200;
  return value;
}

function formatUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  const digits = value >= 1000 ? 0 : 2;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;
}

function formatUsdSigned(value: number) {
  if (!Number.isFinite(value) || value === 0) return "$0";
  const sign = value < 0 ? "-" : "";
  const absValue = Math.abs(value);
  const digits = absValue >= 1000 ? 0 : 2;
  return `${sign}$${absValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;
}

function titleCase(value: string | null | undefined) {
  if (!value) return "Unknown";
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
  const ahead =
    (hasDelegation ? delta >= 10 : true) && (hasMining ? minerROI >= 90 : true);
  const onTrack =
    (hasDelegation ? delta >= -5 : true) && (hasMining ? minerROI >= 60 : true);
  const behind =
    (hasDelegation ? delta >= -20 : true) &&
    (hasMining ? minerROI >= 40 : true);

  if (ahead) {
    return {
      label: "Ahead",
      badgeClass:
        "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
      barClass: "bg-emerald-400",
      score: 3,
      description: "Outperforming projections",
    };
  }

  if (onTrack) {
    return {
      label: "On track",
      badgeClass:
        "bg-yellow-500/10 text-yellow-200 border border-yellow-500/30",
      barClass: "bg-yellow-400",
      score: 2,
      description: "Tracking to expectations",
    };
  }

  if (behind) {
    return {
      label: "Behind",
      badgeClass:
        "bg-orange-500/10 text-orange-200 border border-orange-500/30",
      barClass: "bg-orange-400",
      score: 1,
      description: "Needs attention to catch up",
    };
  }

  return {
    label: "At risk",
    badgeClass: "bg-red-500/10 text-red-200 border border-red-500/30",
    barClass: "bg-red-500",
    score: 0,
    description: "Significant gap vs plan",
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

function getDelegationStatus(
  delegation: FarmSummaryRow["delegation"]
): TrackStatus {
  if (delegation.stepsSold === 0) {
    return {
      label: "Not active",
      barClass: "bg-muted-foreground/30",
      textClass: "text-muted-foreground",
      badgeClass: "bg-muted text-muted-foreground border border-border",
    };
  }

  const delta = delegation.recoveryPercent - delegation.expectedPercent;
  if (delta >= 10) {
    return {
      label: "Ahead",
      barClass: "bg-emerald-400",
      textClass: "text-emerald-300",
      badgeClass:
        "bg-emerald-500/10 text-emerald-200 border border-emerald-500/30",
    };
  }
  if (delta >= -5) {
    return {
      label: "On track",
      barClass: "bg-emerald-400",
      textClass: "text-yellow-200",
      badgeClass:
        "bg-yellow-500/10 text-yellow-200 border border-yellow-500/30",
    };
  }
  if (delta >= -20) {
    return {
      label: "Behind",
      barClass: "bg-emerald-400",
      textClass: "text-orange-200",
      badgeClass:
        "bg-orange-500/10 text-orange-200 border border-orange-500/30",
    };
  }
  return {
    label: "At risk",
    barClass: "bg-emerald-400",
    textClass: "text-red-200",
    badgeClass: "bg-red-500/10 text-red-200 border border-red-500/30",
  };
}

function getMiningStatus(mining: FarmSummaryRow["mining"]): TrackStatus {
  if (mining.stepsSold === 0) {
    return {
      label: "Not active",
      barClass: "bg-muted-foreground/30",
      textClass: "text-muted-foreground",
      badgeClass: "bg-muted text-muted-foreground border border-border",
    };
  }

  if (mining.breakEvenPercent >= 90) {
    return {
      label: "Ahead",
      barClass: "bg-emerald-400",
      textClass: "text-emerald-300",
      badgeClass:
        "bg-emerald-500/10 text-emerald-200 border border-emerald-500/30",
    };
  }
  if (mining.breakEvenPercent >= 60) {
    return {
      label: "On track",
      barClass: "bg-emerald-400",
      textClass: "text-yellow-200",
      badgeClass:
        "bg-yellow-500/10 text-yellow-200 border border-yellow-500/30",
    };
  }
  if (mining.breakEvenPercent >= 40) {
    return {
      label: "Behind",
      barClass: "bg-emerald-400",
      textClass: "text-orange-200",
      badgeClass:
        "bg-orange-500/10 text-orange-200 border border-orange-500/30",
    };
  }
  return {
    label: "At risk",
    barClass: "bg-emerald-400",
    textClass: "text-red-200",
    badgeClass: "bg-red-500/10 text-red-200 border border-red-500/30",
  };
}

const FILTER_OPTIONS: Array<{
  value: FarmFilterOption;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "delegation-only", label: "Delegation only" },
  { value: "mining-only", label: "Mining only" },
  { value: "both", label: "Both" },
];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "rewardScore", label: "Highest Reward Score" },
  { value: "delegated", label: "Most delegated GLW" },
  { value: "mined", label: "Most GLW mined" },
  { value: "risk", label: "Most at risk" },
];

export function MiningStats() {
  const [sortBy, setSortBy] = React.useState<SortOption>("rewardScore");
  const [filterBy, setFilterBy] = React.useState<FarmFilterOption>("all");
  const [selectedFarmId, setSelectedFarmId] = React.useState<string | null>(
    null
  );
  const [detailView, setDetailView] = React.useState<DetailView>("delegation");

  const { data, isLoading, isFetching, isError } = useFarmsPerPieceStats({
    enabled: true,
    endWeek: 114,
  });
  const { spotPrice } = useGlowSpotPrice();

  const farmsSummary = React.useMemo(() => {
    if (!data?.farms) return [];

    const rows = data.farms.map((farm) => {
      const hasDelegation =
        farm.delegator.stepsSold > 0 && farm.participants.uniqueDelegators > 0;
      const hasMining =
        farm.miner.stepsSold > 0 && farm.participants.uniqueMiners > 0;

      const totalDelegated =
        hasDelegation || farm.delegator.stepsSold > 0
          ? new Decimal(farm.delegator.weightedPieceSizeGlw || "0")
              .times(farm.delegator.stepsSold)
              .div(1e18)
              .toNumber()
          : 0;

      const delegationEarned =
        hasDelegation || farm.delegator.stepsSold > 0
          ? new Decimal(farm.delegator.rewardsPerPiece?.total?.allWeeks || "0")
              .times(farm.delegator.stepsSold)
              .div(1e18)
              .toNumber()
          : 0;

      const delegationLastWeek =
        hasDelegation || farm.delegator.stepsSold > 0
          ? new Decimal(farm.delegator.rewardsPerPiece?.total?.lastWeek || "0")
              .times(farm.delegator.stepsSold)
              .div(1e18)
              .toNumber()
          : 0;

      const recoveryPercent =
        totalDelegated === 0 ? 0 : (delegationEarned / totalDelegated) * 100;
      const delegationTotalWeeks =
        farm.delegator.weeksEarned + farm.delegator.weeksLeft;
      const expectedPercent =
        delegationTotalWeeks === 0
          ? 0
          : (farm.delegator.weeksEarned / delegationTotalWeeks) * 100;

      const paidPerStepGlw = hasDelegation
        ? new Decimal(farm.delegator.weightedPieceSizeGlw || "0")
            .div(1e18)
            .toNumber()
        : 0;

      const earnedPerStepGlw =
        hasDelegation && farm.delegator.stepsSold > 0
          ? delegationEarned / farm.delegator.stepsSold
          : 0;

      const totalMinerSpent =
        hasMining || farm.miner.stepsSold > 0
          ? new Decimal(farm.miner.weightedPiecePriceUsdc || "0")
              .times(farm.miner.stepsSold)
              .div(1e6)
              .toNumber()
          : 0;

      const minerEarned =
        hasMining || farm.miner.stepsSold > 0
          ? new Decimal(farm.miner.rewardsPerPiece?.total?.allWeeks || "0")
              .times(farm.miner.stepsSold)
              .div(1e18)
              .toNumber()
          : 0;

      const minerLastWeek =
        hasMining || farm.miner.stepsSold > 0
          ? new Decimal(farm.miner.rewardsPerPiece?.total?.lastWeek || "0")
              .times(farm.miner.stepsSold)
              .div(1e18)
              .toNumber()
          : 0;
      const minerEarnedUsd = minerEarned * spotPrice;
      const minerLastWeekUsd = minerLastWeek * spotPrice;

      const breakEvenPercent = clampPercent(
        hasMining ? Number(farm.miner.roi?.allWeeks || "0") : 0
      );

      const paidPerStepUsd = hasMining
        ? new Decimal(farm.miner.weightedPiecePriceUsdc || "0")
            .div(1e6)
            .toNumber()
        : 0;

      const earnedPerStepGlwValue =
        hasMining && farm.miner.stepsSold > 0
          ? minerEarned / farm.miner.stepsSold
          : 0;
      const earnedPerStepUsd =
        hasMining && farm.miner.stepsSold > 0
          ? earnedPerStepGlwValue * spotPrice
          : 0;

      const combinedGlw = delegationEarned + minerEarned;

      const health = evaluateHealthStatus({
        recoveryPercent,
        expectedPercent,
        minerROI: breakEvenPercent,
        hasDelegation,
        hasMining,
      });

      const rewardScore = calculateRewardScore({
        recoveryPercent: clampPercent(recoveryPercent),
        breakEvenPercent,
        hasDelegation,
        hasMining,
      });

      const cashBountyUsd = CASH_BOUNTY_BY_APPLICATION_ID[farm.appId] ?? null;

      return {
        farmId: farm.farmId,
        farmName: farm.farmName || "Unknown Farm",
        appId: farm.appId,
        regionLabel: titleCase(farm.appId),
        tags: buildFarmTags(farm, hasDelegation, hasMining),
        rewardScore,
        rewardDelta: 0,
        combinedGlw,
        cashBountyUsd,
        health,
        hasDelegation,
        hasMining,
        delegation: {
          totalDelegated,
          earnedToDate: delegationEarned,
          recoveryPercent: clampPercent(recoveryPercent),
          expectedPercent: clampPercent(expectedPercent),
          weeksEarned: farm.delegator.weeksEarned,
          totalWeeks: delegationTotalWeeks,
          stepsSold: farm.delegator.stepsSold,
          paidPerStep: paidPerStepGlw,
          earnedPerStep: earnedPerStepGlw,
          roiPercent: Number(farm.delegator.roi?.allWeeks || "0"),
          wallets: farm.participants.uniqueDelegators,
          breakdown: farm.delegator.weeklyBreakdown,
          lastWeekRewards: delegationLastWeek,
        },
        mining: {
          totalSpent: totalMinerSpent,
          earnedToDate: minerEarned,
          earnedUsd: minerEarnedUsd,
          breakEvenPercent,
          weeksEarned: farm.miner.weeksEarned,
          totalWeeks: farm.miner.weeksEarned + farm.miner.weeksLeft,
          stepsSold: farm.miner.stepsSold,
          paidPerStepUsd,
          earnedPerStep: earnedPerStepGlwValue,
          earnedPerStepUsd,
          roiPercent: Number(farm.miner.roi?.allWeeks || "0"),
          wallets: farm.participants.uniqueMiners,
          breakdown: farm.miner.weeklyBreakdown,
          lastWeekRewards: minerLastWeek,
          lastWeekUsd: minerLastWeekUsd,
        },
      } as FarmSummaryRow;
    });

    const average =
      rows.length === 0
        ? 0
        : rows.reduce((sum, row) => sum + row.rewardScore, 0) / rows.length;

    return rows.map((row) => ({
      ...row,
      rewardDelta: row.rewardScore - average,
    }));
  }, [data, spotPrice]);

  const miningTotals = React.useMemo(() => {
    let totalMining = 0;
    let totalBounty = 0;

    for (const farm of farmsSummary) {
      totalMining += farm.mining.totalSpent;
      if (farm.cashBountyUsd !== null) {
        totalBounty += farm.cashBountyUsd;
      }
    }

    return {
      totalMining,
      totalBounty,
    };
  }, [farmsSummary]);

  const filteredFarms = React.useMemo(() => {
    return farmsSummary.filter((farm) => {
      if (filterBy === "delegation-only") {
        return farm.hasDelegation && !farm.hasMining;
      }
      if (filterBy === "mining-only") {
        return farm.hasMining && !farm.hasDelegation;
      }
      if (filterBy === "both") {
        return farm.hasDelegation && farm.hasMining;
      }
      return true;
    });
  }, [farmsSummary, filterBy]);

  const sortedFarms = React.useMemo(() => {
    const rows = [...filteredFarms];
    rows.sort((a, b) => {
      if (sortBy === "delegated") {
        return b.delegation.totalDelegated - a.delegation.totalDelegated;
      }
      if (sortBy === "mined") {
        return b.mining.totalSpent - a.mining.totalSpent;
      }
      if (sortBy === "risk") {
        if (a.health.score !== b.health.score) {
          return a.health.score - b.health.score;
        }
        return a.rewardScore - b.rewardScore;
      }
      return b.rewardScore - a.rewardScore;
    });
    return rows;
  }, [filteredFarms, sortBy]);

  const selectedFarm = React.useMemo(() => {
    if (!selectedFarmId || !data?.farms) return null;
    const summary = farmsSummary.find((farm) => farm.farmId === selectedFarmId);
    const raw = data.farms.find((farm) => farm.farmId === selectedFarmId);
    if (!summary || !raw) return null;
    return { summary, raw };
  }, [selectedFarmId, farmsSummary, data]);

  const resolvedDetailView = React.useMemo<DetailView>(() => {
    if (!selectedFarm) return detailView;
    if (detailView === "delegation" && !selectedFarm.summary.hasDelegation) {
      return "mining";
    }
    if (detailView === "mining" && !selectedFarm.summary.hasMining) {
      return "delegation";
    }
    return detailView;
  }, [detailView, selectedFarm]);

  const breakdownRows = React.useMemo(() => {
    if (!selectedFarm) return [];
    return resolvedDetailView === "delegation"
      ? selectedFarm.raw.delegator.weeklyBreakdown
      : selectedFarm.raw.miner.weeklyBreakdown;
  }, [selectedFarm, resolvedDetailView]);

  const renderLedgerValue = React.useCallback(
    (value: number, asset = "GLW") => {
      const glwText = `${value.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })} ${asset}`;
      const showUsd = resolvedDetailView === "mining" && spotPrice > 0;
      if (!showUsd) return glwText;
      return (
        <div className="flex flex-col items-end leading-tight">
          <span>{glwText}</span>
          <span className="text-xs text-muted-foreground font-sans">
            {formatUsd(value * spotPrice)}
          </span>
        </div>
      );
    },
    [resolvedDetailView, spotPrice]
  );

  const dialogDelegationStatus =
    selectedFarm && selectedFarm.summary.hasDelegation
      ? getDelegationStatus(selectedFarm.summary.delegation)
      : null;
  const dialogMiningStatus =
    selectedFarm && selectedFarm.summary.hasMining
      ? getMiningStatus(selectedFarm.summary.mining)
      : null;

  const openDetails = (farm: FarmSummaryRow, view?: DetailView) => {
    const defaultView = view ?? (farm.hasDelegation ? "delegation" : "mining");
    setSelectedFarmId(farm.farmId);
    setDetailView(defaultView);
  };

  if (isLoading) {
    return <MiningStatsSkeleton />;
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
        open={Boolean(selectedFarm)}
        onOpenChange={(open) => {
          if (!open) setSelectedFarmId(null);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedFarm && (
            <div className="space-y-6">
              <DialogHeader className="space-y-3">
                <div>
                  <DialogTitle className="text-2xl">
                    {selectedFarm.summary.farmName}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedFarm.summary.regionLabel} ·{" "}
                    <span className="font-mono text-xs">
                      {selectedFarm.summary.appId}
                    </span>
                    {selectedFarm.summary.cashBountyUsd !== null && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · Cash bounty{" "}
                        {formatUsd(selectedFarm.summary.cashBountyUsd)}
                      </span>
                    )}
                  </DialogDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedFarm.summary.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </DialogHeader>

              <div
                className={`grid gap-4 ${
                  selectedFarm.summary.hasDelegation &&
                  selectedFarm.summary.hasMining
                    ? "md:grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {selectedFarm.summary.hasDelegation && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">
                          Delegation health
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatWeeksLabel(
                            selectedFarm.summary.delegation.weeksEarned,
                            selectedFarm.summary.delegation.totalWeeks
                          )}
                        </p>
                      </div>
                      {dialogDelegationStatus && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${dialogDelegationStatus.badgeClass}`}
                        >
                          {dialogDelegationStatus.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Recovery</span>
                      <span
                        className={`font-semibold ${
                          dialogDelegationStatus?.textClass ?? ""
                        }`}
                      >
                        {selectedFarm.summary.delegation.recoveryPercent.toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Delegated:{" "}
                      {selectedFarm.summary.delegation.totalDelegated.toLocaleString(
                        "en-US",
                        { maximumFractionDigits: 0 }
                      )}{" "}
                      GLW · Earned:{" "}
                      {selectedFarm.summary.delegation.earnedToDate.toLocaleString(
                        "en-US",
                        { maximumFractionDigits: 0 }
                      )}{" "}
                      GLW
                    </p>
                  </div>
                )}
                {selectedFarm.summary.hasMining && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">
                          Mining health
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatWeeksLabel(
                            selectedFarm.summary.mining.weeksEarned,
                            selectedFarm.summary.mining.totalWeeks
                          )}
                        </p>
                      </div>
                      {dialogMiningStatus && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${dialogMiningStatus.badgeClass}`}
                        >
                          {dialogMiningStatus.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Break-even</span>
                      <span
                        className={`font-semibold ${
                          dialogMiningStatus?.textClass ?? ""
                        }`}
                      >
                        {selectedFarm.summary.mining.breakEvenPercent.toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Rewards:{" "}
                      {formatUsd(selectedFarm.summary.mining.earnedUsd)} (
                      {selectedFarm.summary.mining.earnedToDate.toLocaleString(
                        "en-US",
                        { maximumFractionDigits: 0 }
                      )}{" "}
                      GLW) · Spent: $
                      {selectedFarm.summary.mining.totalSpent.toLocaleString(
                        "en-US",
                        { maximumFractionDigits: 0 }
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div
                className={`grid gap-6 ${
                  selectedFarm.summary.hasDelegation &&
                  selectedFarm.summary.hasMining
                    ? "md:grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {selectedFarm.summary.hasDelegation && (
                  <DelegationMetricsCard
                    delegation={selectedFarm.summary.delegation}
                  />
                )}
                {selectedFarm.summary.hasMining && (
                  <MiningMetricsCard mining={selectedFarm.summary.mining} />
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs uppercase text-muted-foreground">
                  Timeline
                </p>
                {selectedFarm.summary.hasDelegation && (
                  <p className="text-sm">
                    Delegation •{" "}
                    {formatWeeksLabel(
                      selectedFarm.summary.delegation.weeksEarned,
                      selectedFarm.summary.delegation.totalWeeks
                    )}
                  </p>
                )}
                {selectedFarm.summary.hasMining && (
                  <p className="text-sm">
                    Mining •{" "}
                    {formatWeeksLabel(
                      selectedFarm.summary.mining.weeksEarned,
                      selectedFarm.summary.mining.totalWeeks
                    )}
                  </p>
                )}
              </div>

              <CombinedTotalsStrip summary={selectedFarm.summary} />

              {breakdownRows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">
                      {resolvedDetailView === "delegation"
                        ? "Delegation weekly ledger"
                        : "Mining weekly ledger"}
                    </h4>
                    <div className="flex gap-2">
                      {selectedFarm.summary.hasDelegation && (
                        <Button
                          size="sm"
                          variant={
                            resolvedDetailView === "delegation"
                              ? "default"
                              : "outline"
                          }
                          onClick={() => setDetailView("delegation")}
                        >
                          Delegation
                        </Button>
                      )}
                      {selectedFarm.summary.hasMining && (
                        <Button
                          size="sm"
                          variant={
                            resolvedDetailView === "mining"
                              ? "default"
                              : "outline"
                          }
                          onClick={() => setDetailView("mining")}
                        >
                          Mining
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-3 font-medium">Week</th>
                            <th className="text-right p-3 font-medium">
                              Emissions
                            </th>
                            <th className="text-right p-3 font-medium">
                              Protocol Deposit
                            </th>
                            <th className="text-right p-3 font-medium">
                              Asset
                            </th>
                            <th className="text-right p-3 font-medium">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdownRows
                            .slice()
                            .reverse()
                            .map((week) => {
                              const inflation = new Decimal(
                                week.inflationRewards
                              )
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
                                  key={`${week.weekNumber}-${resolvedDetailView}`}
                                  className="border-b last:border-0 hover:bg-muted/30"
                                >
                                  <td className="p-3 font-semibold">
                                    {week.weekNumber}
                                  </td>
                                  <td className="p-3 text-right font-mono">
                                    {renderLedgerValue(inflation)}
                                  </td>
                                  <td className="p-3 text-right font-mono">
                                    {renderLedgerValue(
                                      protocolDeposit,
                                      week.protocolDepositAsset || "GLW"
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {week.protocolDepositAsset || "GLW"}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-right font-mono font-semibold">
                                    {renderLedgerValue(total)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Farm Performance Overview
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Scan delegation & mining health, then drill in via the dialog.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as SortOption)}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={filterBy === option.value ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilterBy(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-5 space-y-2">
              <p className="text-xs uppercase text-muted-foreground">
                Mining sold (USDC)
              </p>
              <p className="text-2xl font-semibold">
                {formatUsd(miningTotals.totalMining)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-5 space-y-2">
              <p className="text-xs uppercase text-muted-foreground">
                Cash bounties paid
              </p>
              <p className="text-2xl font-semibold">
                {formatUsd(miningTotals.totalBounty)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 shadow-none">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Farm summary table</CardTitle>
              <p className="text-sm text-muted-foreground">
                All values reuse existing delegation + mining metrics.
              </p>
            </div>
            {isFetching && (
              <span className="text-xs text-muted-foreground">
                Refreshing data…
              </span>
            )}
          </CardHeader>
          <CardContent className="-mx-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Farm</TableHead>
                    <TableHead className="min-w-[180px] text-right">
                      Delegation – Progress
                    </TableHead>
                    <TableHead className="min-w-[200px] text-right">
                      Delegation – Size
                    </TableHead>
                    <TableHead className="min-w-[180px] text-right">
                      Mining – Progress
                    </TableHead>
    <TableHead className="min-w-[200px] text-right">
      Mining – Size
    </TableHead>
    <TableHead className="min-w-[140px] text-right">
      Cash bounty
    </TableHead>
    <TableHead className="min-w-[160px] text-right">
      Mining – Net
    </TableHead>
    <TableHead className="min-w-[140px] text-right">
      Combined GLW
    </TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFarms.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No farms match this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedFarms.map((farm) => {
                      const delegationStatus = getDelegationStatus(
                        farm.delegation
                      );
                      const miningStatus = getMiningStatus(farm.mining);

                      return (
                        <TableRow
                          key={farm.farmId}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => openDetails(farm)}
                        >
                          <TableCell className="align-top py-4">
                            <div className="font-semibold">{farm.farmName}</div>
                          </TableCell>
                          <TableCell className="align-top py-4 text-right">
                            {farm.hasDelegation ? (
                              <div className="space-y-1">
                                <div
                                  className={`font-semibold ${delegationStatus.textClass}`}
                                >
                                  {farm.delegation.recoveryPercent.toFixed(1)}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatWeeksLabel(
                                    farm.delegation.weeksEarned,
                                    farm.delegation.totalWeeks
                                  )}
                                </div>
                                <div
                                  className={`text-xs font-medium ${delegationStatus.textClass}`}
                                >
                                  {delegationStatus.label}
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`${delegationStatus.barClass} h-full`}
                                    style={{
                                      width: `${clampPercent(
                                        farm.delegation.recoveryPercent
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                No delegation
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="align-top py-4 text-right">
                            {farm.hasDelegation ? (
                              <div className="space-y-1">
                                <div className="font-semibold">
                                  {farm.delegation.totalDelegated.toLocaleString(
                                    "en-US",
                                    { maximumFractionDigits: 0 }
                                  )}{" "}
                                  GLW
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Earned:{" "}
                                  {farm.delegation.earnedToDate.toLocaleString(
                                    "en-US",
                                    { maximumFractionDigits: 0 }
                                  )}{" "}
                                  GLW
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="align-top py-4 text-right">
                            {farm.hasMining ? (
                              <div className="space-y-1">
                                <div
                                  className={`font-semibold ${miningStatus.textClass}`}
                                >
                                  {farm.mining.breakEvenPercent.toFixed(1)}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Earned: {formatUsd(farm.mining.earnedUsd)} (
                                  {farm.mining.earnedToDate.toLocaleString(
                                    "en-US",
                                    {
                                      maximumFractionDigits: 0,
                                    }
                                  )}{" "}
                                  GLW)
                                </div>
                                <div
                                  className={`text-xs font-medium ${miningStatus.textClass}`}
                                >
                                  {miningStatus.label}
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`${miningStatus.barClass} h-full`}
                                    style={{
                                      width: `${clampPercent(
                                        farm.mining.breakEvenPercent
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                No mining
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="align-top py-4 text-right">
                            {farm.hasMining ? (
                              <div className="space-y-1">
                                <div className="font-semibold">
                                  $
                                  {farm.mining.totalSpent.toLocaleString(
                                    "en-US",
                                    {
                                      maximumFractionDigits: 0,
                                    }
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Wallets: {farm.mining.wallets}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="align-top py-4 text-right">
                            {farm.cashBountyUsd === null ? (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            ) : (
                              <div className="font-semibold">
                                {formatUsd(farm.cashBountyUsd)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="align-top py-4 text-right">
                            {farm.hasMining || farm.cashBountyUsd !== null ? (
                              <div className="font-semibold">
                                {formatUsdSigned(
                                  farm.mining.totalSpent -
                                    (farm.cashBountyUsd ?? 0)
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="align-top py-4 text-right">
                            <div className="font-semibold">
                              {farm.combinedGlw.toLocaleString("en-US", {
                                maximumFractionDigits: 0,
                              })}{" "}
                              GLW
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDetails(farm);
                              }}
                            >
                              View details
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

interface DelegationMetricsCardProps {
  delegation: FarmSummaryRow["delegation"];
}

function DelegationMetricsCard({ delegation }: DelegationMetricsCardProps) {
  const status = React.useMemo(
    () => getDelegationStatus(delegation),
    [delegation]
  );

  return (
    <div className="rounded-lg border p-5 space-y-4 bg-muted/5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            Delegation (GLW)
          </p>
          <p className="text-lg font-semibold">
            {delegation.totalDelegated.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}{" "}
            GLW actively delegated
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {delegation.wallets} {delegation.wallets === 1 ? "wallet" : "wallets"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MetricStat
          label="GLW to delegators"
          value={`${delegation.earnedToDate.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })} GLW`}
          helper={`${delegation.weeksEarned} weeks earned`}
        />
        <MetricStat
          label="Steps filled"
          value={delegation.stepsSold.toLocaleString("en-US")}
          align="right"
        />
      </div>
      <ProgressBarWithStatus
        label="Deposit recovery"
        value={delegation.recoveryPercent}
        expected={delegation.expectedPercent}
        helper={formatWeeksLabel(delegation.weeksEarned, delegation.totalWeeks)}
        status={status}
      />
      <div className="grid grid-cols-2 gap-4 border-t pt-4">
        <MetricStat
          label="Paid / step"
          value={`${delegation.paidPerStep.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })} GLW`}
        />
        <MetricStat
          label="Earned / step"
          value={`${delegation.earnedPerStep.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })} GLW`}
          align="right"
        />
        <MetricStat
          label="GLW last week"
          value={`${delegation.lastWeekRewards.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })} GLW`}
        />
        <MetricStat
          label="ROI to date"
          value={`${delegation.roiPercent.toFixed(1)}%`}
          align="right"
        />
      </div>
    </div>
  );
}

interface MiningMetricsCardProps {
  mining: FarmSummaryRow["mining"];
}

function MiningMetricsCard({ mining }: MiningMetricsCardProps) {
  const status = React.useMemo(() => getMiningStatus(mining), [mining]);

  return (
    <div className="rounded-lg border p-5 space-y-4 bg-muted/5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            Mining (USDC → GLW)
          </p>
          <p className="text-lg font-semibold">
            $
            {mining.totalSpent.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}{" "}
            spent
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {mining.wallets} {mining.wallets === 1 ? "wallet" : "wallets"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MetricStat
          label="Rewards to miners"
          value={`${formatUsd(
            mining.earnedUsd
          )} (${mining.earnedToDate.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })} GLW)`}
          helper={`${mining.weeksEarned} weeks earned`}
        />
        <MetricStat
          label="Steps filled"
          value={mining.stepsSold.toLocaleString("en-US")}
          align="right"
        />
      </div>
      <ProgressBarWithStatus
        label="Break-even progress"
        value={mining.breakEvenPercent}
        expected={100}
        helper={`${mining.weeksEarned} weeks elapsed`}
        status={status}
      />
      <div className="grid grid-cols-2 gap-4 border-t pt-4">
        <MetricStat
          label="Paid / step"
          value={`$${mining.paidPerStepUsd.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })}`}
        />
        <MetricStat
          label="Rewards / step"
          value={`${formatUsd(
            mining.earnedPerStepUsd
          )} (${mining.earnedPerStep.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })} GLW)`}
          align="right"
        />
        <MetricStat
          label="Last week rewards"
          value={`${formatUsd(
            mining.lastWeekUsd
          )} (${mining.lastWeekRewards.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })} GLW)`}
        />
        <MetricStat
          label="ROI to date"
          value={`${mining.roiPercent.toFixed(1)}%`}
          align="right"
        />
      </div>
    </div>
  );
}

interface ProgressBarWithStatusProps {
  label: string;
  value: number;
  expected?: number;
  helper: string;
  status: TrackStatus;
}

function ProgressBarWithStatus({
  label,
  value,
  expected,
  helper,
  status,
}: ProgressBarWithStatusProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wide">
        <span>{label}</span>
        {typeof expected === "number" && (
          <span>Target {expected.toFixed(0)}%</span>
        )}
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden border border-border/40">
        <div
          className={`${status.barClass} h-full`}
          style={{ width: `${clampPercent(value)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{value.toFixed(1)}%</span>
        <span className="text-muted-foreground">{helper}</span>
      </div>
    </div>
  );
}

interface MetricStatProps {
  label: string;
  value: string;
  helper?: string;
  align?: "left" | "right";
}

function MetricStat({ label, value, helper, align = "left" }: MetricStatProps) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

function CombinedTotalsStrip({ summary }: { summary: FarmSummaryRow }) {
  return (
    <div className="rounded-lg border border-dashed p-4 bg-muted/10 space-y-3">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricStat
          label="Combined GLW earned"
          value={`${summary.combinedGlw.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })} GLW`}
        />
        <MetricStat
          label="Total deposit size"
          value={`${summary.delegation.totalDelegated.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })} GLW`}
        />
        <MetricStat
          label="Total USDC incentives"
          value={`$${summary.mining.totalSpent.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })}`}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {summary.hasDelegation && (
          <Badge variant="secondary" className="text-xs">
            Delegator ROI {summary.delegation.roiPercent.toFixed(1)}%
          </Badge>
        )}
        {summary.hasMining && (
          <Badge variant="secondary" className="text-xs">
            Miner ROI {summary.mining.roiPercent.toFixed(1)}%
          </Badge>
        )}
      </div>
    </div>
  );
}
