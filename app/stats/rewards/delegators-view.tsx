"use client";

import React from "react";
import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useFractionsSummary } from "@/hooks/useFractionsSummary";
import { useGlowHolderCount } from "@/hooks/useGlowHolderCount";
import { useYieldPer100 } from "@/hooks/useYieldPer100";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";

export function DelegatorsView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { summary } = useFractionsSummary();
  const { holderCount: glwHolderCount } = useGlowHolderCount();
  const { data, isLoading } = useYieldPer100({ enabled: true });
  const { circulatingSupply } = useGlowCirculatingSupply({ enabled: true });

  const avgGlwPerWeekPer100Delegated = React.useMemo(() => {
    if (!data?.metrics?.glwPerWeekPer100GlwDelegated) return 0;

    return Number(data.metrics.glwPerWeekPer100GlwDelegated) / 1e18;
  }, [data]);

  return (
    <WalletsView
      type="delegator"
      glwSpotPrice={glwSpotPrice}
      networkTotalGlwDelegated={summary?.totalGlwDelegated}
      glwDelegationByEpoch={summary?.glwDelegationByEpoch}
      walletCountByEpoch={summary?.walletCountByEpoch}
      totalContributors={summary?.launchpadContributors}
      glwHolderCount={glwHolderCount}
      weeklyRewardsMetric={avgGlwPerWeekPer100Delegated}
      weeklyRewardsMetricLoading={isLoading}
      circulatingSupply={circulatingSupply}
    />
  );
}
