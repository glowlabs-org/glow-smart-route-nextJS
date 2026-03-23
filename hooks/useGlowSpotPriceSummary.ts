"use client";

import * as React from "react";

import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";

export interface GlowSpotPriceSummary {
  spotPriceUsd: number;
  deltaPercent24h: number | null;
}

export function useGlowSpotPriceSummary(): GlowSpotPriceSummary {
  const { glowPrice } = useGlowCirculatingSupply();

  const spotPriceUsd = React.useMemo(() => {
    return Number.isFinite(glowPrice) && glowPrice > 0 ? glowPrice : 0;
  }, [glowPrice]);

  return { spotPriceUsd: spotPriceUsd, deltaPercent24h: null };
}

