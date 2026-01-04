"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { hubGet } from "@/lib/api/hub-client";

export type PaymentCurrency = "USDG" | "USDC" | "GLW" | "GCTL";

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
  status: string;
  sponsorSplitPercent: number;
  createdAt: string;
  expirationAt: string | null;
  isCommittedOnChain: boolean;
  isFilled: boolean;
  totalSteps: number;
  splitsSold: number;
  stepPrice: string;
  step: string;
  token: string;
  owner: string;
  txHash: string | null;
  progressPercent: number;
  remainingSteps: number | null;
  amountRaised: string | null;
  totalAmountNeeded: string | null;
  rewardScore: number | null;
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
}

export interface UseSponsorListingsParams {
  filters?: SponsorListingsFilters;
  enabled?: boolean;
}

export function useSponsorListings(params: UseSponsorListingsParams = {}) {
  const { filters = {}, enabled = true } = params;
  const queryKey = ["sponsor-listings", filters] as const;

  const query = useQuery({
    queryKey,
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<AuctionApplication[]> => {
      const searchParams: Record<string, string | number | undefined> = {};

      // Backwards compatibility with the existing API behavior:
      // - launchpad listings are returned when `type` is omitted
      // - mining-center listings require `type=mining-center`
      if (filters.type === "mining-center") searchParams.type = "mining-center";
      if (filters.zoneId !== undefined) searchParams.zoneId = filters.zoneId;
      if (filters.sortBy) searchParams.sortBy = filters.sortBy;
      if (filters.sortOrder) searchParams.sortOrder = filters.sortOrder;
      if (filters.paymentCurrency) searchParams.paymentCurrency = filters.paymentCurrency;

      return await hubGet<AuctionApplication[]>(
        "/applications/sponsor-listings-applications",
        { params: searchParams }
      );
    },
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
}

export interface UseGlowLaunchpadParams {
  filters?: GlowLaunchpadFilters;
  enabled?: boolean;
}

// launchpad listings are returned when `type` is omitted
export function useGlowLaunchpad(params: UseGlowLaunchpadParams = {}) {
  const { filters = {}, enabled = true } = params;
  return useSponsorListings({
    filters: { ...filters },
    enabled,
  });
}

export interface MiningCenterFilters {
  zoneId?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  paymentCurrency?: PaymentCurrency;
}

export interface UseMiningCenterParams {
  filters?: MiningCenterFilters;
  enabled?: boolean;
}

// mining-center listings require `type=mining-center`
export function useMiningCenter(params: UseMiningCenterParams = {}) {
  const { filters = {}, enabled = true } = params;
  return useSponsorListings({
    filters: { ...filters, type: "mining-center" },
    enabled,
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
  farmName: string;
  fractionType?: "mining-center" | "launchpad";
  fractionStatus: string;
  currency: PaymentCurrency;
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
}

export function useSplitsActivity(params: UseSplitsActivityParams = {}) {
  const { limit = 50, walletAddress, fractionType, enabled = true } = params;

  const queryKey = ["splits-activity", limit, walletAddress, fractionType] as const;

  const query = useQuery({
    queryKey,
    enabled,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
    queryFn: async (): Promise<SplitsActivityResponse> => {
      const endpoint = fractionType
        ? "/fractions/splits-activity-by-type"
        : "/fractions/splits-activity";

      return await hubGet<SplitsActivityResponse>(endpoint, {
        params: { limit, walletAddress, fractionType },
      });
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
      queryClient.invalidateQueries({ queryKey: ["sponsor-listings"] });
      queryClient.invalidateQueries({ queryKey: ["splits-activity"] });
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


