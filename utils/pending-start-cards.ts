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
    purchaseDate,
  } = params;

  if (!fractionType) return false;

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
    // The "not begun earning" condition is the epoch phase — the purchase
    // week hasn't ended yet, so no inflation has accrued. Past that point
    // the split's earnings flow into the rewarded card and a parallel
    // pending-start card would just duplicate the position.
    if (phase !== "epoch") {
      return false;
    }
  }

  return isPendingStartStatus({ fractionType, status });
}
