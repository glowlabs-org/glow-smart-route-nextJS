"use client";

import React from "react";
import { parseAsString, parseAsInteger } from "nuqs";
import { useQueryState } from "nuqs";
import {
  ArrowUpDown,
  Copy,
  Info,
  LineChart as LineChartIcon,
  TrendingUp,
  Users,
  Zap,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  LineChart,
  Line,
} from "recharts";
import { formatUnits } from "viem";
import { GENESIS_TIMESTAMP } from "@/utils/getCurrentEpoch";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
import { useSplitsActivity } from "@/hooks/useGlowLaunchpad";
import { useEnsNames } from "@/hooks/useEnsNames";
import { MetricCard } from "./farms-view";
import { RewardsSkeleton } from "./view";

const WALLET_LIMIT = 100;
const FARM_LIMIT = 100;
const WALLETS_PER_PAGE = 10;
const EXCLUDED_WALLETS = ["0x77f41144e787cb8cd29a37413a71f53f92ee050c"];

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
      color: type === "delegator" ? "#dcc4ff" : "#ccffd4",
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

interface DelegationTrendChartProps {
  glwDelegationByEpoch: Record<number, string>;
}

function DelegationTrendChart({
  glwDelegationByEpoch,
}: DelegationTrendChartProps) {
  const chartData = React.useMemo(() => {
    const epochs = Object.keys(glwDelegationByEpoch)
      .map(Number)
      .sort((a, b) => a - b);

    const maxEpoch = Math.max(...epochs);

    return epochs
      .filter((epoch) => epoch !== maxEpoch)
      .map((epoch) => {
        const amount = Number(
          formatUnits(BigInt(glwDelegationByEpoch[epoch] || "0"), 18)
        );

        const WEEK_SECONDS = 86400 * 7;
        const epochStartTimestamp = GENESIS_TIMESTAMP + epoch * WEEK_SECONDS;
        const epochDate = new Date(epochStartTimestamp * 1000);

        const formattedDate = epochDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        return {
          epoch,
          amount,
          displayDate: formattedDate,
          fullDate: epochDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        };
      });
  }, [glwDelegationByEpoch]);

  const chartConfig = {
    amount: {
      label: "GLW Delegated",
      color: "#dcc4ff",
    },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
        No delegation data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-80 w-full">
      <LineChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 12, right: 12, top: 12, bottom: 40 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="displayDate"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) =>
            value >= 1000000
              ? `${(value / 1000000).toFixed(1)}M`
              : value >= 1000
              ? `${(value / 1000).toFixed(1)}k`
              : value.toString()
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="min-w-[220px]"
              labelFormatter={(_, payload) => {
                const fullDate = payload?.[0]?.payload?.fullDate || "";
                return (
                  <div className="font-semibold text-sm mb-2 pb-2 border-b border-border/50">
                    {fullDate}
                  </div>
                );
              }}
              formatter={(value) => {
                const numValue = Number(value);
                const formatted = numValue.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                });
                return [
                  <span className="font-semibold">{formatted} GLW</span>,
                  "GLW Delegated",
                ];
              }}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="var(--color-amount)"
          strokeWidth={3}
          dot={{ r: 4, fill: "var(--color-amount)", strokeWidth: 2 }}
          name="GLW Delegated"
        />
      </LineChart>
    </ChartContainer>
  );
}

interface WalletsViewProps {
  type: "delegator" | "miner";
  glwSpotPrice: number;
  networkTotalGlwDelegated?: string;
  glwDelegationByEpoch?: Record<number, string>;
  walletCountByEpoch?: Record<number, number>;
  totalContributors?: number;
  glwHolderCount?: number;
  weeklyRewardsMetric?: number;
  weeklyRewardsMetricLoading?: boolean;
}

export function WalletsView({
  type,
  glwSpotPrice,
  networkTotalGlwDelegated,
  glwDelegationByEpoch,
  walletCountByEpoch,
  totalContributors,
  glwHolderCount,
  weeklyRewardsMetric,
  weeklyRewardsMetricLoading,
}: WalletsViewProps) {
  const defaultSortBy =
    type === "delegator" ? "delegatorRewardsEarned" : "minerRewardsEarned";

  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsString.withDefault(defaultSortBy)
  );
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("")
  );

  const validOptionsForType =
    type === "delegator"
      ? ["glwDelegated", "delegatorRewardsEarned", "totalRewardsEarned"]
      : ["usdcSpentOnMiners", "minerRewardsEarned", "totalRewardsEarned"];

  const validSortBy:
    | "glwDelegated"
    | "usdcSpentOnMiners"
    | "delegatorRewardsEarned"
    | "minerRewardsEarned"
    | "totalRewardsEarned" = validOptionsForType.includes(sortBy)
    ? (sortBy as typeof validSortBy)
    : defaultSortBy;

  React.useEffect(() => {
    if (!validOptionsForType.includes(sortBy)) {
      setSortBy(defaultSortBy);
    }
  }, [type, sortBy, setSortBy, defaultSortBy, validOptionsForType]);

  React.useEffect(() => {
    setPage(1);
  }, [sortBy, type, search, setPage]);

  const apiSortBy = validSortBy;

  const farmsSortBy:
    | "delegatorRewardsDistributed"
    | "minerRewardsDistributed"
    | "totalRewardsDistributed" = "totalRewardsDistributed";

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

  const { activity: recentActivity } = useSplitsActivity({
    limit: 10,
    fractionType: type === "delegator" ? "launchpad" : "mining-center",
    enabled: true,
  });

  const weekRange = data?.weekRange;
  const summary = data?.summary;
  const farms = farmsData?.farms ?? [];
  const farmsSummary = farmsData?.summary;

  const wallets = React.useMemo(() => {
    const allWallets = data?.wallets ?? [];
    return allWallets.filter(
      (wallet) => !EXCLUDED_WALLETS.includes(wallet.walletAddress.toLowerCase())
    );
  }, [data?.wallets]);

  const allWalletAddresses = React.useMemo(() => {
    return wallets.map((w) => w.walletAddress);
  }, [wallets]);

  const { ensNames: allEnsNames } = useEnsNames({
    addresses: allWalletAddresses,
    enabled: allWalletAddresses.length > 0,
  });

  const filteredWallets = React.useMemo(() => {
    if (!search) return wallets;

    const searchLower = search.toLowerCase();
    return wallets.filter((wallet) => {
      const address = wallet.walletAddress.toLowerCase();
      const ensName = allEnsNames[wallet.walletAddress]?.toLowerCase() || "";
      return address.includes(searchLower) || ensName.includes(searchLower);
    });
  }, [wallets, search, allEnsNames]);

  const totalPages = Math.ceil(filteredWallets.length / WALLETS_PER_PAGE);

  React.useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(1);
    }
  }, [page, totalPages, setPage]);

  const paginatedWallets = React.useMemo(() => {
    const startIndex = (page - 1) * WALLETS_PER_PAGE;
    const endIndex = startIndex + WALLETS_PER_PAGE;
    return filteredWallets.slice(startIndex, endIndex);
  }, [filteredWallets, page]);

  const lastWeekNetworkTotalGlwDelegated = React.useMemo(() => {
    if (
      !glwDelegationByEpoch ||
      Object.keys(glwDelegationByEpoch).length === 0
    ) {
      return undefined;
    }
    const epochs = Object.keys(glwDelegationByEpoch)
      .map(Number)
      .sort((a, b) => b - a);
    const lastEpoch = epochs[1];
    return glwDelegationByEpoch[lastEpoch];
  }, [glwDelegationByEpoch]);

  const lastWeekGrowth = React.useMemo(() => {
    if (!glwDelegationByEpoch || Object.keys(glwDelegationByEpoch).length < 2) {
      return null;
    }
    const epochs = Object.keys(glwDelegationByEpoch)
      .map(Number)
      .sort((a, b) => b - a);

    if (epochs.length < 3) return null;

    const lastWeek = BigInt(glwDelegationByEpoch[epochs[1]] || "0");
    const weekBefore = BigInt(glwDelegationByEpoch[epochs[2]] || "0");
    const growth = lastWeek - weekBefore;

    return growth > BigInt(0) ? formatGLW(growth.toString()) : null;
  }, [glwDelegationByEpoch]);

  const newWalletsLastWeek = React.useMemo(() => {
    if (!walletCountByEpoch || Object.keys(walletCountByEpoch).length < 2) {
      return null;
    }
    const epochs = Object.keys(walletCountByEpoch)
      .map(Number)
      .sort((a, b) => b - a);

    if (epochs.length < 3) return null;

    const lastWeekCount = walletCountByEpoch[epochs[1]] || 0;
    const weekBeforeCount = walletCountByEpoch[epochs[2]] || 0;
    const newWallets = lastWeekCount - weekBeforeCount;

    return newWallets > 0 ? newWallets : null;
  }, [walletCountByEpoch]);

  const isInitialLoading = isLoading && !data;

  const rewardsLabel =
    type === "delegator" ? "Delegator Rewards" : "Miner Rewards";
  const capitalLabel = type === "delegator" ? "GLW Delegated" : "USDC Spent";

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
        top3WalletsByRewards: [] as Array<{
          wallet: WalletActivity;
          formattedRewards: string;
          numericRewards: number;
        }>,
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
      type === "delegator" ? "delegatorRewardsEarned" : "minerRewardsEarned";
    const capitalKey =
      type === "delegator" ? "glwDelegated" : "usdcSpentOnMiners";
    const newCapitalKey =
      type === "delegator" ? "glwDelegatedAfterRange" : "usdcSpentAfterRange";

    const totalRewardsRaw = bigIntSum(
      wallets.map((wallet) => wallet[rewardsKey])
    );
    const baseCapitalRaw = bigIntSum(
      wallets.map((wallet) => wallet[capitalKey])
    );

    const totalRewardsNumber = Number(formatUnits(totalRewardsRaw, 18));

    let netTotalRewards = totalRewardsNumber;
    let netAverageReward = totalRewardsNumber / (wallets.length || 1);

    if (type === "delegator" && weekRange) {
      const weeksPassed = weekRange.endWeek - weekRange.startWeek + 1;
      const totalPdSpent = wallets.reduce((sum, wallet) => {
        const glwDelegated = Number(
          formatUnits(BigInt(wallet.glwDelegated || "0"), 18)
        );
        const pdPerWeek = glwDelegated / 100;
        return sum + pdPerWeek * weeksPassed;
      }, 0);

      netTotalRewards = totalRewardsNumber - totalPdSpent;
      netAverageReward = wallets.length ? netTotalRewards / wallets.length : 0;
    }

    const totalRewardsDisplay = netTotalRewards.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const averageRewardDisplay = netAverageReward.toLocaleString("en-US", {
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

    const top3WalletsByRewards = wallets
      .map((wallet) => ({
        wallet,
        formattedRewards: formatGLW(wallet[rewardsKey]),
        numericRewards: Number(
          formatUnits(BigInt(wallet[rewardsKey] || "0"), 18)
        ),
      }))
      .sort((a, b) => b.numericRewards - a.numericRewards)
      .slice(0, 3);

    const topWalletByScore = wallets.reduce<{
      wallet: WalletActivity;
      score: number;
    } | null>((acc, wallet) => {
      const score = calculateMiningScore(wallet, type, glwSpotPrice, weekRange);
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
      top3WalletsByRewards,
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
          title={`${type === "delegator" ? "Delegators" : "Miners"}`}
          value={
            glwHolderCount && glwHolderCount > 0 && totalContributors
              ? `${((totalContributors / glwHolderCount) * 100).toFixed(1)}%`
              : (totalContributors ?? analytics.walletCount).toLocaleString()
          }
          icon={<Users className="h-5 w-5" />}
        >
          <p>
            {glwHolderCount && glwHolderCount > 0 && totalContributors
              ? `of total GLW holders`
              : newWalletsLastWeek !== null
              ? `+${newWalletsLastWeek.toLocaleString()} new wallets last week`
              : !totalContributors && analytics.newWalletCount > 0
              ? `${analytics.newWalletCount.toLocaleString()} new this range`
              : `Showing top ${analytics.walletCount.toLocaleString()}`}
          </p>
        </MetricCard>
        <MetricCard
          title={
            type === "delegator"
              ? "Net Delegator Rewards (total)"
              : `${rewardsLabel} (total)`
          }
          value={`${analytics.totalRewardsDisplay} GLW`}
          icon={<TrendingUp className="h-5 w-5" />}
        >
          {type === "delegator" && weekRange ? (
            <p className="text-xs">
              Avg per wallet: {analytics.averageRewardDisplay} GLW
            </p>
          ) : (
            <p>Avg per wallet: {analytics.averageRewardDisplay} GLW</p>
          )}
        </MetricCard>
        {type === "delegator" && (
          <MetricCard
            title={capitalLabel}
            value={`${formatGLW(networkTotalGlwDelegated || "0")} GLW`}
            icon={<Zap className="h-5 w-5" />}
          >
            <p>
              {" "}
              Last week: {formatGLW(
                lastWeekNetworkTotalGlwDelegated || "0"
              )}{" "}
              GLW
            </p>
          </MetricCard>
        )}
        {weeklyRewardsMetric !== undefined && (
          <MetricCard
            title={
              type === "delegator"
                ? "GLW per Week per 100 GLW Delegated"
                : "GLW per Week per $100 Miner"
            }
            value={
              weeklyRewardsMetricLoading
                ? "..."
                : weeklyRewardsMetric.toFixed(4)
            }
            icon={
              type === "delegator" ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <Zap className="h-5 w-5" />
              )
            }
          >
            <p>
              Average weekly rewards on{" "}
              {type === "delegator" ? "delegation" : "mining"} across all active
              farms
            </p>
          </MetricCard>
        )}
      </div>
      {type === "delegator" &&
        glwDelegationByEpoch &&
        Object.keys(glwDelegationByEpoch).length > 0 && (
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Network Delegation Trend</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Growth of delegated GLW and recent network activity
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Delegation Over Time
                  </h3>
                  <div>
                    <DelegationTrendChart
                      glwDelegationByEpoch={glwDelegationByEpoch}
                    />
                  </div>
                </div>

                {recentActivity.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Recent Activity
                    </h3>
                    <ul className="space-y-2">
                      {recentActivity.slice(0, 5).map((activity) => {
                        const amount = Number(
                          formatUnits(BigInt(activity.totalValue), 18)
                        );
                        const formattedAmount = amount.toLocaleString("en-US", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        });
                        const timeAgo = new Date(
                          activity.purchaseDate
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });

                        return (
                          <li
                            key={`${activity.transactionHash}-${activity.timestamp}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/30 p-3 hover:bg-muted/50 transition-colors text-sm"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-xs font-semibold">
                                {formatAddress(activity.buyer)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {timeAgo}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-foreground">
                              {formattedAmount} GLW
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <CardTitle>Wallet leaderboard</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Detailed performance for the top{" "}
                  {analytics.walletCount.toLocaleString()}{" "}
                  {type === "delegator" ? "delegators" : "miners"}.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={validSortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {type === "delegator" ? (
                      <>
                        <SelectItem value="delegatorRewardsEarned">
                          Net Delegator Rewards
                        </SelectItem>
                        <SelectItem value="glwDelegated">
                          GLW Delegated
                        </SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="minerRewardsEarned">
                          Miner Rewards
                        </SelectItem>
                        <SelectItem value="usdcSpentOnMiners">
                          USDC Spent
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by wallet address or ENS name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearch("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
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
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Wallet</TableHead>
                    {type === "delegator" && (
                      <TableHead className="text-right">
                        {capitalLabel}
                      </TableHead>
                    )}
                    <TableHead className="text-right">
                      {type === "delegator" ? (
                        <div className="flex items-center justify-end gap-1">
                          <span>Net Delegator Rewards</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  Total rewards earned (PD recovery + inflation)
                                  minus the Protocol Deposit allocated to weeks
                                  that have passed. Shows your true profit.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      ) : (
                        rewardsLabel
                      )}
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span>Share of rewards</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                This wallet's percentage of total gross rewards
                                distributed to all{" "}
                                {type === "delegator" ? "delegators" : "miners"}{" "}
                                in the current period.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWallets.map((wallet, index) => {
                    const rank = (page - 1) * WALLETS_PER_PAGE + index + 1;
                    const capitalValue =
                      type === "delegator"
                        ? `${formatGLW(wallet.glwDelegated)} GLW`
                        : null;

                    let rewardsValue: string;
                    let rewardsNumeric: number;

                    if (type === "delegator" && weekRange) {
                      const weeksPassed =
                        weekRange.endWeek - weekRange.startWeek + 1;
                      const glwDelegatedNumeric = Number(
                        formatUnits(BigInt(wallet.glwDelegated || "0"), 18)
                      );
                      const pdPerWeek = glwDelegatedNumeric / 100;
                      const pdSpent = pdPerWeek * weeksPassed;

                      const grossRewards = Number(
                        formatUnits(
                          BigInt(wallet.delegatorRewardsEarned || "0"),
                          18
                        )
                      );
                      const netRewards = grossRewards - pdSpent;

                      rewardsNumeric = grossRewards;
                      rewardsValue = netRewards.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                    } else {
                      rewardsValue = formatGLW(
                        type === "delegator"
                          ? wallet.delegatorRewardsEarned
                          : wallet.minerRewardsEarned
                      );
                      rewardsNumeric = Number(
                        formatUnits(
                          BigInt(
                            (type === "delegator"
                              ? wallet.delegatorRewardsEarned
                              : wallet.minerRewardsEarned) || "0"
                          ),
                          18
                        )
                      );
                    }

                    const share = analytics.totalRewardsNumber
                      ? (rewardsNumeric / analytics.totalRewardsNumber) * 100
                      : 0;
                    const newBadge = isNewParticipant(wallet, type);
                    const ensName = allEnsNames[wallet.walletAddress];

                    return (
                      <TableRow key={wallet.walletAddress}>
                        <TableCell className="font-semibold text-muted-foreground">
                          #{rank}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {ensName ? (
                                <span className="text-sm font-medium">
                                  {ensName}
                                </span>
                              ) : (
                                <span className="font-mono text-sm">
                                  {formatAddress(wallet.walletAddress)}
                                </span>
                              )}
                              {newBadge && (
                                <Badge variant="secondary" className="text-xs">
                                  New
                                </Badge>
                              )}
                            </div>
                            {ensName && (
                              <span className="font-mono text-xs text-muted-foreground">
                                {formatAddress(wallet.walletAddress)}
                              </span>
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
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                copyToClipboard(wallet.walletAddress, "Address")
                              }
                            >
                              <Copy className="h-4 w-4" />
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
          {(totalPages > 1 || search) && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {filteredWallets.length > 0 ? (
                  <>
                    Showing {(page - 1) * WALLETS_PER_PAGE + 1} to{" "}
                    {Math.min(page * WALLETS_PER_PAGE, filteredWallets.length)}{" "}
                    of {filteredWallets.length} wallet
                    {filteredWallets.length !== 1 ? "s" : ""}
                    {search && ` (filtered from ${wallets.length})`}
                  </>
                ) : (
                  <>No wallets found matching "{search}"</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => {
                      if (
                        totalPages > 7 &&
                        pageNum > 2 &&
                        pageNum < totalPages - 1 &&
                        Math.abs(pageNum - page) > 1
                      ) {
                        if (pageNum === 3 || pageNum === totalPages - 2) {
                          return (
                            <span
                              key={pageNum}
                              className="px-2 text-muted-foreground"
                            >
                              ...
                            </span>
                          );
                        }
                        return null;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          className="min-w-[40px]"
                        >
                          {pageNum}
                        </Button>
                      );
                    }
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
