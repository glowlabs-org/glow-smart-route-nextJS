"use client";

import React from "react";
import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useFractionsSummary } from "@/hooks";
import { useGlowHolderCount } from "@/hooks/useGlowHolderCount";

export function MinersView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { summary } = useFractionsSummary();
  const { holderCount: glwHolderCount } = useGlowHolderCount();

  return (
    <WalletsView
      type="miner"
      glwSpotPrice={glwSpotPrice}
      walletCountByEpoch={summary?.walletCountByEpoch}
      totalContributors={summary?.miningCenterContributors}
      glwHolderCount={glwHolderCount}
    />
  );
}

