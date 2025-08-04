"use client";
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Result, Ok, Err } from "ts-results";
import {
  type MintedEvent,
  type StakedEvent,
  type PendingTransfer,
  type FailedOperation,
  type Region,
  type RegionStake,
  type WalletRegionStake,
  type WalletRegionUnlocked,
  ControlRouter,
  TransferDetails,
} from "@glowlabs-org/utils/browser";

if (!process.env.NEXT_PUBLIC_GCTL_API) {
  throw new Error("NEXT_PUBLIC_GCTL_API is not set");
}

// Initialize Glow Control API client
const control = ControlRouter(process.env.NEXT_PUBLIC_GCTL_API);

/**
 * Extract a useful error message from an unknown error value.
 */
function parseApiError(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  const possible: any = error;
  return possible?.error?.message ?? possible?.message ?? "Unknown error";
}

// Query Keys
const QUERY_KEYS = {
  gctlBalance: (wallet?: string) => ["gctl-balance", wallet],
  gctlPrice: () => ["gctl-price"],
  mintedEvents: () => ["minted-events"],
  stakeEvents: () => ["stake-events"], // Updated from stakedEvents
  pendingTransfers: () => ["pending-transfers"],
  failedOperations: () => ["failed-operations"],
  regions: () => ["regions"],
  transferDetails: (txId: string) => ["transfer-details", txId],
  regionStake: (regionId: number) => ["region-stake", regionId],
  walletRegionStake: (wallet?: string, regionId?: number) => [
    "wallet-region-stake",
    wallet,
    regionId,
  ],
  walletRegionUnlocked: (wallet?: string, regionId?: number) => [
    "wallet-region-unlocked",
    wallet,
    regionId,
  ],
} as const;

export function useGctlApi(walletAddress?: string) {
  const queryClient = useQueryClient();

  const fetchRegionsApi = async (): Promise<Region[]> => {
    const data = await control.fetchRegions();
    return data.filter((r) => r.id !== 998 && r.id !== 999);
  };
  // ----------------------- React Query hooks -----------------------------

  // GCTL Balance Query
  const {
    data: gctlBalance = "0",
    refetch: refetchGctlBalance,
    isLoading: isGctlBalanceLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.gctlBalance(walletAddress),
    queryFn: () => control.fetchGctlBalance(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 10 * 1000, // 10 seconds
    retry: 2,
  });

  // GCTL Price Query
  const {
    data: gctlPrice = 0,
    refetch: refetchGctlPrice,
    isLoading: isGctlPriceLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.gctlPrice(),
    queryFn: () => control.fetchGctlPrice(),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  // Minted Events Query
  const {
    data: mintedEvents = [],
    refetch: refetchMintedEvents,
    isLoading: isMintedEventsLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.mintedEvents(),
    queryFn: () => control.fetchMintedEvents(),
    staleTime: 0, // No caching - always fetch fresh data
    gcTime: 0, // Don't cache results
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchIntervalInBackground: true, // Continue refetching even when window is not focused
    retry: 2,
  });

  // Stake Events Query (Updated from Staked Events)
  const {
    data: stakedEvents = [], // Keep the same data property name for backward compatibility
    refetch: refetchStakedEvents,
    isLoading: isStakedEventsLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.stakeEvents(), // Updated query key
    queryFn: () => control.fetchStakeEvents(), // Updated function name
    staleTime: 0, // No caching - always fetch fresh data
    gcTime: 0, // Don't cache results
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchIntervalInBackground: true, // Continue refetching even when window is not focused
    retry: 2,
  });

  // Pending Transfers Query
  const {
    data: pendingTransfers = [],
    refetch: refetchPendingTransfers,
    isLoading: isPendingTransfersLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.pendingTransfers(),
    queryFn: () => control.fetchPendingTransfers(),
    staleTime: 0, // No caching - always fetch fresh data
    gcTime: 0, // Don't cache results
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchIntervalInBackground: true, // Continue refetching even when window is not focused
    retry: 2,
  });

  // Failed Operations Query
  const {
    data: failedOperations = [],
    refetch: refetchFailedOperations,
    isLoading: isFailedOperationsLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.failedOperations(),
    queryFn: () => control.fetchFailedOperations(),
    staleTime: 0, // No caching - always fetch fresh data
    gcTime: 0, // Don't cache results
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  // Regions Query
  const {
    data: regions = [],
    refetch: refetchRegions,
    isLoading: isRegionsLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.regions(),
    queryFn: fetchRegionsApi,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  // Hooks for staking data - these can be called conditionally

  // Hook for transfer details - can be called conditionally
  const useTransferDetails = (txId: string) =>
    useQuery({
      queryKey: QUERY_KEYS.transferDetails(txId),
      queryFn: () => control.fetchTransferDetails(txId),
      enabled: !!txId,
      staleTime: 0, // No caching - always fetch fresh data
      gcTime: 0, // Don't cache results
      retry: 2,
    });

  const useRegionStake = (regionId: number) => {
    return useQuery({
      queryKey: QUERY_KEYS.regionStake(regionId),
      queryFn: () => control.fetchRegionStake(regionId),
      staleTime: 30 * 1000, // 30 seconds
      retry: 2,
    });
  };

  const useWalletRegionStake = (regionId: number) => {
    return useQuery({
      queryKey: QUERY_KEYS.walletRegionStake(walletAddress, regionId),
      queryFn: () => control.fetchWalletRegionStake(walletAddress!, regionId),
      enabled: !!walletAddress,
      staleTime: 15 * 1000, // 15 seconds
      retry: 2,
    });
  };

  const useWalletRegionUnlocked = (regionId: number) => {
    return useQuery({
      queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, regionId),
      queryFn: () =>
        control.fetchWalletRegionUnlocked(walletAddress!, regionId),
      enabled: !!walletAddress,
      staleTime: 15 * 1000, // 15 seconds
      retry: 2,
    });
  };

  // ----------------------- Mutation hooks --------------------------------

  // Stake GCTL Mutation
  const stakeMutation = useMutation({
    mutationFn: async ({
      regionId,
      amount,
    }: {
      regionId: number;
      amount: string;
    }) => {
      if (!walletAddress) throw new Error("Wallet address not provided");

      return await control.stakeGctl(walletAddress, regionId, amount);
    },
    onSuccess: (_, { regionId }) => {
      // Invalidate all relevant queries - will auto-refetch if actively observed
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.regionStake(regionId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionStake(walletAddress, regionId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, regionId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stakeEvents() }); // Add staked events invalidation
    },
    onError: (error) => {
      console.error("Stake mutation error:", error);
      // Invalidate queries on error too in case of partial state changes
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stakeEvents() }); // Add staked events invalidation
    },
  });

  // Unstake GCTL Mutation
  const unstakeMutation = useMutation({
    mutationFn: async ({
      regionId,
      amount,
    }: {
      regionId: number;
      amount: string;
    }) => {
      if (!walletAddress) throw new Error("Wallet address not provided");

      return await control.unstakeGctl(walletAddress, regionId, amount);
    },
    onSuccess: (_, { regionId }) => {
      // Invalidate all relevant queries - will auto-refetch if actively observed
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.regionStake(regionId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionStake(walletAddress, regionId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, regionId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stakeEvents() }); // Add staked events invalidation
    },
    onError: (error) => {
      console.error("Unstake mutation error:", error);
      // Invalidate queries on error too in case of partial state changes
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stakeEvents() }); // Add staked events invalidation
    },
  });

  // Retry Failed Operation Mutation
  const retryFailedOperationMutation = useMutation({
    mutationFn: async (operationId: string) =>
      control.retryFailedOperation(operationId),
    onSuccess: () => {
      // Invalidate failed operations to refresh the list
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.failedOperations(),
      });
      // Also invalidate other relevant queries as the retry might affect them
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.pendingTransfers(),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mintedEvents() });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
    },
    onError: (error) => {
      console.error("Retry failed operation error:", error);
      // Still invalidate to refresh the state
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.failedOperations(),
      });
    },
  });

  // ----------------------- Legacy API functions (for compatibility) ------

  const fetchGctlBalance = useCallback(async (): Promise<
    Result<string, string>
  > => {
    try {
      await refetchGctlBalance();
      return new Ok(gctlBalance);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [refetchGctlBalance, gctlBalance]);

  const fetchGctlPrice = useCallback(async (): Promise<
    Result<number, string>
  > => {
    try {
      await refetchGctlPrice();
      return new Ok(gctlPrice);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [refetchGctlPrice, gctlPrice]);

  const fetchMintedEvents = useCallback(async (): Promise<
    Result<MintedEvent[], string>
  > => {
    try {
      await refetchMintedEvents();
      return new Ok(mintedEvents);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [refetchMintedEvents, mintedEvents]);

  const fetchStakedEvents = useCallback(async (): Promise<
    Result<StakedEvent[], string>
  > => {
    try {
      const result = await refetchStakedEvents();
      return new Ok(result.data || []);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [refetchStakedEvents]);

  const fetchPendingTransfers = useCallback(async (): Promise<
    Result<PendingTransfer[], string>
  > => {
    try {
      const result = await refetchPendingTransfers();
      return new Ok(result.data || []);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [refetchPendingTransfers]);

  const fetchFailedOperations = useCallback(async (): Promise<
    Result<FailedOperation[], string>
  > => {
    try {
      const result = await refetchFailedOperations();
      return new Ok(result.data || []);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [refetchFailedOperations]);

  const fetchRegions = useCallback(async (): Promise<
    Result<Region[], string>
  > => {
    try {
      await refetchRegions();
      return new Ok(regions);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [refetchRegions, regions]);

  const fetchRegionStake = useCallback(
    async (regionId: number): Promise<Result<RegionStake, string>> => {
      try {
        const data = await control.fetchRegionStake(regionId);
        return new Ok(data);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    []
  );

  const fetchWalletRegionStake = useCallback(
    async (regionId: number): Promise<Result<WalletRegionStake, string>> => {
      if (!walletAddress) return new Err("Wallet address not provided");
      try {
        const data = await control.fetchWalletRegionStake(
          walletAddress,
          regionId
        );
        return new Ok(data);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    [walletAddress]
  );

  const fetchWalletRegionUnlocked = useCallback(
    async (regionId: number): Promise<Result<WalletRegionUnlocked, string>> => {
      if (!walletAddress) return new Err("Wallet address not provided");
      try {
        const data = await control.fetchWalletRegionUnlocked(
          walletAddress,
          regionId
        );
        return new Ok(data);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    [walletAddress]
  );

  const stakeGctl = useCallback(
    async (
      regionId: number,
      amount: string
    ): Promise<Result<boolean, string>> => {
      try {
        await stakeMutation.mutateAsync({ regionId, amount });
        return new Ok(true);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    [stakeMutation]
  );

  const unstakeGctl = useCallback(
    async (
      regionId: number,
      amount: string
    ): Promise<Result<boolean, string>> => {
      try {
        await unstakeMutation.mutateAsync({ regionId, amount });
        return new Ok(true);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    [unstakeMutation]
  );

  const retryFailedOperation = useCallback(
    async (operationId: string): Promise<Result<boolean, string>> => {
      try {
        await retryFailedOperationMutation.mutateAsync(operationId);
        return new Ok(true);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    [retryFailedOperationMutation]
  );

  const fetchTransferDetails = useCallback(
    async (txId: string): Promise<Result<TransferDetails, string>> => {
      try {
        const data = await control.fetchTransferDetails(txId);
        return new Ok(data);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    []
  );

  // --------------------------- Exports -----------------------------------
  return {
    // Data
    gctlBalance,
    gctlPrice,
    mintedEvents,
    stakedEvents,
    pendingTransfers,
    failedOperations,
    regions,

    // Loading states
    isGctlBalanceLoading,
    isGctlPriceLoading,
    isMintedEventsLoading,
    isStakedEventsLoading,
    isPendingTransfersLoading,
    isFailedOperationsLoading,
    isRegionsLoading,

    // Legacy functions (for backward compatibility)
    fetchGctlBalance,
    fetchGctlPrice,
    fetchMintedEvents,
    fetchStakedEvents,
    fetchPendingTransfers,
    fetchFailedOperations,
    fetchRegions,
    fetchRegionStake,
    fetchWalletRegionStake,
    fetchWalletRegionUnlocked,
    fetchTransferDetails,
    stakeGctl,
    unstakeGctl,
    retryFailedOperation,

    // New React Query hooks for conditional usage
    useRegionStake,
    useWalletRegionStake,
    useWalletRegionUnlocked,
    useTransferDetails,

    // Mutation states
    isStaking: stakeMutation.isPending,
    isUnstaking: unstakeMutation.isPending,
    isRetryingFailedOperation: retryFailedOperationMutation.isPending,
  } as const;
}
