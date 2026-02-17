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
  filterActiveMiningApplications,
  mapMiningScoresBatchToApplications,
} from "../mining-score";

const SPONSOR_LISTINGS_ENDPOINT = "/applications/sponsor-listings-applications";

export const DASHBOARD_SSR_LISTING_FILTERS = {
  launchpadStatus: { paymentCurrency: "GLW" } as const,
  miningStatus: { paymentCurrency: "USDC", type: "mining-center" } as const,
  launchpadLive: { paymentCurrency: "GLW", includeFilled: true } as const,
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
  farms: MiningScoreParams[]
) => Promise<MiningScoresBatchResponse>;

export interface DashboardLaunchpadPrefetchDeps {
  fetchListings?: FetchListingsFn;
  fetchMiningScoresBatch?: FetchMiningScoresBatchFn;
}

async function defaultFetchListings(
  filters: SponsorListingsFilters
): Promise<AuctionApplication[]> {
  return await hubGet<AuctionApplication[]>(SPONSOR_LISTINGS_ENDPOINT, {
    params: { ...filters },
  });
}

export async function prefetchDashboardLaunchpadData(
  queryClient: QueryClient,
  deps: DashboardLaunchpadPrefetchDeps = {}
) {
  if (!process.env.NEXT_PUBLIC_HUB_URL) return;

  const fetchListings = deps.fetchListings ?? defaultFetchListings;
  let fetchMiningScoresBatch = deps.fetchMiningScoresBatch;
  if (!fetchMiningScoresBatch) {
    const { getCachedMiningScoresBatch } = await import("./mining-scores");
    fetchMiningScoresBatch = getCachedMiningScoresBatch;
  }

  const [launchpadStatusListings, miningStatusListings, launchpadLiveListings, miningLiveListings] =
    await Promise.all([
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

  const activeMiningApplications =
    filterActiveMiningApplications(miningLiveListings);
  if (!activeMiningApplications.length) return;

  const { farmParams } = buildMiningScoreBatchInputs(activeMiningApplications);
  if (!farmParams.length) return;

  try {
    const response = await fetchMiningScoresBatch(farmParams);
    const miningScores = mapMiningScoresBatchToApplications(
      activeMiningApplications,
      farmParams,
      response
    );

    queryClient.setQueryData(
      QUERY_KEYS.listings.miningScores(
        activeMiningApplications.map((application) => application.id)
      ),
      miningScores
    );
  } catch {
    // Best effort; client query will fetch if server prefetch fails.
  }
}
