"use client";

import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";

import { SDKAddresses } from "@/web3/constants/addresses";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { getERC20Balance } from "@/web3/web3/queries/erc20";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";

export interface WalletTokenBalances {
  glwBalance: bigint | null;
  usdcBalance: bigint | null;
  usdgBalance: bigint | null;
  ethBalance: bigint | null;
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
    queryKey: QUERY_KEYS.balances.tokens(
      chainId,
      walletAddress as string | undefined
    ),
    enabled: Boolean(options?.enabled ?? true) && Boolean(walletAddress),
    staleTime: options?.query?.staleTime ?? QUERY_CONFIG.DEFAULT.staleTime,
    gcTime: options?.query?.gcTime ?? 5 * 60_000,
    refetchInterval: options?.query?.refetchInterval,
    refetchOnMount: options?.query?.refetchOnMount,
    refetchOnWindowFocus:
      options?.query?.refetchOnWindowFocus ??
      QUERY_CONFIG.DEFAULT.refetchOnWindowFocus,
    ...(options?.query?.refetchOnReconnect !== undefined
      ? { refetchOnReconnect: options.query.refetchOnReconnect }
      : {}),
    queryFn: async (): Promise<WalletTokenBalances> => {
      if (!walletAddress) {
        return {
          glwBalance: null,
          usdcBalance: null,
          usdgBalance: null,
          ethBalance: null,
        };
      }

      const accountAddress = walletAddress as `0x${string}`;

      const [glwBalance, usdcBalance, usdgBalance, ethBalance] =
        await Promise.all([
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
          publicClient.getBalance({ address: accountAddress }),
        ]);

      return { glwBalance, usdcBalance, usdgBalance, ethBalance };
    },
  });

  return {
    glwBalance: query.data?.glwBalance ?? null,
    usdcBalance: query.data?.usdcBalance ?? null,
    usdgBalance: query.data?.usdgBalance ?? null,
    ethBalance: query.data?.ethBalance ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  };
}