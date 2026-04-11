"use client";

import { useQuery } from "@tanstack/react-query";

export interface WalletSgctlClaimSettlementRow {
  txHash: `0x${string}`;
  logIndex: number;
  nonce: string;
  weekNumber: number;
  wallet: `0x${string}`;
  regionId: number;
  amount: string;
  blockNumber: string;
  settledAt: string;
}

interface WalletSgctlClaimSettlementsResponse {
  page: number;
  limit: number;
  events: WalletSgctlClaimSettlementRow[];
}

interface UseWalletSgctlClaimSettlementsOptions {
  enabled?: boolean;
  limit?: number;
}

const DEFAULT_LIMIT = 200;

async function fetchWalletSgctlClaimSettlements(
  walletAddress: string,
  limit: number
): Promise<WalletSgctlClaimSettlementRow[]> {
  const baseUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL;
  if (!baseUrl) {
    throw new Error("Environment variable NEXT_PUBLIC_CONTROL_API_URL is not set");
  }

  const response = await fetch(
    `${baseUrl}/wallets/address/${encodeURIComponent(
      walletAddress
    )}/events/sgctl-claims?limit=${limit}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch SGCTL claim settlements");
  }

  const body =
    (await response.json()) as WalletSgctlClaimSettlementsResponse | null;
  return body?.events ?? [];
}

export function useWalletSgctlClaimSettlements(
  walletAddress?: string,
  options: UseWalletSgctlClaimSettlementsOptions = {}
) {
  const { enabled = true, limit = DEFAULT_LIMIT } = options;

  const query = useQuery({
    queryKey: ["wallet-sgctl-claim-settlements", walletAddress, limit] as const,
    enabled: enabled && Boolean(walletAddress),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () =>
      await fetchWalletSgctlClaimSettlements(walletAddress!, limit),
  });

  return {
    settlements: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  } as const;
}
