"use client";

/**
 * V2 points hooks — spendable point balance, ledger, and award rates.
 *
 * All three hit the app-local proxy routes under `/api/points/*`, which
 * forward to the GCA CRM backend. Points are V2's spendable currency;
 * the UI must NOT present them as a leaderboard rank.
 */
import { useQuery } from "@tanstack/react-query";
import { v2ApiGet } from "@/lib/api/v2-api-client";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { STALE_TIMES } from "@/hooks/query-config";

export interface V2CurrentStreak {
  /** Consecutive qualifying protocol weeks (0 if the streak is broken). */
  streakWeek: number;
  protocolWeek: number;
  /** Whether the CURRENT protocol week has already qualified. */
  qualified: boolean;
  qualifiedAt: string | null;
  /** Points the next streak award would grant. */
  nextAwardPoints: number;
}

export interface V2PointsBalance {
  wallet: string;
  availablePoints: number;
  lifetimeEarnedPoints: number;
  lifetimeSpentPoints: number;
  openingBalancePoints: number;
  currentStreak: V2CurrentStreak;
  updatedAt: string;
}

/** A `points_ledger` row event type. `admin_correction` is rare. */
export type V2PointsEventType =
  | "legacy_points_migration"
  | "glw_delegation"
  | "sgctl_delegation"
  | "miner_purchase"
  | "weekly_streak"
  | "referral"
  | "shop_purchase"
  | "admin_correction";

/**
 * Plain, user-facing labels for each ledger event type. The V2 spec
 * requires ledger rows to read as plain reasons, not internal codes.
 * Shared so the points balance UI and the activity feed agree.
 */
export const POINTS_EVENT_LABELS: Record<V2PointsEventType, string> = {
  legacy_points_migration: "Legacy points migration",
  glw_delegation: "GLW delegation",
  sgctl_delegation: "sGCTL delegation",
  miner_purchase: "Miner purchase",
  weekly_streak: "Weekly streak",
  referral: "Referral",
  shop_purchase: "Shop purchase",
  admin_correction: "Admin correction",
};

export interface V2PointsLedgerRow {
  id: string;
  createdAt: string;
  eventType: V2PointsEventType;
  pointsDelta: string;
  balanceAfter: string;
  usdValue6: string | null;
  rateApplied: { rateKey: string; value: string } | null;
  reason: string;
  sourceFarmId: string | null;
  sourceFractionId: string | null;
  protocolWeek: number | null;
  metadata: Record<string, unknown> | null;
}

export interface V2PointsLedgerResponse {
  wallet: string;
  rows: V2PointsLedgerRow[];
  nextCursor: string | null;
}

export interface V2PointsRates {
  asOf: string;
  rates: {
    glwDelegationPointsPerUsd: number | null;
    sgctlDelegationPointsPerUsd: number | null;
    minerPurchasePointsPerUsd: number | null;
    streak: {
      perWeek: number | null;
      capWeek: number | null;
      capPoints: number | null;
    };
    shopMinerPointsPerUsd?: number | null;
    shopWattsPointsPerWatt?: number | null;
    [key: string]: unknown;
  };
}

export function useV2PointsBalance(wallet: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.v2.pointsBalance(wallet),
    queryFn: () =>
      v2ApiGet<V2PointsBalance>(
        `/api/points/balance?wallet=${encodeURIComponent(wallet!)}`,
      ),
    enabled: Boolean(wallet),
    staleTime: STALE_TIMES.NORMAL,
    refetchOnWindowFocus: false,
  });
}

export function useV2PointsLedger(
  wallet: string | null | undefined,
  options: { limit?: number } = {},
) {
  const limit = options.limit ?? 50;
  return useQuery({
    queryKey: QUERY_KEYS.v2.pointsLedger(wallet, limit),
    queryFn: () =>
      v2ApiGet<V2PointsLedgerResponse>(
        `/api/points/ledger?wallet=${encodeURIComponent(wallet!)}&limit=${limit}`,
      ),
    enabled: Boolean(wallet),
    staleTime: STALE_TIMES.NORMAL,
    refetchOnWindowFocus: false,
  });
}

export function useV2PointsRates() {
  return useQuery({
    queryKey: QUERY_KEYS.v2.pointsRates(),
    queryFn: () => v2ApiGet<V2PointsRates>("/api/points/rates"),
    staleTime: STALE_TIMES.SLOW,
    refetchOnWindowFocus: false,
  });
}
