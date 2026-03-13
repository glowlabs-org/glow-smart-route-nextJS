"use client";

import { useCallback, useMemo } from "react";
import Decimal from "decimal.js";
import { formatUnits } from "viem";
import { useAccount, useChainId } from "wagmi";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Err, Ok, type Result } from "ts-results";
import type {
  FailedOperation,
  MintedEvent,
  PendingTransfer,
  RegionStake,
  RestakeRequest,
  StakedEvent,
  TransferDetails,
  WalletRegionStake,
  WalletRegionUnlocked,
  StakeRequest,
  VerifyUserSignatureRequest,
} from "@glowlabs-org/utils/browser";
import {
  buildVerifyUserMessage,
  stakeControlEIP712Domain,
  verifyUserEIP712Types,
} from "@glowlabs-org/utils/browser";
import { getControlRouter } from "@/lib/api/control-routers";
import { parseUnknownError } from "@/utils/api-error";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { QUERY_KEYS as APP_QUERY_KEYS } from "@/hooks/query-keys";

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
  ],
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
  gctlHoldersCount: (chainId: number) => ["gctl-holders-count", chainId],
  migrationAmount: (wallet?: string) => ["migration-amount", wallet],
} as const;

export function useGctlHoldersCount(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const chainId = useChainId();
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const query = useQuery({
    queryKey: QUERY_KEYS.gctlHoldersCount(chainId),
    enabled: enabled && isConfigured,
    staleTime: 60_000,
    refetchInterval: enabled ? 300_000 : false,
    refetchOnMount: enabled,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const holdersCount = await (
          getControlRouter() as any
        ).fetchHoldersCount();
        return holdersCount as number;
      } catch (error) {
        console.error("Error fetching GCTL holders count:", error);
        return 0;
      }
    },
  });

  return {
    holdersCount: query.data ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  } as const;
}

export function useGctlApi(
  walletAddress?: string,
  options?: { enabled?: boolean }
) {
  const { enabled = true } = options ?? {};
  const queryClient = useQueryClient();
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const latestNonceQuery = useQuery({
    queryKey: QUERY_KEYS.latestNonce(walletAddress),
    queryFn: () => (getControlRouter() as any).fetchLastNonce(walletAddress!),
    enabled: enabled && isConfigured && Boolean(walletAddress),
    staleTime: 10_000,
    retry: 2,
  });

  const gctlBalanceQuery = useQuery({
    queryKey: QUERY_KEYS.gctlBalance(walletAddress),
    queryFn: () => (getControlRouter() as any).fetchGctlBalance(walletAddress!),
    enabled: enabled && isConfigured && Boolean(walletAddress),
    staleTime: 10_000,
    retry: 2,
  });

  const gctlPriceQuery = useQuery({
    queryKey: QUERY_KEYS.gctlPrice(),
    queryFn: () => (getControlRouter() as any).fetchGctlPrice(),
    enabled: enabled && isConfigured,
    staleTime: 30_000,
    retry: 2,
  });

  const glwPriceQuery = useQuery({
    queryKey: QUERY_KEYS.glwPrice(),
    queryFn: () => (getControlRouter() as any).fetchGlwPrice(),
    enabled: enabled && isConfigured,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: enabled,
    refetchOnWindowFocus: enabled,
    refetchOnReconnect: enabled,
    refetchInterval: enabled ? 60_000 : false,
    retry: 2,
  });

  const gctlCirculatingSupplyQuery = useQuery({
    queryKey: QUERY_KEYS.gctlCirculatingSupply(),
    queryFn: () => (getControlRouter() as any).fetchCirculatingSupply(),
    enabled: enabled && isConfigured,
    staleTime: 30_000,
    retry: 2,
  });

  const glwPriceNumber = useMemo(() => {
    try {
      return new Decimal(
        formatUnits(BigInt(glwPriceQuery.data ?? "0"), 6)
      ).toNumber();
    } catch {
      return 0;
    }
  }, [glwPriceQuery.data]);

  const gctlPriceNumber = useMemo(() => {
    try {
      return new Decimal(
        formatUnits(BigInt(gctlPriceQuery.data ?? "0"), 6)
      ).toNumber();
    } catch {
      return 0;
    }
  }, [gctlPriceQuery.data]);

  const gctlCirculatingSupplyNumber = useMemo(() => {
    try {
      return new Decimal(
        formatUnits(BigInt(gctlCirculatingSupplyQuery.data ?? "0"), 6)
      ).toNumber();
    } catch {
      return 0;
    }
  }, [gctlCirculatingSupplyQuery.data]);

  const useMintedEvents = (params?: { page?: number; limit?: number }) =>
    useQuery({
      queryKey: QUERY_KEYS.mintedEvents(params?.page, params?.limit),
      enabled: isConfigured,
      queryFn: async () => {
        const res = await (getControlRouter() as any).fetchMintedEvents(
          params?.page,
          params?.limit
        );
        return ((res?.events ?? []) as MintedEvent[]) ?? [];
      },
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 30_000,
      refetchIntervalInBackground: true,
      retry: 2,
    });

  const fetchMintedEvents = useCallback(async (): Promise<
    Result<MintedEvent[], string>
  > => {
    try {
      const res = await (getControlRouter() as any).fetchMintedEvents();
      return new Ok(((res?.events ?? []) as MintedEvent[]) ?? []);
    } catch (error) {
      return new Err(parseUnknownError(error));
    }
  }, []);

  const fetchStakedEvents = useCallback(
    async (params: { regionId?: number; page?: number; limit?: number }) => {
      try {
        const res = await (getControlRouter() as any).fetchStakeEvents(
          params.page,
          params.limit,
          params.regionId
        );
        return {
          ok: true as const,
          val: ((res?.events ?? []) as StakedEvent[]) ?? [],
        };
      } catch (error) {
        return { ok: false as const, val: [], err: parseUnknownError(error) };
      }
    },
    []
  );

  const fetchStakedEventsLegacy = useCallback(
    async (params?: {
      regionId?: number;
      page?: number;
      limit?: number;
    }): Promise<Result<StakedEvent[], string>> => {
      try {
        const res = await (getControlRouter() as any).fetchStakeEvents(
          params?.page,
          params?.limit,
          params?.regionId
        );
        return new Ok(((res?.events ?? []) as StakedEvent[]) ?? []);
      } catch (error) {
        return new Err(parseUnknownError(error));
      }
    },
    []
  );

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
      enabled: isConfigured,
      queryFn: async () => {
        const data = await fetchStakedEvents(params ?? {});
        if (data.ok) return data.val;
        return [];
      },
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 30_000,
      refetchIntervalInBackground: true,
      retry: 2,
    });

  const usePendingTransfers = (params?: { page?: number; limit?: number }) =>
    useQuery({
      queryKey: QUERY_KEYS.pendingTransfers(params?.page, params?.limit),
      enabled: isConfigured,
      queryFn: async () => {
        const res = await (getControlRouter() as any).fetchPendingTransfers(
          params?.page,
          params?.limit
        );
        return ((res?.transfers ?? []) as PendingTransfer[]) ?? [];
      },
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 30_000,
      refetchIntervalInBackground: true,
      retry: 2,
    });

  const useFailedOperations = (params?: { page?: number; limit?: number }) =>
    useQuery({
      queryKey: QUERY_KEYS.failedOperations(params?.page, params?.limit),
      enabled: isConfigured,
      queryFn: async () => {
        const res = await (getControlRouter() as any).fetchFailedOperations(
          params?.page,
          params?.limit
        );
        return ((res?.operations ?? []) as FailedOperation[]) ?? [];
      },
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 2,
    });

  const fetchTransferDetails = useCallback(async (txId: string) => {
    try {
      return (await getControlRouter().fetchTransferDetails(
        txId
      )) as TransferDetails;
    } catch (error) {
      throw new Error(parseUnknownError(error));
    }
  }, []);

  const fetchTransferDetailsLegacy = useCallback(
    async (txId: string): Promise<Result<PendingTransfer, string>> => {
      try {
        const data = await getControlRouter().fetchTransferDetails(txId);
        return new Ok(data as PendingTransfer);
      } catch (error) {
        return new Err(parseUnknownError(error));
      }
    },
    []
  );

  const useTransferDetails = (txId: string) =>
    useQuery({
      queryKey: QUERY_KEYS.transferDetails(txId),
      queryFn: () => fetchTransferDetails(txId),
      enabled: isConfigured && Boolean(txId),
      staleTime: 0,
      gcTime: 0,
      retry: 2,
    });

  const useRegionStake = (regionId: number) =>
    useQuery({
      queryKey: QUERY_KEYS.regionStake(regionId),
      queryFn: () =>
        (getControlRouter() as any).fetchRegionStake(
          regionId
        ) as Promise<RegionStake>,
      enabled: isConfigured,
      staleTime: 30_000,
      retry: 2,
    });

  const useWalletRegionStake = (regionId: number) =>
    useQuery({
      queryKey: QUERY_KEYS.walletRegionStake(walletAddress, regionId),
      queryFn: () =>
        (getControlRouter() as any).fetchWalletRegionStake(
          walletAddress!,
          regionId
        ) as Promise<WalletRegionStake>,
      enabled: isConfigured && Boolean(walletAddress),
      staleTime: 15_000,
      retry: 2,
    });

  const useWalletRegionUnlocked = (regionId: number) =>
    useQuery({
      queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, regionId),
      queryFn: () =>
        (getControlRouter() as any).fetchWalletRegionUnlocked(
          walletAddress!,
          regionId
        ) as Promise<WalletRegionUnlocked>,
      enabled: isConfigured && Boolean(walletAddress),
      staleTime: 15_000,
      retry: 2,
    });

  const stakeMutation = useMutation({
    mutationFn: async (stakeRequest: StakeRequest) => {
      if (!walletAddress) throw new Error("Wallet address not provided");
      return await (getControlRouter() as any).stakeGctl(stakeRequest);
    },
    onSuccess: async (_res, { regionId }) => {
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      await queryClient.invalidateQueries({
        queryKey: APP_QUERY_KEYS.wallets.details(walletAddress),
      });
      await queryClient.invalidateQueries({
        queryKey: APP_QUERY_KEYS.wallets.availableStake(walletAddress, regionId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.regionStake(regionId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionStake(walletAddress, regionId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, regionId),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "stake-events",
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.latestNonce(walletAddress),
      });
    },
    onError: async (error) => {
      console.error("Stake mutation error:", error);
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
    },
  });

  const unstakeMutation = useMutation({
    mutationFn: async (unstakeRequest: StakeRequest) => {
      if (!walletAddress) throw new Error("Wallet address not provided");
      return await (getControlRouter() as any).unstakeGctl(unstakeRequest);
    },
    onSuccess: async (_res, { regionId }) => {
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      await queryClient.invalidateQueries({
        queryKey: APP_QUERY_KEYS.wallets.details(walletAddress),
      });
      await queryClient.invalidateQueries({
        queryKey: APP_QUERY_KEYS.wallets.availableStake(walletAddress, regionId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.regionStake(regionId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionStake(walletAddress, regionId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, regionId),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "stake-events",
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.latestNonce(walletAddress),
      });
    },
    onError: async (error) => {
      console.error("Unstake mutation error:", error);
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
    },
  });

  const restakeMutation = useMutation({
    mutationFn: async (restakeRequest: RestakeRequest) => {
      if (!walletAddress) throw new Error("Wallet address not provided");
      return await (getControlRouter() as any).restakeGctl(restakeRequest);
    },
    onSuccess: async (_res, { fromZoneId, toZoneId }) => {
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      await queryClient.invalidateQueries({
        queryKey: APP_QUERY_KEYS.wallets.details(walletAddress),
      });
      await queryClient.invalidateQueries({
        queryKey: APP_QUERY_KEYS.wallets.availableStake(walletAddress, fromZoneId),
      });
      await queryClient.invalidateQueries({
        queryKey: APP_QUERY_KEYS.wallets.availableStake(walletAddress, toZoneId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.regionStake(fromZoneId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.regionStake(toZoneId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionStake(walletAddress, fromZoneId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionStake(walletAddress, toZoneId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, fromZoneId),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.walletRegionUnlocked(walletAddress, toZoneId),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "stake-events",
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.latestNonce(walletAddress),
      });
    },
    onError: async (error) => {
      console.error("Restake mutation error:", error);
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(walletAddress),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() });
    },
  });

  const stakeGctl = useCallback(
    async (stakeRequest: StakeRequest) => {
      try {
        await stakeMutation.mutateAsync(stakeRequest);
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, error: parseUnknownError(error) };
      }
    },
    [stakeMutation]
  );

  const unstakeGctl = useCallback(
    async (unstakeRequest: StakeRequest) => {
      try {
        await unstakeMutation.mutateAsync(unstakeRequest);
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, error: parseUnknownError(error) };
      }
    },
    [unstakeMutation]
  );

  const restakeGctl = useCallback(
    async (restakeRequest: RestakeRequest) => {
      try {
        await restakeMutation.mutateAsync(restakeRequest);
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, error: parseUnknownError(error) };
      }
    },
    [restakeMutation]
  );

  const invalidateAllQueries = useCallback(async () => {
    const wallet = walletAddress;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.gctlPrice() }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.glwPrice() }),
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlCirculatingSupply(),
      }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regions() }),
      queryClient.invalidateQueries({
        queryKey: ["impact-leaderboard"],
      }),
      ...(wallet
        ? [
            queryClient.invalidateQueries({
              queryKey: APP_QUERY_KEYS.balances.gctl(wallet),
            }),
            queryClient.invalidateQueries({
              queryKey: APP_QUERY_KEYS.wallets.details(wallet),
            }),
            queryClient.invalidateQueries({
              predicate: (q) =>
                Array.isArray(q.queryKey) &&
                q.queryKey[0] === "wallet-available-stake" &&
                q.queryKey[1] === wallet,
            }),
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.latestNonce(wallet),
            }),
            queryClient.invalidateQueries({
              queryKey: ["impact-glow-score", wallet],
            }),
            queryClient.invalidateQueries({
              queryKey: ["impact-score-breakdown"],
            }),
            queryClient.invalidateQueries({
              queryKey: ["impact-glow-worth"],
            }),
          ]
        : []),
    ]);

    await queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        [
          "minted-events",
          "stake-events",
          "pending-transfers",
          "failed-operations",
          "transfer-details",
          "region-stake",
          "wallet-region-stake",
          "wallet-region-unlocked",
          "migration-amount",
        ].includes(String(q.queryKey[0])),
    });
  }, [queryClient, walletAddress]);

  const retryFailedOperationMutation = useMutation({
    mutationFn: async (operationId: string) => {
      try {
        return await (getControlRouter() as any).retryFailedOperation(
          operationId
        );
      } catch (error) {
        throw new Error(parseUnknownError(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["failed-operations"] });
      await queryClient.invalidateQueries({ queryKey: ["pending-transfers"] });
    },
  });

  const retryFailedOperation = useCallback(
    async (operationId: string): Promise<Result<unknown, string>> => {
      try {
        const res = await retryFailedOperationMutation.mutateAsync(operationId);
        return new Ok(res);
      } catch (error) {
        return new Err(parseUnknownError(error));
      }
    },
    [retryFailedOperationMutation]
  );

  return {
    latestNonce: latestNonceQuery.data ?? "0",
    gctlBalance: gctlBalanceQuery.data ?? "0",
    gctlPrice: gctlPriceQuery.data ?? "0",
    glwPrice: glwPriceQuery.data ?? "0",
    gctlCirculatingSupply: gctlCirculatingSupplyQuery.data ?? "0",

    glwPriceNumber,
    gctlPriceNumber,
    gctlCirculatingSupplyNumber,

    isGctlBalanceLoading: gctlBalanceQuery.isLoading,
    isGctlBalanceFetching: gctlBalanceQuery.isFetching,
    isGctlPriceLoading: gctlPriceQuery.isLoading,
    isGctlPriceFetching: gctlPriceQuery.isFetching,
    isGctlCirculatingSupplyLoading: gctlCirculatingSupplyQuery.isLoading,
    isGctlCirculatingSupplyFetching: gctlCirculatingSupplyQuery.isFetching,

    stakeGctl,
    unstakeGctl,
    restakeGctl,

    stakeGctlMutation: stakeMutation,
    restakeGctlMutation: restakeMutation,

    invalidateAllQueries,

    useMintedEvents,
    useStakeEvents,
    usePendingTransfers,
    useFailedOperations,
    useTransferDetails,
    useRegionStake,
    useWalletRegionStake,
    useWalletRegionUnlocked,

    retryFailedOperation,
    isRetryingFailedOperation: retryFailedOperationMutation.isPending,

    // Legacy API-style functions used by some screens
    fetchMintedEvents,
    fetchStakedEvents: fetchStakedEventsLegacy,
    fetchTransferDetails: fetchTransferDetailsLegacy,
  } as const;
}

export function useMigrationClaim() {
  const { address, isConnected } = useAccount();
  const { signer } = useEthersSigner();
  const queryClient = useQueryClient();
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);

  const { data: latestNonce, refetch: refetchNonce } = useQuery({
    queryKey: QUERY_KEYS.latestNonce(address),
    queryFn: () => (getControlRouter() as any).fetchLastNonce(address!),
    enabled: isConfigured && isConnected && Boolean(address),
    staleTime: 0,
  });

  const migrationClaimMutation = useMutation({
    mutationFn: async (): Promise<{ success: boolean }> => {
      if (!isConnected || !address || !signer)
        throw new Error("Wallet not connected");

      await refetchNonce();
      if (!latestNonce) throw new Error("Failed to fetch account nonce");

      const nonce = (Number(latestNonce) + 1).toString();
      const deadline = Math.floor(Date.now() / 1000 + 3600).toString();

      const signatureMessage = buildVerifyUserMessage({ nonce, deadline });
      const eip712Types = verifyUserEIP712Types as unknown as Record<
        string,
        any[]
      >;
      const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "1");

      const signature: VerifyUserSignatureRequest["signature"] =
        await signer.signTypedData(
          stakeControlEIP712Domain(chainId),
          eip712Types,
          signatureMessage
        );

      if (!signature) throw new Error("Failed to sign verification message");

      const result = await (getControlRouter() as any).migrateUser({
        wallet: address,
        signature,
        nonce,
        deadline,
      });

      if (!result.success) throw new Error("Migration claim failed");
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.migrationAmount(address),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(address),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.latestNonce(address),
      });
      await queryClient.invalidateQueries({
        queryKey: ["wallet-details", address],
      });
      await queryClient.invalidateQueries({ queryKey: ["erc20-balances"] });

      toast.success(
        "Migration claimed successfully! Your GCTL has been transferred to your wallet."
      );
    },
    onError: (error: any) => {
      console.error("Migration claim error:", error);
      const errorMessage = error?.message || error?.error || "Unknown error";

      if (errorMessage.includes("already claimed"))
        toast.error("This migration has already been claimed");
      else if (
        errorMessage.includes("not found") ||
        errorMessage.includes("not eligible")
      )
        toast.error("No migration amount available for this wallet");
      else if (errorMessage.includes("deadline_expired"))
        toast.error("Signature expired. Please try again");
      else if (errorMessage.includes("signature_failed"))
        toast.error("Invalid signature. Please try again");
      else if (errorMessage.includes("signer_mismatch"))
        toast.error("Signature does not match wallet address");
      else if (errorMessage.includes("already used"))
        toast.error(
          "Transaction nonce already used. Please refresh and try again"
        );
      else if (errorMessage.includes("temporarily disabled"))
        toast.error(
          "Migration is temporarily disabled due to system maintenance"
        );
      else toast.error(`Migration failed: ${errorMessage}`);
    },
  });

  const executeMigrationClaim = useCallback(async (): Promise<boolean> => {
    try {
      await migrationClaimMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  }, [migrationClaimMutation]);

  return {
    executeMigrationClaim,
    isClaimingMigration: migrationClaimMutation.isPending,
    isSuccess: migrationClaimMutation.isSuccess,
    isError: migrationClaimMutation.isError,
    error: migrationClaimMutation.error,
    reset: migrationClaimMutation.reset,
  } as const;
}
