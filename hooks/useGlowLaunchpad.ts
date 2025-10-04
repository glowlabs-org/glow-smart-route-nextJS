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
  lat: number | null;
  lng: number | null;
  estimatedKWhGeneratedPerYear: number | null;
}

export interface AuditFields {
  systemWattageOutput: number | null;
  averageSunlightHoursPerDay: number | null;
  expectedWeeklyCarbonCredits: number | null;
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
  step: string; // Price per step in GLW
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

if (!process.env.NEXT_PUBLIC_CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

export function useGlowLaunchpad(params: UseGlowLaunchpadParams = {}) {
  const { filters = {}, enabled = true } = params;

  const queryKey = ["glow-launchpad", filters];

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
export function useAvailableZones(applications: AuctionApplication[] = []) {
  const zones = applications.reduce((acc, app) => {
    const zone = app.zone;
    if (!acc.find((z) => z.id === zone.id)) {
      acc.push(zone);
    }
    return acc;
  }, [] as Zone[]);

  return {
    zones,
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

// Splits activity types
export interface SplitActivity {
  // Split transaction details
  transactionHash: string;
  blockNumber: number;
  buyer: string;
  creator: string;
  stepsPurchased: number;
  amount: string; // BigInt as string
  step: string; // BigInt as string
  timestamp: number;
  purchaseDate: string;

  // Fraction context
  fractionId: string;
  applicationId: string;
  fractionType?: "mining-center" | "launchpad";
  fractionStatus: string;
  currency: PaymentCurrency;
  isFilled: boolean;
  progressPercent: number;
  rewardScore: number | null;

  // Purchase value calculation
  stepPrice: string; // BigInt as string
  totalValue: string; // BigInt as string
}

export interface SplitsActivityResponse {
  activity: SplitActivity[];
  fractionType?: "mining-center" | "launchpad";
  summary: {
    totalTransactions: number;
    totalStepsPurchased: number;
    totalAmountSpent: string; // BigInt as string
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

// Sponsorship mutation hook
export interface SponsorApplicationParams {
  applicationId: string;
  amount: bigint;
  currency: string;
  txHash: string;
  onSuccess?: () => void;
}

// Hook to fetch splits activity
export function useSplitsActivity(params: UseSplitsActivityParams = {}) {
  const { limit = 50, walletAddress, fractionType, enabled = true } = params;

  const queryKey = ["splits-activity", limit, walletAddress, fractionType];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<SplitsActivityResponse> => {
      const searchParams = new URLSearchParams();

      if (limit) {
        searchParams.append("limit", limit.toString());
      }
      if (walletAddress) {
        searchParams.append("walletAddress", walletAddress);
      }
      if (fractionType) {
        searchParams.append("fractionType", fractionType);
      }

      // Use the new endpoint when fractionType is specified
      const endpoint = fractionType
        ? "/fractions/splits-activity-by-type"
        : "/fractions/splits-activity";
      const url = `${HUB_URL}${endpoint}?${searchParams.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch splits activity: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      return data as SplitsActivityResponse;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter than sponsored farms since this is more dynamic
    refetchOnWindowFocus: true,
    refetchInterval: 30_000, // Refetch every 30 seconds for real-time activity
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
      // Invalidate all glow launchpad queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["glow-launchpad"] });
      queryClient.invalidateQueries({ queryKey: ["splits-activity"] });
      queryClient.invalidateQueries({ queryKey: ["mining-scores"] });
      queryClient.invalidateQueries({ queryKey: ["reward-scores"] });
      queryClient.invalidateQueries({ queryKey: ["mining-center"] });

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
