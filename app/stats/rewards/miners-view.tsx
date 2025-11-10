"use client";

import React from "react";
import Decimal from "decimal.js";
import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useFractionsSummary } from "@/hooks/useFractionsSummary";
import { useGlowHolderCount } from "@/hooks/useGlowHolderCount";
import { useWalletsActivity } from "@/hooks/useWalletsActivity";

export function MinersView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { summary } = useFractionsSummary();
  const { holderCount: glwHolderCount } = useGlowHolderCount();
  const { data: walletsData, isLoading } = useWalletsActivity({
    type: "miner",
    limit: 1000,
    enabled: true,
  });

  const avgGlwPerWeekPer100Dollars = React.useMemo(() => {
    if (!walletsData?.wallets.length || !walletsData?.weekRange) return 0;

    const { weekRange, wallets } = walletsData;
    const weeksInRange = weekRange.endWeek - weekRange.startWeek + 1;

    if (weeksInRange === 0) return 0;

    let totalUsdcSpent = new Decimal(0);
    let totalRewards = new Decimal(0);

    wallets.forEach((wallet) => {
      totalUsdcSpent = totalUsdcSpent.plus(wallet.usdcSpentOnMiners);
      totalRewards = totalRewards.plus(wallet.minerRewardsEarned);
    });

    if (totalUsdcSpent.isZero()) return 0;

    const glwPerWeekPerDollar = totalRewards
      .div(1e18)
      .div(totalUsdcSpent.div(1e6))
      .div(weeksInRange)
      .toNumber();

    return glwPerWeekPerDollar * 100;
  }, [walletsData]);

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

