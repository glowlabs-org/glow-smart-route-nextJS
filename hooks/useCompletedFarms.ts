"use client";

import { PaymentCurrency } from "@glowlabs-org/utils/browser";
import { useQuery } from "@tanstack/react-query";

// Minimal shape based on the CRM completed applications endpoint
export interface CompletedApplication {
  id: string;
  status: string;
  createdAt?: string;
  paymentDate?: string | null;
  installFinishedDate?: string | null;
  revisedInstallFinishedDate?: string | null;
  gcaAcceptanceTimestamp?: string | null;
  paymentCurrency: PaymentCurrency;
  netCarbonCreditEarningWeekly: string;
  solarPanelsQuantity: number;
  paymentAmount: string;
  sponsorSplitPercent?: number | null;
  fractions?: Array<{
    id?: string;
    status?: string;
    type?: string;
    sponsorSplitPercent?: number | null;
    isFilled?: boolean | null;
  }>;
  farm?: {
    id: string;
    auditCompleteDate?: string | null;
    name?: string;
    region?: string;
    regionFullName?: string;
  } | null;
  zone?: {
    id: number;
    name: string;
    isActive?: boolean;
    isAcceptingSponsors?: boolean;
  } | null;
}

interface UseCompletedFarmsParams {
  enabled?: boolean;
  includeFractions?: boolean;
}

const COMPLETED_FARMS_URL = "/api/applications/completed/summary";
const COMPLETED_FARMS_FULL_URL = "/api/applications/completed";

export function useCompletedFarms(params: UseCompletedFarmsParams = {}) {
  const { enabled = true, includeFractions = false } = params;

  const query = useQuery<CompletedApplication[]>({
    queryKey: ["completed-farms", includeFractions],
    enabled,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
    queryFn: async () => {
      const url = includeFractions
        ? COMPLETED_FARMS_FULL_URL
        : COMPLETED_FARMS_URL;
      const res = await fetch(url, {
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch completed farms: ${res.status}`);
      }
      const data = (await res.json()) as CompletedApplication[];
      return Array.isArray(data) ? data : [];
    },
  });

  return {
    farms: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}
