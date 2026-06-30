"use client";

/**
 * Resolves the real solar farm behind a V2 points-shop "miner" prize and
 * estimates the buyer's reward.
 *
 * A miner shop item's `details` carries `sourceFarmId` (a control-backend
 * farm UUID) and `glowSplitPercent6Decimals` (the share of the farm's GLW
 * emissions the buyer receives on fulfilment). The split is an absolute
 * weight where the farm total is 1_000_000 (= 100%), the SAME base as the
 * mining-score's `minerRewardSplit`.
 *
 * We estimate the reward with the launchpad's mining-score route
 * (`/api/farms/mining-scores-batch`), which is keyed on a bare `farmId` — no
 * mining-center listing required. The mining-score returns
 * `userWeeklyGlwRewards = farmWeeklyGlw x (split / 1e6) / numberOfMiners`, so
 * passing `numberOfMiners: 1` and `minerRewardSplit: glowSplitPercent6Decimals`
 * yields exactly the buyer's fulfilled split (`dollarCostOfMiner` only has to
 * be > 0 — it gates, it doesn't scale). Weeks come from the same response's
 * `weeksOfMinerLifeRemaining`. Farm name + photo come from the control
 * images batch, which also works for any `farmId`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import type {
  FarmImagesBatchResponse,
  MiningScoresBatchResponse,
} from "@glowlabs-org/utils/browser";

import {
  MINING_SCORE_FALLBACK_USER_ID,
  normalizeMinerWeeksRemainingDisplay,
} from "@/lib/mining-score";
import {
  useV2ShopPurchases,
  type V2ShopItem,
  type V2ShopPurchaseRow,
} from "@/hooks/v2-points-shop";

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
  /** True once the source farm produced a mining-score estimate. */
  resolved: boolean;
}

interface MinerItemConfig {
  itemId: string;
  farmId: string;
  glowSplit6: string;
  /** Mining-score requires a non-zero dollar cost to gate the estimate. */
  dollarCost: string;
}

/**
 * True for items that are economically a miner. The featured headline miner
 * prize is just a normal `miner` kind with `details.featured`, fulfilled by the
 * same Foundation->buyer GLW split transfer, so it gets the same reward estimate.
 */
export function isMinerLikeItem(item: V2ShopItem): boolean {
  return item.kind === "miner";
}

/** The control farm UUID a miner(-like) item is linked to, or null. */
export function getMinerSourceFarmId(item: V2ShopItem): string | null {
  if (!isMinerLikeItem(item)) return null;
  const value = item.details?.sourceFarmId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getShopMinerValueUsd(item: V2ShopItem): number {
  if (!isMinerLikeItem(item)) return 0;
  const rawValue = item.details?.minerValueUsd;
  if (typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue > 0) {
    return rawValue;
  }
  return 0;
}

function getMinerConfig(item: V2ShopItem): MinerItemConfig | null {
  const farmId = getMinerSourceFarmId(item);
  if (!farmId) return null;
  const split = item.details?.glowSplitPercent6Decimals;
  const glowSplit6 = typeof split === "string" ? split : "0";
  if (glowSplit6 === "0") return null;
  const value = getShopMinerValueUsd(item) || 1;
  return { itemId: item.itemId, farmId, glowSplit6, dollarCost: String(value) };
}

/**
 * Given the current shop items, resolves every farm-linked miner to its
 * source farm + a mining-score reward estimate scaled to the item's split.
 * Returns a map keyed by `itemId`. Items with no `sourceFarmId` /
 * `glowSplitPercent6Decimals` are absent (they fall back to static copy).
 */
export function useShopMinerFarms(
  items: V2ShopItem[],
): Map<string, ShopMinerFarmInfo> {
  const configs = useMemo(() => {
    const list: MinerItemConfig[] = [];
    for (const item of items) {
      const config = getMinerConfig(item);
      if (config) list.push(config);
    }
    return list;
  }, [items]);

  const farmIds = useMemo(
    () => Array.from(new Set(configs.map((c) => c.farmId))),
    [configs],
  );

  // Mining-score estimate per item (one param per item; results are
  // positional so the order here is the order read back below).
  const scoreKey = useMemo(
    () => configs.map((c) => `${c.farmId}:${c.glowSplit6}`).join("|"),
    [configs],
  );
  const scoreQuery = useQuery({
    queryKey: ["shop-miner-mining-scores", scoreKey],
    enabled: configs.length > 0,
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<MiningScoresBatchResponse> => {
      const farms = configs.map((c) => ({
        farmId: c.farmId,
        userId: MINING_SCORE_FALLBACK_USER_ID,
        dollarCostOfMiner: c.dollarCost,
        numberOfMiners: 1,
        minerRewardSplit: c.glowSplit6,
      }));
      const res = await fetch("/api/farms/mining-scores-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farms }),
      });
      if (!res.ok) {
        throw new Error(`mining-scores-batch failed: ${res.status}`);
      }
      return (await res.json()) as MiningScoresBatchResponse;
    },
  });

  // Farm name + photo (works for any farmId, listed or not).
  const metaKey = useMemo(() => farmIds.join(","), [farmIds]);
  const metaQuery = useQuery({
    queryKey: ["shop-miner-farm-meta", metaKey],
    enabled: farmIds.length > 0,
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: async (): Promise<FarmImagesBatchResponse> => {
      const res = await fetch("/api/farms/images-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmIds }),
      });
      if (!res.ok) {
        throw new Error(`farms/images-batch failed: ${res.status}`);
      }
      return (await res.json()) as FarmImagesBatchResponse;
    },
  });

  return useMemo(() => {
    const byItem = new Map<string, ShopMinerFarmInfo>();
    const isLoading = scoreQuery.isLoading || metaQuery.isLoading;
    const results = scoreQuery.data?.results ?? [];

    configs.forEach((config, i) => {
      const result = results[i];
      const meta = metaQuery.data?.results?.[config.farmId];

      let weeklyGlwRewards: number | null = null;
      let weeklyGlwRewardsUsd: number | null = null;
      let weeksRemaining: number | null = null;
      let resolved = false;

      if (result && result.success) {
        resolved = true;
        const wei = (() => {
          try {
            return BigInt(result.data.userWeeklyGlwRewards || "0");
          } catch {
            return 0n;
          }
        })();
        const glw = Number(formatUnits(wei, 18));
        weeklyGlwRewards = Number.isFinite(glw) ? glw : null;
        const priceUsd = result.data.glwPriceUsd6
          ? Number(result.data.glwPriceUsd6) / 1_000_000
          : null;
        weeklyGlwRewardsUsd =
          weeklyGlwRewards != null && priceUsd != null
            ? weeklyGlwRewards * priceUsd
            : null;
        weeksRemaining = normalizeMinerWeeksRemainingDisplay(
          result.data.weeksOfMinerLifeRemaining,
        );
      }

      byItem.set(config.itemId, {
        farmId: config.farmId,
        farmName: meta?.name ?? null,
        imageUrl: meta?.imageUrl ?? null,
        weeklyGlwRewards,
        weeklyGlwRewardsUsd,
        weeksRemaining,
        isLoading,
        resolved,
      });
    });

    return byItem;
  }, [
    configs,
    scoreQuery.data,
    scoreQuery.isLoading,
    metaQuery.data,
    metaQuery.isLoading,
  ]);
}

// --- Holdings (purchased shop miners) --------------------------------------

export interface ShopMinerHolding {
  farmId: string;
  farmName: string | null;
  imageUrl: string | null;
  /** Weekly GLW reward for the wallet's TOTAL split on this farm. */
  weeklyGlwRewards: number | null;
  weeklyGlwRewardsUsd: number | null;
  weeksRemaining: number | null;
  /** Summed glow split (6-decimal weight) across all the wallet's shop
   * miners on this farm. */
  glowSplit6: string;
  /** Summed notional USD value of the miners bought on this farm. */
  minerValueUsd: number;
  /** Summed points spent across the wallet's shop miners on this farm. */
  pricePoints: number;
  purchaseCount: number;
}

/** Pull the (farmId, glowSplit6, valueUsd) a miner-like purchase fulfilled. */
function purchaseToMinerSource(
  row: V2ShopPurchaseRow,
): { farmId: string; glowSplit6: string; valueUsd: number } | null {
  const g = row.grant;
  // Defensive: a malformed or not-yet-fulfilled purchase row can carry a null
  // grant (e.g. an admin-inserted early-access row). Never crash My Farms on it.
  if (g && g.kind === "miner" && g.splitTransferRef) {
    return {
      farmId: g.splitTransferRef.farmId,
      glowSplit6: g.splitTransferRef.glowPercent6Decimals,
      valueUsd: g.minerValueUsd ?? 0,
    };
  }
  return null;
}

/**
 * The wallet's shop-purchased miner holdings, one per source farm (splits and
 * notional value summed across repeat purchases). Reward + weeks come from the
 * same farmId-based mining-score route as the shop cards; farm name/photo from
 * the control images batch.
 */
export function useShopMinerHoldings(
  wallet: string | null | undefined,
): { holdings: ShopMinerHolding[]; isLoading: boolean } {
  const purchasesQuery = useV2ShopPurchases(wallet);

  const byFarm = useMemo(() => {
    const map = new Map<
      string,
      { glowSplit6: bigint; valueUsd: number; pricePoints: number; count: number }
    >();
    for (const row of purchasesQuery.data?.rows ?? []) {
      const src = purchaseToMinerSource(row);
      if (!src) continue;
      const prev = map.get(src.farmId) ?? {
        glowSplit6: 0n,
        valueUsd: 0,
        pricePoints: 0,
        count: 0,
      };
      let add = 0n;
      try {
        add = BigInt(src.glowSplit6);
      } catch {
        add = 0n;
      }
      const points = Number(row.pricePointsTotal);
      map.set(src.farmId, {
        glowSplit6: prev.glowSplit6 + add,
        valueUsd: prev.valueUsd + src.valueUsd,
        pricePoints: prev.pricePoints + (Number.isFinite(points) ? points : 0),
        count: prev.count + 1,
      });
    }
    return map;
  }, [purchasesQuery.data]);

  const farmIds = useMemo(() => Array.from(byFarm.keys()), [byFarm]);
  const entries = useMemo(() => Array.from(byFarm.entries()), [byFarm]);

  const scoreKey = useMemo(
    () => entries.map(([f, v]) => `${f}:${v.glowSplit6}`).join("|"),
    [entries],
  );
  const scoreQuery = useQuery({
    queryKey: ["shop-miner-holding-scores", scoreKey],
    enabled: entries.length > 0,
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<MiningScoresBatchResponse> => {
      const farms = entries.map(([farmId, v]) => ({
        farmId,
        userId: MINING_SCORE_FALLBACK_USER_ID,
        dollarCostOfMiner: String(v.valueUsd > 0 ? v.valueUsd : 1),
        numberOfMiners: 1,
        minerRewardSplit: v.glowSplit6.toString(),
      }));
      const res = await fetch("/api/farms/mining-scores-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farms }),
      });
      if (!res.ok) throw new Error(`mining-scores-batch failed: ${res.status}`);
      return (await res.json()) as MiningScoresBatchResponse;
    },
  });

  const metaKey = useMemo(() => farmIds.join(","), [farmIds]);
  const metaQuery = useQuery({
    queryKey: ["shop-miner-holding-meta", metaKey],
    enabled: farmIds.length > 0,
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: async (): Promise<FarmImagesBatchResponse> => {
      const res = await fetch("/api/farms/images-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmIds }),
      });
      if (!res.ok) throw new Error(`farms/images-batch failed: ${res.status}`);
      return (await res.json()) as FarmImagesBatchResponse;
    },
  });

  const holdings = useMemo(() => {
    const results = scoreQuery.data?.results ?? [];
    return entries.map(([farmId, v], i) => {
      const result = results[i];
      const meta = metaQuery.data?.results?.[farmId];
      let weeklyGlwRewards: number | null = null;
      let weeklyGlwRewardsUsd: number | null = null;
      let weeksRemaining: number | null = null;
      if (result && result.success) {
        const wei = (() => {
          try {
            return BigInt(result.data.userWeeklyGlwRewards || "0");
          } catch {
            return 0n;
          }
        })();
        const glw = Number(formatUnits(wei, 18));
        weeklyGlwRewards = Number.isFinite(glw) ? glw : null;
        const priceUsd = result.data.glwPriceUsd6
          ? Number(result.data.glwPriceUsd6) / 1_000_000
          : null;
        weeklyGlwRewardsUsd =
          weeklyGlwRewards != null && priceUsd != null
            ? weeklyGlwRewards * priceUsd
            : null;
        weeksRemaining = normalizeMinerWeeksRemainingDisplay(
          result.data.weeksOfMinerLifeRemaining,
        );
      }
      return {
        farmId,
        farmName: meta?.name ?? null,
        imageUrl: meta?.imageUrl ?? null,
        weeklyGlwRewards,
        weeklyGlwRewardsUsd,
        weeksRemaining,
        glowSplit6: v.glowSplit6.toString(),
        minerValueUsd: v.valueUsd,
        pricePoints: v.pricePoints,
        purchaseCount: v.count,
      } satisfies ShopMinerHolding;
    });
  }, [entries, scoreQuery.data, metaQuery.data]);

  return {
    holdings,
    isLoading:
      purchasesQuery.isLoading || scoreQuery.isLoading || metaQuery.isLoading,
  };
}
