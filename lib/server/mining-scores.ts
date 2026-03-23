import "server-only";

import { unstable_cache } from "next/cache";
import type {
  MiningScoreParams,
  MiningScoresBatchResponse,
} from "@glowlabs-org/utils/browser";
import { getFarmsRouter } from "@/lib/api/control-routers";
import type { ExtraLiveFarmInput } from "@/lib/mining-score";

export async function fetchMiningScoresBatchUncached(
  farms: MiningScoreParams[],
  extraLiveFarms: ExtraLiveFarmInput[] = []
): Promise<MiningScoresBatchResponse> {
  return (await (getFarmsRouter() as any).calculateMiningScoresBatch({
    farms,
    ...(extraLiveFarms.length > 0 ? { extraLiveFarms } : {}),
  })) as MiningScoresBatchResponse;
}

export const getCachedMiningScoresBatch = unstable_cache(
  async (farms: MiningScoreParams[], extraLiveFarms: ExtraLiveFarmInput[] = []) =>
    await fetchMiningScoresBatchUncached(farms, extraLiveFarms),
  ["farms-mining-scores-batch"],
  {
    revalidate: 300,
    tags: ["farms-mining-scores-batch"],
  }
);
