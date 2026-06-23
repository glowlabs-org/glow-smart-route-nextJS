"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";
import { getLaunchpadNowMs, isMarketplaceVisibleAt } from "@/utils/launchpad-now";

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

/**
 * The GLW leg of a launchpad listing (consolidated-launch-window shape).
 * `remainingSteps` is a whole-unit count; `stepWei` is the per-step GLW price
 * in wei (18 decimals).
 */
export interface ActiveFractionGlwLeg {
  remainingSteps: number;
  stepWei: string;
}

/**
 * The sGCTL leg of a launchpad listing, or `null` when the listing has no
 * sGCTL leg (GLW-only / pre-consolidated-window era). `unitAtomic` is the
 * locked per-unit GCTL price in 6-decimal atomics (= fractions.sgctl_step_atomic),
 * NOT wei. `splitBonusPercent` (n) is present only for the new era and backs the
 * pinned +10 reward score economically; its presence era-gates boost math.
 */
export interface ActiveFractionSgctlLeg {
  remainingUnits: number;
  unitAtomic: string;
  splitBonusPercent: string | null;
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
  /**
   * Consolidated-launch-window shape: a single 9 AM ET visibility boundary plus
   * per-leg inventory. Read `glw.remainingSteps` / `sgctl.remainingUnits`
   * directly — never derive remaining from the legacy phase fields.
   */
  visibleAt?: string | null;
  glw?: ActiveFractionGlwLeg | null;
  sgctl?: ActiveFractionSgctlLeg | null;
  /**
   * @deprecated Legacy phase fields. The backend still emits these (computed
   * from the new model) so Control's tolerant gate and not-yet-deployed
   * frontends keep working during the deploy gap. Prefer `glw`/`sgctl`/
   * `visibleAt`. Do not gate UI on these once the new shape is available.
   */
  delegationAsset?: DelegationAsset;
  delegationPhase?: DelegationPhase;
  marketplaceVisibleAt?: string | null;
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
        | "glw"
      >
    | null
    | undefined
): boolean {
  if (!fraction) return false;

  const totalSteps = fraction.totalSteps ?? 0;
  const remainingSteps = resolveGlwRemainingSteps(fraction);

  return !fraction.isFilled && remainingSteps > 0 && totalSteps > 0;
}

/**
 * Whole GLW units still for sale. Reads the consolidated-launch-window
 * `glw.remainingSteps` leg directly. Falls back to the legacy step ledger
 * (totalSteps - splitsSold) only when the new leg is absent (deploy gap with a
 * not-yet-migrated payload) — and to `remainingSteps` if even the step counts
 * are missing.
 */
export function resolveGlwRemainingSteps(
  fraction:
    | Pick<
        ActiveFraction,
        "remainingSteps" | "totalSteps" | "splitsSold" | "glw"
      >
    | null
    | undefined,
): number {
  if (!fraction) return 0;

  const glwLeg = fraction.glw;
  if (
    glwLeg &&
    typeof glwLeg.remainingSteps === "number" &&
    Number.isFinite(glwLeg.remainingSteps)
  ) {
    return Math.max(0, Math.floor(glwLeg.remainingSteps));
  }

  // Legacy fallback: the exact step ledger (totalSteps - splitsSold). One step
  // is one whole unit, so this is precisely "GLW units left". Only fall back to
  // the API's amount-derived remainingSteps when the step counts are missing.
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

/**
 * Whole sGCTL units still for sale, or 0 when the listing has no sGCTL leg.
 * Reads the consolidated-launch-window `sgctl.remainingUnits` leg directly.
 */
export function resolveSgctlRemainingUnits(
  fraction: Pick<ActiveFraction, "sgctl"> | null | undefined,
): number {
  if (!fraction || !fraction.sgctl) return 0;
  const remainingUnits = fraction.sgctl.remainingUnits;
  if (typeof remainingUnits !== "number" || !Number.isFinite(remainingUnits)) {
    return 0;
  }
  return Math.max(0, Math.floor(remainingUnits));
}

export function isFractionPubliclyVisible(
  fraction:
    | Pick<ActiveFraction, "visibleAt" | "marketplaceVisibleAt">
    | null
    | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!fraction) return false;
  // Prefer the consolidated `visibleAt` (single 9 AM ET boundary; the API
  // returns the per-wallet effective value for early-access reads). Fall back to
  // the legacy `marketplaceVisibleAt` during the deploy gap.
  const effectiveVisibleAt = fraction.visibleAt ?? fraction.marketplaceVisibleAt;
  return isMarketplaceVisibleAt(effectiveVisibleAt, nowMs);
}

/**
 * Foundation backstop grace window. The sGCTL leg is publicly buyable for at
 * least this long after the listing becomes visible. Mirrors the backend
 * SGCTL_BACKSTOP_GRACE_PERIOD_MS (gca-crm sgctlBackstop.ts) so the UI freezes
 * in lockstep with the server.
 */
export const SGCTL_BACKSTOP_GRACE_PERIOD_MS = 60 * 60 * 1000; // 1 hour

/**
 * Organic sGCTL registrations are FROZEN — and the sGCTL tile must be hidden —
 * once BOTH hold:
 *   - the GLW leg is sold out (`glw.remainingSteps <= 0`), AND
 *   - the listing has been publicly visible for at least the 1h grace window
 *     (`now >= visibleAt + 1h`).
 * From that instant only the Foundation backstop fills the remaining sGCTL
 * units, so there is nothing left for a user to buy; showing the tile would
 * just open a dialog that the server rejects (the backend FREEZE,
 * isSgctlOrganicRegistrationFrozen / the /delegate-sgctl reject_frozen gate).
 *
 * NOTE: the grace is anchored to the listing's `visibleAt`. For an early-access
 * wallet the API returns that wallet's earlier effective visible-at, so the tile
 * may hide slightly sooner than the server's public-anchored freeze — the safe
 * direction (never shows a tile that can't be bought; at worst hides one that an
 * early-access wallet could still have bought during the public grace hour).
 */
export function isSgctlOrganicLegFrozen(
  fraction:
    | Pick<
        ActiveFraction,
        | "visibleAt"
        | "marketplaceVisibleAt"
        | "glw"
        | "remainingSteps"
        | "totalSteps"
        | "splitsSold"
      >
    | null
    | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!fraction) return false;
  if (resolveGlwRemainingSteps(fraction) > 0) return false;

  const effectiveVisibleAt = fraction.visibleAt ?? fraction.marketplaceVisibleAt;
  // No visible-at known: GLW is sold out and we can't time the grace, so fall
  // back to GLW-sold-out alone (conservative — hide, matching the server which
  // only backstop-fills once GLW is full).
  if (!effectiveVisibleAt) return true;
  const visibleAtMs = Date.parse(effectiveVisibleAt);
  if (!Number.isFinite(visibleAtMs)) return true;

  return getLaunchpadNowMs(nowMs) >= visibleAtMs + SGCTL_BACKSTOP_GRACE_PERIOD_MS;
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
  /**
   * Base64 EIP-712 payload (V2 miner early access). When present, the
   * backend may reveal mining-center listings before public visibility.
   */
  earlyAccessHeader?: string | null;
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

/**
 * Stable, SHORT discriminator for the React Query cache bucket of an
 * early-access read. The backend cache varies by the wallet AND the numeric
 * entitlement-minutes offset, and each early-access response is wallet-specific,
 * so a coarse constant ("early-access") risks transiently serving one wallet's
 * early window to another after a wallet/duration switch. We derive a short
 * djb2 hash of the base64 header (which encodes the wallet + signature) rather
 * than embedding the raw signature in the key. Returns `"public"` when there is
 * no header.
 */
export function earlyAccessQueryDiscriminator(
  earlyAccessHeader?: string | null,
): string {
  if (!earlyAccessHeader) return "public";
  let hash = 5381;
  for (let i = 0; i < earlyAccessHeader.length; i++) {
    hash = ((hash << 5) + hash + earlyAccessHeader.charCodeAt(i)) | 0;
  }
  // Unsigned hex keeps it short and collision-resistant enough for a cache key.
  return `early-access:${(hash >>> 0).toString(16)}`;
}

export async function fetchSponsorListings(
  filters: SponsorListingsFilters = {},
  earlyAccessHeader?: string | null,
): Promise<AuctionApplication[]> {
  const response = await fetch(buildSponsorListingsProxyUrl(filters), {
    cache: "no-store",
    headers: earlyAccessHeader
      ? { "x-glow-early-access": earlyAccessHeader }
      : undefined,
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
  const {
    filters = {},
    enabled = true,
    query: queryOptions,
    earlyAccessHeader,
  } = params;

  const query = useQuery({
    queryKey: [
      ...QUERY_KEYS.listings.sponsor(filters),
      earlyAccessQueryDiscriminator(earlyAccessHeader),
    ],
    enabled,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: queryOptions?.refetchInterval,
    refetchIntervalInBackground: queryOptions?.refetchIntervalInBackground,
    queryFn: async (): Promise<AuctionApplication[]> =>
      await fetchSponsorListings(filters, earlyAccessHeader),
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
  /**
   * Base64 EIP-712 payload (V2 early access). When present, the backend may
   * reveal launchpad GLW delegation listings before public visibility (mirrors
   * `useMiningCenter`). The sGCTL leg stays gated until the public window.
   */
  earlyAccessHeader?: string | null;
}

// launchpad listings are returned when `type` is omitted
export function useGlowLaunchpad(params: UseGlowLaunchpadParams = {}) {
  const { filters = {}, enabled = true, query, earlyAccessHeader } = params;
  return useSponsorListings({
    filters: { ...filters },
    enabled,
    query,
    earlyAccessHeader,
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
  earlyAccessHeader?: string | null;
}

// mining-center listings require `type=mining-center`
export function useMiningCenter(params: UseMiningCenterParams = {}) {
  const { filters = {}, enabled = true, query, earlyAccessHeader } = params;
  const { paymentCurrency: _paymentCurrency, ...restFilters } = filters;
  return useSponsorListings({
    filters: { ...restFilters, type: "mining-center" },
    enabled,
    query,
    earlyAccessHeader,
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
