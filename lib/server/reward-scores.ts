import "server-only";

import { unstable_cache } from "next/cache";
import { getFarmsRouter } from "@/lib/api/control-routers";
import type {
  RewardScoreBatchParams,
  RewardScoresBatchResponse,
} from "@/lib/reward-score";

async function fetchRewardScoresBatchUncached(
  farms: RewardScoreBatchParams[]
): Promise<RewardScoresBatchResponse> {
  return (await (getFarmsRouter() as any).estimateRewardScoresBatch({
    farms,
  })) as RewardScoresBatchResponse;
}

export const getCachedRewardScoresBatch = unstable_cache(
  async (farms: RewardScoreBatchParams[]) =>
    await fetchRewardScoresBatchUncached(farms),
  ["farms-reward-scores-batch"],
  {
    revalidate: 300,
    tags: ["farms-reward-scores-batch"],
  }
);
