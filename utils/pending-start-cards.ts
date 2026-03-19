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
  if (rewardedFarmTypeKeys.has(farmTypeKey)) return false;
  if (!hasCurrentOwnership) return false;

  return isPendingStartStatus({ fractionType, status });
}
