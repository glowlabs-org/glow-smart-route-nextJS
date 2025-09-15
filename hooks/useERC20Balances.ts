import { useContracts } from "./useContracts";
import { Result, Ok, Err } from "ts-results";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { JsonRpcSigner } from "ethers";

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
    refetch: refetchUsdcBalance,
  } = useQuery({
    queryKey: QUERY_KEYS.usdcBalance(signer ? "pending" : undefined),
    queryFn: async () => {
      if (!signer || !usdc || !isReady) return null;
      const address = await signer.getAddress();
      return await usdc.balanceOf(address);
    },
    enabled: !!signer && !!usdc && isReady,
    staleTime: 10 * 1000, // 10 seconds
    retry: 2,
  });

  // USDG Balance Query
  const {
    data: usdgBalance = null,
    isLoading: isUsdgLoading,
    refetch: refetchUsdgBalance,
  } = useQuery({
    queryKey: QUERY_KEYS.usdgBalance(signer ? "pending" : undefined),
    queryFn: async () => {
      if (!signer || !usdg || !isReady) return null;
      const address = await signer.getAddress();
      return await usdg.balanceOf(address);
    },
    enabled: !!signer && !!usdg && isReady,
    staleTime: 10 * 1000, // 10 seconds
    retry: 2,
  });

  // GLOW Balance Query
  const {
    data: glowBalance = null,
    isLoading: isGlowLoading,
    refetch: refetchGlowBalance,
  } = useQuery({
    queryKey: QUERY_KEYS.glowBalance(signer ? "pending" : undefined),
    queryFn: async () => {
      if (!signer || !glow || !isReady) return null;
      const address = await signer.getAddress();
      return await glow.balanceOf(address);
    },
    enabled: !!signer && !!glow && isReady,
    staleTime: 10 * 1000, // 10 seconds
    retry: 2,
  });

  const isLoading = isUsdcLoading || isUsdgLoading || isGlowLoading;

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
    isReady,
    isLoading,
    usdcBalance,
    usdgBalance,
    setUsdgBalanceForSigner,
    setUsdcBalanceForSigner,
    refreshBalances,
    glowBalance,
    setGlowBalanceForSigner,
  };
};
