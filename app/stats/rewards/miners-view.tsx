"use client";

import React from "react";
import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useFractionsSummary } from "@/hooks";
import { useGlowHolderCount } from "@/hooks/useGlowHolderCount";
import { useYieldPer100 } from "@/hooks";

export function MinersView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { summary } = useFractionsSummary();
  const { holderCount: glwHolderCount } = useGlowHolderCount();
  const { data, isLoading } = useYieldPer100({ enabled: true });

  const avgGlwPerWeekPer100Dollars = React.useMemo(() => {
    if (!data?.metrics?.glwPerWeekPer100UsdMiner) return 0;

    return Number(data.metrics.glwPerWeekPer100UsdMiner) / 1e18;
  }, [data]);

  return (
    <WalletsView
      type="miner"
      glwSpotPrice={glwSpotPrice}
      walletCountByEpoch={summary?.walletCountByEpoch}
      totalContributors={summary?.miningCenterContributors}
      glwHolderCount={glwHolderCount}
      weeklyRewardsMetric={avgGlwPerWeekPer100Dollars}
      weeklyRewardsMetricLoading={isLoading}
    />
  );
}

