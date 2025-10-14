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
}

const COMPLETED_FARMS_URL =
  "https://gca-crm-backend-production-1f2a.up.railway.app/applications/completed";

export function useCompletedFarms(params: UseCompletedFarmsParams = {}) {
  const { enabled = true } = params;

  const query = useQuery<CompletedApplication[]>({
    queryKey: ["completed-farms"],
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetch(COMPLETED_FARMS_URL, {
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
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } as const;
}
