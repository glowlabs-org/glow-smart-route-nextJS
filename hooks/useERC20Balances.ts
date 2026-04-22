import { useContracts } from "./useContracts";
import { Result, Ok, Err } from "ts-results";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { JsonRpcSigner } from "ethers";
import React from "react";
import { useAccount } from "wagmi";

export type SYMBOLS = "GLOW" | "IMPACT POWER POINTS" | "USDG" | "USDC";

export enum GetBalanceError {
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
}

// Query Keys
const QUERY_KEYS = {
  erc20Balances: (address?: string) => ["erc20-balances", address],
  usdcBalance: (address?: string) => ["usdc-balance", address],
  usdgBalance: (address?: string) => ["usdg-balance", address],
  glowBalance: (address?: string) => ["glow-balance", address],
} as const;

export const useER20Balances = ({
  signer,
}: {
  signer: JsonRpcSigner | undefined | null;
}) => {
  const { usdg, glow, usdc, isReady } = useContracts(signer);

  // Prefer wagmi's synchronous address — it is available as soon as the
  // wallet is connected and doesn't wait on the ethers signer to resolve.
  // The signer.getAddress() fallback remains for environments where wagmi
  // hasn't hydrated yet.
  const { address: wagmiAddress } = useAccount();
  const [signerAddress, setSignerAddress] = React.useState<string | null>(null);
  const walletAddress = wagmiAddress ?? signerAddress;

  React.useEffect(() => {
    // Only resolve via signer when wagmi hasn't already provided an address,
    // so we don't block balance loading behind a slow ethers roundtrip.
    if (wagmiAddress) {
      setSignerAddress(null);
      return;
    }
    if (signer) {
      signer
        .getAddress()
        .then((addr) => {
          setSignerAddress(addr);
        })
        .catch((error) => {
          console.error("Failed to get wallet address:", error);
          setSignerAddress(null);
        });
    } else {
      setSignerAddress(null);
    }
  }, [signer, wagmiAddress]);

  // Single optimized query that fetches all balances at once
  const {
    data: balances,
    isLoading,
    isError: hasError,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.erc20Balances(walletAddress || undefined),
    queryFn: async () => {
      if (!walletAddress || !usdc || !usdg || !glow) {
        return { usdc: null, usdg: null, glow: null };
      }

      try {
        // Fetch all balances in parallel for maximum efficiency
        const [usdcBal, usdgBal, glowBal] = await Promise.all([
          usdc.balanceOf(walletAddress),
          usdg.balanceOf(walletAddress),
          glow.balanceOf(walletAddress),
        ]);

        return {
          usdc: usdcBal,
          usdg: usdgBal,
          glow: glowBal,
        };
      } catch (error) {
        console.error("Error fetching balances:", error);
        throw error;
      }
    },
    enabled: !!walletAddress && !!usdc && !!usdg && !!glow,
    staleTime: 10 * 1000, // 10 seconds - data considered fresh
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for stale-while-revalidate
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    refetchOnMount: true, // Always fetch fresh data on mount
    retry: 2,
  });

  // Extract individual balances for backward compatibility
  const usdcBalance = balances?.usdc ?? null;
  const usdgBalance = balances?.usdg ?? null;
  const glowBalance = balances?.glow ?? null;

  // Individual error states
  const isUsdcError = hasError;
  const isUsdgError = hasError;
  const isGlowError = hasError;
  /**
   * @param getBalance ~ Returns the balance for the desired token
   * @return Result<BigNumber, GetBalanceError> ~ Returns the balance for the desired token
   */
  async function getBalances(): Promise<
    Result<{ glow: bigint; usdg: bigint; usdc: bigint }, GetBalanceError>
  > {
    if (!signer) return new Err(GetBalanceError.SIGNER_NOT_AVAILABLE);
    if (!glow || !usdg || !usdc)
      return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);

    try {
      const address = await signer.getAddress();
      const [g, u, c] = await Promise.all([
        glow.balanceOf(address),
        usdg.balanceOf(address),
        usdc.balanceOf(address),
      ]);
      return new Ok({ glow: g, usdg: u, usdc: c });
    } catch (error) {
      console.error("Error fetching balances:", error);
      return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);
    }
  }

  // Optimized refetch functions - all use the same single query
  const setUsdcBalanceForSigner = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const setUsdgBalanceForSigner = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const setGlowBalanceForSigner = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const refreshBalances = useCallback(async () => {
    if (!isReady || !signer) return;
    await refetch();
  }, [isReady, signer, refetch]);

  return {
    getBalances,
    isReady: !!walletAddress && (!!usdc || !!usdg || !!glow), // Ready when we have address and at least one contract
    isLoading,
    hasError,
    hasSigner: !!signer,
    isUsdcError,
    isUsdgError,
    isGlowError,
    usdcBalance,
    usdgBalance,
    setUsdgBalanceForSigner,
    setUsdcBalanceForSigner,
    refreshBalances,
    glowBalance,
    setGlowBalanceForSigner,
  };
};
