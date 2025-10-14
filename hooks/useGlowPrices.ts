"use client";

import { useQuery } from "@tanstack/react-query";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";

interface SpotPriceResponse {
  spotPrice: string;
  indexingComplete: boolean;
}

interface EdgapPriceResponse {
  edgap: {
    halfLives: {
      "100h": string;
    };
    states: {
      "100h": {
        zeroPerLiquidityWAD: string;
        onePerLiquidityWAD: string;
        lastUpdatedTimestamp: string;
        glowPrice: string;
      };
    };
  };
  indexingComplete: boolean;
}

interface PoolActivityBucket {
  timestamp: number;
  swaps: number;
  glowIn: string;
  glowOut: string;
  usdgIn: string;
  usdgOut: string;
  vwap: string;
}

interface PoolActivityResponse {
  interval: string;
  indexingComplete: boolean;
  buckets: PoolActivityBucket[];
}

interface EdgapSeriesItem {
  timestamp: number;
  edgapPrice: string;
  reserve0: string;
  reserve1: string;
}

interface EdgapSeriesResponse {
  range: string;
  indexingComplete: boolean;
  edgapSeries: EdgapSeriesItem[];
}

const API_BASE = process.env.NEXT_PUBLIC_POSITIONS_API_BASE;

if (!API_BASE) {
  throw new Error("NEXT_PUBLIC_POSITIONS_API_BASE is not set");
}

async function fetchSpotPrice(): Promise<SpotPriceResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/spot-price`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Error fetching spot price:", error);
    return null;
  }
}

async function fetchEdgapPrice(): Promise<EdgapPriceResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/get-edgaps`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Error fetching edgap price:", error);
    return null;
  }
}

async function fetchPoolActivity(
  range: "hour" | "day" | "7d" = "7d",
  interval: "15min" | "hour" | "day" = "hour"
): Promise<PoolActivityResponse | null> {
  try {
    const res = await fetch(
      `${API_BASE}/get-pool-activity?range=${range}&interval=${interval}`,
      {
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Error fetching pool activity:", error);
    return null;
  }
}

async function fetchEdgapSeries(
  range: "hour" | "day" | "7d" = "7d"
): Promise<EdgapSeriesResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/get-edgap-series?range=${range}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Error fetching edgap series:", error);
    return null;
  }
}

export function useGlowSpotPrice() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["glow-spot-price"],
    queryFn: fetchSpotPrice,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Refetch every 60 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const price = data?.spotPrice ? parseFloat(data.spotPrice) : null;

  return {
    spotPrice: price,
    isLoading,
    error,
    indexingComplete: data?.indexingComplete ?? false,
  };
}

export function useGlowEdgapPrice() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["glow-edgap-price"],
    queryFn: fetchEdgapPrice,
    staleTime: 10_000,
    refetchInterval: 60_000, // Refetch every minute (edgap updates slower)
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const price = data?.edgap?.states?.["100h"]?.glowPrice
    ? parseFloat(data.edgap.states["100h"].glowPrice)
    : null;

  return {
    edgapPrice: price,
    isLoading,
    error,
    indexingComplete: data?.indexingComplete ?? false,
  };
}

export function usePoolActivity(
  range: "hour" | "day" | "7d" = "day",
  interval: "15min" | "hour" | "day" = "hour"
) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pool-activity", range, interval],
    queryFn: () => fetchPoolActivity(range, interval),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Calculate sparkline from VWAP data
  // For 7 days of hourly data, sample evenly to get ~24 points for a nice chart
  const bucketsWithActivity = data?.buckets?.filter((b) => b.swaps > 0) ?? [];

  const sparkline =
    bucketsWithActivity.length > 0
      ? bucketsWithActivity
          .filter((_, i) => {
            // Sample every nth bucket to get ~24 points
            const samplingInterval = Math.max(
              1,
              Math.floor(bucketsWithActivity.length / 24)
            );
            return i % samplingInterval === 0;
          })
          .map((b) => parseFloat(b.vwap))
      : [];

  // Calculate 7-day delta (first vs last point in sparkline)
  const currentPrice =
    sparkline.length > 0 ? sparkline[sparkline.length - 1] : null;
  const previousPrice = sparkline.length > 0 ? sparkline[0] : null;
  const delta =
    currentPrice !== null && previousPrice !== null
      ? currentPrice - previousPrice
      : null;
  const deltaPercent =
    delta !== null && previousPrice !== null && previousPrice !== 0
      ? (delta / previousPrice) * 100
      : null;

  return {
    buckets: data?.buckets ?? [],
    sparkline,
    currentPrice,
    delta,
    deltaPercent,
    isLoading,
    error,
    indexingComplete: data?.indexingComplete ?? false,
  };
}

export function useEdgapSeries(range: "hour" | "day" | "7d" = "7d") {
  const { data, isLoading, error } = useQuery({
    queryKey: ["edgap-series", range],
    queryFn: () => fetchEdgapSeries(range),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const series = data?.edgapSeries ?? [];

  // Build EDGAP sparkline sampled to ~24 points for readability
  const edgapValues = series
    .map((p) => parseFloat(p.edgapPrice))
    .filter((n) => Number.isFinite(n));
  const edgapSparkline =
    edgapValues.length > 0
      ? edgapValues.filter((_, i) => {
          const samplingInterval = Math.max(
            1,
            Math.floor(edgapValues.length / 24)
          );
          return i % samplingInterval === 0;
        })
      : [];

  const edgapCurrent =
    edgapValues.length > 0 ? edgapValues[edgapValues.length - 1] : null;
  const edgapStart = edgapValues.length > 0 ? edgapValues[0] : null;
  const edgapDelta =
    edgapCurrent !== null && edgapStart !== null
      ? edgapCurrent - edgapStart
      : null;
  const edgapDeltaPercent =
    edgapDelta !== null && edgapStart ? (edgapDelta / edgapStart) * 100 : null;

  // Derive GCTL mint series using protocol formula:
  // GCTL = ceil(sqrt(GLW_PRICE) / 0.05) * 0.05
  // This rounds up to the nearest 5 cents
  const gctlValues = edgapValues.map((glwPrice) => {
    const sqrtPrice = Math.sqrt(glwPrice);
    const roundedUpToFiveCents = Math.ceil(sqrtPrice / 0.05) * 0.05;
    return roundedUpToFiveCents;
  });

  const gctlSparkline =
    gctlValues.length > 0
      ? gctlValues.filter((_, i) => {
          const samplingInterval = Math.max(
            1,
            Math.floor(gctlValues.length / 24)
          );
          return i % samplingInterval === 0;
        })
      : [];

  const gctlCurrent =
    gctlValues.length > 0 ? gctlValues[gctlValues.length - 1] : null;
  const gctlStart = gctlValues.length > 0 ? gctlValues[0] : null;
  const gctlDelta =
    gctlCurrent !== null && gctlStart !== null ? gctlCurrent - gctlStart : null;
  const gctlDeltaPercent =
    gctlDelta !== null && gctlStart ? (gctlDelta / gctlStart) * 100 : null;

  return {
    // Raw
    series,
    isLoading,
    error,
    indexingComplete: data?.indexingComplete ?? false,

    // EDGAP derived
    edgapSparkline,
    edgapCurrent,
    edgapDelta,
    edgapDeltaPercent,

    // GCTL derived
    gctlSparkline,
    gctlCurrent,
    gctlDelta,
    gctlDeltaPercent,
  };
}

// Composite hook that returns all price data
export function useGlowPrices() {
  const spotData = useGlowSpotPrice();
  const edgapData = useGlowEdgapPrice();
  const poolActivity = usePoolActivity("7d", "15min");
  const edgapSeries = useEdgapSeries("7d");

  // Calculate GCTL mint price using protocol formula:
  // GCTL = ceil(sqrt(GLW_PRICE) / 0.05) * 0.05
  // This rounds up to the nearest 5 cents
  const calculateGctlPrice = (glwPrice: number | null) => {
    if (glwPrice === null || glwPrice === undefined) return null;
    const sqrtPrice = Math.sqrt(glwPrice);
    const roundedUpToFiveCents = Math.ceil(sqrtPrice / 0.05) * 0.05;
    return roundedUpToFiveCents;
  };

  const gctlMintPrice =
    edgapData.edgapPrice !== null && edgapData.edgapPrice !== undefined
      ? calculateGctlPrice(edgapData.edgapPrice)
      : spotData.spotPrice !== null
      ? calculateGctlPrice(spotData.spotPrice)
      : null;

  return {
    // Spot price
    spotPrice: spotData.spotPrice,
    spotPriceLoading: spotData.isLoading,
    spotPriceIndexingComplete: spotData.indexingComplete,

    // Edgap price
    edgapPrice: edgapData.edgapPrice,
    edgapPriceLoading: edgapData.isLoading,
    edgapPriceIndexingComplete: edgapData.indexingComplete,
    edgapSparkline: edgapSeries.edgapSparkline,
    edgapDelta: edgapSeries.edgapDelta,
    edgapDeltaPercent: edgapSeries.edgapDeltaPercent,

    // GCTL mint price (derived)
    gctlMintPrice,
    gctlMintSparkline: edgapSeries.gctlSparkline,
    gctlMintDelta: edgapSeries.gctlDelta,
    gctlMintDeltaPercent: edgapSeries.gctlDeltaPercent,

    // Pool activity for sparklines
    spotSparkline: poolActivity.sparkline,
    spotDelta: poolActivity.delta,
    spotDeltaPercent: poolActivity.deltaPercent,
    poolActivityLoading: poolActivity.isLoading,
    poolActivityIndexingComplete: poolActivity.indexingComplete,

    // Overall loading state
    isLoading:
      spotData.isLoading ||
      edgapData.isLoading ||
      poolActivity.isLoading ||
      edgapSeries.isLoading,
  };
}
