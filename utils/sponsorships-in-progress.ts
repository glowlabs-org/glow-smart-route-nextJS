import type { AuctionApplication, SplitActivity } from "@/hooks/hub-listings";
import type { ApplicationRewardScore } from "@/hooks/control-farms";
import type { ApplicationMiningScore } from "@/lib/mining-score";
import {
  calculateLaunchpadPerShareRewards,
  normalizeDelegationCurrency,
  parseTokenAmountFromBaseUnits,
  parseUsd6Amount,
  resolveLaunchpadDelegationUnitCount,
  resolveDelegationCurrencyFromSplitActivity,
  resolveDelegationCurrency,
  type DelegationCurrency,
} from "@/utils/launchpad-rewards";
import { isSplitActivityStillActive } from "@/utils/wallet-launchpad";

export interface SponsorshipInProgress {
  applicationId: string;
  application: AuctionApplication | null;
  fractionType: "launchpad" | "mining-center";
  userSteps: number;
  progressPercent: number;
  delegationCurrency?: DelegationCurrency;
}

export interface SponsorshipInProgressWithEstimate
  extends SponsorshipInProgress {
  estimatedUserWeeklyGlw: number;
  estimatedUserWeeklyUsd?: number;
  estimatedUserWeeklyPd?: number;
  estimatedUserWeeklyPdAsset?: DelegationCurrency | null;
  delegationCurrency?: "GLW" | "SGCTL";
}

export function estimateMiningCenterWeeklyGlw(params: {
  miningScore: ApplicationMiningScore | null | undefined;
  userSteps: number;
}): number {
  const { miningScore, userSteps } = params;

  if (!miningScore?.weeklyGlwRewards) return 0;
  if (!userSteps || userSteps <= 0) return 0;

  const rewardsPerMiner = parseTokenAmountFromBaseUnits(
    miningScore.weeklyGlwRewards,
    18
  );
  if (!Number.isFinite(rewardsPerMiner) || rewardsPerMiner <= 0) return 0;

  const estimated = rewardsPerMiner * userSteps;
  if (!Number.isFinite(estimated) || estimated <= 0) return 0;

  return estimated;
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
      delegationCurrency?: DelegationCurrency;
    }
  >();

  for (const evt of splitsActivity) {
    if (evt.fractionType !== fractionType) continue;

    const app = sponsorListings.find((a) => a.id === evt.applicationId) ?? null;
    if (!isSplitActivityStillActive({ split: evt, listing: app })) continue;
    const progress =
      app?.activeFraction?.progressPercent ?? evt.progressPercent ?? 0;

    const delegationCurrency =
      fractionType === "launchpad"
        ? resolveDelegationCurrencyFromSplitActivity({
            currency: evt.currency,
            amount: evt.amount,
            stepPrice: evt.stepPrice,
            transactionHash: evt.transactionHash,
            application: app,
          })
        : undefined;
    const key =
      fractionType === "launchpad"
        ? evt.activityAssetKey ?? `${evt.applicationId}:${delegationCurrency}`
        : evt.applicationId;
    const existing = byApp.get(key);
    byApp.set(key, {
      application: app,
      userSteps: (existing?.userSteps ?? 0) + (evt.stepsPurchased ?? 0),
      progressPercent: progress,
      delegationCurrency,
    });
  }

  return Array.from(byApp.entries())
    .map(([key, data]) => ({
      applicationId: key.split(":")[0],
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
  rewardScoreMapByCurrency?: Partial<
    Record<DelegationCurrency, Map<string, ApplicationRewardScore>>
  >;
}): SponsorshipInProgressWithEstimate[] {
  const { sponsorshipsInProgress, rewardScoreMap, rewardScoreMapByCurrency } =
    params;
  if (!sponsorshipsInProgress.length) return [];

  return sponsorshipsInProgress.map((item) => {
    const currentCurrency = resolveDelegationCurrency(item.application);
    const delegationCurrency = item.delegationCurrency ?? currentCurrency;
    // Divide the farm reward by the GLW unit count (deposit / GLW step), NOT the
    // dual-leg listing's sGCTL share count. Without the currency override,
    // resolveDelegationCurrency() returns SGCTL for dual-leg listings, which
    // divides by ~11x too many shares and badly understates EST. WEEKLY REWARDS
    // (~19 instead of ~215 GLW for 7 units). Mirrors the deposit dialog.
    const totalSteps =
      item.application != null
        ? resolveLaunchpadDelegationUnitCount(item.application, delegationCurrency)
        : null;
    const preferredRewardScoreMap =
      rewardScoreMapByCurrency?.[delegationCurrency] ?? rewardScoreMap;
    const fallbackRewardScoreMap =
      rewardScoreMapByCurrency?.[currentCurrency] ?? rewardScoreMap;
    const rewardScore =
      preferredRewardScoreMap.get(item.applicationId) ??
      fallbackRewardScoreMap.get(item.applicationId) ??
      null;
    const isFallbackDifferentCurrency =
      preferredRewardScoreMap !== fallbackRewardScoreMap &&
      !preferredRewardScoreMap.has(item.applicationId) &&
      fallbackRewardScoreMap.has(item.applicationId);

    const {
      estimatedUserWeeklyGlw,
      estimatedUserWeeklyUsd,
      estimatedUserWeeklyPd,
      estimatedUserWeeklyPdAsset,
    } = (() => {
      if (!rewardScore) {
        return {
          estimatedUserWeeklyGlw: 0,
          estimatedUserWeeklyUsd: 0,
          estimatedUserWeeklyPd: 0,
          estimatedUserWeeklyPdAsset: null,
        };
      }
      if (typeof totalSteps !== "number" || totalSteps <= 0) {
        return {
          estimatedUserWeeklyGlw: 0,
          estimatedUserWeeklyUsd: 0,
          estimatedUserWeeklyPd: 0,
          estimatedUserWeeklyPdAsset: null,
        };
      }
      if (!item.userSteps || item.userSteps <= 0) {
        return {
          estimatedUserWeeklyGlw: 0,
          estimatedUserWeeklyUsd: 0,
          estimatedUserWeeklyPd: 0,
          estimatedUserWeeklyPdAsset: null,
        };
      }

      if (isFallbackDifferentCurrency) {
        const emissionPerShare = parseTokenAmountFromBaseUnits(
          rewardScore.userWeeklyGlwRewards,
          18
        ) / totalSteps;
        const emissionUsdPerShare =
          parseUsd6Amount(rewardScore.userWeeklyGlwValueUsd) / totalSteps;

        const estimatedGlw = emissionPerShare * item.userSteps;
        const estimatedUsd = emissionUsdPerShare * item.userSteps;

        return {
          estimatedUserWeeklyGlw:
            Number.isFinite(estimatedGlw) && estimatedGlw > 0 ? estimatedGlw : 0,
          estimatedUserWeeklyUsd:
            Number.isFinite(estimatedUsd) && estimatedUsd > 0 ? estimatedUsd : 0,
          estimatedUserWeeklyPd: 0,
          estimatedUserWeeklyPdAsset: delegationCurrency,
        };
      }

      const perShare = calculateLaunchpadPerShareRewards({
        reward: rewardScore,
        totalShares: totalSteps,
        delegationCurrency,
      });

      const estimatedEmissionGlw = perShare.emissionGlwPerShare * item.userSteps;
      const estimatedPd = perShare.pdPerShare * item.userSteps;
      const estimatedUsd = perShare.totalUsdPerShare * item.userSteps;
      const estimatedGlw =
        delegationCurrency === "GLW"
          ? estimatedEmissionGlw + estimatedPd
          : estimatedEmissionGlw;

      return {
        estimatedUserWeeklyGlw:
          Number.isFinite(estimatedGlw) && estimatedGlw > 0 ? estimatedGlw : 0,
        estimatedUserWeeklyUsd:
          Number.isFinite(estimatedUsd) && estimatedUsd > 0 ? estimatedUsd : 0,
        estimatedUserWeeklyPd:
          delegationCurrency !== "GLW" &&
          Number.isFinite(estimatedPd) &&
          estimatedPd > 0
            ? estimatedPd
            : 0,
        estimatedUserWeeklyPdAsset:
          delegationCurrency !== "GLW" ? delegationCurrency : null,
      };
    })();

    return {
      ...item,
      estimatedUserWeeklyGlw,
      estimatedUserWeeklyUsd,
      estimatedUserWeeklyPd,
      estimatedUserWeeklyPdAsset,
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
    const estimatedUserWeeklyGlw = estimateMiningCenterWeeklyGlw({
      miningScore,
      userSteps: item.userSteps,
    });

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
