"use client";

import React from "react";
import { parseAsString } from "nuqs";
import { useQueryState } from "nuqs";
import {
  ArrowUpDown,
  Copy,
  ExternalLink,
  LineChart,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  ComposedChart,
  Line,
} from "recharts";
import { formatUnits } from "viem";

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
  useWalletsActivity,
  useFarmsActivity,
  formatGLW,
  formatUSDC,
  type WalletActivity,
  type FarmActivity,
} from "@/hooks/useWalletsActivity";
import { MetricCard } from "./farms-view";
import { RewardsSkeleton } from "./view";

const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || "1";
const ETHERSCAN_BASE_URL =
  CHAIN_ID === "1" ? "https://etherscan.io" : "https://sepolia.etherscan.io";
const WALLET_LIMIT = 100;
const FARM_LIMIT = 100;

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function bigIntSum(values: Array<string | undefined>): bigint {
  return values.reduce(
    (total, value) => total + BigInt(value ?? "0"),
    BigInt(0)
  );
}

function isNewParticipant(wallet: WalletActivity, type: "delegator" | "miner") {
  if (type === "delegator") {
    return BigInt(wallet.glwDelegatedAfterRange || "0") > BigInt(0);
  }
  return BigInt(wallet.usdcSpentAfterRange || "0") > BigInt(0);
}

function calculateMiningScore(
  wallet: WalletActivity,
  type: "delegator" | "miner",
  glwSpotPrice: number,
  weekRange: { startWeek: number; endWeek: number } | undefined
): number | null {
  if (!weekRange) return null;

  const weeksEarned = weekRange.endWeek - weekRange.startWeek + 1;

  if (type === "delegator") {
    const delegated = Number(wallet.glwDelegated);
    const earned = Number(wallet.delegatorRewardsEarned);
    if (delegated === 0 || weeksEarned === 0) return null;

    const totalReturn = earned / delegated;
    const annualizedReturn = (totalReturn / weeksEarned) * 52;
    return annualizedReturn;
  } else {
    const usdcSpent = Number(wallet.usdcSpentOnMiners) / 1e6;
    const glwEarned = Number(wallet.minerRewardsEarned) / 1e18;

    if (usdcSpent === 0 || glwSpotPrice === 0 || weeksEarned === 0) return null;

    const glwEquivalentSpent = usdcSpent / glwSpotPrice;
    if (glwEquivalentSpent === 0) return null;

    const totalReturn = glwEarned / glwEquivalentSpent;
    const annualizedReturn = (totalReturn / weeksEarned) * 52;
    return annualizedReturn;
  }
}

function formatMiningScore(score: number | null): string {
  if (score === null) return "N/A";
  return `${(score * 100).toFixed(2)}%`;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast.success(`${label} copied`);
    })
    .catch(() => {
      toast.error("Failed to copy");
    });
}

interface RewardsChartProps {
  wallets: WalletActivity[];
  type: "delegator" | "miner";
  glwSpotPrice: number;
  weekRange: { startWeek: number; endWeek: number } | undefined;
}

function RewardsChart({
  wallets,
  type,
  glwSpotPrice,
  weekRange,
}: RewardsChartProps) {
  const chartData = React.useMemo(() => {
    return wallets.slice(0, 20).map((wallet, index) => {
      const delegatorRewards = Number(wallet.delegatorRewardsEarned) / 1e18;
      const minerRewards = Number(wallet.minerRewardsEarned) / 1e18;
      const capital =
        type === "delegator"
          ? Number(formatUnits(BigInt(wallet.glwDelegated ?? "0"), 18))
          : Number(formatUnits(BigInt(wallet.usdcSpentOnMiners ?? "0"), 6));
      const miningScore = calculateMiningScore(
        wallet,
        type,
        glwSpotPrice,
        weekRange
      );

      return {
        wallet: formatAddress(wallet.walletAddress),
        fullAddress: wallet.walletAddress,
        delegatorRewards,
        minerRewards,
        rewards: type === "delegator" ? delegatorRewards : minerRewards,
        capital,
        miningScore: miningScore ?? 0,
        index: index + 1,
      };
    });
  }, [wallets, type, glwSpotPrice, weekRange]);

  const chartConfig = React.useMemo(() => {
    return {
      rewards: {
        label: type === "delegator" ? "Delegator Rewards" : "Miner Rewards",
        color:
          type === "delegator" ? "hsl(142, 71%, 45%)" : "hsl(217, 91%, 60%)",
      },
      miningScore: {
        label: "Mining Score",
        color: "hsl(25, 95%, 53%)",
      },
    } satisfies ChartConfig;
  }, [type]);

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
          dataKey="wallet"
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
            value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()
          }
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="min-w-[220px]"
              labelFormatter={(_, payload) => {
                const address = payload?.[0]?.payload?.fullAddress || "";
                return (
                  <div className="font-mono text-xs mb-2 pb-2 border-b border-border/50">
                    {address
                      ? `${address.slice(0, 10)}...${address.slice(-8)}`
                      : ""}
                  </div>
                );
              }}
              formatter={(value, name, payload) => {
                const numValue = Number(value);
                const capital = payload?.payload?.capital as number;
                const rewardsLabel =
                  type === "delegator" ? "Delegator Rewards" : "Miner Rewards";

                if (name === "rewards" || name === rewardsLabel) {
                  const formatted = numValue.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  });
                  return [
                    <span className="font-semibold">{formatted} GLW</span>,
                    rewardsLabel,
                  ];
                } else if (name === "miningScore" || name === "Mining Score") {
                  const formatted = (numValue * 100).toFixed(1);
                  return [
                    <span className="font-semibold">{formatted}%</span>,
                    "Mining Score",
                  ];
                }
                if (name === "capital") {
                  const formatted = capital.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  });
                  const label =
                    type === "delegator" ? "Capital Delegated" : "USDC Spent";
                  const suffix = type === "delegator" ? " GLW" : " USDC";
                  return [
                    <span className="font-semibold">{formatted + suffix}</span>,
                    label,
                  ];
                }
                return [String(value), String(name)];
              }}
            />
          }
        />
        <Bar
          yAxisId="left"
          dataKey="rewards"
          fill="var(--color-rewards)"
          radius={[4, 4, 0, 0]}
          name={type === "delegator" ? "Delegator Rewards" : "Miner Rewards"}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="miningScore"
          stroke="var(--color-miningScore)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-miningScore)" }}
          name="Mining Score"
        />
      </ComposedChart>
    </ChartContainer>
  );
}

interface FarmsChartProps {
  farms: FarmActivity[];
  type: "delegator" | "miner";
}

function FarmsChart({ farms, type }: FarmsChartProps) {
  const chartData = React.useMemo(() => {
    return farms.slice(0, 20).map((farm) => {
      const delegatorRewards = Number(farm.delegatorRewardsDistributed) / 1e18;
      const minerRewards = Number(farm.minerRewardsDistributed) / 1e18;
      const rewards = type === "delegator" ? delegatorRewards : minerRewards;
      const displayName = farm.farmName || farm.farmId.slice(0, 8);

      return {
        farm:
          displayName.length > 15
            ? `${displayName.slice(0, 15)}...`
            : displayName,
        fullFarmName: farm.farmName || farm.farmId,
        fullFarmId: farm.farmId,
        delegatorRewards,
        minerRewards,
        rewards,
        uniqueDelegators: farm.uniqueDelegators,
        uniqueMiners: farm.uniqueMiners,
        uniqueParticipants:
          type === "delegator" ? farm.uniqueDelegators : farm.uniqueMiners,
      };
    });
  }, [farms, type]);

  const chartConfig = {
    rewards: {
      label: type === "delegator" ? "Delegator Rewards" : "Miner Rewards",
      color: type === "delegator" ? "hsl(142, 71%, 45%)" : "hsl(217, 91%, 60%)",
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
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) =>
            value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="min-w-[240px]"
              labelFormatter={(_, payload) => {
                const farmName = payload?.[0]?.payload?.fullFarmName || "";
                const participants =
                  payload?.[0]?.payload?.uniqueParticipants || 0;
                const participantLabel =
                  type === "delegator" ? "delegators" : "miners";
                return (
                  <div className="mb-2 pb-2 border-b border-border/50">
                    <div className="text-sm font-semibold mb-1">{farmName}</div>
                    <div className="text-xs text-muted-foreground">
                      {participants} {participantLabel}
                    </div>
                  </div>
                );
              }}
              formatter={(value, name) => {
                const numValue = Number(value);
                const rewardsLabel =
                  type === "delegator" ? "Delegator Rewards" : "Miner Rewards";

                if (name === "rewards" || name === rewardsLabel) {
                  const formatted = numValue.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  });
                  return [
                    <span className="font-semibold">{formatted} GLW</span>,
                    rewardsLabel,
                  ];
                }
                return [String(value), String(name)];
              }}
            />
          }
        />
        <Bar
          dataKey="rewards"
          fill="var(--color-rewards)"
          radius={[4, 4, 0, 0]}
          name={type === "delegator" ? "Delegator Rewards" : "Miner Rewards"}
        />
      </BarChart>
    </ChartContainer>
  );
}

interface WalletsViewProps {
  type: "delegator" | "miner";
  glwSpotPrice: number;
}

export function WalletsView({ type, glwSpotPrice }: WalletsViewProps) {
  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsString.withDefault("efficiency")
  );

  const validSortBy:
    | "glwDelegated"
    | "usdcSpentOnMiners"
    | "delegatorRewardsEarned"
    | "minerRewardsEarned"
    | "totalRewardsEarned"
    | "efficiency" = [
    "glwDelegated",
    "usdcSpentOnMiners",
    "delegatorRewardsEarned",
    "minerRewardsEarned",
    "totalRewardsEarned",
    "efficiency",
  ].includes(sortBy)
    ? (sortBy as typeof validSortBy)
    : "efficiency";

  const apiSortBy:
    | "glwDelegated"
    | "usdcSpentOnMiners"
    | "delegatorRewardsEarned"
    | "minerRewardsEarned"
    | "totalRewardsEarned" =
    validSortBy === "efficiency"
      ? type === "delegator"
        ? "delegatorRewardsEarned"
        : "minerRewardsEarned"
      : (validSortBy as typeof apiSortBy);

  const farmsSortBy: "delegatorRewardsDistributed" | "minerRewardsDistributed" | "totalRewardsDistributed" =
    "totalRewardsDistributed";

  const { data, isLoading, isFetching, isError } = useWalletsActivity({
    type,
    sortBy: apiSortBy,
    limit: WALLET_LIMIT,
    enabled: true,
  });

  const {
    data: farmsData,
    isLoading: farmsLoading,
    isFetching: farmsFetching,
  } = useFarmsActivity({
    type,
    sortBy: farmsSortBy,
    limit: FARM_LIMIT,
    enabled: true,
  });

  const weekRange = data?.weekRange;
  const summary = data?.summary;
  const farms = farmsData?.farms ?? [];
  const farmsSummary = farmsData?.summary;

  const wallets = React.useMemo(() => {
    const allWallets = data?.wallets ?? [];

    if (validSortBy === "efficiency") {
      return [...allWallets].sort((a, b) => {
        const scoreA = calculateMiningScore(
          a,
          type,
          glwSpotPrice,
          weekRange
        );
        const scoreB = calculateMiningScore(
          b,
          type,
          glwSpotPrice,
          weekRange
        );

        if (scoreA === null && scoreB === null) return 0;
        if (scoreA === null) return 1;
        if (scoreB === null) return -1;

        return scoreB - scoreA;
      });
    }

    return allWallets;
  }, [data?.wallets, validSortBy, type, glwSpotPrice, weekRange]);

  const isInitialLoading = isLoading && !data;

  const rewardsLabel =
    type === "delegator" ? "Delegator Rewards" : "Miner Rewards";
  const capitalLabel =
    type === "delegator" ? "GLW Delegated" : "USDC Spent";

  const analytics = React.useMemo(() => {
    if (!wallets.length) {
      return {
        walletCount: 0,
        newWalletCount: 0,
        coverageRate: summary?.totalWallets ? 0 : null,
        totalRewardsRaw: BigInt(0),
        totalRewardsDisplay: "0.00",
        totalRewardsNumber: 0,
        averageRewardDisplay: "0.00",
        totalCapitalDisplay: "0.00",
        totalCapitalNumber: 0,
        newCapitalDisplay: "0.00",
        newCapitalShare: 0,
        averageMiningScore: 0,
        bestMiningScore: null as number | null,
        topWalletByRewards: null as {
          wallet: WalletActivity;
          formattedRewards: string;
        } | null,
        topWalletByScore: null as {
          wallet: WalletActivity;
          score: number;
        } | null,
        newWallets: [] as Array<{
          wallet: WalletActivity;
          capitalDisplay: string;
        }>,
      };
    }

    const rewardsKey =
      type === "delegator"
        ? "delegatorRewardsEarned"
        : "minerRewardsEarned";
    const capitalKey =
      type === "delegator" ? "glwDelegated" : "usdcSpentOnMiners";
    const newCapitalKey =
      type === "delegator"
        ? "glwDelegatedAfterRange"
        : "usdcSpentAfterRange";

    const totalRewardsRaw = bigIntSum(
      wallets.map((wallet) => wallet[rewardsKey])
    );
    const baseCapitalRaw = bigIntSum(
      wallets.map((wallet) => wallet[capitalKey])
    );

    const totalRewardsNumber = Number(formatUnits(totalRewardsRaw, 18));

    const averageRewardNumber = wallets.length
      ? totalRewardsNumber / wallets.length
      : 0;

    const totalRewardsDisplay = formatGLW(totalRewardsRaw.toString());

    const averageRewardDisplay = averageRewardNumber.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const newWallets = wallets.filter((wallet) =>
      isNewParticipant(wallet, type)
    );
    const newCapitalRaw = bigIntSum(
      newWallets.map((wallet) => wallet[newCapitalKey])
    );
    const newCapitalNumber =
      type === "delegator"
        ? Number(formatUnits(newCapitalRaw, 18))
        : Number(formatUnits(newCapitalRaw, 6));

    const newCapitalDisplay =
      type === "delegator"
        ? formatGLW(newCapitalRaw.toString())
        : formatUSDC(newCapitalRaw.toString());

    const combinedCapitalRaw = baseCapitalRaw + newCapitalRaw;

    const totalCapitalNumber =
      type === "delegator"
        ? Number(formatUnits(combinedCapitalRaw, 18))
        : Number(formatUnits(combinedCapitalRaw, 6));

    const totalCapitalDisplay =
      type === "delegator"
        ? formatGLW(combinedCapitalRaw.toString())
        : formatUSDC(combinedCapitalRaw.toString());

    const miningScores = wallets
      .map((wallet) =>
        calculateMiningScore(wallet, type, glwSpotPrice, weekRange)
      )
      .filter((score): score is number => score !== null);

    const averageMiningScore = miningScores.length
      ? miningScores.reduce((sum, score) => sum + score, 0) /
        miningScores.length
      : 0;

    const topWalletByRewards = wallets.reduce<{
      wallet: WalletActivity;
      formattedRewards: string;
      numericRewards: number;
    } | null>((acc, wallet) => {
      const rewardsFormatted = formatGLW(wallet[rewardsKey]);
      const rewardsNumeric = Number(
        formatUnits(BigInt(wallet[rewardsKey] || "0"), 18)
      );
      if (!acc || rewardsNumeric > acc.numericRewards) {
        return {
          wallet,
          formattedRewards: rewardsFormatted,
          numericRewards: rewardsNumeric,
        };
      }
      return acc;
    }, null);

    const topWalletByScore = wallets.reduce<{
      wallet: WalletActivity;
      score: number;
    } | null>((acc, wallet) => {
      const score = calculateMiningScore(
        wallet,
        type,
        glwSpotPrice,
        weekRange
      );
      if (score === null) return acc;
      if (!acc || score > acc.score) {
        return { wallet, score };
      }
      return acc;
    }, null);

    const newWalletHighlights = newWallets
      .sort((a, b) =>
        Number(
          BigInt(b[newCapitalKey] || "0") - BigInt(a[newCapitalKey] || "0")
        )
      )
      .slice(0, 4)
      .map((wallet) => ({
        wallet,
        capitalDisplay:
          type === "delegator"
            ? `${formatGLW(wallet[newCapitalKey])} GLW`
            : `$${formatUSDC(wallet[newCapitalKey])}`,
      }));

    const coverageRate = summary?.totalWallets
      ? Math.min(wallets.length / summary.totalWallets, 1)
      : null;

    return {
      walletCount: wallets.length,
      newWalletCount: newWallets.length,
      coverageRate,
      totalRewardsRaw,
      totalRewardsDisplay,
      totalRewardsNumber,
      averageRewardDisplay,
      totalCapitalDisplay,
      totalCapitalNumber,
      newCapitalDisplay,
      newCapitalShare: totalCapitalNumber
        ? newCapitalNumber / totalCapitalNumber
        : 0,
      averageMiningScore,
      bestMiningScore: miningScores.length ? Math.max(...miningScores) : null,
      topWalletByRewards,
      topWalletByScore,
      newWallets: newWalletHighlights,
    };
  }, [wallets, type, summary?.totalWallets, glwSpotPrice, weekRange]);

  const isEmptyState = !isInitialLoading && wallets.length === 0;

  if (isInitialLoading) {
    return <RewardsSkeleton />;
  }

  if (isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          Unable to load rewards data right now.
        </p>
      </div>
    );
  }

  if (isEmptyState) {
    return (
      <div className="py-24 text-center space-y-3">
        <h2 className="text-xl font-semibold">No wallets found</h2>
        <p className="text-sm text-muted-foreground">
          Adjust the filters to explore different segments of Glow{" "}
          {type === "delegator" ? "delegators" : "miners"}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title={`Active ${type === "delegator" ? "Delegators" : "Miners"}`}
          value={analytics.walletCount.toLocaleString()}
          icon={<Users className="h-5 w-5" />}
        >
          {analytics.newWalletCount > 0 && (
            <p>
              {analytics.newWalletCount.toLocaleString()} new this range
            </p>
          )}
          {summary?.totalWallets && (
            <p>
              Showing {analytics.walletCount.toLocaleString()} of{" "}
              {summary.totalWallets.toLocaleString()} network wallets
            </p>
          )}
        </MetricCard>
        <MetricCard
          title={`${rewardsLabel} (total)`}
          value={`${analytics.totalRewardsDisplay} GLW`}
          icon={<TrendingUp className="h-5 w-5" />}
        >
          <p>Avg per wallet: {analytics.averageRewardDisplay} GLW</p>
        </MetricCard>
        {type === "delegator" && (
          <MetricCard
            title={capitalLabel}
            value={`${analytics.totalCapitalDisplay} GLW`}
            icon={<Zap className="h-5 w-5" />}
          >
            {analytics.newWalletCount > 0 && (
              <p>
                New inflows: {`${analytics.newCapitalDisplay} GLW`} (
                {(analytics.newCapitalShare * 100).toFixed(0)}%)
              </p>
            )}
          </MetricCard>
        )}
        <MetricCard
          title="Average Mining Score"
          value={`${(analytics.averageMiningScore * 100).toFixed(1)}%`}
          icon={<LineChart className="h-5 w-5" />}
        >
          {analytics.bestMiningScore !== null ? (
            <p>
              Top wallet: {(analytics.bestMiningScore * 100).toFixed(1)}%
            </p>
          ) : (
            <p>No score available yet</p>
          )}
        </MetricCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 border-border/60">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <CardTitle>{rewardsLabel} & Efficiency</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Highlighting the top 20 wallets by{" "}
                  {rewardsLabel.toLowerCase()} with their mining score.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={validSortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efficiency">Mining Score</SelectItem>
                    {type === "delegator" ? (
                      <>
                        <SelectItem value="delegatorRewardsEarned">
                          Rewards Earned
                        </SelectItem>
                        <SelectItem value="glwDelegated">
                          GLW Delegated
                        </SelectItem>
                        <SelectItem value="totalRewardsEarned">
                          Total Rewards
                        </SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="minerRewardsEarned">
                          Rewards Earned
                        </SelectItem>
                        <SelectItem value="totalRewardsEarned">
                          Total Rewards
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isFetching ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <RewardsChart
                wallets={wallets}
                type={type}
                glwSpotPrice={glwSpotPrice}
                weekRange={weekRange}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Performance highlights</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Noteworthy wallets driving Glow mining outcomes this range.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {analytics.topWalletByRewards && (
              <div className="rounded-lg border border-border/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground tracking-wide">
                      Highest rewards
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {formatAddress(
                        analytics.topWalletByRewards.wallet.walletAddress
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analytics.topWalletByRewards.formattedRewards} GLW
                      earned
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(
                          analytics.topWalletByRewards!.wallet.walletAddress,
                          "Address"
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={`${ETHERSCAN_BASE_URL}/address/${analytics.topWalletByRewards.wallet.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {analytics.topWalletByScore && (
              <div className="rounded-lg border border-border/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground tracking-wide">
                      Strongest mining score
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {formatAddress(
                        analytics.topWalletByScore.wallet.walletAddress
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatMiningScore(analytics.topWalletByScore.score)}{" "}
                      annualized
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(
                          analytics.topWalletByScore!.wallet.walletAddress,
                          "Address"
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={`${ETHERSCAN_BASE_URL}/address/${analytics.topWalletByScore.wallet.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {analytics.newWallets.length > 0 && (
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">
                  New capital inflows
                </p>
                <ul className="mt-3 space-y-2">
                  {analytics.newWallets.map(
                    ({ wallet, capitalDisplay }) => (
                      <li
                        key={wallet.walletAddress}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-3 text-sm"
                      >
                        <span className="font-mono text-xs">
                          {formatAddress(wallet.walletAddress)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {capitalDisplay}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>Wallet leaderboard</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Detailed performance for the top{" "}
                {analytics.walletCount.toLocaleString()}{" "}
                {type === "delegator" ? "delegators" : "miners"}.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isFetching ? (
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
                    <TableHead>Wallet</TableHead>
                    {type === "delegator" && (
                      <TableHead className="text-right">
                        {capitalLabel}
                      </TableHead>
                    )}
                    <TableHead className="text-right">{rewardsLabel}</TableHead>
                    <TableHead className="text-right">
                      Share of rewards
                    </TableHead>
                    <TableHead className="text-right">Mining score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.map((wallet) => {
                    const capitalValue =
                      type === "delegator"
                        ? `${formatGLW(wallet.glwDelegated)} GLW`
                        : null;
                    const rewardsValue = formatGLW(
                      type === "delegator"
                        ? wallet.delegatorRewardsEarned
                        : wallet.minerRewardsEarned
                    );
                    const miningScore = calculateMiningScore(
                      wallet,
                      type,
                      glwSpotPrice,
                      weekRange
                    );
                    const rewardsNumeric = Number(
                      formatUnits(
                        BigInt(
                          (type === "delegator"
                            ? wallet.delegatorRewardsEarned
                            : wallet.minerRewardsEarned) || "0"
                        ),
                        18
                      )
                    );
                    const share = analytics.totalRewardsNumber
                      ? (rewardsNumeric / analytics.totalRewardsNumber) * 100
                      : 0;
                    const newBadge = isNewParticipant(wallet, type);

                    return (
                      <TableRow key={wallet.walletAddress}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {formatAddress(wallet.walletAddress)}
                            </span>
                            {newBadge && (
                              <Badge variant="secondary" className="text-xs">
                                New
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        {type === "delegator" && (
                          <TableCell className="text-right font-mono text-sm">
                            {capitalValue}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-mono text-sm">
                          {rewardsValue} GLW
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {share.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {miningScore !== null ? (
                            <Badge
                              variant={
                                miningScore >= 0.5
                                  ? "default"
                                  : miningScore >= 0.2
                                  ? "secondary"
                                  : "outline"
                              }
                              className="font-mono"
                            >
                              {formatMiningScore(miningScore)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                copyToClipboard(
                                  wallet.walletAddress,
                                  "Address"
                                )
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" asChild>
                              <a
                                href={`${ETHERSCAN_BASE_URL}/address/${wallet.walletAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Farm coverage
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Track how rewards are flowing to solar farms that Glow{" "}
            {type === "delegator" ? "delegators" : "miners"} are supporting.
            Competitive farms recover deposits faster and share surplus rewards
            with the network.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardHeader>
              <div>
                <CardTitle>Rewards distribution by farm</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Top {farms.length > 20 ? 20 : farms.length} farms ranked by
                  total rewards distributed.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {farmsLoading || farmsFetching ? (
                <Skeleton className="h-80 w-full" />
              ) : farms.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
                  No data available for chart
                </div>
              ) : (
                <FarmsChart farms={farms} type={type} />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <div className="flex flex-col gap-2">
                <CardTitle>Farm roster</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Snapshot of unique{" "}
                  {type === "delegator" ? "delegators" : "miners"} supporting
                  each farm.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {farmsLoading || farmsFetching ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : farms.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No farms found with rewards distributed.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Farm Name</TableHead>
                        <TableHead className="text-right">
                          {rewardsLabel}
                        </TableHead>
                        <TableHead className="text-right">
                          {type === "delegator" ? "Delegators" : "Miners"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {farms.slice(0, FARM_LIMIT).map((farm) => {
                        const rewards =
                          type === "delegator"
                            ? farm.delegatorRewardsDistributed
                            : farm.minerRewardsDistributed;
                        const participants =
                          type === "delegator"
                            ? farm.uniqueDelegators
                            : farm.uniqueMiners;
                        const displayName = farm.farmName || farm.farmId;

                        return (
                          <TableRow key={farm.farmId}>
                            <TableCell>
                              <span className="text-sm">
                                {displayName.length > 30
                                  ? `${displayName.slice(0, 30)}...`
                                  : displayName}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {formatGLW(rewards)} GLW
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {participants.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {farmsSummary && (
          <div className="text-xs text-muted-foreground">
            Displaying {Math.min(farms.length, FARM_LIMIT)} of{" "}
            {farmsSummary.totalFarms.toLocaleString()} farms with rewards
            activity.
          </div>
        )}
      </div>
    </div>
  );
}

