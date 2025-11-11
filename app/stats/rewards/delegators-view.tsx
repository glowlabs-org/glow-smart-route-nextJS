"use client";

import React from "react";
import Decimal from "decimal.js";
import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useFractionsSummary } from "@/hooks/useFractionsSummary";
import { useGlowHolderCount } from "@/hooks/useGlowHolderCount";
import { useFarmsPerPieceStats } from "@/hooks/useFarmsPerPieceStats";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";

export function DelegatorsView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { summary } = useFractionsSummary();
  const { holderCount: glwHolderCount } = useGlowHolderCount();
  const { data, isLoading } = useFarmsPerPieceStats({ enabled: true });
  const { circulatingSupply } = useGlowCirculatingSupply({ enabled: true });

  const avgGlwPerWeekPer100Delegated = React.useMemo(() => {
    if (!data?.farms) return 0;

    let totalDelegatorRewards = new Decimal(0);
    let totalDelegatorInvested = new Decimal(0);
    let totalDelegatorWeeks = 0;
    let delegatorFarmsCount = 0;

    data.farms.forEach((farm) => {
      if (farm.delegator.stepsSold > 0) {
        const totalRewards = new Decimal(
          farm.delegator.rewardsPerPiece?.total?.allWeeks || "0"
        ).times(farm.delegator.stepsSold);

        totalDelegatorRewards = totalDelegatorRewards.plus(totalRewards);

        totalDelegatorInvested = totalDelegatorInvested.plus(
          new Decimal(farm.delegator.weightedPieceSizeGlw || "0").times(
            farm.delegator.stepsSold
          )
        );

        totalDelegatorWeeks += farm.delegator.weeksEarned;
        delegatorFarmsCount += 1;
      }
    });

    const avgDelegatorWeeksEarned =
      delegatorFarmsCount > 0 ? totalDelegatorWeeks / delegatorFarmsCount : 1;
    const avgGlwPerWeekPerGlwDelegated =
      totalDelegatorInvested.isZero() || avgDelegatorWeeksEarned === 0
        ? 0
        : totalDelegatorRewards
            .div(totalDelegatorInvested)
            .div(avgDelegatorWeeksEarned)
            .toNumber();

    return avgGlwPerWeekPerGlwDelegated * 100;
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
