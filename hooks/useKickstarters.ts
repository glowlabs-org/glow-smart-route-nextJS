"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type Kickstarter,
  KickstarterRouter,
} from "@glowlabs-org/utils/browser";

if (!process.env.NEXT_PUBLIC_CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

const kickstarterRouter = KickstarterRouter(
  process.env.NEXT_PUBLIC_CONTROL_API_URL
);

const QUERY_KEYS = {
  kickstarters: () => ["kickstarters"],
} as const;

export function useKickstarters() {
  const {
    data: kickstarters = [],
    refetch: refetchKickstarters,
    isLoading: isKickstartersLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.kickstarters(),
    queryFn: () => kickstarterRouter.fetchKickstarters(),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  return {
    kickstarters,
    refetchKickstarters,
    isKickstartersLoading,
  } as const;
}
