import "server-only";

import { unstable_cache } from "next/cache";
import { QueryClient } from "@tanstack/react-query";
import type {
  MiningScoreParams,
  MiningScoresBatchResponse,
} from "@glowlabs-org/utils/browser";
import type {
  AuctionApplication,
  SponsorListingsFilters,
} from "../../hooks/hub-listings";
import { QUERY_KEYS } from "../../hooks/query-keys";
import { hubGet } from "../api/hub-client";
import {
  buildMiningScoreBatchInputs,
  buildMiningScoreExtraLiveFarmsKey,
  fetchLiveSoonMiningScoreFarms,
  type ExtraLiveFarmInput,
  type LiveSoonFarmResult,
  filterActiveMiningApplications,
  mapMiningScoresBatchToApplications,
} from "../mining-score";
import {
  buildRewardScoreCurrencyKey,
  buildRewardScoreBatchInputs,
  filterActiveRewardApplications,
  getMissingRewardScoresForApplications,
  mapRewardScoresBatchToApplications,
} from "../reward-score";
import type {
  RewardScoreBatchParams,
  RewardScoresBatchResponse,
} from "../reward-score";

const SPONSOR_LISTINGS_ENDPOINT = "/applications/sponsor-listings-applications";
const PREFETCH_TIMEOUT_MS = 3_000;
const DASHBOARD_LISTINGS_REVALIDATE_SECONDS = 30;

// Launch-boundary cache busting: include the current launchpad slot in the
// cache key so a stale-but-still-fresh pre-launch entry never serves data
// into the live window. The consolidated launch window has a SINGLE boundary
// on Tuesdays in ET (GLW + sGCTL + miners all go live together):
//
//     pre-9AM   ── 9 AM ─→ live
//
// Without this, a user who lands on the dashboard just after 9 AM ET can be
// served the SSR cache generated seconds earlier — pre-launch data, missing
// the freshly-visible miners/launchpad. With the fingerprint in the key, the
// Tuesday 9 AM boundary creates a new cache entry; the old one is orphaned.
// Mirrors the backend's single-boundary approach in publicRoutes.ts.
function getLaunchpadPhaseFingerprint(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
  const minutesIntoEtDay = Number(parts.hour) * 60 + Number(parts.minute);
  // Single boundary in minutes-since-midnight ET: 9 AM = 540.
  const slot = minutesIntoEtDay < 540 ? "0-pre9am" : "1-post9am";
  return `${dayKey}-${slot}`;
}

export const DASHBOARD_SSR_LISTING_FILTERS = {
  launchpadStatus: {} as const,
  miningStatus: { paymentCurrency: "USDC", type: "mining-center" } as const,
  launchpadLive: { includeFilled: true } as const,
  miningLive: {
    paymentCurrency: "USDC",
    includeFilled: true,
    type: "mining-center",
  } as const,
} as const;

type FetchListingsFn = (
  filters: SponsorListingsFilters
) => Promise<AuctionApplication[]>;

type FetchMiningScoresBatchFn = (
  farms: MiningScoreParams[],
  extraLiveFarms?: ExtraLiveFarmInput[]
) => Promise<MiningScoresBatchResponse>;

type FetchLiveSoonFarmsFn = () => Promise<LiveSoonFarmResult[]>;

type FetchRewardScoresBatchFn = (
  farms: RewardScoreBatchParams[]
) => Promise<RewardScoresBatchResponse>;

export interface DashboardLaunchpadPrefetchDeps {
  fetchListings?: FetchListingsFn;
  fetchMiningScoresBatch?: FetchMiningScoresBatchFn;
  fetchLiveSoonFarms?: FetchLiveSoonFarmsFn;
  fetchRewardScoresBatch?: FetchRewardScoresBatchFn;
  prefetchRewardScores?: boolean;
  prefetchMiningScores?: boolean;
  prefetchLiveSoon?: boolean;
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

async function defaultFetchListings(
  filters: SponsorListingsFilters
): Promise<AuctionApplication[]> {
  // Fingerprint is computed per request and passed as an argument so it
  // becomes part of unstable_cache's key. Old slot entries become orphans
  // automatically on phase transitions.
  const fingerprint = getLaunchpadPhaseFingerprint();
  return await withTimeout(getCachedSponsorListings(filters, fingerprint));
}

const getCachedSponsorListings = unstable_cache(
  async (filters: SponsorListingsFilters, _phaseFingerprint: string) =>
    await hubGet<AuctionApplication[]>(SPONSOR_LISTINGS_ENDPOINT, {
      params: { ...filters },
    }),
  ["dashboard-sponsor-listings"],
  {
    revalidate: DASHBOARD_LISTINGS_REVALIDATE_SECONDS,
    tags: ["dashboard-sponsor-listings"],
  }
);

export async function prefetchDashboardLaunchpadData(
  queryClient: QueryClient,
  deps: DashboardLaunchpadPrefetchDeps = {}
) {
  if (!process.env.NEXT_PUBLIC_HUB_URL) return;

  const fetchListings = deps.fetchListings ?? defaultFetchListings;
  let fetchMiningScoresBatch = deps.fetchMiningScoresBatch;
  const fetchLiveSoonFarms = deps.fetchLiveSoonFarms ?? fetchLiveSoonMiningScoreFarms;
  let fetchRewardScoresBatch = deps.fetchRewardScoresBatch;
  const prefetchRewardScores = deps.prefetchRewardScores ?? true;
  const prefetchMiningScores = deps.prefetchMiningScores ?? true;
  const prefetchLiveSoon = deps.prefetchLiveSoon ?? prefetchMiningScores;

  const [
    launchpadStatusListings,
    miningStatusListings,
    launchpadLiveListings,
    miningLiveListings,
    liveSoonFarms,
  ] = await Promise.all([
      fetchListings(DASHBOARD_SSR_LISTING_FILTERS.launchpadStatus).catch(
        () => []
      ),
      fetchListings(DASHBOARD_SSR_LISTING_FILTERS.miningStatus).catch(
        () => []
      ),
      fetchListings(DASHBOARD_SSR_LISTING_FILTERS.launchpadLive).catch(
        () => []
      ),
      fetchListings(DASHBOARD_SSR_LISTING_FILTERS.miningLive).catch(() => []),
      prefetchLiveSoon ? fetchLiveSoonFarms().catch(() => []) : Promise.resolve([]),
    ]);

  queryClient.setQueryData(
    QUERY_KEYS.listings.sponsor(DASHBOARD_SSR_LISTING_FILTERS.launchpadStatus),
    launchpadStatusListings
  );
  queryClient.setQueryData(
    QUERY_KEYS.listings.sponsor(DASHBOARD_SSR_LISTING_FILTERS.miningStatus),
    miningStatusListings
  );
  queryClient.setQueryData(
    QUERY_KEYS.listings.sponsor(DASHBOARD_SSR_LISTING_FILTERS.launchpadLive),
    launchpadLiveListings
  );
  queryClient.setQueryData(
    QUERY_KEYS.listings.sponsor(DASHBOARD_SSR_LISTING_FILTERS.miningLive),
    miningLiveListings
  );
  queryClient.setQueryData(QUERY_KEYS.listings.liveSoon(), liveSoonFarms);

  const activeRewardApplications =
    filterActiveRewardApplications(launchpadLiveListings);
  const { requestList, batchParams: rewardBatchParams } =
    buildRewardScoreBatchInputs({
      applications: activeRewardApplications,
      paymentCurrency: "GLW",
      walletAddress: null,
    });
  const rewardScoreCurrencyKey = buildRewardScoreCurrencyKey(
    activeRewardApplications,
    "GLW"
  );
  if (prefetchRewardScores && activeRewardApplications.length > 0) {
    if (rewardBatchParams.length > 0) {
      try {
        if (!fetchRewardScoresBatch) {
          const { getCachedRewardScoresBatch } = await import("./reward-scores");
          fetchRewardScoresBatch = getCachedRewardScoresBatch;
        }
        const response = await withTimeout(
          fetchRewardScoresBatch!(rewardBatchParams)
        );
        const rewardScores = mapRewardScoresBatchToApplications({
          applications: activeRewardApplications,
          requestList,
          response,
        });

        queryClient.setQueryData(
          QUERY_KEYS.listings.rewardScores(
            activeRewardApplications.map((application) => application.id),
            rewardScoreCurrencyKey,
            null
          ),
          rewardScores
        );
      } catch {
        // Best effort; client query will fetch if server prefetch fails.
      }
    } else {
      queryClient.setQueryData(
        QUERY_KEYS.listings.rewardScores(
          activeRewardApplications.map((application) => application.id),
          rewardScoreCurrencyKey,
          null
        ),
        getMissingRewardScoresForApplications(
          activeRewardApplications,
          "Missing required data for calculation"
        )
      );
    }
  }

  const activeMiningApplications =
    filterActiveMiningApplications(miningLiveListings);
  const miningExtraLiveKey =
    buildMiningScoreExtraLiveFarmsKey(launchpadLiveListings, liveSoonFarms);
  if (!prefetchMiningScores || !activeMiningApplications.length) return;

  const { farmParams, extraLiveFarms } = buildMiningScoreBatchInputs(
    activeMiningApplications,
    launchpadLiveListings,
    liveSoonFarms
  );
  if (!farmParams.length) return;

  try {
    if (!fetchMiningScoresBatch) {
      const { getCachedMiningScoresBatch } = await import("./mining-scores");
      fetchMiningScoresBatch = getCachedMiningScoresBatch;
    }
    const response = await withTimeout(
      fetchMiningScoresBatch!(farmParams, extraLiveFarms)
    );
    const miningScores = mapMiningScoresBatchToApplications(
      activeMiningApplications,
      farmParams,
      response
    );

    queryClient.setQueryData(
      QUERY_KEYS.listings.miningScores(
        activeMiningApplications.map((application) => application.id),
        miningExtraLiveKey
      ),
      miningScores
    );
  } catch {
    // Best effort; client query will fetch if server prefetch fails.
  }
}
