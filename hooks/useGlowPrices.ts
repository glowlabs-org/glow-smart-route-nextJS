"use client";

import { useQuery } from "@tanstack/react-query";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { useGlowSpotPrice as useLiveGlowSpotPrice } from "@/hooks/useGlowSpotPrice";

interface EdgapPriceResponse {
  currentPriceUsdc: string;
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
const CONTROL_API_BASE = process.env.NEXT_PUBLIC_CONTROL_API_URL;

if (!API_BASE) {
  throw new Error("NEXT_PUBLIC_POSITIONS_API_BASE is not set");
}

if (!CONTROL_API_BASE) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

async function fetchEdgapPrice(): Promise<EdgapPriceResponse | null> {
  try {
    const res = await fetch(`${CONTROL_API_BASE}/price/glw`, {
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

export function useGlowSpotPrice(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const { spotPrice, isLoading, isFetching } = useLiveGlowSpotPrice({
    query: {
      enabled,
      staleTime: 30_000,
      refetchInterval: enabled ? 60_000 : false,
      refetchOnMount: enabled,
      refetchOnWindowFocus: false,
    },
  });

  return {
    spotPrice: Number.isFinite(spotPrice) && spotPrice > 0 ? spotPrice : null,
    isLoading,
    isFetching,
    error: null,
    indexingComplete: true,
  };
}

export function useGlowEdgapPrice(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["glow-edgap-price"],
    queryFn: fetchEdgapPrice,
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnMount: enabled,
    refetchOnWindowFocus: false,
  });

  const price = data?.currentPriceUsdc
    ? parseFloat(data.currentPriceUsdc) / 1e6
    : null;

  return {
    edgapPrice: price,
    isLoading,
    isFetching,
    error,
    indexingComplete: data !== null,
  };
}

export function usePoolActivity(
  range: "hour" | "day" | "7d" = "day",
  interval: "15min" | "hour" | "day" = "hour",
  options?: { enabled?: boolean }
) {
  const { enabled = true } = options ?? {};

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["pool-activity", range, interval],
    queryFn: () => fetchPoolActivity(range, interval),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnMount: enabled,
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
    isFetching,
    error,
    indexingComplete: data?.indexingComplete ?? false,
  };
}

export function useEdgapSeries(
  range: "hour" | "day" | "7d" = "7d",
  options?: { enabled?: boolean }
) {
  const { enabled = true } = options ?? {};

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["edgap-series", range],
    queryFn: () => fetchEdgapSeries(range),
    enabled,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnMount: enabled,
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
    isFetching,
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
export function useGlowPrices(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};

  const spotData = useGlowSpotPrice({ enabled });
  const edgapData = useGlowEdgapPrice({ enabled });

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
    spotPriceFetching: spotData.isFetching,
    spotPriceIndexingComplete: spotData.indexingComplete,

    // Edgap price
    edgapPrice: edgapData.edgapPrice,
    edgapPriceLoading: edgapData.isLoading,
    edgapPriceFetching: edgapData.isFetching,
    edgapPriceIndexingComplete: edgapData.indexingComplete,
    edgapSparkline: [] as number[],
    edgapDelta: null as number | null,
    edgapDeltaPercent: null as number | null,

    // GCTL mint price (derived)
    gctlMintPrice,
    gctlMintSparkline: [] as number[],
    gctlMintDelta: null as number | null,
    gctlMintDeltaPercent: null as number | null,

    // Historical series intentionally omitted until they are sourced from
    // Control/Hub instead of the positions API.
    spotSparkline: [] as number[],
    spotDelta: null as number | null,
    spotDeltaPercent: null as number | null,
    poolActivityLoading: false,
    poolActivityFetching: false,
    poolActivityIndexingComplete: false,

    // Overall loading state
    isLoading: spotData.isLoading || edgapData.isLoading,
  };
}
