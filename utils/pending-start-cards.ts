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
}): boolean {
  const {
    fractionType,
    status,
    farmTypeKey,
    rewardedFarmTypeKeys,
    hasCurrentOwnership,
  } = params;

  if (!fractionType) return false;
  if (!hasCurrentOwnership) return false;

  // Mining-center purchases can legitimately have both:
  // 1. an existing rewarded farm card for older miner splits, and
  // 2. a newer "starts soon" purchase on the same farm that has not begun earning.
  // Keep showing the pending-start card in that case so the additional purchase
  // is not hidden until rewards catch up in later report weeks.
  if (rewardedFarmTypeKeys.has(farmTypeKey) && fractionType !== "mining-center") {
    return false;
  }

  return isPendingStartStatus({ fractionType, status });
}
