"use client";

import React from "react";
import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useFractionsSummary } from "@/hooks";
import { useGlowHolderCount } from "@/hooks/useGlowHolderCount";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";

export function DelegatorsView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { summary } = useFractionsSummary();
  const { holderCount: glwHolderCount } = useGlowHolderCount();
  const { circulatingSupply } = useGlowCirculatingSupply({ enabled: true });

  return (
    <WalletsView
      type="delegator"
      glwSpotPrice={glwSpotPrice}
      networkTotalGlwDelegated={summary?.totalGlwDelegated}
      glwDelegationByEpoch={summary?.glwDelegationByEpoch}
      walletCountByEpoch={summary?.walletCountByEpoch}
      glwHolderCount={glwHolderCount}
      circulatingSupply={circulatingSupply}
    />
  );
}
