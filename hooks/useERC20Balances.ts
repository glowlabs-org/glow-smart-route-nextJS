import { useContracts } from "./useContracts";
import { Result, Ok, Err } from "ts-results";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { JsonRpcSigner } from "ethers";
import React from "react";

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
  const queryClient = useQueryClient();

  // Get wallet address synchronously for query keys
  const [walletAddress, setWalletAddress] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (signer) {
      signer
        .getAddress()
        .then((addr) => {
          setWalletAddress(addr);
        })
        .catch((error) => {
          console.error("Failed to get wallet address:", error);
          setWalletAddress(null);
        });
    } else {
      setWalletAddress(null);
    }
  }, [signer]);

  // Get wallet address
  const getWalletAddress = useCallback(async (): Promise<string | null> => {
    if (!signer) return null;
    try {
      return await signer.getAddress();
    } catch {
      return null;
    }
  }, [signer]);

  // USDC Balance Query
  const {
    data: usdcBalance = null,
    isLoading: isUsdcLoading,
    isError: isUsdcError,
    error: usdcError,
    refetch: refetchUsdcBalance,
  } = useQuery({
    queryKey: QUERY_KEYS.usdcBalance(walletAddress || undefined),
    queryFn: async () => {
      if (!walletAddress || !usdc) return null;
      return await usdc.balanceOf(walletAddress);
    },
    enabled: !!walletAddress && !!usdc,
    staleTime: 10 * 1000, // 10 seconds
    retry: 2,
  });

  // USDG Balance Query
  const {
    data: usdgBalance = null,
    isLoading: isUsdgLoading,
    isError: isUsdgError,
    error: usdgError,
    refetch: refetchUsdgBalance,
  } = useQuery({
    queryKey: QUERY_KEYS.usdgBalance(walletAddress || undefined),
    queryFn: async () => {
      if (!walletAddress) {
        return null;
      }
      try {
        if (!usdg) {
          throw new Error("USDG contract not available");
        }
        const balance = await usdg.balanceOf(walletAddress);
        return balance;
      } catch (error) {
        console.error("Error fetching USDG balance:", error);
        // Re-throw to let React Query handle it
        throw error;
      }
    },
    enabled: !!walletAddress && !!usdg,
    staleTime: 10 * 1000, // 10 seconds
    retry: 2,
  });

  // GLOW Balance Query
  const {
    data: glowBalance = null,
    isLoading: isGlowLoading,
    isError: isGlowError,
    error: glowError,
    refetch: refetchGlowBalance,
  } = useQuery({
    queryKey: QUERY_KEYS.glowBalance(walletAddress || undefined),
    queryFn: async () => {
      if (!walletAddress) return null;
      if (!glow) {
        throw new Error("GLOW contract not available");
      }
      return await glow.balanceOf(walletAddress);
    },
    enabled: !!walletAddress && !!glow,
    staleTime: 10 * 1000, // 10 seconds
    retry: 2,
  });

  const isLoading = isUsdcLoading || isUsdgLoading || isGlowLoading;
  const hasError = isUsdcError || isUsdgError || isGlowError;
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

  // Legacy functions for backward compatibility
  const setUsdcBalanceForSigner = useCallback(async () => {
    await refetchUsdcBalance();
  }, [refetchUsdcBalance]);

  const setUsdgBalanceForSigner = useCallback(async () => {
    await refetchUsdgBalance();
  }, [refetchUsdgBalance]);

  const setGlowBalanceForSigner = useCallback(async () => {
    await refetchGlowBalance();
  }, [refetchGlowBalance]);

  const refreshBalances = useCallback(async () => {
    if (!isReady || !signer) return;
    await Promise.all([
      refetchUsdcBalance(),
      refetchUsdgBalance(),
      refetchGlowBalance(),
    ]);
  }, [
    isReady,
    signer,
    refetchUsdcBalance,
    refetchUsdgBalance,
    refetchGlowBalance,
  ]);

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
