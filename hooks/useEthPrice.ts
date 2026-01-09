"use client";

import { useQuery } from "@tanstack/react-query";
import { useSwapETHToUSDC } from "./useSwapETHToUSDC";
import { formatUnits } from "viem";

export function useEthPrice() {
  const { estimateEthToUsdc } = useSwapETHToUSDC();

  const query = useQuery({
    queryKey: ["eth-price"],
    queryFn: async () => {
      const res = await estimateEthToUsdc({ amountInWei: BigInt(1e18) });
      if (res.ok) {
        // USDC has 6 decimals
        return parseFloat(formatUnits(res.val.amountOutUsdc, 6));
      }
      return null;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  return {
    ethPrice: query.data ?? 0,
    isLoading: query.isLoading,
  };
}

