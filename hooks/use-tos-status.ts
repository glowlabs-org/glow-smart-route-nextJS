"use client";

import { useQuery } from "@tanstack/react-query";
import { getWalletsRouter } from "@/lib/api/control-routers";

interface TosStatusResponse {
  needsReAcceptance?: boolean;
}

export function useTosStatus(address?: string | null) {
  const normalizedAddress = address?.toLowerCase() ?? null;

  const query = useQuery({
    queryKey: ["tos-status", normalizedAddress],
    queryFn: async () =>
      (await getWalletsRouter().fetchTosStatus(
        normalizedAddress!
      )) as TosStatusResponse,
    enabled: Boolean(normalizedAddress),
    staleTime: 30_000,
    retry: 1,
  });

  const needsReAcceptance = Boolean(query.data?.needsReAcceptance);
  const hasAcceptedTos =
    Boolean(normalizedAddress) && query.isSuccess && !needsReAcceptance;

  return {
    ...query,
    needsReAcceptance,
    hasAcceptedTos,
  };
}
