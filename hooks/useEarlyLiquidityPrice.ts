"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { EarlyLiquidityABI } from "@glowlabs-org/guarded-launch-abis";
import { formatUnits } from "viem";
import { addresses } from "@/web3/constants/addresses";
import { publicClient } from "@/web3/web3/clients/publicClient";

interface EarlyLiquidityPriceResult {
  price: number;
  updatedAt: number;
}

export function useEarlyLiquidityPrice(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const query = useQuery<EarlyLiquidityPriceResult | null>({
    queryKey: ["glw-early-liquidity-price"],
    queryFn: async () => {
      try {
        const price = (await publicClient.readContract({
          address: addresses.earlyLiquidity,
          abi: EarlyLiquidityABI,
          functionName: "getCurrentPrice",
        })) as bigint;

        const nextPrice = Number(formatUnits(price, 6)) * 100;
        if (!Number.isFinite(nextPrice) || nextPrice <= 0)
          return { price: 0, updatedAt: Date.now() };

        return { price: nextPrice, updatedAt: Date.now() };
      } catch {
        return null;
      }
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  });

  return {
    currentPrice: query.data?.price ?? 0,
    updatedAt: query.data?.updatedAt ?? 0,
    isLoading: query.isLoading || query.isFetching || query.isPending,
  } as const;
}
