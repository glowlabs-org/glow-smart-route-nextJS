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
import {
  computeClaimUnlockTimestampMs,
  getWeeksToWait,
} from "@/utils/claim-unlock";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";

export type {
  MigrationAmountResponse,
  MintedEvent,
  StakedEvent,
  WalletDetails,
};

export interface UseWalletsParams {
  walletAddress?: string;
  enabled?: boolean;
  page?: number;
  limit?: number;
  regionId?: number;
  includeWalletDetails?: boolean;
  includeMintedEvents?: boolean;
  includeStakeEvents?: boolean;
  includeMigrationAmount?: boolean;
  includeAllWallets?: boolean;
}

export interface WalletRegionAvailableStake {
  wallet?: string;
  regionId?: number;
  totalStakedAndNotUsedInProtocolFees?: string;
  pendingUnstake?: string;
  pendingRestakeOut?: string;
  delegatedSgctlVaultBalance?: string;
  protocolDepositVaultBalance?: string;
  availableStakedGctl?: string;
}

interface WalletRegionAvailableStakeBatchResponse {
  wallet: string;
  results: WalletRegionAvailableStake[];
}

export function getRewardCurrencyDecimals(currency: string): number {
  if (currency === "SGCTL") return DECIMALS_BY_TOKEN.GCTL;
  return DECIMALS_BY_TOKEN[currency as keyof typeof DECIMALS_BY_TOKEN] ?? 18;
}

function parseAvailableStakeRaw(value?: string): bigint {
  try {
    return BigInt(value ?? "0");
  } catch {
    return 0n;
  }
}

export function calculateImpactEligibleStakedGctl(
  snapshot?: WalletRegionAvailableStake | null,
): bigint {
  if (!snapshot) return 0n;

  return (
    parseAvailableStakeRaw(snapshot.totalStakedAndNotUsedInProtocolFees) +
    parseAvailableStakeRaw(snapshot.delegatedSgctlVaultBalance) +
    parseAvailableStakeRaw(snapshot.protocolDepositVaultBalance)
  );
}

export async function fetchWalletRegionAvailableStake(
  walletAddress: string,
  regionId: number,
): Promise<WalletRegionAvailableStake> {
  const baseUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL;
  if (!baseUrl) {
    throw new Error(
      "Environment variable NEXT_PUBLIC_CONTROL_API_URL is not set",
    );
  }

  const response = await fetch(
    `${baseUrl}/wallet/${encodeURIComponent(walletAddress)}/region/${regionId}/available-stake`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to refresh available staked GCTL state");
  }

  return (await response.json()) as WalletRegionAvailableStake;
}

function normalizeBatchRegionIds(
  regionIds?: Array<number | null | undefined>,
): number[] {
  return Array.from(
    new Set(
      (regionIds ?? []).filter((regionId): regionId is number =>
        Number.isFinite(regionId),
      ),
    ),
  ).sort((a, b) => a - b);
}

export async function fetchWalletRegionAvailableStakeBatch(
  walletAddress: string,
  regionIds: number[],
): Promise<Map<number, WalletRegionAvailableStake>> {
  const normalizedRegionIds = normalizeBatchRegionIds(regionIds);
  if (normalizedRegionIds.length === 0) {
    return new Map();
  }

  const baseUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL;
  if (!baseUrl) {
    throw new Error(
      "Environment variable NEXT_PUBLIC_CONTROL_API_URL is not set",
    );
  }

  const response = await fetch(
    `${baseUrl}/wallet/${encodeURIComponent(walletAddress)}/available-stake/batch`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ regionIds: normalizedRegionIds }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to refresh available staked GCTL state");
  }

  const data =
    (await response.json()) as WalletRegionAvailableStakeBatchResponse;

  return new Map(
    (data.results ?? [])
      .filter(
        (result): result is WalletRegionAvailableStake & { regionId: number } =>
          Number.isFinite(result.regionId),
      )
      .map((result) => [result.regionId, result] as const),
  );
}

export function useWalletRegionAvailableStake(params: {
  walletAddress?: string;
  regionId?: number | null;
  enabled?: boolean;
}) {
  const { walletAddress, regionId, enabled = true } = params;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const query = useQuery({
    queryKey: QUERY_KEYS.wallets.availableStake(walletAddress, regionId),
    queryFn: () =>
      fetchWalletRegionAvailableStake(walletAddress!, regionId as number),
    enabled:
      enabled &&
      isConfigured &&
      Boolean(walletAddress) &&
      Number.isFinite(regionId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  return {
    availableStake: query.data,
    isAvailableStakeLoading: query.isLoading,
    isAvailableStakeFetching: query.isFetching,
    availableStakeError: query.error,
    refetchAvailableStake: query.refetch,
  } as const;
}

export function useWalletRegionAvailableStakeMap(params: {
  walletAddress?: string;
  regionIds?: Array<number | null | undefined>;
  enabled?: boolean;
}) {
  const { walletAddress, regionIds, enabled = true } = params;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const normalizedRegionIds = React.useMemo(
    () => normalizeBatchRegionIds(regionIds),
    [regionIds],
  );

  const batchQuery = useQuery({
    queryKey: QUERY_KEYS.wallets.availableStakeBatch(
      walletAddress,
      normalizedRegionIds,
    ),
    queryFn: () =>
      fetchWalletRegionAvailableStakeBatch(walletAddress!, normalizedRegionIds),
    enabled:
      enabled &&
      isConfigured &&
      Boolean(walletAddress) &&
      normalizedRegionIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const availableStakedGctlByRegion = React.useMemo(() => {
    const map = new Map<number, bigint>();
    normalizedRegionIds.forEach((regionId) => {
      map.set(
        regionId,
        parseAvailableStakeRaw(
          batchQuery.data?.get(regionId)?.availableStakedGctl,
        ),
      );
    });
    return map;
  }, [batchQuery.data, normalizedRegionIds]);

  const impactEligibleStakedGctlByRegion = React.useMemo(() => {
    const map = new Map<number, bigint>();
    normalizedRegionIds.forEach((regionId) => {
      map.set(
        regionId,
        calculateImpactEligibleStakedGctl(batchQuery.data?.get(regionId)),
      );
    });
    return map;
  }, [batchQuery.data, normalizedRegionIds]);

  const availableStakeByRegion = React.useMemo(() => {
    const map = new Map<number, WalletRegionAvailableStake | null>();
    normalizedRegionIds.forEach((regionId) => {
      map.set(regionId, batchQuery.data?.get(regionId) ?? null);
    });
    return map;
  }, [batchQuery.data, normalizedRegionIds]);

  return {
    availableStakedGctlByRegion,
    impactEligibleStakedGctlByRegion,
    availableStakeByRegion,
    isAvailableStakeMapLoading: batchQuery.isLoading,
    isAvailableStakeMapFetching: batchQuery.isFetching,
    availableStakeMapError: batchQuery.error ?? null,
  } as const;
}

export function useWallets(params: UseWalletsParams = {}) {
  const {
    walletAddress,
    enabled = true,
    page = 1,
    limit = 20,
    regionId,
    includeWalletDetails = true,
    includeMintedEvents = true,
    includeStakeEvents = true,
    includeMigrationAmount = true,
    includeAllWallets = false,
  } = params;
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const walletDetailsQuery = useQuery({
    queryKey: QUERY_KEYS.wallets.details(walletAddress),
    queryFn: () =>
      (getWalletsRouter() as any).fetchWalletByAddress(walletAddress!),
    enabled:
      enabled &&
      includeWalletDetails &&
      isConfigured &&
      Boolean(walletAddress),
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    retry: 2,
  });

  const mintedEventsQuery = useQuery({
    queryKey: QUERY_KEYS.wallets.mintedEvents(walletAddress, page, limit),
    queryFn: () =>
      (getWalletsRouter() as any).fetchWalletMintedEvents(
        walletAddress!,
        page,
        limit,
      ),
    enabled:
      enabled &&
      includeMintedEvents &&
      isConfigured &&
      Boolean(walletAddress),
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    retry: 2,
  });

  const stakeEventsQuery = useQuery({
    queryKey: QUERY_KEYS.wallets.stakeEvents(
      walletAddress,
      page,
      limit,
      regionId,
    ),
    queryFn: () =>
      (getWalletsRouter() as any).fetchWalletStakeEvents(
        walletAddress!,
        page,
        limit,
        regionId,
      ),
    enabled:
      enabled &&
      includeStakeEvents &&
      isConfigured &&
      Boolean(walletAddress),
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    retry: 2,
  });

  const migrationQuery = useQuery({
    queryKey: QUERY_KEYS.wallets.migrationAmount(walletAddress),
    queryFn: () =>
      (getControlRouter() as any).fetchMigrationAmount(walletAddress!),
    enabled:
      enabled &&
      includeMigrationAmount &&
      isConfigured &&
      Boolean(walletAddress),
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
    retry: 2,
  });

  const allWalletsQuery = useQuery({
    queryKey: QUERY_KEYS.wallets.all(),
    queryFn: () => (getWalletsRouter() as any).fetchAllWallets(),
    enabled: enabled && includeAllWallets,
    staleTime: QUERY_CONFIG.DEFAULT.staleTime,
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
  options: UseWalletV2ClaimsOptions = {},
): WalletV2ClaimsResult {
  const currentEpoch = getCurrentEpoch();
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const { data, isLoading, isError, error } =
    useQuery<WalletWeeklyRewardsResponse | null>({
      queryKey: QUERY_KEYS.wallets.v2Claims(walletAddress, options.refreshKey),
      enabled: isConfigured && Boolean(walletAddress),
      staleTime: options.query?.staleTime ?? QUERY_CONFIG.DEFAULT.staleTime,
      gcTime: options.query?.gcTime ?? 5 * 60_000,
      refetchOnWindowFocus:
        options.query?.refetchOnWindowFocus ??
        QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
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
          },
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
        const decimals = getRewardCurrencyDecimals(currency);
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
          formatUnits(BigInt(inflationRaw), DECIMALS_BY_TOKEN.GLW),
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
  // Deterministic timestamp (ms) the week's rewards become claimable: the
  // Wednesday 1pm ET following finalization. Drives the single claimability
  // predicate across the claims panel and dashboard widgets.
  unlockMs: number;
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
  options: UseClaimableRewardsOptions = {},
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
    queryKey: QUERY_KEYS.wallets.rewards(walletAddress, options.refreshKey),
    enabled: isConfigured && Boolean(walletAddress),
    staleTime: options.query?.staleTime ?? QUERY_CONFIG.DEFAULT.staleTime,
    gcTime: options.query?.gcTime ?? 5 * 60_000,
    refetchOnMount: options.query?.refetchOnMount ?? true,
    refetchOnWindowFocus:
      options.query?.refetchOnWindowFocus ??
      QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
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
        },
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
        unlockMs: 0,
        weeksUntilClaimable: 0,
      };

      const isGlwFinalized = reward.weekNumber <= glwFinalizedThresholdWeek;
      const isPdFinalized = reward.weekNumber <= pdFinalizedThresholdWeek;

      if (reward.glowInflationTotal && reward.glowInflationTotal !== "0") {
        const glwAmount = formatUnits(
          BigInt(reward.glowInflationTotal),
          DECIMALS_BY_TOKEN.GLW,
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
        const decimals = getRewardCurrencyDecimals(currency);
        const pdAmount = formatUnits(
          BigInt(reward.protocolDepositRewardsReceived),
          decimals,
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
          new Decimal(currentPdTotal).plus(pdAmount).toString(),
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
      .map((entry) => {
        const hasGlwRewards = entry.rewards.some(
          (reward) => reward.type === "glowInflation",
        );
        const hasProtocolRewards = entry.rewards.some(
          (reward) => reward.type === "protocolDeposit",
        );
        // Presence-aware finalization: a stream absent for the week does not
        // gate it. PD finalizes one epoch later than GLW inflation, so a week
        // carrying both is only finalized once the PD threshold is met.
        const isFinalized =
          (!hasGlwRewards || entry.week <= glwFinalizedThresholdWeek) &&
          (!hasProtocolRewards || entry.week <= pdFinalizedThresholdWeek);
        return {
          ...entry,
          isFinalized,
          unlockMs: computeClaimUnlockTimestampMs(
            entry.week,
            getWeeksToWait(hasProtocolRewards),
          ),
          weeksUntilClaimable: Math.max(
            0,
            entry.week - pdFinalizedThresholdWeek,
          ),
        };
      })
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
