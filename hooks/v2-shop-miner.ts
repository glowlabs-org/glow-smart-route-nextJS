"use client";

/**
 * Resolves the real solar farm behind a V2 points-shop "miner" prize.
 *
 * A miner shop item's `details` carries `sourceFarmId` (a control-backend
 * farm UUID) and `glowSplitPercent6Decimals` (the share of the farm's GLW
 * emissions the buyer receives on fulfillment).
 *
 * To estimate the buyer's reward we reuse the launchpad's reward-score:
 * find the mining-center listing for the farm, read its reward-score
 * (`userWeeklyGlwRewards` at `userGlowSplitPercent`), then re-base that
 * onto the shop item's own `glowSplitPercent6Decimals`. Because GLW
 * reward is linear in the glow split, `weekly = userWeeklyGlwRewards x
 * itemSplit / userSplit` is exact and the scaled6 units cancel — no
 * dependence on the percent denominator. Weeks remaining come from the
 * launchpad mining-score (`weeksOfMinerLifeRemaining`).
 */
import { useMemo } from "react";
import { formatUnits } from "viem";

import { useMiningCenter, type AuctionApplication } from "@/hooks/hub-listings";
import {
  useMiningScore,
  getMiningScoreForApplication,
  useRewardScore,
} from "@/hooks/control-farms";
import { normalizeMinerWeeksRemainingDisplay } from "@/lib/mining-score";
import type { V2ShopItem } from "@/hooks/v2-points-shop";

export interface ShopMinerFarmInfo {
  farmId: string;
  farmName: string | null;
  imageUrl: string | null;
  /** Estimated weekly GLW reward (human units) for this item's split. */
  weeklyGlwRewards: number | null;
  weeklyGlwRewardsUsd: number | null;
  /** Weeks the buyer can still earn from, purchase week forward. */
  weeksRemaining: number | null;
  isLoading: boolean;
  /** True once the source farm was matched to a mining-center listing. */
  resolved: boolean;
}

interface MinerItemConfig {
  farmId: string;
  glowSplit6: string;
}

/** The control farm UUID a miner item is linked to, or null for legacy items. */
export function getMinerSourceFarmId(item: V2ShopItem): string | null {
  if (item.kind !== "miner") return null;
  const value = item.details?.sourceFarmId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getMinerConfig(item: V2ShopItem): MinerItemConfig | null {
  const farmId = getMinerSourceFarmId(item);
  if (!farmId) return null;
  const split = item.details?.glowSplitPercent6Decimals;
  return {
    farmId,
    glowSplit6: typeof split === "string" ? split : "0",
  };
}

function safeBigInt(value: string | null | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/**
 * Given the current shop items, resolves every farm-linked miner to its
 * source farm + a launchpad reward estimate scaled to the item's split.
 * Returns a map keyed by `itemId`. Items with no `sourceFarmId` are absent.
 */
export function useShopMinerFarms(
  items: V2ShopItem[],
): Map<string, ShopMinerFarmInfo> {
  const configByItem = useMemo(() => {
    const map = new Map<string, MinerItemConfig>();
    for (const item of items) {
      const config = getMinerConfig(item);
      if (config) map.set(item.itemId, config);
    }
    return map;
  }, [items]);

  const hasFarmLinkedMiners = configByItem.size > 0;

  // `includeFilled` so a source farm still resolves once its mining-center
  // auction has sold out — the reward estimate only needs the farm itself.
  const { applications, isLoading: isListingsLoading } = useMiningCenter({
    enabled: hasFarmLinkedMiners,
    filters: { includeFilled: true },
  });

  const matchedApplications = useMemo(() => {
    if (!hasFarmLinkedMiners) return [] as AuctionApplication[];
    const wanted = new Set(
      Array.from(configByItem.values(), (c) => c.farmId),
    );
    const seen = new Set<string>();
    const result: AuctionApplication[] = [];
    for (const app of applications) {
      if (app.farmId && wanted.has(app.farmId) && !seen.has(app.farmId)) {
        seen.add(app.farmId);
        result.push(app);
      }
    }
    return result;
  }, [applications, configByItem, hasFarmLinkedMiners]);

  const matchEnabled = matchedApplications.length > 0;

  const { miningScoreMap, isLoading: isScoresLoading } = useMiningScore({
    applications: matchedApplications,
    enabled: matchEnabled,
  });

  const { rewardScoreMap, isLoading: isRewardLoading } = useRewardScore({
    applications: matchedApplications,
    paymentCurrency: "USDC",
    enabled: matchEnabled,
  });

  const appByFarmId = useMemo(() => {
    const map = new Map<string, AuctionApplication>();
    for (const app of matchedApplications) {
      if (app.farmId) map.set(app.farmId, app);
    }
    return map;
  }, [matchedApplications]);

  return useMemo(() => {
    const byItem = new Map<string, ShopMinerFarmInfo>();
    const isLoading =
      isListingsLoading || isScoresLoading || isRewardLoading;

    for (const [itemId, config] of configByItem) {
      const app = appByFarmId.get(config.farmId);
      if (!app) {
        byItem.set(itemId, {
          farmId: config.farmId,
          farmName: null,
          imageUrl: null,
          weeklyGlwRewards: null,
          weeklyGlwRewardsUsd: null,
          weeksRemaining: null,
          isLoading,
          resolved: false,
        });
        continue;
      }

      // Re-base the launchpad reward-score onto this item's glow split.
      const reward = rewardScoreMap.get(app.id);
      let weeklyGlwRewards: number | null = null;
      if (reward && !reward.error) {
        const userSplit = safeBigInt(reward.userGlowSplitPercent);
        const itemSplit = safeBigInt(config.glowSplit6);
        if (userSplit > 0n && itemSplit > 0n) {
          const scaledWei =
            (safeBigInt(reward.userWeeklyGlwRewards) * itemSplit) / userSplit;
          const asNumber = Number(formatUnits(scaledWei, 18));
          weeklyGlwRewards = Number.isFinite(asNumber) ? asNumber : null;
        }
      }

      const score = getMiningScoreForApplication(miningScoreMap, app.id);

      byItem.set(itemId, {
        farmId: config.farmId,
        farmName: app.farmName ?? null,
        imageUrl: app.afterInstallPictures?.[0]?.url ?? null,
        weeklyGlwRewards,
        weeklyGlwRewardsUsd: null,
        weeksRemaining: normalizeMinerWeeksRemainingDisplay(
          score?.weeksOfMinerLifeRemaining,
        ),
        isLoading,
        resolved: true,
      });
    }

    return byItem;
  }, [
    configByItem,
    appByFarmId,
    miningScoreMap,
    rewardScoreMap,
    isListingsLoading,
    isScoresLoading,
    isRewardLoading,
  ]);
}
