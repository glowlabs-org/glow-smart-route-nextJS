"use client";

import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useFractionsSummary } from "@/hooks/useFractionsSummary";

export function MinersView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { summary } = useFractionsSummary();
  
  return (
    <WalletsView
      type="miner"
      glwSpotPrice={glwSpotPrice}
      walletCountByEpoch={summary?.walletCountByEpoch}
      totalContributors={summary?.miningCenterContributors}
    />
  );
}

