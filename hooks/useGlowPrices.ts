"use client";

import { useQuery } from "@tanstack/react-query";
import { useGlowSpotPrice as useLiveGlowSpotPrice } from "@/hooks/useGlowSpotPrice";

interface EdgapPriceResponse {
  currentPriceUsdc: string;
}

async function fetchEdgapPrice(): Promise<EdgapPriceResponse | null> {
  try {
    const res = await fetch("/api/control/glw-price");
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Error fetching edgap price:", error);
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
