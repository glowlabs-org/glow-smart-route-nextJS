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
  /**
   * Points accrued so far during the CURRENT week (this-week running
   * total), as opposed to `nextAwardPoints` which is the amount the NEXT
   * streak award would grant. Optional: the backend may not ship it yet.
   */
  projectedCurrentWeekPoints?: number;
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

export interface V2WattsActivityRow {
  farmId: string;
  farmName: string;
  regionId: number;
  watts: string;
  createdAt: string;
}

export interface V2WattsActivity {
  wallet: string;
  rows: V2WattsActivityRow[];
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

/**
 * Like {@link useV2PointsLedger} but follows the `nextCursor` and returns the
 * ENTIRE ledger, not just the latest page.
 *
 * The backend silently clamps `limit` to 200 per page (and returns a
 * `nextCursor`), so any consumer that needs to aggregate across the whole
 * ledger (e.g. the per-category breakdown sums, which must reconcile to the
 * spendable balance) cannot rely on a single fetch. Eclipse-Prime referrers
 * blow past 200 rows quickly because realtime referral writes one row per
 * referee earning event, on top of weekly streak rows.
 *
 * A page cap guards against an unexpectedly huge ledger; if it is hit,
 * `truncated` is set so callers can decide whether the sums are trustworthy.
 */
export function useV2PointsLedgerAll(
  wallet: string | null | undefined,
  options: { pageSize?: number; maxPages?: number } = {},
) {
  const pageSize = Math.min(options.pageSize ?? 200, 200);
  const maxPages = options.maxPages ?? 50;
  return useQuery({
    queryKey: QUERY_KEYS.v2.pointsLedgerAggregate(wallet, pageSize),
    queryFn: async () => {
      const allRows: V2PointsLedgerRow[] = [];
      let cursor: string | null = null;
      let pages = 0;
      let truncated = false;
      do {
        const qs = new URLSearchParams({
          wallet: wallet!,
          limit: String(pageSize),
        });
        if (cursor) qs.set("cursor", cursor);
        const page: V2PointsLedgerResponse = await v2ApiGet<V2PointsLedgerResponse>(
          `/api/points/ledger?${qs.toString()}`,
        );
        allRows.push(...page.rows);
        cursor = page.nextCursor;
        pages += 1;
        if (cursor && pages >= maxPages) {
          truncated = true;
          break;
        }
      } while (cursor);
      return { wallet: wallet ?? "", rows: allRows, truncated };
    },
    enabled: Boolean(wallet),
    staleTime: STALE_TIMES.NORMAL,
    refetchOnWindowFocus: false,
  });
}

export function useV2WattsActivity(
  wallet: string | null | undefined,
  options: { limit?: number } = {},
) {
  const limit = options.limit ?? 50;
  return useQuery({
    queryKey: QUERY_KEYS.v2.wattsActivity(wallet, limit),
    queryFn: () =>
      v2ApiGet<V2WattsActivity>(
        `/api/points/watts-activity?wallet=${encodeURIComponent(wallet!)}&limit=${limit}`,
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
