"use client";

import * as React from "react";
import { useActivelyDelegatedByWeek } from "@/hooks/hub-fractions";
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

  const latestWeek =
    typeof latestSnapshot?.week === "number" && Number.isFinite(latestSnapshot.week)
      ? latestSnapshot.week
      : null;

  const delegatedByWeekQuery = useActivelyDelegatedByWeek({
    startWeek: latestWeek ?? undefined,
    endWeek: latestWeek ?? undefined,
    enabled: enabled && latestWeek !== null,
  });

  const delegatedByWeekWei = React.useMemo(() => {
    if (latestWeek === null) return null;
    const byWeek = delegatedByWeekQuery.data?.byWeek;
    if (!byWeek) return null;
    const fromNumericIndex = byWeek[latestWeek];
    if (typeof fromNumericIndex === "string") return fromNumericIndex;

    const fromStringIndex = (byWeek as Record<string, string | undefined>)[
      String(latestWeek)
    ];
    return typeof fromStringIndex === "string" ? fromStringIndex : null;
  }, [delegatedByWeekQuery.data?.byWeek, latestWeek]);

  const isDelegatedNormalizationPending =
    enabled &&
    latestWeek !== null &&
    delegatedByWeekWei === null &&
    !delegatedByWeekQuery.isError &&
    (delegatedByWeekQuery.isLoading || delegatedByWeekQuery.isFetching);

  const derivedMetrics =
    React.useMemo(
      () =>
        deriveGlowCirculatingSupplyMetrics(
          latestSnapshot,
          spotPrice,
          delegatedByWeekWei
        ),
      [delegatedByWeekWei, latestSnapshot, spotPrice]
    );

  const circulatingSupply = isDelegatedNormalizationPending
    ? 0
    : derivedMetrics.circulatingSupply;
  const marketCap = isDelegatedNormalizationPending ? 0 : derivedMetrics.marketCap;
  const totalSupply = derivedMetrics.totalSupply;
  const glowPrice = derivedMetrics.glowPrice;

  const refetchMarketCap = React.useCallback(async () => {
    await Promise.all([
      snapshotQuery.refetch(),
      latestWeek !== null
        ? delegatedByWeekQuery.refetch()
        : Promise.resolve(undefined),
    ]);
  }, [delegatedByWeekQuery, latestWeek, snapshotQuery]);

  const isDelegatedWeekLoading =
    latestWeek !== null && (delegatedByWeekQuery.isLoading || delegatedByWeekQuery.isFetching);

  return {
    circulatingSupply,
    totalSupply,
    marketCap,
    glowPrice,
    isLoading:
      isSpotPriceLoading ||
      snapshotQuery.isLoading ||
      isDelegatedWeekLoading ||
      isDelegatedNormalizationPending,
    isFetching: snapshotQuery.isFetching || delegatedByWeekQuery.isFetching,
    error: snapshotQuery.error ?? delegatedByWeekQuery.error,
    refetchMarketCap,
  };
}
