"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  type TooltipProps as RechartsTooltipProps,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  Tooltip as UiTooltip,
  TooltipContent as UiTooltipContent,
  TooltipProvider as UiTooltipProvider,
  TooltipTrigger as UiTooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/connect-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { usePoolActivity } from "@/hooks/useGlowPrices";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useGctlApi, useRewardsBreakdown, useClaimableRewards } from "@/hooks";
import { useSwapDialogData } from "@/hooks/useSwapDialogData";
import { useRewardsKernelWrapper } from "@/hooks/useRewardsKernelWrapper";
import { weekToNonce } from "@/hooks/useMerkleProofs";
import { useWalletSwaps } from "@/hooks/useWalletSwaps";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WALLET_CLAIMS_LIMIT,
  fetchWalletRewardClaimsIndex,
} from "@/lib/api/wallet-reward-claims-index";
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { getCurrentEpoch } from "@/utils/getCurrentEpoch";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import {
  getWeekNumberFromTimestamp,
  getCurrentWeekNumber,
  weekToTimestamp,
} from "@/lib/rewards/weekly-delegations";
import Link from "next/link";
import { Sparkles, Send, ArrowLeftRight } from "lucide-react";
import { useAccount, useBalance, useChainId } from "wagmi";
import OnboardingHeroWidget from "./onboarding-hero-widget";
import { SwapDialog } from "@/components/dialogs/swap-dialog";
import { SendDialog } from "@/components/send-dialog";

const GLOW_GREEN = "#4ADE80";
const ZERO_WORTH_THRESHOLD_GLW = 0.01;

function parseGlwFromWei(value?: string | null) {
  if (!value) return 0;
  try {
    return Number(formatUnits(BigInt(value), DECIMALS_BY_TOKEN.GLW));
  } catch {
    return 0;
  }
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    chunks.push(items.slice(i, i + size));
  return chunks;
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatUsdCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSpotPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$—";
  const decimals = value < 1 ? 3 : 2;
  return `$${value.toFixed(decimals)}`;
}

interface GlowWorthPoint {
  glw: number;
  week?: number;
  isCurrent?: boolean;
  liquidGlw?: number;
  delegatedActiveGlw?: number;
  unclaimedGlwRewards?: number;
}

interface NetWorthWidgetProps {
  walletAddress?: string | null;
}

function GlowWorthChartTooltip({
  active,
  payload,
}: RechartsTooltipProps<number, string>) {
  if (!active) return null;
  const point = payload?.[0]?.payload as GlowWorthPoint | undefined;
  const safeGlw = point?.glw ?? NaN;
  const week = point?.week;
  const isCurrent = Boolean(point?.isCurrent);
  const liquid = point?.liquidGlw ?? NaN;
  const delegated = point?.delegatedActiveGlw ?? NaN;
  const unclaimed = point?.unclaimedGlwRewards ?? NaN;
  if (!Number.isFinite(safeGlw)) return null;

  const dateLabel = (() => {
    if (typeof week !== "number" || !Number.isFinite(week)) return null;
    const startMs = weekToTimestamp(week);
    if (!Number.isFinite(startMs)) return null;
    return new Date(startMs).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  })();

  const currentDateLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-foreground/10 dark:border-zinc-800 bg-popover/95 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
        {isCurrent
          ? `Current · ${currentDateLabel}`
          : dateLabel
          ? `Week ${week} · ${dateLabel}`
          : week
          ? `Week ${week}`
          : "GLW worth"}
      </div>
      <div className="font-mono text-sm font-bold tabular-nums text-foreground">
        {safeGlw.toLocaleString("en-US", { maximumFractionDigits: 0 })} GLW
      </div>
      {Number.isFinite(liquid) &&
      Number.isFinite(delegated) &&
      Number.isFinite(unclaimed) ? (
        <div className="mt-2 space-y-1 text-[11px] font-mono text-muted-foreground/80 dark:text-zinc-400">
          <div className="flex items-center justify-between gap-4">
            <span>Liquid</span>
            <span className="tabular-nums text-foreground">
              {liquid.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Delegated</span>
            <span className="tabular-nums text-foreground">
              {delegated.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Unclaimed</span>
            <span className="tabular-nums text-foreground">
              {unclaimed.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GlowWorthEmptyState() {
  return (
    <div className="h-full w-full rounded-2xl border border-dashed border-border/60 bg-muted/10 px-6 py-8">
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="font-mono text-sm font-bold text-foreground">
          No GLW worth yet
        </div>
        <div className="mt-1 max-w-[360px] text-xs text-muted-foreground">
          Buy GLW, Delegate, or Stake GCTL to start building your Glow Worth
          history.
        </div>
      </div>
    </div>
  );
}

function NetWorthSkeleton() {
  return (
    <Card className="h-full overflow-hidden flex flex-col gap-2 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
            GLOW WORTH
          </span>
          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-muted/20 px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-800/50">
            <Skeleton className="h-4 w-16 rounded-md" />
            <span className="font-mono text-[11px] text-muted-foreground">
              GLW price
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-0">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-col gap-2 p-4 pb-3 pt-0 shrink-0">
            <div className="flex items-baseline gap-3">
              <Skeleton className="h-14 w-44 rounded-2xl" />
              <Skeleton className="h-7 w-14 rounded-xl" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-4 w-36 rounded-md" />
            </div>
          </div>

          <div className="px-4 flex-1 min-h-[100px]">
            <div className="h-full w-full rounded-2xl border border-border/60 bg-muted/10" />
          </div>

          <div className="border-t border-border/60 bg-muted/10 shrink-0">
            <div className="p-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="shrink-0 rounded-xl border border-foreground/10 bg-muted/10 px-3 py-2 min-w-[132px] dark:border-zinc-800 dark:bg-background/40"
                  >
                    <Skeleton className="h-4 w-16 rounded-md" />
                    <Skeleton className="mt-2 h-4 w-20 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NetWorthWidget({ walletAddress }: NetWorthWidgetProps) {
  const { isConnecting, isReconnecting } = useAccount();
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const [isSwapOpen, setIsSwapOpen] = React.useState(false);
  const [isSendOpen, setIsSendOpen] = React.useState(false);
  const hasWallet = Boolean(walletAddress);
  const { headlineStats, ethPriceInUSD } = useSwapDialogData({
    enabled: hasWallet,
  });
  const isWalletConnecting = isConnecting || isReconnecting;
  const handleSwapOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setIsSwapOpen(nextOpen);
      if (nextOpen) return;
      if (!walletAddress) return;

      void (async () => {
        try {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["wallet-token-balances", chainId, walletAddress],
            }),
            queryClient.invalidateQueries({
              queryKey: ["wallet-swaps", chainId, walletAddress],
            }),
            queryClient.invalidateQueries({
              queryKey: ["unclaimed-glw-rewards", walletAddress],
            }),
          ]);
        } catch {}
      })();
    },
    [chainId, queryClient, walletAddress]
  );
  const {
    data: ethBalanceData,
    isLoading: isEthBalanceLoading,
    isError: isEthBalanceError,
  } = useBalance({
    address: (walletAddress ?? undefined) as `0x${string}` | undefined,
    query: {
      enabled: hasWallet && Boolean(walletAddress),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  });
  const {
    glwBalance,
    usdcBalance,
    usdgBalance,
    isLoading: isTokenBalancesLoading,
    isError: isTokenBalancesError,
  } = useWalletTokenBalances(walletAddress, {
    query: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  });
  const { gctlBalance, isGctlBalanceLoading } = useGctlApi(
    walletAddress ?? undefined,
    {
      enabled: hasWallet,
    }
  );
  const {
    data: rewardsBreakdown,
    isLoading: isRewardsBreakdownLoading,
    isError: isRewardsBreakdownError,
  } = useRewardsBreakdown({
    walletAddress: walletAddress ?? null,
    enabled: hasWallet,
  });
  const {
    weeklyBreakdown,
    isLoading: isClaimableRewardsLoading,
    isError: isClaimableRewardsError,
  } = useClaimableRewards(walletAddress ?? undefined, {
    query: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  });
  const { checkIfClaimed, checkIfGlwClaimed } = useRewardsKernelWrapper();
  const {
    swaps,
    isLoading: isSwapsLoading,
    error: swapsError,
  } = useWalletSwaps(walletAddress ?? undefined);

  const liquidGlw = React.useMemo(() => {
    if (!glwBalance) return 0;
    try {
      return Number(formatUnits(glwBalance, DECIMALS_BY_TOKEN.GLW));
    } catch {
      return 0;
    }
  }, [glwBalance]);

  const usdc = React.useMemo(() => {
    if (!usdcBalance) return 0;
    try {
      return Number(formatUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC));
    } catch {
      return 0;
    }
  }, [usdcBalance]);

  const usdg = React.useMemo(() => {
    if (!usdgBalance) return 0;
    try {
      return Number(formatUnits(usdgBalance, DECIMALS_BY_TOKEN.USDG));
    } catch {
      return 0;
    }
  }, [usdgBalance]);

  const eth = React.useMemo(() => {
    const value = ethBalanceData?.value;
    if (!value) return 0;
    try {
      return Number(formatUnits(value, 18));
    } catch {
      return 0;
    }
  }, [ethBalanceData?.value]);

  const gctl = React.useMemo(() => {
    if (!gctlBalance) return 0;
    try {
      return Number(formatUnits(BigInt(gctlBalance), DECIMALS_BY_TOKEN.GCTL));
    } catch {
      return 0;
    }
  }, [gctlBalance]);

  const delegated = React.useMemo(() => {
    if (!rewardsBreakdown) {
      return {
        delegatedGrossGlw: 0,
        returnedDepositGlw: 0,
        delegatedActiveGlw: 0,
      };
    }

    const delegatedAfter = parseGlwFromWei(
      rewardsBreakdown.delegatedAfterWeekRange?.totalGlwDelegatedAfter
    );

    let delegatedInvested = 0;
    let returnedDeposit = 0;

    for (const farm of rewardsBreakdown.farmDetails ?? []) {
      if (farm.type !== "launchpad") continue;
      delegatedInvested += parseGlwFromWei(farm.amountInvested);
      returnedDeposit += parseGlwFromWei(farm.totalProtocolDepositRewards);
    }

    const delegatedGrossGlw = delegatedInvested + delegatedAfter;
    const delegatedActiveGlw = Math.max(0, delegatedGrossGlw - returnedDeposit);
    return {
      delegatedGrossGlw,
      returnedDepositGlw: returnedDeposit,
      delegatedActiveGlw,
    };
  }, [rewardsBreakdown]);

  const eligibleWeeksForUnclaimed = React.useMemo(() => {
    return weeklyBreakdown
      .filter((w) => w.isFinalized)
      .filter((w) => w.rewards.some((r) => r.currency === "GLW"))
      .map((w) => ({
        week: w.week,
        hasInflation: w.rewards.some((r) => r.type === "glowInflation"),
        hasProtocolGlw: w.rewards.some(
          (r) => r.type === "protocolDeposit" && r.currency === "GLW"
        ),
        inflationGlw: w.rewards
          .filter((r) => r.type === "glowInflation" && r.currency === "GLW")
          .reduce((sum, r) => sum + Number(r.amount || 0), 0),
        protocolGlw: w.rewards
          .filter((r) => r.type === "protocolDeposit" && r.currency === "GLW")
          .reduce((sum, r) => sum + Number(r.amount || 0), 0),
      }))
      .filter(
        (w) =>
          (w.hasInflation && w.inflationGlw > 0) ||
          (w.hasProtocolGlw && w.protocolGlw > 0)
      );
  }, [weeklyBreakdown]);

  const eligibleWeeksForUnclaimedKey = React.useMemo(() => {
    return eligibleWeeksForUnclaimed
      .map((w) => `${w.week}:${w.inflationGlw}:${w.protocolGlw}`)
      .join("|");
  }, [eligibleWeeksForUnclaimed]);

  const {
    data: unclaimedGlwRewards = 0,
    isLoading: isUnclaimedGlwLoading,
    isError: isUnclaimedGlwError,
  } = useQuery({
    queryKey: [
      "unclaimed-glw-rewards",
      walletAddress,
      eligibleWeeksForUnclaimedKey,
    ],
    enabled: Boolean(
      hasWallet && walletAddress && eligibleWeeksForUnclaimed.length > 0
    ),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!walletAddress) return 0;

      const addressLower = walletAddress.toLowerCase() as `0x${string}`;

      let claimsIndex: Awaited<
        ReturnType<typeof fetchWalletRewardClaimsIndex>
      > | null = null;
      try {
        claimsIndex = await fetchWalletRewardClaimsIndex({
          walletAddress: addressLower,
          limit: DEFAULT_WALLET_CLAIMS_LIMIT,
        });
      } catch {
        claimsIndex = null;
      }

      // Keep RPC load sane
      const batches = chunk(eligibleWeeksForUnclaimed, 8);

      let total = 0;
      for (const batch of batches) {
        const results = await Promise.all(
          batch.map(async (w) => {
            const inflationClaimed = await (async () => {
              if (!w.hasInflation) return true;

              if (
                claimsIndex?.indexingComplete &&
                claimsIndex.hasMinerPoolBucketIds
              ) {
                return claimsIndex.claimedV1Buckets.has(
                  BigInt(w.week + 1).toString()
                );
              }

              return await checkIfGlwClaimed(w.week + 1, addressLower);
            })();

            const protocolClaimed = await (async () => {
              if (!w.hasProtocolGlw) return true;

              if (claimsIndex?.indexingComplete) {
                return claimsIndex.claimedV2Nonces.has(
                  weekToNonce(w.week).toString()
                );
              }

              return await checkIfClaimed(addressLower, weekToNonce(w.week));
            })();

            const inflationUnclaimed = inflationClaimed ? 0 : w.inflationGlw;
            const protocolUnclaimed = protocolClaimed ? 0 : w.protocolGlw;
            return inflationUnclaimed + protocolUnclaimed;
          })
        );
        total += results.reduce((sum, n) => sum + n, 0);
      }

      return total;
    },
  });

  const MOCK_GLOW_WORTH = 125420;
  const MOCK_WEEKLY_ACCUMULATED = 1250;
  const MOCK_CHART_DATA = React.useMemo(() => {
    const endWeek = 100;
    return Array.from({ length: 13 }).map((_, i) => ({
      glw: 100000 + i * 2000 + Math.random() * 1000,
      week: endWeek - 12 + i,
    }));
  }, []);

  const glowWorth = React.useMemo(() => {
    if (!hasWallet) return MOCK_GLOW_WORTH;
    return liquidGlw + delegated.delegatedActiveGlw + unclaimedGlwRewards;
  }, [hasWallet, delegated.delegatedActiveGlw, liquidGlw, unclaimedGlwRewards]);

  const hasWorthDataError =
    isTokenBalancesError ||
    isRewardsBreakdownError ||
    isClaimableRewardsError ||
    isEthBalanceError ||
    Boolean(swapsError) ||
    isUnclaimedGlwError;

  const isWorthDataInitialLoading =
    hasWallet &&
    !hasWorthDataError &&
    (isTokenBalancesLoading ||
      isEthBalanceLoading ||
      isGctlBalanceLoading ||
      isRewardsBreakdownLoading ||
      isClaimableRewardsLoading ||
      isSwapsLoading ||
      (weeklyBreakdown.length > 0 && isUnclaimedGlwLoading));

  const showEmptyState =
    hasWallet &&
    !isWorthDataInitialLoading &&
    !hasWorthDataError &&
    Number.isFinite(glowWorth) &&
    glowWorth < ZERO_WORTH_THRESHOLD_GLW;

  const glowWorthBreakdownShares = React.useMemo(() => {
    if (!Number.isFinite(glowWorth) || glowWorth <= 0) {
      return { delegatedShare: 0, unclaimedShare: 0 };
    }

    const delegatedShareRaw = delegated.delegatedActiveGlw / glowWorth;
    const delegatedShare = Math.max(0, Math.min(1, delegatedShareRaw));

    const unclaimedShareRaw = unclaimedGlwRewards / glowWorth;
    const unclaimedShare = Math.max(
      0,
      Math.min(1 - delegatedShare, unclaimedShareRaw)
    );

    return { delegatedShare, unclaimedShare };
  }, [delegated.delegatedActiveGlw, glowWorth, unclaimedGlwRewards]);

  const weeklyAccumulatedGlw = React.useMemo(() => {
    if (!hasWallet) return MOCK_WEEKLY_ACCUMULATED;
    if (!rewardsBreakdown) return 0;
    let maxWeek = -1;
    let amount = 0;
    for (const farm of rewardsBreakdown.farmDetails ?? []) {
      for (const w of farm.weeklyBreakdown ?? []) {
        const glw = parseGlwFromWei(w.totalRewards);
        if (w.weekNumber > maxWeek) {
          maxWeek = w.weekNumber;
          amount = glw;
        } else if (w.weekNumber === maxWeek) {
          amount += glw;
        }
      }
    }
    return amount;
  }, [hasWallet, rewardsBreakdown]);

  const glowWorthChartData = React.useMemo(() => {
    if (!hasWallet) return MOCK_CHART_DATA;

    const endWeek = (() => {
      const apiEndWeek = rewardsBreakdown?.weekRange?.endWeek;
      if (typeof apiEndWeek === "number" && Number.isFinite(apiEndWeek))
        return apiEndWeek;
      try {
        return getCurrentEpoch();
      } catch {
        return getCurrentWeekNumber();
      }
    })();
    const startWeek = Math.max(0, endWeek - 12);

    const earnedByWeek = new Map<number, number>();
    if (rewardsBreakdown) {
      for (const farm of rewardsBreakdown.farmDetails ?? []) {
        for (const w of farm.weeklyBreakdown ?? []) {
          if (w.weekNumber < startWeek || w.weekNumber > endWeek) continue;
          earnedByWeek.set(
            w.weekNumber,
            (earnedByWeek.get(w.weekNumber) ?? 0) +
              parseGlwFromWei(w.totalRewards)
          );
        }
      }
    }

    if (earnedByWeek.size === 0 && weeklyBreakdown.length > 0) {
      for (const weekEntry of weeklyBreakdown) {
        if (weekEntry.week < startWeek || weekEntry.week > endWeek) continue;
        const glwEarned = weekEntry.rewards
          .filter((r) => r.currency === "GLW")
          .reduce((sum, r) => sum + Number(r.amount || 0), 0);
        if (glwEarned <= 0) continue;
        earnedByWeek.set(
          weekEntry.week,
          (earnedByWeek.get(weekEntry.week) ?? 0) + glwEarned
        );
      }
    }

    const swapDeltaByWeek = new Map<number, number>();
    for (const swap of swaps) {
      const week = getWeekNumberFromTimestamp(swap.timestamp);
      if (week < startWeek || week > endWeek) continue;
      const netGlw = (swap.glwOut ?? 0) - (swap.glwIn ?? 0);
      swapDeltaByWeek.set(week, (swapDeltaByWeek.get(week) ?? 0) + netGlw);
    }

    const weeks = Array.from({ length: endWeek - startWeek + 1 }).map(
      (_, idx) => startWeek + idx
    );

    const deltas = weeks.map((week) => {
      const earned = earnedByWeek.get(week) ?? 0;
      const netSwaps = swapDeltaByWeek.get(week) ?? 0;
      return earned + netSwaps;
    });

    const totalDelta = deltas.reduce((sum, d) => sum + d, 0);
    let current = glowWorth - totalDelta;

    const points: GlowWorthPoint[] = [];
    weeks.forEach((week, idx) => {
      current += deltas[idx] ?? 0;
      const isCurrent = idx === weeks.length - 1;
      const total = Math.max(0, current);

      if (isCurrent) {
        points.push({
          glw: total,
          week,
          isCurrent,
          liquidGlw,
          delegatedActiveGlw: delegated.delegatedActiveGlw,
          unclaimedGlwRewards,
        });
        return;
      }

      const delegatedActiveGlw =
        total * glowWorthBreakdownShares.delegatedShare;
      const unclaimedGlw = total * glowWorthBreakdownShares.unclaimedShare;
      const liquid = Math.max(0, total - delegatedActiveGlw - unclaimedGlw);

      points.push({
        glw: total,
        week,
        isCurrent,
        liquidGlw: liquid,
        delegatedActiveGlw,
        unclaimedGlwRewards: unclaimedGlw,
      });
    });

    return points;
  }, [
    hasWallet,
    MOCK_CHART_DATA,
    delegated.delegatedActiveGlw,
    glowWorth,
    glowWorthBreakdownShares.delegatedShare,
    glowWorthBreakdownShares.unclaimedShare,
    liquidGlw,
    rewardsBreakdown,
    swaps,
    unclaimedGlwRewards,
    weeklyBreakdown,
  ]);

  const visibleHoldings = React.useMemo(() => {
    const holdings = [
      { symbol: "GLW", amount: liquidGlw },
      { symbol: "USDC", amount: usdc },
      { symbol: "USDG", amount: usdg },
      { symbol: "GCTL", amount: gctl },
      { symbol: "ETH", amount: eth },
    ] as const;
    return holdings.filter((h) => h.amount > 0);
  }, [eth, gctl, liquidGlw, usdc, usdg]);

  const { glowPrice, marketCap } = useGlowCirculatingSupply();
  const { deltaPercent: deltaPercent24h, currentPrice: vwapPrice24h } =
    usePoolActivity("day", "hour");

  const spotPrice = React.useMemo(() => {
    if (Number.isFinite(glowPrice) && glowPrice > 0) return glowPrice;
    if (Number.isFinite(vwapPrice24h) && (vwapPrice24h ?? 0) > 0)
      return vwapPrice24h ?? 0;
    return 0;
  }, [glowPrice, vwapPrice24h]);

  const formattedSpotPrice = React.useMemo(
    () => formatSpotPrice(spotPrice),
    [spotPrice]
  );
  const formattedDeltaPercent = React.useMemo(() => {
    if (!Number.isFinite(deltaPercent24h as number) || deltaPercent24h === null)
      return null;
    const sign = deltaPercent24h >= 0 ? "+" : "";
    return `${sign}${deltaPercent24h.toFixed(1)}%`;
  }, [deltaPercent24h]);

  const deltaClassName =
    formattedDeltaPercent === null
      ? "text-muted-foreground"
      : (deltaPercent24h ?? 0) >= 0
      ? "text-green-400"
      : "text-red-400";

  const chartData = glowWorthChartData;
  const yDomain = React.useMemo<[number, number]>(() => {
    const values = chartData
      .map((p) => p.glw)
      .filter((v) => Number.isFinite(v));
    if (values.length === 0) return [0, 1];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const pad = range > 0 ? Math.max(range * 0.15, 10) : 10;

    return [Math.max(0, min - pad), max + pad];
  }, [chartData]);

  const shouldShowSkeleton =
    (isWalletConnecting && !hasWallet) ||
    (hasWallet && isWorthDataInitialLoading);
  if (shouldShowSkeleton) return <NetWorthSkeleton />;

  if (showEmptyState) return <OnboardingHeroWidget className="h-full" />;

  return (
    <Card className="h-full min-h-[420px] lg:min-h-0 overflow-hidden flex flex-col gap-2 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              GLOW WORTH
            </span>

            {hasWallet && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 sm:px-2.5 text-[11px] font-mono uppercase tracking-wider gap-1.5"
                  onClick={() => setIsSwapOpen(true)}
                >
                  <ArrowLeftRight className="h-3 w-3 hidden sm:block" />
                  <span className="text-xs sm:inline">Swap</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 sm:px-2.5 text-[11px] font-mono uppercase tracking-wider gap-1.5"
                  onClick={() => setIsSendOpen(true)}
                >
                  <Send className="h-3 w-3" />
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </div>
            )}
          </div>

          <UiTooltipProvider delayDuration={150}>
            <UiTooltip>
              <UiTooltipTrigger asChild>
                <div className="inline-flex shrink-0 w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-2.5 py-1">
                  <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                    {formattedSpotPrice}
                  </span>
                  <span
                    className={cn("font-mono text-[11px] hidden sm:inline")}
                  >
                    GLW price
                  </span>
                </div>
              </UiTooltipTrigger>
              <UiTooltipContent side="bottom" align="end" sideOffset={10}>
                <div className="font-mono text-[10px]">
                  Market Cap: {formatUsdCompact(marketCap)}
                </div>
              </UiTooltipContent>
            </UiTooltip>
          </UiTooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-0">
        <div
          aria-hidden={!hasWallet}
          className={cn(
            "flex flex-col flex-1 min-h-0",
            !hasWallet &&
              "pointer-events-none select-none blur-[5px] opacity-60 bg-background"
          )}
        >
          <div className="flex flex-col gap-2 p-4 pb-3 pt-0 shrink-0">
            <div className="font-mono text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-foreground tabular-nums">
              <NumberTicker
                value={glowWorth}
                decimalPlaces={0}
                className="tracking-tighter"
              />
              <span className="ml-2 text-xl md:text-2xl font-mono font-semibold text-zinc-500">
                GLW
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="px-2 py-1 rounded-md font-mono text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                +
                {weeklyAccumulatedGlw.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}{" "}
                GLW
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                accumulated this week
              </span>
            </div>
          </div>

          <div
            className={cn(
              "px-4 flex-1",
              hasWallet
                ? "min-h-[180px] lg:min-h-[100px]"
                : "min-h-[220px] lg:min-h-[190px]"
            )}
          >
            {showEmptyState ? (
              <GlowWorthEmptyState />
            ) : (
              <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--border)"
                      strokeOpacity={0.12}
                    />
                    <YAxis
                      width={56}
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={8}
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 10,
                      }}
                      tickFormatter={(value: number) => formatCompact(value)}
                      domain={yDomain}
                    />
                    <RechartsTooltip
                      cursor={{ stroke: "var(--border)", strokeOpacity: 0.35 }}
                      content={GlowWorthChartTooltip}
                    />
                    <defs>
                      <linearGradient
                        id="glowWorthGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={GLOW_GREEN}
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor={GLOW_GREEN}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="glw"
                      stroke={GLOW_GREEN}
                      strokeWidth={3}
                      fill="url(#glowWorthGradient)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {hasWallet && !showEmptyState ? (
            <div className="border-t border-border/60 bg-muted/10 shrink-0">
              <div className="p-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {visibleHoldings.map((holding) => (
                    <div
                      key={holding.symbol}
                      className="shrink-0 rounded-xl border border-foreground/10 bg-muted/10 px-3 py-2 min-w-[132px] dark:border-border dark:bg-background/40"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          {holding.symbol}
                        </div>
                        <div className="font-mono text-sm font-bold text-foreground tabular-nums">
                          {holding.symbol === "GLW"
                            ? `${formatCompact(holding.amount)}`
                            : holding.symbol === "ETH"
                            ? toFixedTruncate(holding.amount, 4)
                            : formatCompact(holding.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {!hasWallet ? (
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-center max-w-xs mx-auto">
              <div className="mt-1 text-sm text-muted-foreground">
                Connect your wallet to Begin.
              </div>
              <div className="mt-3">
                <ConnectButton
                  className="w-full"
                  variant="default"
                  size="large"
                />
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>

      <SwapDialog
        open={isSwapOpen}
        onOpenChange={handleSwapOpenChange}
        headlineStats={headlineStats}
        ethPriceInUSD={ethPriceInUSD}
      />
      <SendDialog open={isSendOpen} onOpenChange={setIsSendOpen} />
    </Card>
  );
}
