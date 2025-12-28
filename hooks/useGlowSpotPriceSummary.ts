"use client";

import * as React from "react";

import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { usePoolActivity } from "@/hooks/useGlowPrices";

export interface GlowSpotPriceSummary {
  spotPriceUsd: number;
  deltaPercent24h: number | null;
}

export function useGlowSpotPriceSummary(): GlowSpotPriceSummary {
  const { glowPrice } = useGlowCirculatingSupply();
  const { deltaPercent, currentPrice } = usePoolActivity("day", "hour");

  const spotPriceUsd = React.useMemo(() => {
    if (Number.isFinite(glowPrice) && glowPrice > 0) return glowPrice;
    if (Number.isFinite(currentPrice) && (currentPrice ?? 0) > 0)
      return currentPrice ?? 0;
    return 0;
  }, [currentPrice, glowPrice]);

  const deltaPercent24h = React.useMemo(() => {
    if (deltaPercent === null) return null;
    if (!Number.isFinite(deltaPercent as number)) return null;
    return deltaPercent as number;
  }, [deltaPercent]);

  return { spotPriceUsd: spotPriceUsd, deltaPercent24h };
}


