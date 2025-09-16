"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

// Types based on the WalletsRouter
export interface ControlWallet {
  address: string;
  [key: string]: any;
}

export interface WalletsResponse {
  wallets: ControlWallet[];
}

export interface WalletDetails {
  address: string;
  [key: string]: any;
}

export interface MintedEvent {
  txId: string;
  epoch: number;
  wallet: string;
  amountRaw: string;
  currency: string;
  gctlMinted: string;
  ts: string;
}

export interface StakedEvent {
  id: string;
  epoch: number;
  wallet: string;
  regionId: number;
  regionName?: string;
  amount: string;
  direction: "stake" | "unstake";
  ts: string;
}

if (!process.env.NEXT_PUBLIC_CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

function parseApiError(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  const possible: any = error;
  return possible?.error?.message ?? possible?.message ?? "Unknown error";
}

function WalletsRouter(baseUrl: string) {
  if (!baseUrl) throw new Error("CONTROL API base URL is not set");

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${baseUrl}${path}`, init);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error || `Request to ${path} failed`);
    }
    return (await res.json()) as T;
  };

  const buildPaginationQuery = (page?: number, limit?: number) => {
    const p = page ?? 1;
    const l = limit ?? 50;
    return `?page=${p}&limit=${l}`;
  };

  const fetchAllWallets = async (): Promise<ControlWallet[]> => {
    try {
      const data = await request<WalletsResponse>(`/wallets/all`);
      return data.wallets ?? [];
    } catch (error) {
      throw new Error(parseApiError(error));
    }
  };

  const fetchWalletByAddress = async (
    wallet: string
  ): Promise<WalletDetails> => {
    try {
      return await request<WalletDetails>(
        `/wallets/address/${encodeURIComponent(wallet)}`
      );
    } catch (error) {
      throw new Error(parseApiError(error));
    }
  };

  const fetchWalletMintedEvents = async (
    wallet: string,
    page?: number,
    limit?: number
  ): Promise<MintedEvent[]> => {
    try {
      const data = await request<{ events: MintedEvent[] }>(
        `/wallets/address/${encodeURIComponent(
          wallet
        )}/events/minted${buildPaginationQuery(page, limit)}`
      );
      return data.events ?? [];
    } catch (error) {
      throw new Error(parseApiError(error));
    }
  };

  const fetchWalletStakeEvents = async (
    wallet: string,
    page?: number,
    limit?: number,
    regionId?: number
  ): Promise<StakedEvent[]> => {
    try {
      const base = `/wallets/address/${encodeURIComponent(
        wallet
      )}/events/stake${buildPaginationQuery(page, limit)}`;
      const query =
        typeof regionId === "number" ? `${base}&regionId=${regionId}` : base;
      const data = await request<{ events: StakedEvent[] }>(query);
      return data.events ?? [];
    } catch (error) {
      throw new Error(parseApiError(error));
    }
  };

  return {
    fetchAllWallets,
    fetchWalletByAddress,
    fetchWalletMintedEvents,
    fetchWalletStakeEvents,
  } as const;
}

// Initialize Wallets API client
const walletsRouter = WalletsRouter(process.env.NEXT_PUBLIC_CONTROL_API_URL);

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

  return {
    // Data
    walletDetails,
    mintedEvents,
    stakeEvents,
    allWallets,

    // Loading states
    isWalletDetailsLoading,
    isMintedEventsLoading,
    isStakeEventsLoading,
    isAllWalletsLoading,

    // Errors
    walletDetailsError,
    mintedEventsError,
    stakeEventsError,
    allWalletsError,

    // Refetch functions
    refetchWalletDetails,
    refetchMintedEvents,
    refetchStakeEvents,
    refetchAllWallets,

    // Helper functions
    fetchWalletDetails,
    fetchWalletMintedEvents,
    fetchWalletStakeEvents,
  } as const;
}
