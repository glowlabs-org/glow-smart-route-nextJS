"use client";

import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";

import { SDKAddresses } from "@/web3/constants/addresses";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { getERC20Balance } from "@/web3/web3/queries/erc20";

export interface WalletTokenBalances {
  glwBalance: bigint | null;
  usdcBalance: bigint | null;
  usdgBalance: bigint | null;
}

export interface UseWalletTokenBalancesResult extends WalletTokenBalances {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseWalletTokenBalancesOptions {
  enabled?: boolean;
  query?: {
    staleTime?: number;
    gcTime?: number;
    refetchInterval?: number | false;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
  };
}

export function useWalletTokenBalances(
  walletAddress?: string | null,
  options?: UseWalletTokenBalancesOptions
): UseWalletTokenBalancesResult {
  const chainId = useChainId();

  const query = useQuery({
    queryKey: ["wallet-token-balances", chainId, walletAddress],
    enabled: Boolean(options?.enabled ?? true) && Boolean(walletAddress),
    staleTime: options?.query?.staleTime ?? 10_000,
    gcTime: options?.query?.gcTime ?? 5 * 60_000,
    refetchInterval: options?.query?.refetchInterval,
    refetchOnMount: options?.query?.refetchOnMount,
    refetchOnWindowFocus: options?.query?.refetchOnWindowFocus ?? true,
    ...(options?.query?.refetchOnReconnect !== undefined
      ? { refetchOnReconnect: options.query.refetchOnReconnect }
      : {}),
    queryFn: async (): Promise<WalletTokenBalances> => {
      if (!walletAddress) {
        return { glwBalance: null, usdcBalance: null, usdgBalance: null };
      }

      const accountAddress = walletAddress as `0x${string}`;

      const [glwBalance, usdcBalance, usdgBalance] = await Promise.all([
        getERC20Balance({
          client: publicClient,
          tokenAddress: SDKAddresses.GLW as `0x${string}`,
          accountAddress,
        }),
        getERC20Balance({
          client: publicClient,
          tokenAddress: SDKAddresses.USDC as `0x${string}`,
          accountAddress,
        }),
        getERC20Balance({
          client: publicClient,
          tokenAddress: SDKAddresses.USDG as `0x${string}`,
          accountAddress,
        }),
      ]);

      return { glwBalance, usdcBalance, usdgBalance };
    },
  });

  return {
    glwBalance: query.data?.glwBalance ?? null,
    usdcBalance: query.data?.usdcBalance ?? null,
    usdgBalance: query.data?.usdgBalance ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  };
}


