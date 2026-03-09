import type { AuctionApplication, SplitActivity } from "@/hooks/hub-listings";
import type { ApplicationRewardScore } from "@/hooks/control-farms";
import type { ApplicationMiningScore } from "@/lib/mining-score";
import {
  calculateLaunchpadPerShareRewards,
  parseTokenAmountFromBaseUnits,
  resolveDelegationCurrency,
} from "@/utils/launchpad-rewards";

export interface SponsorshipInProgress {
  applicationId: string;
  application: AuctionApplication | null;
  fractionType: "launchpad" | "mining-center";
  userSteps: number;
  progressPercent: number;
}

export interface SponsorshipInProgressWithEstimate
  extends SponsorshipInProgress {
  estimatedUserWeeklyGlw: number;
  estimatedUserWeeklyUsd?: number;
  delegationCurrency?: "GLW" | "SGCTL";
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
    {
      application: AuctionApplication | null;
      userSteps: number;
      progressPercent: number;
    }
  >();

  for (const evt of splitsActivity) {
    if (evt.fractionType !== fractionType) continue;

    const status = (evt.fractionStatus ?? "").toLowerCase();
    if (status !== "committed") continue;

    const app = sponsorListings.find((a) => a.id === evt.applicationId) ?? null;
    const progress =
      app?.activeFraction?.progressPercent ?? evt.progressPercent ?? 0;
    const isFilled =
      Boolean(app?.activeFraction?.isFilled) ||
      Boolean(evt.isFilled) ||
      Boolean(evt.fractionStatus === "filled") ||
      progress >= 100;
    if (isFilled) continue;

    const key = evt.applicationId;
    const existing = byApp.get(key);
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
    const delegationCurrency = resolveDelegationCurrency(item.application);

    const { estimatedUserWeeklyGlw, estimatedUserWeeklyUsd } = (() => {
      if (!rewardScore) {
        return { estimatedUserWeeklyGlw: 0, estimatedUserWeeklyUsd: 0 };
      }
      if (typeof totalSteps !== "number" || totalSteps <= 0) {
        return { estimatedUserWeeklyGlw: 0, estimatedUserWeeklyUsd: 0 };
      }
      if (!item.userSteps || item.userSteps <= 0) {
        return { estimatedUserWeeklyGlw: 0, estimatedUserWeeklyUsd: 0 };
      }

      const perShare = calculateLaunchpadPerShareRewards({
        reward: rewardScore,
        totalShares: totalSteps,
        delegationCurrency,
      });

      const estimatedGlw = perShare.totalGlwPerShare * item.userSteps;
      const estimatedUsd = perShare.totalUsdPerShare * item.userSteps;

      return {
        estimatedUserWeeklyGlw:
          Number.isFinite(estimatedGlw) && estimatedGlw > 0 ? estimatedGlw : 0,
        estimatedUserWeeklyUsd:
          Number.isFinite(estimatedUsd) && estimatedUsd > 0 ? estimatedUsd : 0,
      };
    })();

    return {
      ...item,
      estimatedUserWeeklyGlw,
      estimatedUserWeeklyUsd,
      delegationCurrency,
    };
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

      const rewardsPerMiner = parseTokenAmountFromBaseUnits(
        miningScore.weeklyGlwRewards,
        18
      );
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
  return items.reduce(
    (acc, item) => acc + (item.estimatedUserWeeklyGlw || 0),
    0
  );
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
