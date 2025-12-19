"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { useChainId } from "wagmi";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";

const API_BASE = process.env.NEXT_PUBLIC_POSITIONS_API_BASE;
if (!API_BASE) {
  throw new Error("NEXT_PUBLIC_POSITIONS_API_BASE is not set");
}

export interface SwapEvent {
  txHash?: `0x${string}`;
  timestamp: number;
  glwIn: number;
  glwOut: number;
  usdgIn: number;
  usdgOut: number;
}

export interface SwapTotals {
  totalGlwIn: number;
  totalGlwOut: number;
  totalUsdgIn: number;
  totalUsdgOut: number;
}

export interface WalletSwapsData {
  swaps: SwapEvent[];
  totals: SwapTotals;
  indexingComplete: boolean;
}

interface WalletSwapActivityApiSwap {
  id: number;
  timestamp: number; // unix seconds
  glowIn?: string;
  glowOut?: string;
  usdgIn?: string;
  usdgOut?: string;
  txHash?: string;
  transactionHash?: string;
}

interface WalletSwapActivityApiResponse {
  indexingComplete: boolean;
  swaps: WalletSwapActivityApiSwap[];
}

function parseAmount(value: string | undefined, decimals: number) {
  if (!value) return 0;
  try {
    return Number(formatUnits(BigInt(value), decimals));
  } catch {
    return 0;
  }
}

function asTxHash(value: string | undefined): `0x${string}` | undefined {
  if (!value) return undefined;
  if (!value.startsWith("0x")) return undefined;
  if (value.length !== 66) return undefined;
  return value as `0x${string}`;
}

async function fetchWalletSwapsFromApi(params: {
  walletAddress: `0x${string}`;
  limit: number;
}): Promise<WalletSwapsData> {
  const { walletAddress, limit } = params;

  const res = await fetch(
    `${API_BASE}/get-wallet-swap-activity/${walletAddress}?limit=${limit}`,
    { cache: "no-store" }
  );

  const body = (await res.json().catch(() => null)) as
    | WalletSwapActivityApiResponse
    | { error?: string; indexingComplete?: boolean }
    | null;

  // While indexing is incomplete, the service returns 503. We treat this as an
  // "empty but not error" state to avoid noisy UIs.
  if (!res.ok) {
    const indexingComplete = (body as any)?.indexingComplete ?? true;
    if (res.status === 503 && indexingComplete === false) {
      return {
        indexingComplete: false,
        swaps: [],
        totals: { totalGlwIn: 0, totalGlwOut: 0, totalUsdgIn: 0, totalUsdgOut: 0 },
      };
    }

    const message =
      (body as any)?.error ||
      `Failed to fetch wallet swap activity (status ${res.status})`;
    throw new Error(message);
  }

  const apiSwaps = (body as WalletSwapActivityApiResponse | null)?.swaps ?? [];
  const indexingComplete =
    (body as WalletSwapActivityApiResponse | null)?.indexingComplete ?? true;

  const swaps: SwapEvent[] = apiSwaps
    .map((swap) => {
      const txHash = asTxHash(swap.txHash ?? swap.transactionHash);
      return {
        txHash,
        timestamp: swap.timestamp * 1000,
        glwIn: parseAmount(swap.glowIn, DECIMALS_BY_TOKEN.GLW),
        glwOut: parseAmount(swap.glowOut, DECIMALS_BY_TOKEN.GLW),
        usdgIn: parseAmount(swap.usdgIn, DECIMALS_BY_TOKEN.USDG),
        usdgOut: parseAmount(swap.usdgOut, DECIMALS_BY_TOKEN.USDG),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const totals: SwapTotals = {
    totalGlwIn: swaps.reduce((sum, s) => sum + s.glwIn, 0),
    totalGlwOut: swaps.reduce((sum, s) => sum + s.glwOut, 0),
    totalUsdgIn: swaps.reduce((sum, s) => sum + s.usdgIn, 0),
    totalUsdgOut: swaps.reduce((sum, s) => sum + s.usdgOut, 0),
  };

  return { indexingComplete, swaps, totals };
}

export function useWalletSwaps(
  walletAddress: string | undefined,
  options?: { limit?: number; enabled?: boolean }
) {
  const chainId = useChainId();
  const { limit = 500, enabled = true } = options ?? {};

  const { data, isLoading, isFetching, error } = useQuery<WalletSwapsData>({
    queryKey: ["wallet-swaps", chainId, walletAddress, limit],
    enabled: Boolean(enabled && walletAddress),
    queryFn: () =>
      fetchWalletSwapsFromApi({
        walletAddress: walletAddress as `0x${string}`,
        limit,
      }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  return {
    swaps: data?.swaps ?? [],
    totals: data?.totals ?? {
      totalGlwIn: 0,
      totalGlwOut: 0,
      totalUsdgIn: 0,
      totalUsdgOut: 0,
    },
    indexingComplete: data?.indexingComplete ?? false,
    isLoading,
    isFetching,
    error,
  };
}
