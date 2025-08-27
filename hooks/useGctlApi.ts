"use client";
import { useCallback, useMemo } from "react";
import Decimal from "decimal.js";
import { formatUnits } from "viem";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Result, Ok, Err } from "ts-results";
import {
  type MintedEvent,
  type StakedEvent,
  type PendingTransfer,
  type FailedOperation,
  type RegionStake,
  type WalletRegionStake,
  type WalletRegionUnlocked,
  type RestakeRequest,
  ControlRouter,
  TransferDetails,
  StakeRequest,
} from "@glowlabs-org/utils/browser";

if (!process.env.NEXT_PUBLIC_CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

// Initialize Glow Control API client
const control = ControlRouter(process.env.NEXT_PUBLIC_CONTROL_API_URL);

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
  gctlCirculatingSupply: () => ["gctl-circulating-supply"],
  mintedEvents: (page?: number, limit?: number) => [
    "minted-events",
    page,
    limit,
  ],
  stakeEvents: (regionId?: number, page?: number, limit?: number) => [
    "stake-events",
    regionId,
    page,
    limit,
  ], // Updated from stakedEvents
  pendingTransfers: (page?: number, limit?: number) => [
    "pending-transfers",
    page,
    limit,
  ],
  failedOperations: (page?: number, limit?: number) => [
    "failed-operations",
    page,
    limit,
  ],
  regions: () => ["regions"],
  latestNonce: (wallet?: string) => ["latest-nonce", wallet],
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
  glwPrice: () => ["glw-price"],
} as const;

export function useGctlApi(walletAddress?: string) {
  const queryClient = useQueryClient();

  // ----------------------- React Query hooks -----------------------------

  // Latest Nonce used for the wallet
  const {
    data: latestNonce = "0",
    refetch: refetchLatestNonce,
    isLoading: isLatestNonceLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.latestNonce(walletAddress),
    queryFn: () => control.fetchLastNonce(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 10 * 1000, // 10 seconds
    retry: 2,
  });

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
    data: gctlPrice = "0",
    refetch: refetchGctlPrice,
    isLoading: isGctlPriceLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.gctlPrice(),
    queryFn: () => control.fetchGctlPrice(),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  const {
    data: glwPrice = "0",
    refetch: refetchGlwPrice,
    isLoading: isGlwPriceLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.glwPrice(),
    queryFn: () => control.fetchGlwPrice(),
    staleTime: 60_000, // Cache for 1 minute
    gcTime: 5 * 60_000, // Garbage collect after 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000, // Refetch every minute to stay up-to-date
    retry: 2,
  });

  const glwPriceNumber = useMemo(() => {
    try {
      return new Decimal(formatUnits(BigInt(glwPrice), 6)).toNumber();
    } catch {
      return 0;
    }
  }, [glwPrice]);

  const gctlPriceNumber = useMemo(() => {
    try {
      return new Decimal(formatUnits(BigInt(gctlPrice), 6)).toNumber();
    } catch {
      return 0;
    }
  }, [gctlPrice]);

  // GCTL Circulating Supply
  const {
    data: gctlCirculatingSupply = "0",
    refetch: refetchGctlCirculatingSupply,
    isLoading: isGctlCirculatingSupplyLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.gctlCirculatingSupply(),
    queryFn: () => control.fetchCirculatingSupply(),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  const gctlCirculatingSupplyNumber = useMemo(() => {
    try {
      return new Decimal(
        formatUnits(BigInt(gctlCirculatingSupply), 6)
      ).toNumber();
    } catch {
      return 0;
    }
  }, [gctlCirculatingSupply]);

  // Conditional hooks for Events/Transfers
  const useMintedEvents = (params?: { page?: number; limit?: number }) =>
    useQuery({
      queryKey: QUERY_KEYS.mintedEvents(params?.page, params?.limit),
      queryFn: () => control.fetchMintedEvents(params?.page, params?.limit),
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 30000,
      refetchIntervalInBackground: true,
      retry: 2,
    });

  const useStakeEvents = (params?: {
    regionId?: number;
    page?: number;
    limit?: number;
  }) =>
    useQuery({
      queryKey: QUERY_KEYS.stakeEvents(
        params?.regionId,
        params?.page,
        params?.limit
      ),
      queryFn: async () => {
        const data = await fetchStakedEvents(params ?? {});
        if (data.ok) {
          return data.val;
        }
        return [];
      },
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 30000,
      refetchIntervalInBackground: true,
      retry: 2,
    });

  const usePendingTransfers = (params?: { page?: number; limit?: number }) =>
    useQuery({
      queryKey: QUERY_KEYS.pendingTransfers(params?.page, params?.limit),
      queryFn: () => control.fetchPendingTransfers(params?.page, params?.limit),
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 30000,
      refetchIntervalInBackground: true,
      retry: 2,
    });

  const useFailedOperations = (params?: { page?: number; limit?: number }) =>
    useQuery({
      queryKey: QUERY_KEYS.failedOperations(params?.page, params?.limit),
      queryFn: () => control.fetchFailedOperations(params?.page, params?.limit),
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 2,
    });

  // Hook for transfer details - can be called conditionally
  const useTransferDetails = (txId: string) =>
    useQuery({
      queryKey: QUERY_KEYS.transferDetails(txId),
      queryFn: () => fetchTransferDetails(txId),
      enabled: !!txId,
      staleTime: 0, // No caching - always fetch fresh data
      gcTime: 0, // Don't cache results
      retry: 2,
    });

  const useRegionStake = (regionId: number) => {
    return useQuery({
      queryKey: QUERY_KEYS.regionStake(regionId),
      queryFn: () => fetchStakedEvents({ regionId }),
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
    mutationFn: async (stakeRequest: StakeRequest) => {
      if (!walletAddress) throw new Error("Wallet address not provided");

      return await control.stakeGctl(stakeRequest);
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
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "stake-events",
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.latestNonce(walletAddress),
      });
    },
    onError: (error) => {
      console.error("Stake mutation error:", error);
      // Invalidate queries on error too in case of partial state changes
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "stake-events",
      });
    },
  });

  // Unstake GCTL Mutation
  const unstakeMutation = useMutation({
    mutationFn: async (unstakeRequest: StakeRequest) => {
      if (!walletAddress) throw new Error("Wallet address not provided");

      return await control.unstakeGctl(unstakeRequest);
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
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.latestNonce(walletAddress),
      });
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

  // Restake GCTL Mutation
  const restakeMutation = useMutation({
    mutationFn: async (restakeRequest: RestakeRequest) => {
      if (!walletAddress) throw new Error("Wallet address not provided");
      return await control.restakeGctl(restakeRequest);
    },
    onSuccess: (_, { fromZoneId, toZoneId }) => {
      // Invalidate balances and region stakes for both source and destination
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      if (typeof fromZoneId === "number") {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.regionStake(fromZoneId),
        });
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.walletRegionStake(walletAddress, fromZoneId),
        });
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, fromZoneId),
        });
      }
      if (typeof toZoneId === "number") {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.regionStake(toZoneId),
        });
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.walletRegionStake(walletAddress, toZoneId),
        });
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, toZoneId),
        });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "stake-events",
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.latestNonce(walletAddress),
      });
    },
    onError: (error) => {
      console.error("Restake mutation error:", error);
      // Conservative invalidation in case of partial state
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "stake-events",
      });
    },
  });

  // Retry Failed Operation Mutation
  const retryFailedOperationMutation = useMutation({
    mutationFn: async (operationId: string) =>
      control.retryFailedOperation(operationId),
    onSuccess: () => {
      // Invalidate failed operations to refresh the list
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "failed-operations",
      });
      // Also invalidate other relevant queries as the retry might affect them
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "pending-transfers",
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "minted-events",
      });
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

  const stakeGctlMutation = useMutation({
    mutationFn: async (stakeRequest: StakeRequest) => {
      if (!walletAddress) throw new Error("Wallet address not provided");
      return await control.stakeGctl(stakeRequest);
    },
    onSuccess: (_, { regionId }) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionStake(walletAddress, regionId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, regionId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "stake-events",
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.latestNonce(walletAddress),
      });
    },
    onError: (error) => {
      console.error("Stake mutation error:", error);
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
    Result<string, string>
  > => {
    try {
      await refetchGctlPrice();
      return new Ok(gctlPrice.toString());
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [refetchGctlPrice, gctlPrice]);

  const fetchCirculatingSupply = useCallback(async (): Promise<
    Result<string, string>
  > => {
    try {
      await refetchGctlCirculatingSupply();
      return new Ok(gctlCirculatingSupply.toString());
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [refetchGctlCirculatingSupply, gctlCirculatingSupply]);

  const fetchMintedEvents = useCallback(async (): Promise<
    Result<MintedEvent[], string>
  > => {
    try {
      const data = await control.fetchMintedEvents();
      return new Ok(data.events || []);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, []);

  const fetchStakedEvents = useCallback(
    async ({
      page,
      limit,
      regionId,
    }: {
      page?: number;
      limit?: number;
      regionId?: number;
    }): Promise<Result<StakedEvent[], string>> => {
      try {
        const data = await control.fetchStakeEvents(page, limit, regionId);
        return new Ok(data.events || []);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    []
  );

  const fetchPendingTransfers = useCallback(async (): Promise<
    Result<PendingTransfer[], string>
  > => {
    try {
      const data = await control.fetchPendingTransfers();
      return new Ok(data.transfers || []);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, []);

  const fetchFailedOperations = useCallback(async (): Promise<
    Result<FailedOperation[], string>
  > => {
    try {
      const data = await control.fetchFailedOperations();
      return new Ok(data.operations || []);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, []);

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
    async (stakeRequest: StakeRequest): Promise<Result<boolean, string>> => {
      try {
        await stakeMutation.mutateAsync(stakeRequest);
        return new Ok(true);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    [stakeMutation]
  );

  const unstakeGctl = useCallback(
    async (unstakeRequest: StakeRequest): Promise<Result<boolean, string>> => {
      try {
        await unstakeMutation.mutateAsync(unstakeRequest);
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

  const invalidateAllQueries = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  // New: Restake helper
  const restakeGctl = useCallback(
    async (
      restakeRequest: RestakeRequest
    ): Promise<Result<boolean, string>> => {
      try {
        await restakeMutation.mutateAsync(restakeRequest);
        return new Ok(true);
      } catch (error) {
        return new Err(parseApiError(error));
      }
    },
    [restakeMutation]
  );

  // --------------------------- Exports -----------------------------------
  return {
    // Data
    gctlBalance,
    gctlPrice,
    gctlPriceNumber,
    glwPrice,
    glwPriceNumber,
    gctlCirculatingSupply,
    gctlCirculatingSupplyNumber,
    latestNonce,
    // Events/transfers data are now exposed via conditional hooks instead

    // Loading states
    isGctlBalanceLoading,
    isGctlPriceLoading,
    isGlwPriceLoading,
    isGctlCirculatingSupplyLoading,
    // Loading states for events/transfers are provided by conditional hooks

    // Legacy functions (for backward compatibility)
    fetchGctlBalance,
    fetchGctlPrice,
    fetchCirculatingSupply,
    fetchMintedEvents,
    fetchStakedEvents,
    fetchPendingTransfers,
    fetchFailedOperations,

    fetchRegionStake,
    fetchWalletRegionStake,
    fetchWalletRegionUnlocked,
    fetchTransferDetails,
    stakeGctl,
    unstakeGctl,
    retryFailedOperation,
    stakeGctlMutation,
    restakeGctl,

    // New React Query hooks for conditional usage
    useRegionStake,
    useWalletRegionStake,
    useWalletRegionUnlocked,
    useTransferDetails,
    useMintedEvents,
    useStakeEvents,
    usePendingTransfers,
    useFailedOperations,

    // Mutation states
    isStaking: stakeMutation.isPending,
    isUnstaking: unstakeMutation.isPending,
    isRestaking: restakeMutation.isPending,
    isRetryingFailedOperation: retryFailedOperationMutation.isPending,
    isLatestNonceLoading,
    invalidateAllQueries,
  } as const;
}
