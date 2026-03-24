"use client";

import { useQuery } from "@tanstack/react-query";
import { getWalletsRouter } from "@/lib/api/control-routers";

interface TosStatusResponse {
  needsReAcceptance?: boolean;
}

export function useTosStatus(address?: string | null) {
  const query = useQuery({
    queryKey: ["tos-status", address],
    queryFn: async () =>
      (await getWalletsRouter().fetchTosStatus(
        address!
      )) as TosStatusResponse,
    enabled: Boolean(address),
    staleTime: 30_000,
    retry: 1,
  });

  const needsReAcceptance = Boolean(query.data?.needsReAcceptance);
  const hasAcceptedTos = Boolean(address) && query.isSuccess && !needsReAcceptance;

  return {
    ...query,
    needsReAcceptance,
    hasAcceptedTos,
  };
}
