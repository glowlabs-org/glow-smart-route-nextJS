"use client";

import * as React from "react";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useGlowCirculatingSnapshot } from "@/hooks/useGlowCirculatingSnapshot";
import { deriveGlowCirculatingSupplyMetrics } from "@/hooks/glow-circulating-supply-utils";

export function useGlowCirculatingSupply(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const { spotPrice, isLoading: isSpotPriceLoading } = useGlowSpotPrice({
    query: { enabled },
  });

  const snapshotQuery = useGlowCirculatingSnapshot({
    range: "1w",
    includePartialWeek: true,
    enabled,
  });

  const latestSnapshot = React.useMemo(() => {
    const series = snapshotQuery.data?.series;
    if (!series?.length) return null;
    return series[series.length - 1];
  }, [snapshotQuery.data?.series]);

  const { circulatingSupply, totalSupply, marketCap, glowPrice } =
    React.useMemo(
      () => deriveGlowCirculatingSupplyMetrics(latestSnapshot, spotPrice),
      [latestSnapshot, spotPrice]
    );

  return {
    circulatingSupply,
    totalSupply,
    marketCap,
    glowPrice,
    isLoading: isSpotPriceLoading || snapshotQuery.isLoading,
    isFetching: snapshotQuery.isFetching,
    error: snapshotQuery.error,
    refetchMarketCap: snapshotQuery.refetch,
  };
}
