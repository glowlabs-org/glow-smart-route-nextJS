"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  WalletsRouter,
  type ControlWallet,
  type WalletDetails,
  type MintedEvent,
  type StakedEvent,
  type MigrationAmountResponse,
  ControlRouter,
} from "@glowlabs-org/utils/browser";

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL;

if (!CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

// Initialize Wallets API client from SDK
const walletsRouter = WalletsRouter(CONTROL_API_URL);
const controlRouter = ControlRouter(CONTROL_API_URL);

// Re-export types for convenience
export type {
  ControlWallet,
  WalletDetails,
  MintedEvent,
  StakedEvent,
  MigrationAmountResponse,
};

// Query Keys
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
} as const;

export interface UseWalletsParams {
  walletAddress?: string;
  enabled?: boolean;
  page?: number;
  limit?: number;
  regionId?: number;
}

export function useWallets({
  walletAddress,
  enabled = true,
  page = 1,
  limit = 20,
  regionId,
}: UseWalletsParams = {}) {
  // Wallet Details Query
  const {
    data: walletDetails,
    isLoading: isWalletDetailsLoading,
    error: walletDetailsError,
    refetch: refetchWalletDetails,
  } = useQuery({
    queryKey: QUERY_KEYS.walletDetails(walletAddress),
    queryFn: () => walletsRouter.fetchWalletByAddress(walletAddress!),
    enabled: enabled && Boolean(walletAddress),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  // Wallet Minted Events Query
  const {
    data: mintedEvents = [],
    isLoading: isMintedEventsLoading,
    error: mintedEventsError,
    refetch: refetchMintedEvents,
  } = useQuery({
    queryKey: QUERY_KEYS.walletMintedEvents(walletAddress, page, limit),
    queryFn: () =>
      walletsRouter.fetchWalletMintedEvents(walletAddress!, page, limit),
    enabled: enabled && Boolean(walletAddress),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  // Wallet Stake Events Query
  const {
    data: stakeEvents = [],
    isLoading: isStakeEventsLoading,
    error: stakeEventsError,
    refetch: refetchStakeEvents,
  } = useQuery({
    queryKey: QUERY_KEYS.walletStakeEvents(
      walletAddress,
      page,
      limit,
      regionId
    ),
    queryFn: () =>
      walletsRouter.fetchWalletStakeEvents(
        walletAddress!,
        page,
        limit,
        regionId
      ),
    enabled: enabled && Boolean(walletAddress),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  // Migration Amount Query
  const {
    data: migrationData,
    isLoading: isMigrationLoading,
    error: migrationError,
    refetch: refetchMigrationAmount,
  } = useQuery({
    queryKey: QUERY_KEYS.migrationAmount(walletAddress),
    queryFn: () => controlRouter.fetchMigrationAmount(walletAddress!),
    enabled: enabled && Boolean(walletAddress),
    staleTime: 60 * 1000, // 1 minute (migration data changes less frequently)
    retry: 2,
  });

  // All Wallets Query (for admin purposes)
  const {
    data: allWallets = [],
    isLoading: isAllWalletsLoading,
    error: allWalletsError,
    refetch: refetchAllWallets,
  } = useQuery({
    queryKey: QUERY_KEYS.allWallets(),
    queryFn: () => walletsRouter.fetchAllWallets(),
    enabled: false, // Only enable when explicitly needed
    staleTime: 60 * 1000, // 1 minute
    retry: 2,
  });

  // Helper functions
  const fetchWalletDetails = useCallback(
    (wallet: string) => walletsRouter.fetchWalletByAddress(wallet),
    []
  );

  const fetchWalletMintedEvents = useCallback(
    (wallet: string, eventPage?: number, eventLimit?: number) =>
      walletsRouter.fetchWalletMintedEvents(wallet, eventPage, eventLimit),
    []
  );

  const fetchWalletStakeEvents = useCallback(
    (
      wallet: string,
      eventPage?: number,
      eventLimit?: number,
      eventRegionId?: number
    ) =>
      walletsRouter.fetchWalletStakeEvents(
        wallet,
        eventPage,
        eventLimit,
        eventRegionId
      ),
    []
  );

  const fetchMigrationAmount = useCallback(
    (wallet: string) => controlRouter.fetchMigrationAmount(wallet),
    []
  );

  return {
    // Data
    walletDetails,
    mintedEvents,
    stakeEvents,
    migrationData,
    allWallets,

    // Loading states
    isWalletDetailsLoading,
    isMintedEventsLoading,
    isStakeEventsLoading,
    isMigrationLoading,
    isAllWalletsLoading,

    // Errors
    walletDetailsError,
    mintedEventsError,
    stakeEventsError,
    migrationError,
    allWalletsError,

    // Refetch functions
    refetchWalletDetails,
    refetchMintedEvents,
    refetchStakeEvents,
    refetchMigrationAmount,
    refetchAllWallets,

    // Helper functions
    fetchWalletDetails,
    fetchWalletMintedEvents,
    fetchWalletStakeEvents,
    fetchMigrationAmount,
  } as const;
}
