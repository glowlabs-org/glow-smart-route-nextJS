"use client";
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Result, Ok, Err } from "ts-results";

// ---- Types ---------------------------------------------------------------
export interface MintedEvent {
  txId: string;
  epoch: number;
  wallet: string;
  amountWei: string; // Updated from amountUsdcWei
  currency: string; // New field
  gctlMinted: string;
  ts: string; // ISO date string
}

export interface StakedEvent {
  id: string;
  epoch: number;
  wallet: string;
  regionId: number;
  amount: string;
  direction: "stake" | "unstake";
  ts: string; // ISO date string
}

export interface PendingTransfer {
  txId: string;
  wallet: string;
  amountWei: string; // Updated from amountUsdcWei
  type: string; // New field
  currency: string; // New field
  status: string;
  ts: string; // ISO date string
  applicationId?: string;
  farmId?: string; // New field
  regionId?: number;
}

export interface FailedOperation {
  id: string;
  txId: string;
  operation: string;
  failureType: string;
  errorMessage: string;
  errorDetails?: string;
  isRetryable: string;
  retryCount: number;
  lastRetryAt?: string; // ISO date string
  resolvedAt?: string; // ISO date string
  wallet?: string;
  amountWei?: string; // Updated from amountUsdcWei
  currency?: string; // New field
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface GctlPrice {
  currentPriceUsdc: number;
}

// New staking-related types
export interface StakeRequest {
  wallet: string;
  regionId: number;
  amount: string; // Amount in atomic units (10^6 = 1 GCTL)
}

export interface RegionStake {
  regionId: number;
  currentGctlStake: string;
}

export interface WalletRegionStake {
  wallet: string;
  regionId: number;
  currentGctlStake: string;
}

export interface WalletRegionUnlocked {
  wallet: string;
  regionId: number;
  unlocked: string;
}

// New region type
export interface Region {
  id: number;
  name: string;
  flag: string;
  currentGctlStake: string;
  isActive: boolean;
  solarFarmCount: number;
}

// --------------------------------------------------------------------------
const BASE_URL = "/api"; // Use local API routes instead of external API

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

  // ----------------------- API helpers -----------------------------------
  const fetchGctlBalanceApi = async (wallet: string): Promise<string> => {
    const res = await fetch(`${BASE_URL}/balance/${wallet}`);
    if (!res.ok) throw new Error("Failed to fetch GCTL balance");
    const data = await res.json();
    return (data?.gctl_balance ?? "0").toString();
  };

  const fetchGctlPriceApi = async (): Promise<number> => {
    const res = await fetch(`${BASE_URL}/price`);
    if (!res.ok) throw new Error("Failed to fetch GCTL price");
    const data: GctlPrice = await res.json();
    return data.currentPriceUsdc;
  };

  const fetchMintedEventsApi = async (): Promise<MintedEvent[]> => {
    const res = await fetch(`${BASE_URL}/events/minted?page=1&limit=50`);
    if (!res.ok) throw new Error("Failed to fetch minted events");
    const data = await res.json();
    return data.events ?? [];
  };

  const fetchStakeEventsApi = async (): Promise<StakedEvent[]> => {
    const res = await fetch(`${BASE_URL}/events/stake?page=1&limit=50`); // Updated endpoint
    if (!res.ok) throw new Error("Failed to fetch stake events");
    const data = await res.json();
    return data.events ?? [];
  };

  const fetchPendingTransfersApi = async (): Promise<PendingTransfer[]> => {
    const res = await fetch(`${BASE_URL}/transfers/pending?page=1&limit=50`);
    if (!res.ok) throw new Error("Failed to fetch pending transfers");
    const data = await res.json();
    return data.transfers ?? [];
  };

  const fetchFailedOperationsApi = async (): Promise<FailedOperation[]> => {
    const res = await fetch(`${BASE_URL}/operations/failed?page=1&limit=50`);
    if (!res.ok) throw new Error("Failed to fetch failed operations");
    const data = await res.json();
    return data.operations ?? [];
  };

  const fetchRegionsApi = async (): Promise<Region[]> => {
    const res = await fetch(`${BASE_URL}/regions`);
    if (!res.ok) throw new Error("Failed to fetch regions");
    const data = await res.json();

    // Filter out test regions
    return (
      data.regions.filter((r: Region) => r.id !== 998 && r.id !== 999) ?? []
    );
  };

  const fetchRegionStakeApi = async (
    regionId: number
  ): Promise<RegionStake> => {
    const res = await fetch(`${BASE_URL}/region/${regionId}/stake`);
    if (!res.ok) throw new Error("Failed to fetch region stake");
    return await res.json();
  };

  const fetchWalletRegionStakeApi = async (
    wallet: string,
    regionId: number
  ): Promise<WalletRegionStake> => {
    const res = await fetch(
      `${BASE_URL}/wallet/${wallet}/region/${regionId}/stake`
    );
    if (!res.ok) throw new Error("Failed to fetch wallet region stake");
    return await res.json();
  };

  const fetchWalletRegionUnlockedApi = async (
    wallet: string,
    regionId: number
  ): Promise<WalletRegionUnlocked> => {
    const res = await fetch(
      `${BASE_URL}/wallet/${wallet}/region/${regionId}/unlocked`
    );
    if (!res.ok) throw new Error("Failed to fetch wallet region unlocked");
    return await res.json();
  };

  // ----------------------- React Query hooks -----------------------------

  // GCTL Balance Query
  const {
    data: gctlBalance = "0",
    refetch: refetchGctlBalance,
    isLoading: isGctlBalanceLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.gctlBalance(walletAddress),
    queryFn: () => fetchGctlBalanceApi(walletAddress!),
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
    queryFn: fetchGctlPriceApi,
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
    queryFn: fetchMintedEventsApi,
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
    queryFn: fetchStakeEventsApi, // Updated function name
    staleTime: 0, // No caching - always fetch fresh data
    gcTime: 0, // Don't cache results
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  // Pending Transfers Query
  const {
    data: pendingTransfers = [],
    refetch: refetchPendingTransfers,
    isLoading: isPendingTransfersLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.pendingTransfers(),
    queryFn: fetchPendingTransfersApi,
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
    queryFn: fetchFailedOperationsApi,
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
  const useRegionStake = (regionId: number) => {
    return useQuery({
      queryKey: QUERY_KEYS.regionStake(regionId),
      queryFn: () => fetchRegionStakeApi(regionId),
      staleTime: 30 * 1000, // 30 seconds
      retry: 2,
    });
  };

  const useWalletRegionStake = (regionId: number) => {
    return useQuery({
      queryKey: QUERY_KEYS.walletRegionStake(walletAddress, regionId),
      queryFn: () => fetchWalletRegionStakeApi(walletAddress!, regionId),
      enabled: !!walletAddress,
      staleTime: 15 * 1000, // 15 seconds
      retry: 2,
    });
  };

  const useWalletRegionUnlocked = (regionId: number) => {
    return useQuery({
      queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, regionId),
      queryFn: () => fetchWalletRegionUnlockedApi(walletAddress!, regionId),
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

      const stakeRequest: StakeRequest = {
        wallet: walletAddress,
        regionId,
        amount,
      };

      const res = await fetch(`${BASE_URL}/stake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stakeRequest),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to stake GCTL");
      }

      return await res.json();
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

      const unstakeRequest: StakeRequest = {
        wallet: walletAddress,
        regionId,
        amount,
      };

      const res = await fetch(`${BASE_URL}/unstake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(unstakeRequest),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to unstake GCTL");
      }

      return await res.json();
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
    mutationFn: async (operationId: string) => {
      const res = await fetch(
        `${BASE_URL}/operations/failed/${operationId}/retry`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to retry operation");
      }

      return await res.json();
    },
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
        const data = await fetchRegionStakeApi(regionId);
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
        const data = await fetchWalletRegionStakeApi(walletAddress, regionId);
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
        const data = await fetchWalletRegionUnlockedApi(
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
    stakeGctl,
    unstakeGctl,
    retryFailedOperation,

    // New React Query hooks for conditional usage
    useRegionStake,
    useWalletRegionStake,
    useWalletRegionUnlocked,

    // Mutation states
    isStaking: stakeMutation.isPending,
    isUnstaking: unstakeMutation.isPending,
    isRetryingFailedOperation: retryFailedOperationMutation.isPending,
  } as const;
}
