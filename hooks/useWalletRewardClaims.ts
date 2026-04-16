"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_CONFIG } from "@/hooks/query-config";
import {
  DEFAULT_WALLET_CLAIMS_LIMIT,
  fetchWalletRewardClaims,
  walletRewardClaimsQueryKey,
  type WalletRewardClaimRow,
} from "@/lib/api/wallet-reward-claims-index";

export interface UseWalletRewardClaimsOptions {
  enabled?: boolean;
  limit?: number;
  refreshKey?: string | number;
  query?: {
    staleTime?: number;
    gcTime?: number;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
  };
}

export interface UseWalletRewardClaimsResult {
  claims: WalletRewardClaimRow[];
  indexingComplete: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

function asLowerHexAddress(value: `0x${string}`): `0x${string}` {
  return value.toLowerCase() as `0x${string}`;
}

export function useWalletRewardClaims(
  walletAddress?: string,
  options: UseWalletRewardClaimsOptions = {}
): UseWalletRewardClaimsResult {
  const {
    enabled = true,
    limit = DEFAULT_WALLET_CLAIMS_LIMIT,
    refreshKey,
    query,
  } = options;

  const walletLower = walletAddress
    ? (walletAddress.toLowerCase() as `0x${string}`)
    : null;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: walletRewardClaimsQueryKey(walletLower, limit, refreshKey),
    enabled: enabled && Boolean(walletLower),
    staleTime: query?.staleTime ?? QUERY_CONFIG.DEFAULT.staleTime,
    gcTime: query?.gcTime ?? 10 * 60_000,
    refetchOnWindowFocus:
      query?.refetchOnWindowFocus ?? QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    refetchOnMount: query?.refetchOnMount ?? true,
    ...(query?.refetchOnReconnect !== undefined
      ? { refetchOnReconnect: query.refetchOnReconnect }
      : {}),
    queryFn: async () => {
      if (!walletLower) throw new Error("No wallet address");
      return await fetchWalletRewardClaims({
        walletAddress: asLowerHexAddress(walletLower),
        limit,
      });
    },
  });

  return {
    claims: data?.claims ?? [],
    indexingComplete: data?.indexingComplete ?? true,
    isLoading,
    isError,
    error: (error as Error | null) ?? null,
    refetch,
  };
}

