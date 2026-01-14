"use client";

import React from "react";
import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import {
  useFractionsSummary,
  useTotalActivelyDelegated,
  useActivelyDelegatedByWeek,
} from "@/hooks";
import { useGlowHolderCount } from "@/hooks/useGlowHolderCount";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";

export function DelegatorsView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { summary } = useFractionsSummary();
  const {
    data: totalActivelyDelegatedData,
    isLoading: isTotalActivelyDelegatedLoading,
  } = useTotalActivelyDelegated();
  const {
    data: activelyDelegatedByWeekData,
    isLoading: isActivelyDelegatedByWeekLoading,
  } = useActivelyDelegatedByWeek();
  const { holderCount: glwHolderCount } = useGlowHolderCount();
  const { circulatingSupply } = useGlowCirculatingSupply({ enabled: true });

  // Use current week data from new endpoint (week 112) instead of summary (historical purchases)
  const networkTotal = totalActivelyDelegatedData?.totalGlwDelegatedWei;

  return (
    <WalletsView
      type="delegator"
      glwSpotPrice={glwSpotPrice}
      networkTotalGlwDelegated={networkTotal}
      isLoadingNetworkTotal={isTotalActivelyDelegatedLoading}
      glwDelegationByEpoch={
        activelyDelegatedByWeekData?.byWeek || summary?.glwDelegationByEpoch
      }
      isLoadingDelegationByEpoch={isActivelyDelegatedByWeekLoading}
      walletCountByEpoch={summary?.walletCountByEpoch}
      glwHolderCount={glwHolderCount}
      circulatingSupply={circulatingSupply}
    />
  );
}
