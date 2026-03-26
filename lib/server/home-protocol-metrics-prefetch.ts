import "server-only";

import { unstable_cache } from "next/cache";
import { QueryClient } from "@tanstack/react-query";
import type { HeadlineStats } from "./headline-stats";
import { getCompletedApplicationsSummary } from "./completed-applications";
import type { TotalActivelyDelegatedResponse } from "../../hooks/hub-fractions";
import type { CompletedApplication } from "../../hooks/useCompletedFarms";
import { QUERY_KEYS } from "../../hooks/query-keys";
import { hubGet } from "../api/hub-client";

const PREFETCH_TIMEOUT_MS = 3_000;
const HOME_TOTAL_DELEGATED_REVALIDATE_SECONDS = 60;

interface HomeProtocolMetricsPrefetchOptions {
  headlineStats?: HeadlineStats | null;
}

async function withSignalTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = PREFETCH_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = PREFETCH_TIMEOUT_MS
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

const getCachedTotalActivelyDelegated = unstable_cache(
  async () =>
    await hubGet<TotalActivelyDelegatedResponse>("/fractions/total-actively-delegated"),
  ["home-total-actively-delegated"],
  {
    revalidate: HOME_TOTAL_DELEGATED_REVALIDATE_SECONDS,
    tags: ["home-total-actively-delegated"],
  }
);

export async function prefetchHomeProtocolMetricsData(
  queryClient: QueryClient,
  options: HomeProtocolMetricsPrefetchOptions = {}
) {
  const { headlineStats } = options;

  if (headlineStats) {
    queryClient.setQueryData(QUERY_KEYS.prices.glowSpot(), {
      spotPrice: Number(headlineStats.glowPrice ?? 0),
      updatedAt: Date.now(),
      indexingComplete: true,
    });

    queryClient.setQueryData(QUERY_KEYS.prices.marketCap(), {
      circulatingSupply: Number(headlineStats.circulatingSupply ?? 0),
      marketCap: Number(headlineStats.marketCap ?? 0),
      totalSupply: Number(headlineStats.totalSupply ?? 0),
    });
  }
  await Promise.allSettled([
    withTimeout(getCachedTotalActivelyDelegated()).then((data) => {
      queryClient.setQueryData(QUERY_KEYS.fractions.totalActivelyDelegated(), data);
    }),
    withSignalTimeout(async () => {
      const completedFarms =
        (await getCompletedApplicationsSummary()) as CompletedApplication[];
      queryClient.setQueryData(["completed-farms", false], completedFarms);
    }),
  ]);
}
