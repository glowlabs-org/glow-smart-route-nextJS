"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { formatUnits } from "viem";
import {
  DECIMALS_BY_TOKEN,
  type MigrationAmountResponse,
  type MintedEvent,
  type StakedEvent,
  type WalletDetails,
  type WalletWeeklyRewardsResponse,
  type WeeklyReward,
} from "@glowlabs-org/utils/browser";
import { getControlRouter, getWalletsRouter } from "@/lib/api/control-routers";
import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";

export type {
  MigrationAmountResponse,
  MintedEvent,
  StakedEvent,
  WalletDetails,
};

const QUERY_KEYS = {
  walletDetails: (wallet?: string) => ["wallet-details", wallet],
  walletMintedEvents: (wallet?: string, page?: number, limit?: number) => [
    "wallet-minted-events",
    wallet,
    page,
    limit,
  ],
  walletStakeEvents: (
    wallet?: string,
    page?: number,
    limit?: number,
    regionId?: number
  ) => ["wallet-stake-events", wallet, page, limit, regionId],
  migrationAmount: (wallet?: string) => ["migration-amount", wallet],
  allWallets: () => ["all-wallets"],
  v2Claims: (wallet?: string, refreshKey?: string | number) => {
    if (refreshKey == null) return ["wallet-v2-claims", wallet] as const;
    return ["wallet-v2-claims", wallet, refreshKey] as const;
  },
  walletRewards: (wallet?: string, refreshKey?: string | number) => {
    if (refreshKey == null) return ["wallet-rewards", wallet] as const;
    return ["wallet-rewards", wallet, refreshKey] as const;
  },
} as const;

export interface UseWalletsParams {
  walletAddress?: string;
  enabled?: boolean;
  page?: number;
  limit?: number;
  regionId?: number;
}

export function useWallets(params: UseWalletsParams = {}) {
  const {
    walletAddress,
    enabled = true,
    page = 1,
    limit = 20,
    regionId,
  } = params;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const walletDetailsQuery = useQuery({
    queryKey: QUERY_KEYS.walletDetails(walletAddress),
    queryFn: () =>
      (getWalletsRouter() as any).fetchWalletByAddress(walletAddress!),
    enabled: enabled && isConfigured && Boolean(walletAddress),
    staleTime: 30_000,
    retry: 2,
  });

  const mintedEventsQuery = useQuery({
    queryKey: QUERY_KEYS.walletMintedEvents(walletAddress, page, limit),
    queryFn: () =>
      (getWalletsRouter() as any).fetchWalletMintedEvents(
        walletAddress!,
        page,
        limit
      ),
    enabled: enabled && isConfigured && Boolean(walletAddress),
    staleTime: 30_000,
    retry: 2,
  });

  const stakeEventsQuery = useQuery({
    queryKey: QUERY_KEYS.walletStakeEvents(
      walletAddress,
      page,
      limit,
      regionId
    ),
    queryFn: () =>
      (getWalletsRouter() as any).fetchWalletStakeEvents(
        walletAddress!,
        page,
        limit,
        regionId
      ),
    enabled: enabled && isConfigured && Boolean(walletAddress),
    staleTime: 30_000,
    retry: 2,
  });

  const migrationQuery = useQuery({
    queryKey: QUERY_KEYS.migrationAmount(walletAddress),
    queryFn: () =>
      (getControlRouter() as any).fetchMigrationAmount(walletAddress!),
    enabled: enabled && isConfigured && Boolean(walletAddress),
    staleTime: 60_000,
    retry: 2,
  });

  const allWalletsQuery = useQuery({
    queryKey: QUERY_KEYS.allWallets(),
    queryFn: () => (getWalletsRouter() as any).fetchAllWallets(),
    enabled: false,
    staleTime: 60_000,
    retry: 2,
  });

  return {
    walletDetails: walletDetailsQuery.data as WalletDetails | undefined,
    mintedEvents: (mintedEventsQuery.data ?? []) as MintedEvent[],
    stakeEvents: (stakeEventsQuery.data ?? []) as StakedEvent[],
    migrationData: migrationQuery.data as MigrationAmountResponse | undefined,
    allWallets: (allWalletsQuery.data ?? []) as any[],

    isWalletDetailsLoading: walletDetailsQuery.isLoading,
    isMintedEventsLoading: mintedEventsQuery.isLoading,
    isStakeEventsLoading: stakeEventsQuery.isLoading,
    isMigrationLoading: migrationQuery.isLoading,
    isAllWalletsLoading: allWalletsQuery.isLoading,

    walletDetailsError: walletDetailsQuery.error,
    mintedEventsError: mintedEventsQuery.error,
    stakeEventsError: stakeEventsQuery.error,
    migrationError: migrationQuery.error,
    allWalletsError: allWalletsQuery.error,

    refetchWalletDetails: walletDetailsQuery.refetch,
    refetchMintedEvents: mintedEventsQuery.refetch,
    refetchStakeEvents: stakeEventsQuery.refetch,
    refetchMigrationAmount: migrationQuery.refetch,
    refetchAllWallets: allWalletsQuery.refetch,
  } as const;
}

export interface WalletProtocolClaim {
  week: number;
  currency: string;
  amount: number;
  amountRaw: string;
  claimedAt: number;
}

export interface WalletInflationClaim {
  week: number;
  amount: number;
  amountRaw: string;
  claimedAt: number;
}

interface WalletV2ClaimsResult {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  protocolClaims: WalletProtocolClaim[];
  protocolTotals: Record<string, number>;
  inflationClaims: WalletInflationClaim[];
  inflationTotalGlw: number;
}

export interface UseWalletV2ClaimsOptions {
  refreshKey?: string | number;
  query?: {
    staleTime?: number;
    gcTime?: number;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
  };
}

function weekToTimestamp(week: number) {
  const secondsPerWeek = 7 * 86_400;
  return (GENESIS_TIMESTAMP + week * secondsPerWeek) * 1000;
}

export function useWalletV2Claims(
  walletAddress: string | undefined,
  options: UseWalletV2ClaimsOptions = {}
): WalletV2ClaimsResult {
  const currentEpoch = getCurrentEpoch();
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const { data, isLoading, isError, error } =
    useQuery<WalletWeeklyRewardsResponse | null>({
      queryKey: QUERY_KEYS.v2Claims(walletAddress, options.refreshKey),
      enabled: isConfigured && Boolean(walletAddress),
      staleTime: options.query?.staleTime ?? 30_000,
      gcTime: options.query?.gcTime ?? 5 * 60_000,
      refetchOnWindowFocus: options.query?.refetchOnWindowFocus ?? false,
      refetchOnMount: options.query?.refetchOnMount ?? true,
      ...(options.query?.refetchOnReconnect !== undefined
        ? { refetchOnReconnect: options.query.refetchOnReconnect }
        : {}),
      queryFn: async () => {
        if (!walletAddress) return null;
        return await (getWalletsRouter() as any).fetchWalletWeeklyRewards(
          walletAddress,
          {
            endWeek: currentEpoch - 1,
            limit: 150,
          }
        );
      },
    });

  const processed = React.useMemo(() => {
    if (!data?.rewards?.length) {
      return {
        protocolClaims: [],
        protocolTotals: {},
        inflationClaims: [],
        inflationTotalGlw: 0,
      };
    }

    const protocolTotals: Record<string, number> = {};
    const protocolClaims: WalletProtocolClaim[] = [];
    const inflationClaims: WalletInflationClaim[] = [];
    let inflationTotalGlw = 0;

    for (const reward of data.rewards) {
      const raw = reward.protocolDepositRewardsReceived;
      if (raw && raw !== "0") {
        const currency = reward.paymentCurrency || "GLW";
        const decimals =
          DECIMALS_BY_TOKEN[currency as keyof typeof DECIMALS_BY_TOKEN] ?? 18;
        const amount = Number(formatUnits(BigInt(raw), decimals));
        if (Number.isFinite(amount) && amount > 0) {
          protocolTotals[currency] = new Decimal(protocolTotals[currency] || 0)
            .plus(amount)
            .toNumber();
          protocolClaims.push({
            week: reward.weekNumber,
            currency,
            amount,
            amountRaw: raw,
            claimedAt: weekToTimestamp(reward.weekNumber),
          });
        }
      }

      const inflationRaw = reward.glowInflationTotal;
      if (inflationRaw && inflationRaw !== "0") {
        const glwAmount = Number(
          formatUnits(BigInt(inflationRaw), DECIMALS_BY_TOKEN.GLW)
        );
        if (Number.isFinite(glwAmount) && glwAmount > 0) {
          inflationTotalGlw = new Decimal(inflationTotalGlw)
            .plus(glwAmount)
            .toNumber();
          inflationClaims.push({
            week: reward.weekNumber,
            amount: glwAmount,
            amountRaw: inflationRaw,
            claimedAt: weekToTimestamp(reward.weekNumber),
          });
        }
      }
    }

    protocolClaims.sort((a, b) => b.week - a.week);
    inflationClaims.sort((a, b) => b.week - a.week);

    return {
      protocolClaims,
      protocolTotals,
      inflationClaims,
      inflationTotalGlw,
    };
  }, [data]);

  return {
    isLoading,
    isError,
    error: (error as Error | null) ?? null,
    protocolClaims: processed.protocolClaims,
    protocolTotals: processed.protocolTotals,
    inflationClaims: processed.inflationClaims,
    inflationTotalGlw: processed.inflationTotalGlw,
  };
}

export interface ClaimableReward {
  week: number;
  currency: string;
  amount: string;
  amountRaw: string;
  type: "glowInflation" | "protocolDeposit";
}

export interface WeeklyClaimableRewards {
  week: number;
  rewards: ClaimableReward[];
  totalGlw: string;
  totalProtocolDeposit: Map<string, string>;
  isFinalized: boolean;
  weeksUntilClaimable: number;
}

export interface AggregatedTotals {
  [currency: string]: string;
}

export interface UseClaimableRewardsOptions {
  refreshKey?: string | number;
  query?: {
    staleTime?: number;
    gcTime?: number;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
  };
}

export interface UseClaimableRewardsResult {
  aggregatedTotals: AggregatedTotals;
  weeklyBreakdown: WeeklyClaimableRewards[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useClaimableRewards(
  walletAddress?: string,
  options: UseClaimableRewardsOptions = {}
): UseClaimableRewardsResult {
  const currentEpoch = getCurrentEpoch();
  const glwFinalizedThresholdWeek = currentEpoch - 3;
  const pdFinalizedThresholdWeek = currentEpoch - 4;
  const endWeek = currentEpoch - 1;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const {
    data: rewardsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.walletRewards(walletAddress, options.refreshKey),
    enabled: isConfigured && Boolean(walletAddress),
    staleTime: options.query?.staleTime ?? 30_000,
    gcTime: options.query?.gcTime ?? 5 * 60_000,
    refetchOnMount: options.query?.refetchOnMount ?? true,
    refetchOnWindowFocus: options.query?.refetchOnWindowFocus ?? false,
    ...(options.query?.refetchOnReconnect !== undefined
      ? { refetchOnReconnect: options.query.refetchOnReconnect }
      : {}),
    queryFn: async () => {
      if (!walletAddress) throw new Error("No wallet address");
      return await (getWalletsRouter() as any).fetchWalletWeeklyRewards(
        walletAddress,
        {
          endWeek,
          limit: 100,
        }
      );
    },
  });

  const { aggregatedTotals, weeklyBreakdown } = React.useMemo(() => {
    if (!rewardsData?.rewards?.length)
      return { aggregatedTotals: {}, weeklyBreakdown: [] };

    const totals: AggregatedTotals = {};
    const weeklyMap = new Map<number, WeeklyClaimableRewards>();

    rewardsData.rewards.forEach((reward: WeeklyReward) => {
      if (reward.weekNumber > endWeek || reward.weekNumber < 97) return;

      const weekData = weeklyMap.get(reward.weekNumber) || {
        week: reward.weekNumber,
        rewards: [],
        totalGlw: "0",
        totalProtocolDeposit: new Map<string, string>(),
        isFinalized: false,
        weeksUntilClaimable: 0,
      };

      const isGlwFinalized = reward.weekNumber <= glwFinalizedThresholdWeek;
      const isPdFinalized = reward.weekNumber <= pdFinalizedThresholdWeek;

      if (reward.glowInflationTotal && reward.glowInflationTotal !== "0") {
        const glwAmount = formatUnits(
          BigInt(reward.glowInflationTotal),
          DECIMALS_BY_TOKEN.GLW
        );

        weekData.rewards.push({
          week: reward.weekNumber,
          currency: "GLW",
          amount: glwAmount,
          amountRaw: reward.glowInflationTotal,
          type: "glowInflation",
        });

        weekData.totalGlw = new Decimal(weekData.totalGlw)
          .plus(glwAmount)
          .toString();
        if (isGlwFinalized && isPdFinalized) {
          totals.GLW = new Decimal(totals.GLW || "0")
            .plus(glwAmount)
            .toString();
        }
      }

      if (
        reward.protocolDepositRewardsReceived &&
        reward.protocolDepositRewardsReceived !== "0"
      ) {
        const currency = reward.paymentCurrency;
        const decimals =
          DECIMALS_BY_TOKEN[currency as keyof typeof DECIMALS_BY_TOKEN] || 18;
        const pdAmount = formatUnits(
          BigInt(reward.protocolDepositRewardsReceived),
          decimals
        );

        weekData.rewards.push({
          week: reward.weekNumber,
          currency,
          amount: pdAmount,
          amountRaw: reward.protocolDepositRewardsReceived,
          type: "protocolDeposit",
        });

        const currentPdTotal =
          weekData.totalProtocolDeposit.get(currency) || "0";
        weekData.totalProtocolDeposit.set(
          currency,
          new Decimal(currentPdTotal).plus(pdAmount).toString()
        );

        if (isGlwFinalized && isPdFinalized) {
          totals[currency] = new Decimal(totals[currency] || "0")
            .plus(pdAmount)
            .toString();
        }
      }

      weeklyMap.set(reward.weekNumber, weekData);
    });

    const weeklyBreakdown = Array.from(weeklyMap.values())
      .map((entry) => ({
        ...entry,
        isFinalized:
          entry.week <= glwFinalizedThresholdWeek &&
          entry.week <= pdFinalizedThresholdWeek,
        weeksUntilClaimable: Math.max(0, entry.week - pdFinalizedThresholdWeek),
      }))
      .sort((a, b) => b.week - a.week);

    return { aggregatedTotals: totals, weeklyBreakdown };
  }, [
    rewardsData,
    glwFinalizedThresholdWeek,
    pdFinalizedThresholdWeek,
    endWeek,
  ]);

  return {
    aggregatedTotals,
    weeklyBreakdown,
    isLoading,
    isError,
    error: (error as Error | null) ?? null,
    refetch,
  };
}
