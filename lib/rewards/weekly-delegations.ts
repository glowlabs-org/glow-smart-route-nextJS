import { formatUnits } from "viem";

import type { RewardsBreakdownResponse } from "@/hooks";
import { GENESIS_TIMESTAMP } from "@/utils/getCurrentEpoch";

const GLW_DECIMALS = 18;
const SECONDS_PER_WEEK = 7 * 86_400;
const USDC_DECIMALS = 6;

export function getGlwFromWei(value?: string) {
  if (!value) return 0;
  try {
    return Number(formatUnits(BigInt(value), GLW_DECIMALS));
  } catch {
    return 0;
  }
}

export function getUsdcFromWei(value?: string) {
  if (!value) return 0;
  try {
    return Number(formatUnits(BigInt(value), USDC_DECIMALS));
  } catch {
    return 0;
  }
}

export function buildWeeklyDelegations(data?: RewardsBreakdownResponse | null) {
  const weeklyDelegations = new Map<number, number>();
  if (!data) return weeklyDelegations;

  data.farmDetails
    .filter((farm) => farm.type === "launchpad")
    .forEach((farm) => {
      if (
        farm.firstWeekWithRewards === undefined ||
        farm.firstWeekWithRewards === null
      ) {
        return;
      }

      const delegatedAmount = getGlwFromWei(farm.amountInvested);
      if (delegatedAmount <= 0) return;

      weeklyDelegations.set(
        farm.firstWeekWithRewards,
        (weeklyDelegations.get(farm.firstWeekWithRewards) ?? 0) +
          delegatedAmount
      );
    });

  return weeklyDelegations;
}

export function weekToTimestamp(week: number) {
  return (GENESIS_TIMESTAMP + week * SECONDS_PER_WEEK) * 1000;
}

export function getCurrentWeekNumber(referenceDate = Date.now()) {
  const genesisMs = GENESIS_TIMESTAMP * 1000;
  const diffMs = Math.max(0, referenceDate - genesisMs);
  const msPerWeek = SECONDS_PER_WEEK * 1000;
  return Math.floor(diffMs / msPerWeek);
}

export function getWeekNumberFromTimestamp(timestamp: number) {
  const timestampSeconds =
    timestamp > 1_000_000_000_000
      ? Math.floor(timestamp / 1000)
      : Math.floor(timestamp);
  const delta = Math.max(0, timestampSeconds - GENESIS_TIMESTAMP);
  return Math.floor(delta / SECONDS_PER_WEEK);
}
