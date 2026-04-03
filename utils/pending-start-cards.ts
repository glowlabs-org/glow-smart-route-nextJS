import { buildPendingRewardTimeline } from "@/utils/reward-pipeline";

export type PendingStartFractionType = "launchpad" | "mining-center";

export function isPendingStartStatus(params: {
  fractionType: PendingStartFractionType;
  status: string;
}): boolean {
  const { fractionType } = params;
  const status = params.status.toLowerCase();

  if (fractionType === "launchpad") {
    return status === "filled";
  }

  return status === "filled" || status === "expired";
}

export function shouldIncludePendingStartCard(params: {
  fractionType: PendingStartFractionType | undefined;
  status: string;
  farmTypeKey: string;
  rewardedFarmTypeKeys: Set<string>;
  hasCurrentOwnership: boolean;
  purchaseDate?: string | null;
}): boolean {
  const {
    fractionType,
    status,
    farmTypeKey,
    rewardedFarmTypeKeys,
    hasCurrentOwnership,
    purchaseDate,
  } = params;

  if (!fractionType) return false;
  if (!hasCurrentOwnership) return false;

  if (rewardedFarmTypeKeys.has(farmTypeKey)) {
    if (fractionType !== "mining-center") {
      return false;
    }

    const phase = purchaseDate
      ? buildPendingRewardTimeline({ purchaseDate }).phase
      : null;

    // Mining-center purchases can legitimately have both:
    // 1. an existing rewarded farm card for older miner splits, and
    // 2. a newer pending purchase on the same farm that has not begun earning.
    // Once that newer purchase is already claimable, the rewarded/active card
    // should take over again instead of rendering a duplicate claim-ready card.
    if (phase === "claimable") {
      return false;
    }
  }

  return isPendingStartStatus({ fractionType, status });
}
