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
  referrerPendingPointsScaled6?: string;
  refereePendingPointsScaled6?: string;
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
  newRefereeActivations: {
    total: number;
    truncated: boolean;
    rows: Array<{
      refereeWallet: string;
      referrerWallet: string;
      linkedAt: string;
      lastWeekBasePointsScaled6: string;
      projectedBasePointsScaled6: string;
      inflationPointsScaled6: string;
      steeringPointsScaled6: string;
      vaultPointsScaled6: string;
      worthPointsScaled6: string;
    }>;
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

export interface ReferralDashboardOverviewResponse {
  overview: ReferralDashboardResponse["overview"];
  tierDistribution: ReferralDashboardResponse["tierDistribution"];
  currentWeek: number;
}

export interface ReferralDashboardTopReferrersResponse {
  topReferrers: ReferralDashboardTopReferrer[];
}

export interface ReferralDashboardRecentReferralsResponse {
  recentReferrals: ReferralDashboardRecentReferral[];
}

export interface ReferralDashboardWeeklyStatsResponse {
  weeklyStats: ReferralDashboardWeeklyStat[];
  totalPointsAllTime: ReferralDashboardResponse["totalPointsAllTime"];
  currentWeek: number;
}

export interface ReferralDashboardNewRefereesResponse {
  newRefereeActivations: ReferralDashboardResponse["newRefereeActivations"];
}

export type ReferralDashboardKolPaybackRangePreset =
  | "this_week"
  | "past_month"
  | "past_3_months"
  | "past_6_months"
  | "year_to_date"
  | "all_time";

export interface ReferralDashboardKolPaybackResponse {
  range: {
    preset: string;
    startWeek: number;
    endWeek: number;
    startWeekAt: string;
    endWeekAt: string;
  };
  program: {
    paybackPercent: number;
    eligibleKolWallets: string[];
    eligibilityRule: string;
  };
  summary: {
    totalEligibleSales: number;
    totalMinerSalesRaw: string;
    totalMinerSalesUsdc: string;
    totalPaybackRaw: string;
    totalPaybackUsdc: string;
  };
  kols: Array<{
    kolWallet: string;
    paybackPercent: number;
    totalMinerSalesRaw: string;
    totalMinerSalesUsdc: string;
    totalPaybackRaw: string;
    totalPaybackUsdc: string;
    weeks: Array<{
      weekNumber: number;
      label: string;
      startAt: string;
      endAt: string;
      saleCount: number;
      uniqueBuyers: number;
      totalMinerSalesRaw: string;
      totalMinerSalesUsdc: string;
      totalPaybackRaw: string;
      totalPaybackUsdc: string;
      sales: Array<{
        kolWallet: string;
        weekNumber: number;
        weekLabel: string;
        weekStartAt: string;
        weekEndAt: string;
        kolPaybackEligible: true;
        buyer: string;
        transactionHash: string;
        stepsPurchased: number;
        amountRaw: string;
        amountUsdc: string;
        paybackRaw: string;
        paybackUsdc: string;
        saleAt: string;
        referralLinkedAt: string;
        referralActivatedAt: string | null;
        referralStatus: string;
        fractionId: string;
        applicationId: string;
        farmId: string | null;
        farmName: string | null;
      }>;
    }>;
  }>;
}

function fetchSection<T>(path: string) {
  return async (): Promise<T> => {
    const response = await fetch(path);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch ${path}: ${response.status} - ${errorText}`);
    }
    return response.json();
  };
}

export function useReferralDashboardOverview() {
  return useQuery<ReferralDashboardOverviewResponse>({
    queryKey: ["referral-dashboard", "overview"],
    queryFn: fetchSection("/api/referral-dashboard/overview"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useReferralDashboardTopReferrers() {
  return useQuery<ReferralDashboardTopReferrersResponse>({
    queryKey: ["referral-dashboard", "top-referrers"],
    queryFn: fetchSection("/api/referral-dashboard/top-referrers"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useReferralDashboardRecentReferrals() {
  return useQuery<ReferralDashboardRecentReferralsResponse>({
    queryKey: ["referral-dashboard", "recent-referrals"],
    queryFn: fetchSection("/api/referral-dashboard/recent-referrals"),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useReferralDashboardWeeklyStats() {
  return useQuery<ReferralDashboardWeeklyStatsResponse>({
    queryKey: ["referral-dashboard", "weekly-stats"],
    queryFn: fetchSection("/api/referral-dashboard/weekly-stats"),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useReferralDashboardNewReferees() {
  return useQuery<ReferralDashboardNewRefereesResponse>({
    queryKey: ["referral-dashboard", "new-referees"],
    queryFn: fetchSection("/api/referral-dashboard/new-referees"),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useReferralDashboardKolPayback(
  rangePreset: ReferralDashboardKolPaybackRangePreset
) {
  return useQuery<ReferralDashboardKolPaybackResponse>({
    queryKey: ["referral-dashboard", "kol-payback-export", rangePreset],
    queryFn: fetchSection(
      `/api/referral-dashboard/kol-payback-export?rangePreset=${rangePreset}`
    ),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
