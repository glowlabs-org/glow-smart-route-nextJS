"use client";

import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";
import { ControlRouter } from "@glowlabs-org/utils/browser";

export function useGctlHoldersCount(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const chainId = useChainId();
  const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL;

  if (!CONTROL_API_URL) {
    throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
  }

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["gctl-holders-count", chainId],
    enabled,
    queryFn: async () => {
      try {
        const router = ControlRouter(CONTROL_API_URL);
        const holdersCount = await router.fetchHoldersCount();
        return holdersCount;
      } catch (error) {
        console.error("Error fetching GCTL holders count:", error);
        return 0;
      }
    },
    staleTime: 60_000, // 1 minute
    refetchInterval: enabled ? 300_000 : false, // 5 minutes
    refetchOnMount: enabled,
    refetchOnWindowFocus: false,
  });

  return {
    holdersCount: data ?? 0,
    isLoading,
    isFetching,
    error,
  };
}
