import { formatUnits } from "viem";
import type { AuctionApplication, SplitActivity } from "@/hooks/hub-listings";
import type { ApplicationRewardScore } from "@/hooks/control-farms";
import type { ApplicationMiningScore } from "@/hooks/control-farms";

export interface SponsorshipInProgress {
  applicationId: string;
  application: AuctionApplication | null;
  fractionType: "launchpad" | "mining-center";
  userSteps: number;
  progressPercent: number;
}

export interface SponsorshipInProgressWithEstimate extends SponsorshipInProgress {
  estimatedUserWeeklyGlw: number;
}

function safeParseGlwFromWeiString(value: string): number {
  try {
    return Number.parseFloat(formatUnits(BigInt(value), 18));
  } catch {
    return 0;
  }
}

function deriveInProgress(params: {
  splitsActivity: SplitActivity[];
  sponsorListings: AuctionApplication[];
  fractionType: "launchpad" | "mining-center";
}): SponsorshipInProgress[] {
  const { splitsActivity, sponsorListings, fractionType } = params;
  if (!splitsActivity.length) return [];

  const byApp = new Map<
    string,
    { application: AuctionApplication | null; userSteps: number; progressPercent: number }
  >();

  for (const evt of splitsActivity) {
    if (evt.fractionType !== fractionType) continue;

    const app = sponsorListings.find((a) => a.id === evt.applicationId) ?? null;
    const isFilled = app?.activeFraction?.isFilled ?? evt.isFilled;
    if (isFilled) continue;

    const key = evt.applicationId;
    const existing = byApp.get(key);
    const progress = app?.activeFraction?.progressPercent ?? evt.progressPercent ?? 0;
    byApp.set(key, {
      application: app,
      userSteps: (existing?.userSteps ?? 0) + (evt.stepsPurchased ?? 0),
      progressPercent: progress,
    });
  }

  return Array.from(byApp.entries())
    .map(([applicationId, data]) => ({
      applicationId,
      fractionType,
      ...data,
    }))
    .filter((item) => item.userSteps > 0);
}

/**
 * Launchpad delegations: estimate user weekly GLW as:
 * (weekly farm rewards / total steps) * user steps
 */
export function attachEstimatedWeeklyLaunchpadRewards(params: {
  sponsorshipsInProgress: SponsorshipInProgress[];
  rewardScoreMap: Map<string, ApplicationRewardScore>;
}): SponsorshipInProgressWithEstimate[] {
  const { sponsorshipsInProgress, rewardScoreMap } = params;
  if (!sponsorshipsInProgress.length) return [];

  return sponsorshipsInProgress.map((item) => {
    const totalSteps = item.application?.activeFraction?.totalSteps ?? null;
    const rewardScore = rewardScoreMap.get(item.applicationId) ?? null;

    const estimatedUserWeeklyGlw = (() => {
      if (!rewardScore) return 0;
      if (typeof totalSteps !== "number" || totalSteps <= 0) return 0;
      if (!item.userSteps || item.userSteps <= 0) return 0;

      const glwRewards = safeParseGlwFromWeiString(rewardScore.userWeeklyGlwRewards);
      const pdRewards = safeParseGlwFromWeiString(rewardScore.userWeeklyPdRewards);
      const totalRewards = glwRewards + pdRewards;
      if (!Number.isFinite(totalRewards) || totalRewards <= 0) return 0;

      const rewardsPerShare = totalRewards / totalSteps;
      if (!Number.isFinite(rewardsPerShare) || rewardsPerShare <= 0) return 0;

      const estimated = rewardsPerShare * item.userSteps;
      if (!Number.isFinite(estimated) || estimated <= 0) return 0;
      return estimated;
    })();

    return { ...item, estimatedUserWeeklyGlw };
  });
}

/**
 * Mining center: `weeklyGlwRewards` is "weekly rewards per miner" (see mining center UI),
 * so estimate user weekly GLW as: rewardsPerMiner * user miners purchased.
 */
export function attachEstimatedWeeklyMiningCenterRewards(params: {
  sponsorshipsInProgress: SponsorshipInProgress[];
  miningScoreMap: Map<string, ApplicationMiningScore>;
}): SponsorshipInProgressWithEstimate[] {
  const { sponsorshipsInProgress, miningScoreMap } = params;
  if (!sponsorshipsInProgress.length) return [];

  return sponsorshipsInProgress.map((item) => {
    const miningScore = miningScoreMap.get(item.applicationId) ?? null;

    const estimatedUserWeeklyGlw = (() => {
      if (!miningScore?.weeklyGlwRewards) return 0;
      if (!item.userSteps || item.userSteps <= 0) return 0;

      const rewardsPerMiner = safeParseGlwFromWeiString(miningScore.weeklyGlwRewards);
      if (!Number.isFinite(rewardsPerMiner) || rewardsPerMiner <= 0) return 0;

      const est = rewardsPerMiner * item.userSteps;
      if (!Number.isFinite(est) || est <= 0) return 0;
      return est;
    })();

    return { ...item, estimatedUserWeeklyGlw };
  });
}

export function getAggregatedEstimatedWeeklyGlw(
  items: SponsorshipInProgressWithEstimate[]
): number {
  return items.reduce((acc, item) => acc + (item.estimatedUserWeeklyGlw || 0), 0);
}

export function deriveLaunchpadSponsorshipsInProgress(params: {
  splitsActivity: SplitActivity[];
  sponsorListings: AuctionApplication[];
}): SponsorshipInProgress[] {
  return deriveInProgress({ ...params, fractionType: "launchpad" });
}

export function deriveMiningCenterSponsorshipsInProgress(params: {
  splitsActivity: SplitActivity[];
  sponsorListings: AuctionApplication[];
}): SponsorshipInProgress[] {
  return deriveInProgress({ ...params, fractionType: "mining-center" });
}



