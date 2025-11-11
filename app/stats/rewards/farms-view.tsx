"use client";

import React from "react";
import {
  Activity,
  ArrowUpDown,
  Coins,
  LineChart,
  TrendingUp,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { calculateFarmEfficiency } from "@glowlabs-org/utils/browser";
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
    name: string;
    efficiencyScore: number;
    protocolDepositUsd6: string;
    weeklyImpactAssetsWad: string;
    weeklyGlwRewards?: number;
    weeklyProtocolDeposit?: number;
    weeklyProtocolDepositRewards?: number;
    paymentCurrency?: string;
    regionId: number;
    totalRewardsUsd?: number;
  }>;
  glwPrice: number | null;
}

function FarmsRewardsChart({ farms, glwPrice }: FarmsRewardsChartProps) {
  const chartData = React.useMemo(() => {
    return farms
      .filter((farm) => (farm.totalRewardsUsd ?? 0) > 0)
      .slice(0, 20)
      .map((farm, index) => {
        const totalRewardsUsd = farm.totalRewardsUsd ?? 0;
        const farmName = farm.name || `Farm ${farm.farmId.slice(0, 8)}`;

        return {
          farm: farmName.length > 20 ? `${farmName.slice(0, 17)}...` : farmName,
          fullFarmName: farmName,
          fullFarmId: farm.farmId,
          totalRewardsUsd,
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
      color: "#ff8533",
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
      <BarChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 8, right: 8, top: 12, bottom: 60 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="farm"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          angle={-35}
          textAnchor="end"
          height={80}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) =>
            value >= 1000
              ? `$${(value / 1000).toFixed(1)}k`
              : `$${value.toFixed(0)}`
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="min-w-[220px]"
              labelFormatter={(_, payload) => {
                const farmName = payload?.[0]?.payload?.fullFarmName || "";
                const farmId = payload?.[0]?.payload?.fullFarmId || "";
                return (
                  <div className="space-y-1 mb-2 pb-2 border-b border-border/50">
                    <div className="font-semibold text-sm">{farmName}</div>
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
                    <div key="total-rewards" className="space-y-1">
                      <div className="font-semibold">${formatted}</div>
                      <div className="text-xs text-muted-foreground">
                        {currency === "GLW" ? (
                          <>
                            {(glwRewards + pdRewards).toLocaleString("en-US", {
                              maximumFractionDigits: 2,
                            })}{" "}
                            GLW
                          </>
                        ) : (
                          <>
                            {glwRewards.toLocaleString("en-US", {
                              maximumFractionDigits: 2,
                            })}{" "}
                            GLW +{" "}
                            {pdRewards.toLocaleString("en-US", {
                              maximumFractionDigits: 2,
                            })}{" "}
                            {currency}
                          </>
                        )}
                      </div>
                    </div>,
                    "Total Rewards (USD)",
                  ];
                }
                return [String(value), String(name)];
              }}
            />
          }
        />
        <Bar
          dataKey="totalRewardsUsd"
          fill="var(--color-totalRewardsUsd)"
          radius={[4, 4, 0, 0]}
          name="Total Rewards (USD)"
        />
      </BarChart>
    </ChartContainer>
  );
}

type SortField =
  | "efficiency"
  | "glwRewards"
  | "totalRewardsUsd"
  | "protocolDeposit"
  | "weeklyImpactAssets"
  | "name"
  | "region";

interface SortableTableHeadProps {
  field: SortField;
  currentSortBy: SortField;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;
  children: React.ReactNode;
  className?: string;
}

function SortableTableHead({
  field,
  currentSortBy,
  sortDirection,
  onSort,
  children,
  className,
}: SortableTableHeadProps) {
  const isActive = currentSortBy === field;
  const isRightAlign = className?.includes("text-right");

  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(field)}
        className={`flex items-center gap-1 hover:text-foreground transition-colors w-full ${
          isRightAlign ? "justify-end" : ""
        }`}
      >
        <span>{children}</span>
        {isActive ? (
          sortDirection === "desc" ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

interface FarmsViewProps {
  selectedFarmId: string;
  onSelectFarm: (farmId: string) => void;
}

export function FarmsView({ selectedFarmId, onSelectFarm }: FarmsViewProps) {
  const [sortBy, setSortBy] = React.useState<SortField>("efficiency");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "desc"
  );
  const [selectedRegionId, setSelectedRegionId] = React.useState<
    number | "all"
  >("all");
  const [selectedFarmForDialog, setSelectedFarmForDialog] = React.useState<{
    farmId: string;
    farmName: string;
  } | null>(null);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  }

  const { regions } = useRegions();
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
    data: dialogWeeklyRewardsData,
    isLoading: isDialogWeeklyRewardsLoading,
  } = useFarmWeeklyRewards({
    farmId: selectedFarmForDialog?.farmId || "",
    enabled: !!selectedFarmForDialog?.farmId,
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
        totalRewardsUsd,
      };
    });

    const filtered =
      selectedRegionId === "all"
        ? farmsWithRewards
        : farmsWithRewards.filter((farm) => farm.regionId === selectedRegionId);

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "efficiency":
          comparison = b.efficiencyScore - a.efficiencyScore;
          break;
        case "glwRewards":
          comparison = (b.weeklyGlwRewards ?? 0) - (a.weeklyGlwRewards ?? 0);
          break;
        case "totalRewardsUsd":
          comparison = (b.totalRewardsUsd ?? 0) - (a.totalRewardsUsd ?? 0);
          break;
        case "protocolDeposit":
          comparison =
            Number(b.protocolDepositUsd6) - Number(a.protocolDepositUsd6);
          break;
        case "weeklyImpactAssets":
          comparison =
            Number(b.weeklyImpactAssetsWad) - Number(a.weeklyImpactAssetsWad);
          break;
        case "name":
          const aName = a.name || `Farm ${a.farmId.slice(0, 8)}`;
          const bName = b.name || `Farm ${b.farmId.slice(0, 8)}`;
          comparison = aName.localeCompare(bName);
          break;
        case "region":
          comparison = a.regionId - b.regionId;
          break;
        default:
          comparison = b.efficiencyScore - a.efficiencyScore;
      }

      return sortDirection === "desc" ? comparison : -comparison;
    });

    return sorted;
  }, [
    efficiencyData,
    batchWeeklyRewardsData,
    sortBy,
    sortDirection,
    selectedRegionId,
    glwSpotPrice,
    gctlMintPrice,
  ]);

  const totalLastWeekRewardsUsd = React.useMemo(() => {
    return farms.reduce((sum, f) => sum + (f.totalRewardsUsd ?? 0), 0);
  }, [farms]);

  const rewardsBreakdown = React.useMemo(() => {
    const breakdown = new Map<string, { amount: number; usdValue: number }>();
    let farmsWithData = 0;

    farms.forEach((farm) => {
      if (farm.totalRewardsUsd > 0) {
        farmsWithData++;
      }

      if (farm.weeklyGlwRewards && farm.weeklyGlwRewards > 0) {
        const existing = breakdown.get("GLW") || { amount: 0, usdValue: 0 };
        breakdown.set("GLW", {
          amount: existing.amount + farm.weeklyGlwRewards,
          usdValue:
            existing.usdValue + farm.weeklyGlwRewards * (glwSpotPrice || 0),
        });
      }

      if (
        farm.weeklyProtocolDepositRewards &&
        farm.weeklyProtocolDepositRewards > 0 &&
        farm.paymentCurrency
      ) {
        const currency = farm.paymentCurrency;
        const existing = breakdown.get(currency) || { amount: 0, usdValue: 0 };
        const currencyPrice = getCurrencyPrice(
          currency,
          glwSpotPrice,
          gctlMintPrice
        );
        breakdown.set(currency, {
          amount: existing.amount + farm.weeklyProtocolDepositRewards,
          usdValue:
            existing.usdValue +
            farm.weeklyProtocolDepositRewards * currencyPrice,
        });
      }
    });

    return { breakdown, farmsWithData, totalFarms: farms.length };
  }, [farms, glwSpotPrice, gctlMintPrice]);

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
    <>
      <Dialog
        open={selectedFarmForDialog !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedFarmForDialog(null);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[85vh] sm:max-h-[85vh] h-full sm:h-auto sm:rounded-lg overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{selectedFarmForDialog?.farmName}</DialogTitle>
            <DialogDescription>
              V2 weekly rewards breakdown and farm statistics
            </DialogDescription>
          </DialogHeader>

          {isDialogWeeklyRewardsLoading ? (
            <div className="py-8">
              <Skeleton className="h-80 w-full" />
            </div>
          ) : dialogWeeklyRewardsData &&
            dialogWeeklyRewardsData.rewards.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Weeks Active
                    </p>
                    <p className="font-mono font-bold text-xl">
                      {dialogWeeklyRewardsData.summary.weeksActive}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Total GLW Inflation
                    </p>
                    <p className="font-mono font-semibold text-sm">
                      {formatRewardValue(
                        dialogWeeklyRewardsData.summary.totalGlowInflation,
                        18
                      )}{" "}
                      GLW
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Total PD Rewards
                    </p>
                    <p className="font-mono font-semibold text-sm">
                      {(() => {
                        const currency =
                          dialogWeeklyRewardsData.rewards[0]?.paymentCurrency ||
                          "GLW";
                        const decimals = currency === "GLW" ? 18 : 6;
                        const total = dialogWeeklyRewardsData.rewards.reduce(
                          (sum, r) =>
                            sum.plus(r.protocolDepositRewardsDistributed),
                          new Decimal(0)
                        );
                        return currency === "GLW"
                          ? `${formatRewardValue(
                              total.toString(),
                              decimals
                            )} GLW`
                          : `${formatRewardValue(
                              total.toString(),
                              decimals
                            )} ${currency}`;
                      })()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Protocol Deposit
                    </p>
                    <p className="font-mono font-semibold text-sm">
                      $
                      {formatRewardValue(
                        dialogWeeklyRewardsData.rewards[0]
                          ?.protocolDepositPaidTotal || "0",
                        6
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Week</th>
                        <th className="text-left p-3 font-medium">Currency</th>
                        <th className="text-right p-3 font-medium">
                          GLW Inflation
                        </th>
                        <th className="text-right p-3 font-medium">
                          PD Rewards Distributed
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dialogWeeklyRewardsData.rewards
                        .slice()
                        .reverse()
                        .map((reward) => (
                          <tr
                            key={reward.weekNumber}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="p-3 font-semibold">
                              Week {reward.weekNumber}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-xs">
                                {reward.paymentCurrency}
                              </Badge>
                            </td>
                            <td className="p-3 text-right font-mono">
                              {formatRewardValue(reward.glowInflationTotal, 18)}{" "}
                              GLW
                            </td>
                            <td className="p-3 text-right font-mono">
                              {reward.paymentCurrency === "GLW"
                                ? `${formatRewardValue(
                                    reward.protocolDepositRewardsDistributed,
                                    18
                                  )} GLW`
                                : `${formatRewardValue(
                                    reward.protocolDepositRewardsDistributed,
                                    6
                                  )} ${reward.paymentCurrency}`}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/50 font-semibold">
                        <td className="p-3" colSpan={2}>
                          Total
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatRewardValue(
                            dialogWeeklyRewardsData.summary.totalGlowInflation,
                            18
                          )}{" "}
                          GLW
                        </td>
                        <td className="p-3 text-right font-mono">
                          {(() => {
                            const currency =
                              dialogWeeklyRewardsData.rewards[0]
                                ?.paymentCurrency || "GLW";
                            const decimals = currency === "GLW" ? 18 : 6;
                            const total =
                              dialogWeeklyRewardsData.rewards.reduce(
                                (sum, r) =>
                                  sum.plus(r.protocolDepositRewardsDistributed),
                                new Decimal(0)
                              );
                            return currency === "GLW"
                              ? `${formatRewardValue(
                                  total.toString(),
                                  decimals
                                )} GLW`
                              : `${formatRewardValue(
                                  total.toString(),
                                  decimals
                                )} ${currency}`;
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No weekly rewards data available for this farm
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <span className="text-sm font-medium">Region:</span>
          <Select
            value={String(selectedRegionId)}
            onValueChange={(value) =>
              setSelectedRegionId(value === "all" ? "all" : Number(value))
            }
          >
            <SelectTrigger className="w-full sm:w-[280px]">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                ? `All farms tracked (${rewardsBreakdown.farmsWithData} with recent rewards)`
                : `Farms in region (${rewardsBreakdown.farmsWithData} with recent rewards)`}
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
                ? `Distributed to ${rewardsBreakdown.farmsWithData} farms with recent data`
                : `Distributed to ${rewardsBreakdown.farmsWithData} farms with recent data`}
            </p>
          </MetricCard>

          <MetricCard
            title={
              selectedRegionId === "all"
                ? "Network Efficiency"
                : "Region Efficiency"
            }
            value={(() => {
              if (selectedRegionId !== "all") {
                const selectedRegion = regions.find(
                  (r) => r.id === selectedRegionId
                );
                return selectedRegion
                  ? selectedRegion.efficiencyScore.toFixed(2)
                  : "0.00";
              }

              const filteredFarms =
                selectedRegionId === "all"
                  ? farms
                  : farms.filter((f) => f.regionId === selectedRegionId);

              if (filteredFarms.length === 0) return "0.00";

              let totalProtocolDepositUsd6 = BigInt(0);
              let totalWeeklyImpactAssetsWad = BigInt(0);

              filteredFarms.forEach((farm) => {
                totalProtocolDepositUsd6 += BigInt(farm.protocolDepositUsd6);
                totalWeeklyImpactAssetsWad += BigInt(
                  farm.weeklyImpactAssetsWad
                );
              });

              if (totalProtocolDepositUsd6 === BigInt(0)) return "0.00";

              const networkEfficiency = calculateFarmEfficiency(
                totalProtocolDepositUsd6,
                totalWeeklyImpactAssetsWad
              );

              return networkEfficiency.toFixed(2);
            })()}
            icon={<Zap className="h-5 w-5" />}
          >
            <p>
              {selectedRegionId === "all"
                ? "Weighted by total protocol deposits across all farms"
                : "Carbon credits per $100k deposit/week"}
            </p>
          </MetricCard>

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
        </div>

        {rewardsBreakdown.breakdown.size > 1 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
              Last Week Rewards by Asset
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from(rewardsBreakdown.breakdown.entries())
                .sort((a, b) => b[1].usdValue - a[1].usdValue)
                .map(([currency, data]) => (
                  <MetricCard
                    key={currency}
                    title={`${currency} Rewards`}
                    value={data.amount.toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                    icon={<Coins className="h-5 w-5" />}
                  >
                    <p>
                      $
                      {data.usdValue.toLocaleString("en-US", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{" "}
                      USD value
                    </p>
                  </MetricCard>
                ))}
            </div>
          </div>
        )}

        <Card className="border-border/60">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <CardTitle>Weekly Rewards Overview</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedRegionId === "all"
                    ? "Top 20 farms with recent rewards activity, ranked by total rewards distributed (USD)."
                    : `Top 20 farms with recent rewards in ${
                        regions.find((r) => r.id === selectedRegionId)?.name ||
                        "this region"
                      }, ranked by total rewards (USD).`}
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
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efficiency">Efficiency Score</SelectItem>
                    <SelectItem value="totalRewardsUsd">
                      Total Rewards (USD)
                    </SelectItem>
                    <SelectItem value="glwRewards">GLW Inflation</SelectItem>
                    <SelectItem value="protocolDeposit">
                      Protocol Deposit
                    </SelectItem>
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
                      <SortableTableHead
                        field="name"
                        currentSortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Farm Name
                      </SortableTableHead>
                      <SortableTableHead
                        field="region"
                        currentSortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="hidden sm:table-cell"
                      >
                        Region
                      </SortableTableHead>
                      <SortableTableHead
                        field="efficiency"
                        currentSortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      >
                        Efficiency
                      </SortableTableHead>
                      <SortableTableHead
                        field="glwRewards"
                        currentSortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      >
                        GLW/Week
                      </SortableTableHead>
                      <SortableTableHead
                        field="totalRewardsUsd"
                        currentSortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      >
                        PD Rewards
                      </SortableTableHead>
                      <SortableTableHead
                        field="protocolDeposit"
                        currentSortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="hidden md:table-cell text-right"
                      >
                        Protocol Deposit
                      </SortableTableHead>
                      <SortableTableHead
                        field="weeklyImpactAssets"
                        currentSortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="hidden lg:table-cell text-right"
                      >
                        Carbon Credits
                      </SortableTableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {farms.map((farm, index) => (
                      <TableRow
                        key={farm.farmId}
                        className={
                          farm.totalRewardsUsd > 0
                            ? "cursor-pointer hover:bg-muted/30"
                            : ""
                        }
                        onClick={() => {
                          if (farm.totalRewardsUsd > 0) {
                            setSelectedFarmForDialog({
                              farmId: farm.farmId,
                              farmName:
                                farm.name || `Farm ${farm.farmId.slice(0, 8)}`,
                            });
                          }
                        }}
                      >
                        <TableCell className="font-semibold">
                          #{index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium text-sm">
                              {farm.name || `Farm ${farm.farmId.slice(0, 8)}`}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {farm.farmId.slice(0, 8)}...
                              {farm.farmId.slice(-4)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary" className="text-xs">
                            {regions.find((r) => r.id === farm.regionId)
                              ?.name || `Region ${farm.regionId}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={`font-mono ${
                              farm.efficiencyScore >= 10
                                ? "bg-[#ccffd4]/20 text-[#5fb56f] dark:text-[#ccffd4] border-[#ccffd4]/40"
                                : farm.efficiencyScore >= 5
                                ? "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/40"
                                : "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40"
                            }`}
                          >
                            {farm.efficiencyScore.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {farm.weeklyGlwRewards
                            ? `${farm.weeklyGlwRewards.toLocaleString("en-US", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
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
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
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
                        <TableCell className="hidden md:table-cell text-right font-mono text-sm">
                          ${formatRewardValue(farm.protocolDepositUsd6, 6)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right font-mono text-sm">
                          {formatRewardValue(farm.weeklyImpactAssetsWad, 18)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={farm.totalRewardsUsd === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (farm.totalRewardsUsd > 0) {
                                setSelectedFarmForDialog({
                                  farmId: farm.farmId,
                                  farmName:
                                    farm.name ||
                                    `Farm ${farm.farmId.slice(0, 8)}`,
                                });
                              }
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
      </div>
    </>
  );
}
