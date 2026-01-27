"use client";

import { useQuery } from "@tanstack/react-query";

export interface ReferralDashboardTopReferrer {
  referrerWallet: string;
  activeReferees: number;
  totalReferees: number;
  pendingReferees: number;
  ensName?: string;
  tier: string;
  tierPercent: number;
}

export interface ReferralDashboardRecentReferral {
  referrerWallet: string;
  refereeWallet: string;
  status: string;
  linkedAt: string;
  activatedAt?: string;
  gracePeriodEndsAt: string;
  referralCode: string;
  isInGracePeriod: boolean;
}

export interface ReferralDashboardWeeklyStat {
  weekNumber: number;
  totalReferrerPoints: string;
  totalRefereeBonusPoints: string;
  totalActivationBonusPoints: string;
  uniqueReferrers: number;
  uniqueReferees: number;
}

export interface ReferralDashboardResponse {
  overview: {
    totalReferrals: number;
    activeReferrals: number;
    pendingReferrals: number;
    inGracePeriod: number;
    inBonusPeriod: number;
    activationBonusesAwarded: number;
    totalCodesGenerated: number;
    uniqueReferrers: number;
  };
  tierDistribution: {
    seed: number;
    grow: number;
    scale: number;
    legend: number;
  };
  topReferrers: ReferralDashboardTopReferrer[];
  recentReferrals: ReferralDashboardRecentReferral[];
  weeklyStats: ReferralDashboardWeeklyStat[];
  totalPointsAllTime: {
    referrerPoints: string;
    refereeBonusPoints: string;
    activationBonusPoints: string;
  };
  currentWeek: number;
}

export function useReferralDashboard() {
  const query = useQuery<ReferralDashboardResponse>({
    queryKey: ["referral-dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/referral-dashboard");

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch referral dashboard: ${response.status} - ${errorText}`
        );
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
