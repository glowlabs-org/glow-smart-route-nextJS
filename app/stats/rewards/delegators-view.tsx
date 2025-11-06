"use client";

import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useFractionsSummary } from "@/hooks/useFractionsSummary";

export function DelegatorsView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { summary } = useFractionsSummary();

  return (
    <WalletsView
      type="delegator"
      glwSpotPrice={glwSpotPrice}
      networkTotalGlwDelegated={summary?.totalGlwDelegated}
      glwDelegationByEpoch={summary?.glwDelegationByEpoch}
      walletCountByEpoch={summary?.walletCountByEpoch}
      totalContributors={summary?.launchpadContributors}
    />
  );
}
