"use client";

import { FarmsRouter } from "@glowlabs-org/utils/browser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";

// Constants
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

// Types based on the backend response
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
  address: string | null;
  farmOwnerName: string | null;
  lat: number | null;
  lng: number | null;
  estimatedKWhGeneratedPerYear: number | null;
}

export interface AuditFields {
  systemWattageOutput: number | null;
  averageSunlightHoursPerDay: number | null;
  adjustedWeeklyCarbonCredits: number | null;
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

export interface AuctionApplication {
  id: string;
  userId: string;
  status: string;
  createdAt: string;
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
}

export interface MiningMarketplaceFilters {
  zoneId?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  paymentCurrency?: PaymentCurrency;
}

export interface UseMiningMarketplaceParams {
  filters?: MiningMarketplaceFilters;
  enabled?: boolean;
}

if (!process.env.NEXT_PUBLIC_CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

const farmsRouter = FarmsRouter(process.env.NEXT_PUBLIC_CONTROL_API_URL);

export function useMiningMarketplace(params: UseMiningMarketplaceParams = {}) {
  const { filters = {}, enabled = true } = params;

  const queryKey = ["mining-marketplace", filters];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<AuctionApplication[]> => {
      const searchParams = new URLSearchParams();

      if (filters.zoneId !== undefined) {
        searchParams.append("zoneId", filters.zoneId.toString());
      }
      if (filters.sortBy) {
        searchParams.append("sortBy", filters.sortBy);
      }
      if (filters.sortOrder) {
        searchParams.append("sortOrder", filters.sortOrder);
      }
      if (filters.paymentCurrency) {
        searchParams.append("paymentCurrency", filters.paymentCurrency);
      }

      const url = `${HUB_URL}/applications/sponsor-listings-applications?${searchParams.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch auction applications: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as AuctionApplication[];
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    applications: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Helper hook to get unique zones from applications
export function useAvailableZones() {
  const { applications, isLoading } = useMiningMarketplace();

  const zones = applications.reduce((acc, app) => {
    const zone = app.zone;
    if (!acc.find((z) => z.id === zone.id)) {
      acc.push(zone);
    }
    return acc;
  }, [] as Zone[]);

  return {
    zones,
    isLoading,
  };
}

// Helper to get the asset price quote for a specific currency (how much 1 unit of asset is worth in USD)
export function getAssetPriceQuote(
  priceQuotes: ApplicationPriceQuote[],
  currency: PaymentCurrency
): string | null {
  if (!priceQuotes.length) return null;

  // Get the most recent price quote
  const latestQuote = priceQuotes[0];
  return latestQuote.prices[currency] || null;
}

// Helper to calculate protocol deposit amount in a specific currency
export function calculateProtocolDepositAmount(
  finalProtocolFee: string | null,
  priceQuotes: ApplicationPriceQuote[],
  currency: PaymentCurrency
): string | null {
  if (!finalProtocolFee || !priceQuotes.length) return null;

  const assetPriceQuote = getAssetPriceQuote(priceQuotes, currency);
  if (!assetPriceQuote) return null;

  try {
    // finalProtocolFee is in dollars, assetPriceQuote is dollars per unit of asset
    // So protocol deposit amount = finalProtocolFee / assetPriceQuote
    const protocolFeeInDollars = new Decimal(finalProtocolFee);
    const assetPriceInDollars = new Decimal(assetPriceQuote);

    if (assetPriceInDollars.isZero()) return null;

    const depositAmount = protocolFeeInDollars.div(assetPriceInDollars);
    return depositAmount.toString();
  } catch (e) {
    console.error("Error calculating protocol deposit amount:", e);
    return null;
  }
}

// Helper to calculate payment amount when buying GCTL with USDC/USDG
export function calculateGctlPaymentAmount(
  finalProtocolFee: string | null,
  priceQuotes: ApplicationPriceQuote[],
  gctlPriceInUSD: number
): string | null {
  if (!finalProtocolFee || !priceQuotes.length || !gctlPriceInUSD) return null;

  try {
    // First calculate how much GCTL is needed
    const gctlAmount = calculateProtocolDepositAmount(
      finalProtocolFee,
      priceQuotes,
      "GCTL"
    );
    if (!gctlAmount) return null;

    // Then multiply by current GCTL price to get USD amount
    const gctlAmountDecimal = new Decimal(gctlAmount);
    const gctlPrice = new Decimal(gctlPriceInUSD);

    const usdAmount = gctlAmountDecimal.mul(gctlPrice);
    return usdAmount.toString();
  } catch (e) {
    console.error("Error calculating GCTL payment amount:", e);
    return null;
  }
}

// Helper to get all available currencies for an application
export function getAvailableCurrencies(
  priceQuotes: ApplicationPriceQuote[]
): PaymentCurrency[] {
  if (!priceQuotes.length) return [];

  const latestQuote = priceQuotes[0];
  return Object.keys(latestQuote.prices).filter(
    (currency) =>
      latestQuote.prices[currency as PaymentCurrency] &&
      parseFloat(latestQuote.prices[currency as PaymentCurrency]) > 0
  ) as PaymentCurrency[];
}

// Sponsored farm type
export interface SponsoredFarm {
  id: string;
  applicationId: string;
  protocolDepositPaidAmount: string;
  protocolDepositPaidCurrency: string;
  builtAt: string;
  sponsorWallet: string;
  regionId: number;
  regionName?: string;
  farmOwnerName?: string;
  afterInstallPictures?: Document[];
}

// Sponsorship mutation hook
export interface SponsorApplicationParams {
  applicationId: string;
  amount: bigint;
  currency: string;
  txHash: string;
  onSuccess?: () => void;
}

// Hook to fetch sponsored farms
export function useSponsoredFarms(enabled: boolean = true) {
  const queryKey = ["sponsored-farms"];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await farmsRouter.fetchSponsoredFarms();
      return res;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    sponsoredFarms: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useSponsorApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SponsorApplicationParams) => {
      // Since the actual sponsorship happens through the forwarder contract,
      // this mutation is primarily for cache invalidation after successful sponsorship
      return {
        applicationId: params.applicationId,
        txHash: params.txHash,
        success: true,
      };
    },
    onSuccess: (data, variables) => {
      // Invalidate all mining marketplace queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["mining-marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["sponsored-farms"] });

      // Call the onSuccess callback if provided
      if (variables.onSuccess) {
        variables.onSuccess();
      }
    },
    onError: (error) => {
      console.error("Sponsorship mutation error:", error);
    },
  });
}
