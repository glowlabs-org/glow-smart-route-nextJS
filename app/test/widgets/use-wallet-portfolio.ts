"use client";

import * as React from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";

import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useImpactGlowWorthQuery, useImpactScoreQuery } from "@/hooks";
import { useSwapDialogData } from "@/hooks/useSwapDialogData";
import { QUERY_CONFIG } from "@/hooks/query-config";
import { getCurrentWeekNumber } from "@/lib/rewards/weekly-delegations";

const ZERO_WORTH_THRESHOLD_GLW = 0.01;

export interface GlowWorthPoint {
  glw: number;
  week?: number;
  isCurrent?: boolean;
  liquidGlw?: number;
  delegatedActiveGlw?: number;
  unclaimedGlwRewards?: number;
}

export type PortfolioTokenSymbol = "GLW" | "USDC" | "USDG" | "ETH";

export interface PortfolioHolding {
  symbol: PortfolioTokenSymbol;
  amount: number;
}

export interface AllocationItem {
  symbol: PortfolioTokenSymbol;
  amount: number;
  usdValue: number | null;
  percent: number | null;
}

function parseGlwFromWei(value?: string | null) {
  if (!value) return 0;
  try {
    return Number(formatUnits(BigInt(value), DECIMALS_BY_TOKEN.GLW));
  } catch {
    return 0;
  }
}

function safeNumberFromUnits(
  value: bigint | undefined | null,
  decimals: number
) {
  if (!value) return 0;
  try {
    return Number(formatUnits(value, decimals));
  } catch {
    return 0;
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function computeAllocations(params: {
  holdings: PortfolioHolding[];
  glowPriceUsd: number | null;
  ethPriceUsd: number | null;
}) {
  const { holdings, glowPriceUsd, ethPriceUsd } = params;

  const priced = holdings.map((h): AllocationItem => {
    if (h.amount <= 0) return { ...h, usdValue: null, percent: null };

    if (h.symbol === "USDC" || h.symbol === "USDG") {
      return { ...h, usdValue: h.amount, percent: null };
    }

    if (h.symbol === "GLW") {
      const price = glowPriceUsd ?? null;
      if (!price || !Number.isFinite(price) || price <= 0)
        return { ...h, usdValue: null, percent: null };
      return { ...h, usdValue: h.amount * price, percent: null };
    }

    if (h.symbol === "ETH") {
      const price = ethPriceUsd ?? null;
      if (!price || !Number.isFinite(price) || price <= 0)
        return { ...h, usdValue: null, percent: null };
      return { ...h, usdValue: h.amount * price, percent: null };
    }

    return { ...h, usdValue: null, percent: null };
  });

  const totalUsd = priced
    .map((i) => i.usdValue)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .reduce((sum, v) => sum + v, 0);

  const withPercent = priced.map((i) => {
    if (!i.usdValue || !Number.isFinite(i.usdValue) || i.usdValue <= 0)
      return i;
    if (!Number.isFinite(totalUsd) || totalUsd <= 0)
      return { ...i, percent: null };
    return {
      ...i,
      percent: clampNumber(i.usdValue / totalUsd, 0, 1),
    };
  });

  return { totalUsd, items: withPercent };
}

export function useWalletPortfolio(params: { walletAddress?: string | null }) {
  const walletAddress = params.walletAddress ?? null;
  const { isConnecting, isReconnecting } = useAccount();
  const hasWallet = Boolean(walletAddress);
  const isWalletConnecting = isConnecting || isReconnecting;

  const { headlineStats, ethPriceInUSD } = useSwapDialogData({
    enabled: hasWallet,
  });

  const {
    data: ethBalanceData,
    isLoading: isEthBalanceLoading,
    isError: isEthBalanceError,
  } = useBalance({
    address: (walletAddress ?? undefined) as `0x${string}` | undefined,
    query: {
      enabled: hasWallet && Boolean(walletAddress),
      staleTime: QUERY_CONFIG.DEFAULT.staleTime,
      refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
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
      staleTime: QUERY_CONFIG.DEFAULT.staleTime,
      refetchOnWindowFocus: QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    },
  });

  const weekRange = React.useMemo(() => {
    if (!hasWallet) return null;
    const endWeek = getCurrentWeekNumber();
    return { startWeek: Math.max(0, endWeek - 12), endWeek };
  }, [hasWallet]);

  const {
    data: impactGlowWorth,
    isLoading: isImpactGlowWorthLoading,
    isError: isImpactGlowWorthError,
  } = useImpactGlowWorthQuery({
    walletAddress,
    weekRange,
    enabled: hasWallet,
  });

  const {
    data: impactScore,
    isLoading: isImpactScoreLoading,
    isError: isImpactScoreError,
  } = useImpactScoreQuery({
    walletAddress,
    weekRange,
    enabled: hasWallet,
    toastTitle: "Failed to load Glow Worth history",
  });

  const liquidGlw = React.useMemo(
    () => safeNumberFromUnits(glwBalance, DECIMALS_BY_TOKEN.GLW),
    [glwBalance]
  );
  const usdc = React.useMemo(
    () => safeNumberFromUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC),
    [usdcBalance]
  );
  const usdg = React.useMemo(
    () => safeNumberFromUnits(usdgBalance, DECIMALS_BY_TOKEN.USDG),
    [usdgBalance]
  );
  const eth = React.useMemo(
    () => safeNumberFromUnits(ethBalanceData?.value, 18),
    [ethBalanceData?.value]
  );

  const impactLiquidGlw = React.useMemo(() => {
    return parseGlwFromWei(impactGlowWorth?.liquidGlwWei);
  }, [impactGlowWorth?.liquidGlwWei]);
  const impactDelegatedActiveGlw = React.useMemo(() => {
    return parseGlwFromWei(impactGlowWorth?.delegatedActiveGlwWei);
  }, [impactGlowWorth?.delegatedActiveGlwWei]);
  const impactUnclaimedGlwRewards = React.useMemo(() => {
    return parseGlwFromWei(impactGlowWorth?.unclaimedGlwRewardsWei);
  }, [impactGlowWorth?.unclaimedGlwRewardsWei]);

  const MOCK_GLOW_WORTH = 125_420;
  const MOCK_WEEKLY_ACCUMULATED = 1_250;
  const MOCK_CHART_DATA = React.useMemo(() => {
    const endWeek = 100;
    return Array.from({ length: 13 }).map((_, i) => ({
      glw: 100000 + i * 2000 + Math.random() * 1000,
      week: endWeek - 12 + i,
    }));
  }, []);

  const glowWorthGlw = React.useMemo(() => {
    if (!hasWallet) return MOCK_GLOW_WORTH;
    return parseGlwFromWei(impactGlowWorth?.glowWorthWei);
  }, [hasWallet, impactGlowWorth?.glowWorthWei]);

  const glowWorthBreakdown = React.useMemo(() => {
    if (!hasWallet) return null;
    return {
      glowWorthGlw,
      liquidGlw: impactLiquidGlw,
      delegatedActiveGlw: impactDelegatedActiveGlw,
      unclaimedGlwRewards: impactUnclaimedGlwRewards,
    };
  }, [
    glowWorthGlw,
    hasWallet,
    impactDelegatedActiveGlw,
    impactLiquidGlw,
    impactUnclaimedGlwRewards,
  ]);

  const hasWorthDataError =
    isTokenBalancesError ||
    isEthBalanceError ||
    isImpactGlowWorthError ||
    isImpactScoreError;

  const isWorthDataInitialLoading =
    hasWallet &&
    !hasWorthDataError &&
    (isTokenBalancesLoading ||
      isEthBalanceLoading ||
      isImpactGlowWorthLoading ||
      isImpactScoreLoading);

  const showEmptyState =
    hasWallet &&
    !isWorthDataInitialLoading &&
    !hasWorthDataError &&
    Number.isFinite(glowWorthGlw) &&
    glowWorthGlw < ZERO_WORTH_THRESHOLD_GLW;

  const weeklyAccumulatedGlw = React.useMemo(() => {
    if (!hasWallet) return MOCK_WEEKLY_ACCUMULATED;

    const weekly = impactScore?.weekly ?? [];
    if (weekly.length === 0) return 0;

    // Use actual earnings (inflation + protocol deposit) from the most recent week
    // with finalized data. This avoids false "accumulation" from:
    // 1. Claims moving GLW between buckets (unclaimed → liquid)
    // 2. Stale TWAB snapshots creating artificial deltas
    // 3. Current week using fresh data vs previous week using stale snapshots
    for (let i = weekly.length - 1; i >= 0; i--) {
      const row = weekly[i];
      if (!row) continue;

      const inflation = parseGlwFromWei(row.inflationGlwWei);
      const protocolDeposit = parseGlwFromWei(row.protocolDepositRecoveredGlwWei);
      const totalEarnings = inflation + protocolDeposit;

      if (totalEarnings > 0) return totalEarnings;
    }

    return 0;
  }, [hasWallet, impactScore?.weekly]);

  const chartData = React.useMemo<GlowWorthPoint[]>(() => {
    if (!hasWallet) return MOCK_CHART_DATA as GlowWorthPoint[];
    const weekly = impactScore?.weekly ?? [];
    if (weekly.length === 0) return [];

    return weekly.map((row, idx) => {
      const isCurrent = idx === weekly.length - 1;
      const fallbackGlw = parseGlwFromWei(row.glowWorthGlwWei);
      const currentGlw = parseGlwFromWei(impactGlowWorth?.glowWorthWei);
      const glw = isCurrent ? currentGlw : fallbackGlw;

      // Breakdown is only available for current week
      const liquidGlw = isCurrent ? impactLiquidGlw : undefined;
      const delegatedActiveGlw = isCurrent
        ? impactDelegatedActiveGlw
        : undefined;
      const unclaimedGlwRewards = isCurrent
        ? impactUnclaimedGlwRewards
        : undefined;

      return {
        glw,
        week: row.weekNumber,
        isCurrent,
        liquidGlw,
        delegatedActiveGlw,
        unclaimedGlwRewards,
      };
    });
  }, [
    hasWallet,
    MOCK_CHART_DATA,
    impactScore?.weekly,
    impactGlowWorth?.glowWorthWei,
    impactLiquidGlw,
    impactDelegatedActiveGlw,
    impactUnclaimedGlwRewards,
  ]);

  const yDomain = React.useMemo<[number, number]>(() => {
    const values = chartData
      .map((p) => p.glw)
      .filter((v) => Number.isFinite(v));
    if (values.length === 0) return [0, 1];

    const max = Math.max(...values);
    // Ensure at least 20% buffer at the top to prevent overlap with value display overlay
    const paddedMax = max * 1.25;

    return [0, paddedMax];
  }, [chartData]);

  // Portfolio allocations should reflect *wallet-held* tokens, not the broader
  // "GLW Worth" number (which includes delegated + unclaimed).
  const holdings = React.useMemo<PortfolioHolding[]>(() => {
    const items: PortfolioHolding[] = [
      { symbol: "GLW", amount: liquidGlw },
      { symbol: "USDC", amount: usdc },
      { symbol: "USDG", amount: usdg },
      { symbol: "ETH", amount: eth },
    ];
    return items.filter((i) => i.amount > 0);
  }, [eth, liquidGlw, usdc, usdg]);

  const { glowPrice, marketCap } = useGlowCirculatingSupply({
    enabled: hasWallet,
  });

  const allocations = React.useMemo(() => {
    return computeAllocations({
      holdings,
      glowPriceUsd:
        Number.isFinite(glowPrice) && glowPrice > 0 ? glowPrice : null,
      ethPriceUsd:
        Number.isFinite(ethPriceInUSD ?? NaN) && (ethPriceInUSD ?? 0) > 0
          ? (ethPriceInUSD as number)
          : null,
    });
  }, [ethPriceInUSD, glowPrice, holdings]);

  const shouldShowSkeleton =
    (isWalletConnecting && !hasWallet) ||
    (hasWallet && isWorthDataInitialLoading);

  return {
    hasWallet,
    isWalletConnecting,
    shouldShowSkeleton,
    showEmptyState,
    hasWorthDataError,

    headlineStats,
    ethPriceInUSD: ethPriceInUSD ?? null,
    glowPriceUsd: Number.isFinite(glowPrice) ? glowPrice : 0,
    marketCapUsd: Number.isFinite(marketCap) ? marketCap : 0,

    glowWorthGlw,
    glowWorthBreakdown,
    weeklyAccumulatedGlw,
    chartData,
    yDomain,

    holdings,
    allocationItems: allocations.items,
    allocationTotalUsd: allocations.totalUsd,
  };
}
