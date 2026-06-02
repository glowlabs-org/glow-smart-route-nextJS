"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";
import {
  getLaunchpadNowMs,
  isMarketplaceVisibleAt,
} from "@/utils/launchpad-now";

export type PaymentCurrency = "USDG" | "USDC" | "GLW" | "GCTL" | "SGCTL";
export type DelegationPhase = "hidden" | "sgctl" | "glw" | null;
export type DelegationAsset = "SGCTL" | "GLW" | null;

export type SortBy =
  | "publishedOnAuctionTimestamp"
  | "sponsorSplitPercent"
  | "finalProtocolFee"
  | "paymentCurrency";

export type SortOrder = "asc" | "desc";

export interface Zone {
  id: number;
  name: string;
  isAcceptingSponsors: boolean;
  isActive: boolean;
  requirementSet: {
    id: number;
    name: string;
    code: string;
  };
}

export interface ApplicationPriceQuote {
  id: number;
  prices: Record<PaymentCurrency, string>;
  signature: string;
  createdAt: string;
  gcaAddress: string;
}

export interface EnquiryFields {
  lat: number | null;
  lng: number | null;
  estimatedKWhGeneratedPerYear: number | null;
}

export interface AuditFields {
  systemWattageOutput: number | null;
  averageSunlightHoursPerDay: number | null;
  expectedWeeklyCarbonCredits: number | null;
  netCarbonCreditEarningWeekly: number | null;
  solarPanelsQuantity: number | null;
}

export interface Document {
  id: number;
  name: string;
  url: string;
}

export interface WeeklyProduction {
  id: number;
  week: number;
  year: number;
  productionKWh: number;
  applicationId: string;
}

export interface WeeklyCarbonDebt {
  id: number;
  week: number;
  year: number;
  carbonDebt: number;
  applicationId: string;
}

export interface ActiveFraction {
  id: string;
  nonce: number;
  type?: string;
  status: string;
  sponsorSplitPercent: number;
  createdAt: string;
  expirationAt: string | null;
  filledAt: string | null;
  isCommittedOnChain: boolean;
  isFilled: boolean;
  totalSteps: number;
  splitsSold: number;
  stepPrice: string;
  step: string;
  sgctlStepAtomic?: string | null;
  token: string;
  owner: string;
  txHash: string | null;
  delegationAsset?: DelegationAsset;
  delegationPhase?: DelegationPhase;
  marketplaceVisibleAt?: string | null;
  glwDelegationVisibleAt?: string | null;
  progressPercent: number;
  remainingSteps: number | null;
  remainingUsd6?: string | null;
  currentStepUsd6?: string | null;
  amountRaised: string | null;
  totalAmountNeeded: string | null;
  rewardScore: number | null;
}

export function isFractionOpenForMarketplace(
  fraction:
    | Pick<
        ActiveFraction,
        | "isFilled"
        | "remainingSteps"
        | "totalSteps"
        | "splitsSold"
        | "delegationPhase"
        | "delegationAsset"
      >
    | null
    | undefined
): boolean {
  if (!fraction) return false;

  const totalSteps = fraction.totalSteps ?? 0;
  const remainingSteps = resolveFractionRemainingSteps(fraction);

  return !fraction.isFilled && remainingSteps > 0 && totalSteps > 0;
}

export function resolveFractionRemainingSteps(
  fraction:
    | Pick<
        ActiveFraction,
        | "remainingSteps"
        | "totalSteps"
        | "splitsSold"
        | "delegationPhase"
        | "delegationAsset"
      >
    | null
    | undefined,
): number {
  if (!fraction) return 0;

  // sGCTL pre-sale phase: splitsSold counts sGCTL shares while totalSteps is the
  // GLW-phase step count — different units — so (totalSteps - splitsSold) hits 0
  // long before the sGCTL fundraise target is met, falsely reading sold-out and
  // hiding the listing for the whole pre-sale (Eternal Florida wk129: 24/24 with
  // 117 sGCTL shares still open). Trust the backend's phase-aware remainingSteps
  // here; the GLW step-ledger preference below only applies to the GLW phase.
  const isSgctlPhase =
    fraction.delegationPhase === "sgctl" ||
    fraction.delegationAsset === "SGCTL";
  if (
    isSgctlPhase &&
    typeof fraction.remainingSteps === "number" &&
    Number.isFinite(fraction.remainingSteps)
  ) {
    return Math.max(0, Math.floor(fraction.remainingSteps));
  }

  // Prefer the exact step ledger (totalSteps - splitsSold). One step is one
  // whole unit, so this is precisely "units left". The API's remainingSteps is
  // derived from leftover USD/GLW amounts and can floor to one short of a whole
  // step (dust in amountRaised), which made the "Max" button buy every unit but
  // the last. Only fall back to remainingSteps when the step counts are missing.
  const hasTotalSteps =
    typeof fraction.totalSteps === "number" &&
    Number.isFinite(fraction.totalSteps);
  const hasSplitsSold =
    typeof fraction.splitsSold === "number" &&
    Number.isFinite(fraction.splitsSold);

  if (hasTotalSteps && hasSplitsSold) {
    const totalSteps = Math.max(0, Math.floor(fraction.totalSteps));
    const soldSteps = Math.max(0, Math.floor(fraction.splitsSold));
    return Math.max(0, totalSteps - soldSteps);
  }

  if (
    typeof fraction.remainingSteps === "number" &&
    Number.isFinite(fraction.remainingSteps)
  ) {
    return Math.max(0, Math.floor(fraction.remainingSteps));
  }

  const totalSteps = hasTotalSteps
    ? Math.max(0, Math.floor(fraction.totalSteps))
    : 0;
  const soldSteps = hasSplitsSold
    ? Math.max(0, Math.floor(fraction.splitsSold))
    : 0;

  return Math.max(0, totalSteps - soldSteps);
}

export function isFractionPubliclyVisible(
  fraction:
    | Pick<ActiveFraction, "marketplaceVisibleAt">
    | null
    | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!fraction) return false;
  return isMarketplaceVisibleAt(fraction.marketplaceVisibleAt, nowMs);
}

export interface AuctionApplication {
  id: string;
  userId: string;
  status: string;
  createdAt: string;
  farmId: string | null;
  farmName: string | null;
  isPublishedOnAuction: boolean;
  publishedOnAuctionTimestamp: string;
  sponsorSplitPercent: number;
  finalProtocolFee: string | null;
  /**
   * Per-farm PD vault-recovery discount that divides the PD term in the
   * reward-score formula. Numeric column on the hub `applications` table,
   * serialized as a decimal string (e.g. "1.25"). Default 1.25.
   */
  pdRecoveryDiscount: string | null;
  paymentCurrency: PaymentCurrency | null;
  paymentEventType: string | null;
  zone: Zone;
  applicationPriceQuotes: ApplicationPriceQuote[];
  enquiryFields: EnquiryFields | null;
  auditFields: AuditFields | null;
  weeklyProduction: WeeklyProduction[];
  weeklyCarbonDebt: WeeklyCarbonDebt[];
  afterInstallPictures: Document[];
  activeFraction: ActiveFraction | null;
}

export type SponsorListingType = "launchpad" | "mining-center";

export interface SponsorListingsFilters {
  type?: SponsorListingType;
  zoneId?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  paymentCurrency?: PaymentCurrency;
  includeFilled?: boolean;
}

export interface UseSponsorListingsParams {
  filters?: SponsorListingsFilters;
  enabled?: boolean;
  query?: {
    refetchInterval?: number | false;
    refetchIntervalInBackground?: boolean;
  };
}

const SPONSOR_LISTINGS_PROXY_PATH = "/api/applications/sponsor-listings-applications";

function buildSponsorListingsProxyUrl(
  filters: SponsorListingsFilters = {},
): string {
  const searchParams = new URLSearchParams();

  // Backwards compatibility with the existing API behavior:
  // - launchpad listings are returned when `type` is omitted
  // - mining-center listings require `type=mining-center`
  if (filters.type === "mining-center") {
    searchParams.set("type", "mining-center");
  }
  if (filters.zoneId !== undefined) {
    searchParams.set("zoneId", String(filters.zoneId));
  }
  if (filters.sortBy) {
    searchParams.set("sortBy", filters.sortBy);
  }
  if (filters.sortOrder) {
    searchParams.set("sortOrder", filters.sortOrder);
  }
  if (filters.paymentCurrency) {
    searchParams.set("paymentCurrency", filters.paymentCurrency);
  }
  if (filters.includeFilled) {
    searchParams.set("includeFilled", String(filters.includeFilled));
  }

  const query = searchParams.toString();
  return query
    ? `${SPONSOR_LISTINGS_PROXY_PATH}?${query}`
    : SPONSOR_LISTINGS_PROXY_PATH;
}

export async function fetchSponsorListings(
  filters: SponsorListingsFilters = {},
): Promise<AuctionApplication[]> {
  const response = await fetch(buildSponsorListingsProxyUrl(filters), {
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Sponsor listings fetch failed: ${response.status} - ${text}`,
    );
  }

  return (await response.json()) as AuctionApplication[];
}

export function useSponsorListings(params: UseSponsorListingsParams = {}) {
  const { filters = {}, enabled = true, query: queryOptions } = params;

  const query = useQuery({
    queryKey: QUERY_KEYS.listings.sponsor(filters),
    enabled,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: queryOptions?.refetchInterval,
    refetchIntervalInBackground: queryOptions?.refetchIntervalInBackground,
    queryFn: async (): Promise<AuctionApplication[]> =>
      await fetchSponsorListings(filters),
  });

  return {
    applications: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export interface GlowLaunchpadFilters {
  zoneId?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  paymentCurrency?: PaymentCurrency;
  includeFilled?: boolean;
}

export interface UseGlowLaunchpadParams {
  filters?: GlowLaunchpadFilters;
  enabled?: boolean;
  query?: UseSponsorListingsParams["query"];
}

// launchpad listings are returned when `type` is omitted
export function useGlowLaunchpad(params: UseGlowLaunchpadParams = {}) {
  const { filters = {}, enabled = true, query } = params;
  return useSponsorListings({
    filters: { ...filters },
    enabled,
    query,
  });
}

export interface MiningCenterFilters {
  zoneId?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  paymentCurrency?: PaymentCurrency;
  includeFilled?: boolean;
}

export interface UseMiningCenterParams {
  filters?: MiningCenterFilters;
  enabled?: boolean;
  query?: UseSponsorListingsParams["query"];
}

// mining-center listings require `type=mining-center`
export function useMiningCenter(params: UseMiningCenterParams = {}) {
  const { filters = {}, enabled = true, query } = params;
  const { paymentCurrency: _paymentCurrency, ...restFilters } = filters;
  return useSponsorListings({
    filters: { ...restFilters, type: "mining-center" },
    enabled,
    query,
  });
}

export function useAvailableZones(applications: AuctionApplication[] = []) {
  const zones = applications.reduce((acc, app) => {
    const zone = app.zone;
    if (!acc.find((z) => z.id === zone.id)) acc.push(zone);
    return acc;
  }, [] as Zone[]);

  return { zones } as const;
}

export function getAssetPriceQuote(
  priceQuotes: ApplicationPriceQuote[],
  currency: PaymentCurrency
): string | null {
  if (!priceQuotes.length) return null;
  const latestQuote = priceQuotes[0];
  if (currency === "SGCTL") return latestQuote.prices.GCTL || null;
  return latestQuote.prices[currency] || null;
}

export function calculateProtocolDepositAmount(
  finalProtocolFee: string | null,
  priceQuotes: ApplicationPriceQuote[],
  currency: PaymentCurrency
): string | null {
  if (!finalProtocolFee || !priceQuotes.length) return null;

  const assetPriceQuote = getAssetPriceQuote(priceQuotes, currency);
  if (!assetPriceQuote) return null;

  try {
    const protocolFeeInDollars = new Decimal(finalProtocolFee);
    const assetPriceInDollars = new Decimal(assetPriceQuote);
    if (assetPriceInDollars.isZero()) return null;
    return protocolFeeInDollars.div(assetPriceInDollars).toString();
  } catch {
    return null;
  }
}

export function calculateGctlPaymentAmount(
  finalProtocolFee: string | null,
  priceQuotes: ApplicationPriceQuote[],
  gctlPriceInUSD: number
): string | null {
  if (!finalProtocolFee || !priceQuotes.length || !gctlPriceInUSD) return null;

  try {
    const gctlAmount = calculateProtocolDepositAmount(
      finalProtocolFee,
      priceQuotes,
      "GCTL"
    );
    if (!gctlAmount) return null;

    const gctlAmountDecimal = new Decimal(gctlAmount);
    const gctlPrice = new Decimal(gctlPriceInUSD);
    return gctlAmountDecimal.mul(gctlPrice).toString();
  } catch {
    return null;
  }
}

export function getAvailableCurrencies(
  priceQuotes: ApplicationPriceQuote[]
): PaymentCurrency[] {
  if (!priceQuotes.length) return [];
  const latestQuote = priceQuotes[0];
  return Object.keys(latestQuote.prices).filter((currency) => {
    const v = latestQuote.prices[currency as PaymentCurrency];
    return Boolean(v) && Number.parseFloat(v) > 0;
  }) as PaymentCurrency[];
}

export interface SplitActivity {
  transactionHash: string;
  blockNumber: number;
  buyer: string;
  creator: string;
  stepsPurchased: number;
  amount: string;
  step: string;
  timestamp: number;
  purchaseDate: string;
  fractionId: string;
  applicationId: string;
  farmId?: string | null;
  farmName: string;
  // USDC6 atomic string ("1500000000" = $1,500). Null for older payloads or
  // applications that never had a finalProtocolFee set.
  finalProtocolFee?: string | null;
  fractionType?: "mining-center" | "launchpad";
  fractionStatus: string;
  currency: PaymentCurrency;
  currencyDecimals?: number;
  activityAssetKey?: string;
  isFilled: boolean;
  progressPercent: number;
  rewardScore: number | null;
  stepPrice: string;
  totalValue: string;
}

export interface SplitsActivityResponse {
  activity: SplitActivity[];
  fractionType?: "mining-center" | "launchpad";
  summary: {
    totalTransactions: number;
    totalStepsPurchased: number;
    totalAmountSpent: string;
    uniqueBuyers: number;
    uniqueFractions: number;
  };
}

export interface UseSplitsActivityParams {
  limit?: number;
  walletAddress?: string;
  fractionType?: "mining-center" | "launchpad";
  enabled?: boolean;
  staleTimeMs?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
  refetchIntervalMs?: number | false;
}

export function useSplitsActivity(params: UseSplitsActivityParams = {}) {
  const {
    limit = 50,
    walletAddress,
    fractionType,
    enabled = true,
    staleTimeMs = 30_000,
    refetchOnWindowFocus = false,
    refetchOnMount = false,
    refetchIntervalMs = false,
  } = params;
  const normalizedWalletAddress = walletAddress?.toLowerCase();

  const query = useQuery({
    queryKey: QUERY_KEYS.activity.splits(
      limit,
      normalizedWalletAddress,
      fractionType,
    ),
    enabled,
    staleTime: staleTimeMs,
    refetchOnWindowFocus,
    refetchOnMount,
    refetchInterval: refetchIntervalMs,
    queryFn: async (): Promise<SplitsActivityResponse> => {
      const endpoint = fractionType
        ? "/api/fractions/splits-activity-by-type"
        : "/api/fractions/splits-activity";

      const search = new URLSearchParams();
      search.set("limit", String(limit));
      if (normalizedWalletAddress) {
        search.set("walletAddress", normalizedWalletAddress);
      }
      if (fractionType) search.set("fractionType", fractionType);

      const response = await fetch(`${endpoint}?${search.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch splits activity: ${response.status}`);
      }

      return (await response.json()) as SplitsActivityResponse;
    },
  });

  return {
    activity: query.data?.activity || [],
    summary: query.data?.summary || {
      totalTransactions: 0,
      totalStepsPurchased: 0,
      totalAmountSpent: "0",
      uniqueBuyers: 0,
      uniqueFractions: 0,
    },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}

export interface SponsorApplicationParams {
  applicationId: string;
  amount: bigint;
  currency: string;
  txHash: string;
  onSuccess?: () => void;
}

export function useSponsorApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SponsorApplicationParams) => {
      return {
        applicationId: params.applicationId,
        txHash: params.txHash,
        success: true,
      };
    },
    onSuccess: (_data, variables) => {
      // Invalidate all sponsor listings (launchpad + mining center)
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.listings.allSponsors,
      });
      // Also invalidate with predicate to catch all filter variations
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "sponsor-listings",
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.activity.allSplits,
      });
      queryClient.invalidateQueries({ queryKey: ["rewards-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["mining-scores"] });
      queryClient.invalidateQueries({ queryKey: ["reward-scores"] });

      if (variables.onSuccess) variables.onSuccess();
    },
    onError: (error) => {
      console.error("Sponsorship mutation error:", error);
    },
  });
}
