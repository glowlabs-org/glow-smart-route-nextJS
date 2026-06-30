"use client";

import React from "react";
import { useRewardScore } from "@/hooks/control-farms";
import type { AuctionApplication, SplitActivity } from "@/hooks/hub-listings";
import { useGlowLaunchpad } from "@/hooks/hub-listings";
import {
  attachEstimatedWeeklyLaunchpadRewards,
  deriveLaunchpadSponsorshipsInProgress,
} from "@/utils/sponsorships-in-progress";
import {
  buildCurrentLaunchpadCurrencyByFarmId,
  buildLaunchpadCurrenciesByFarmId,
  buildLaunchpadDelegatedAmountsByFarmId,
} from "@/utils/wallet-launchpad";

export function useWalletLaunchpadInProgress(params: {
  splitsActivity: SplitActivity[];
  walletAddress?: string | null;
  enabled?: boolean;
}) {
  const { splitsActivity, walletAddress, enabled = true } = params;
  const shouldLoad = enabled && splitsActivity.length > 0;

  const {
    applications: sponsorListings,
    isLoading: isSponsorListingsLoading,
    isError: isSponsorListingsError,
  } = useGlowLaunchpad({
    enabled: shouldLoad,
  });

  const sponsorListingById = React.useMemo(() => {
    const map = new Map<string, AuctionApplication>();
    for (const app of sponsorListings) {
      map.set(app.id, app);
    }
    return map;
  }, [sponsorListings]);

  const sponsorshipsInProgress = React.useMemo(() => {
    return deriveLaunchpadSponsorshipsInProgress({
      splitsActivity,
      sponsorListings,
    });
  }, [splitsActivity, sponsorListings]);

  const applicationsForRewards = React.useMemo(() => {
    return sponsorshipsInProgress
      .map((item) => item.application)
      .filter((app): app is AuctionApplication => app !== null);
  }, [sponsorshipsInProgress]);

  // Two-map model (matches launchpad-view / launchpad-status-widget): force GLW
  // for the GLW map and SGCTL for the SGCTL map. WITHOUT forceCurrency,
  // resolveRewardScorePaymentCurrency() resolves a dual-leg listing
  // (activeFraction.sgctl != null) to SGCTL on BOTH calls, so the "GLW" map
  // carries the sGCTL leg's userWeeklyPdRewards in GCTL 6-decimal units. Parsed
  // as 18-decimal GLW that PD collapses to ~0, dropping the GLW PD recovery
  // (~16.7/unit) from a GLW-delegated in-progress card's EST. WEEKLY.
  const {
    rewardScoreMap,
    isLoading: isRewardScoresLoading,
    isError: isRewardScoresError,
  } = useRewardScore({
    applications: applicationsForRewards,
    paymentCurrency: "GLW",
    forceCurrency: "GLW",
    enabled: shouldLoad && applicationsForRewards.length > 0,
    walletAddress: walletAddress ?? null,
  });

  const {
    rewardScoreMap: sgctlRewardScoreMap,
    isLoading: isSgctlRewardScoresLoading,
  } = useRewardScore({
    applications: applicationsForRewards,
    paymentCurrency: "SGCTL",
    forceCurrency: "SGCTL",
    enabled: shouldLoad && applicationsForRewards.length > 0,
    walletAddress: walletAddress ?? null,
  });

  const sponsorshipsInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyLaunchpadRewards({
      sponsorshipsInProgress,
      rewardScoreMap,
      rewardScoreMapByCurrency: {
        GLW: rewardScoreMap,
        SGCTL: sgctlRewardScoreMap,
      },
    }).sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0));
  }, [rewardScoreMap, sgctlRewardScoreMap, sponsorshipsInProgress]);

  const currentLaunchpadCurrencyByFarmId = React.useMemo(() => {
    return buildCurrentLaunchpadCurrencyByFarmId(sponsorListings);
  }, [sponsorListings]);

  const launchpadCurrenciesByFarmId = React.useMemo(() => {
    return buildLaunchpadCurrenciesByFarmId({
      splitsActivity,
      sponsorListingById,
    });
  }, [splitsActivity, sponsorListingById]);

  const launchpadDelegatedAmountsByFarmId = React.useMemo(() => {
    return buildLaunchpadDelegatedAmountsByFarmId({
      splitsActivity,
      sponsorListingById,
    });
  }, [splitsActivity, sponsorListingById]);

  return {
    sponsorListings,
    sponsorListingById,
    sponsorshipsInProgress,
    sponsorshipsInProgressWithEstimates,
    currentLaunchpadCurrencyByFarmId,
    launchpadCurrenciesByFarmId,
    launchpadDelegatedAmountsByFarmId,
    isSponsorListingsLoading,
    isSponsorListingsError,
    isRewardScoresLoading,
    isRewardScoresError,
    isSgctlRewardScoresLoading,
  } as const;
}
