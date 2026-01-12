"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { parseAbi, zeroAddress } from "viem";
import Decimal from "decimal.js";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { SDKAddresses } from "@/web3/constants/addresses";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";

interface GlowSpotPriceResult {
  spotPrice: number; // USDG per 1 GLW
  updatedAt: number;
}

export interface UseGlowSpotPriceQueryOverrides {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number | false;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  retry?: number;
}

export interface UseGlowSpotPriceOptions {
  refreshKey?: string | number;
  query?: UseGlowSpotPriceQueryOverrides;
}

export function useGlowSpotPrice(options: UseGlowSpotPriceOptions = {}) {
  const query = useQuery<GlowSpotPriceResult | null>({
    queryKey: QUERY_KEYS.prices.glowSpot(options.refreshKey),
    queryFn: async () => {
      try {
        const factory = SDKAddresses.UNISWAP_V2_FACTORY as `0x${string}`;
        const GLW = SDKAddresses.GLW_UNISWAP as `0x${string}`;
        const USDG = SDKAddresses.USDG_UNISWAP as `0x${string}`;

        if (!factory || !GLW || !USDG) return null;

        const pair = (await publicClient.readContract({
          address: factory,
          abi: parseAbi([
            "function getPair(address tokenA, address tokenB) external view returns (address pair)",
          ]),
          functionName: "getPair",
          args: [GLW, USDG],
        })) as `0x${string}`;

        if (!pair || pair === zeroAddress) return null;

        const token0 = (await publicClient.readContract({
          address: pair,
          abi: parseAbi([
            "function token0() view returns (address)",
            "function token1() view returns (address)",
          ]),
          functionName: "token0",
        })) as `0x${string}`;

        const [reserve0, reserve1] = (await publicClient.readContract({
          address: pair,
          abi: parseAbi([
            "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
          ]),
          functionName: "getReserves",
        })) as readonly [bigint, bigint, number];

        const isToken0USDG =
          token0.toLowerCase() === (USDG as string).toLowerCase();
        const usdgReserve = isToken0USDG ? reserve0 : reserve1;
        const glwReserve = isToken0USDG ? reserve1 : reserve0;

        const baseUSDG = new Decimal(10).pow(DECIMALS_BY_TOKEN.USDG);
        const baseGLW = new Decimal(10).pow(DECIMALS_BY_TOKEN.GLW);

        const usdg = new Decimal(usdgReserve.toString()).div(baseUSDG);
        const glw = new Decimal(glwReserve.toString()).div(baseGLW);

        if (!glw.isFinite() || glw.lte(0))
          return { spotPrice: 0, updatedAt: Date.now() };
        const price = usdg.div(glw).toNumber();
        if (!Number.isFinite(price) || price < 0)
          return { spotPrice: 0, updatedAt: Date.now() };

        return { spotPrice: price, updatedAt: Date.now() };
      } catch {
        return null;
      }
    },
    enabled: options.query?.enabled ?? true,
    staleTime: options.query?.staleTime ?? QUERY_CONFIG.REALTIME.staleTime,
    gcTime: options.query?.gcTime,
    refetchInterval:
      options.query?.refetchInterval ?? QUERY_CONFIG.REALTIME.refetchInterval,
    refetchOnMount: options.query?.refetchOnMount ?? true,
    refetchOnWindowFocus:
      options.query?.refetchOnWindowFocus ??
      QUERY_CONFIG.REALTIME.refetchOnWindowFocus,
    refetchOnReconnect: options.query?.refetchOnReconnect ?? true,
    retry: options.query?.retry ?? 2,
  });

  return {
    spotPrice: query.data?.spotPrice ?? 0,
    updatedAt: query.data?.updatedAt ?? 0,
    isLoading: query.isLoading || query.isFetching || query.isPending,
  } as const;
}