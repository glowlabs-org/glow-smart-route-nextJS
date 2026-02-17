import "server-only";

import { unstable_cache } from "next/cache";
import type {
  MiningScoreParams,
  MiningScoresBatchResponse,
} from "@glowlabs-org/utils/browser";
import { getFarmsRouter } from "@/lib/api/control-routers";

async function fetchMiningScoresBatchUncached(
  farms: MiningScoreParams[]
): Promise<MiningScoresBatchResponse> {
  return (await (getFarmsRouter() as any).calculateMiningScoresBatch({
    farms,
  })) as MiningScoresBatchResponse;
}

export const getCachedMiningScoresBatch = unstable_cache(
  async (farms: MiningScoreParams[]) =>
    await fetchMiningScoresBatchUncached(farms),
  ["farms-mining-scores-batch"],
  {
    revalidate: 60,
    tags: ["farms-mining-scores-batch"],
  }
);
