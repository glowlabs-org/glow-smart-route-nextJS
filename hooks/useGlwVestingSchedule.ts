"use client";

import { useQuery } from "@tanstack/react-query";

export interface GlwVestingScheduleApiResponse {
  type: "csv" | "json";
  csv: string | null;
  json: unknown | null;
}

export interface VestingChartPoint {
  year: string;
  unlocked: number; // in millions (for chart labeling)
}

function normalizeAmountToGlw(amount: unknown): number | null {
  if (amount === null || amount === undefined) return null;
  const n = typeof amount === "string" ? Number(amount) : (amount as number);
  if (!Number.isFinite(n)) return null;

  // Heuristic: if it looks like wei, scale down to tokens.
  if (n > 1e15) return n / 1e18;
  return n;
}

function parseJsonToYearlyPoints(json: unknown): VestingChartPoint[] | null {
  if (!Array.isArray(json)) return null;

  // CRM `/glw/vesting-schedule` rows are a time series where `unlocked` is
  // cumulative (not "amount unlocked during this period"). For the yearly chart
  // we want the year-end unlocked value, not the sum of monthly cumulative rows.
  const byYear = new Map<string, { dateLike: string | null; unlocked: number }>();

  for (const row of json) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;

    const yearRaw =
      (typeof r.year === "string" && r.year) ||
      (typeof r.vesting_year === "string" && r.vesting_year) ||
      null;

    const dateLike =
      (typeof r.date === "string" && r.date) ||
      (typeof r.timestamp === "string" && r.timestamp) ||
      (typeof r.start_date === "string" && r.start_date) ||
      null;

    const year = yearRaw ?? (dateLike ? dateLike.slice(0, 4) : null);
    if (!year || !/^\d{4}$/.test(year)) continue;

    const amount =
      normalizeAmountToGlw(r.unlocked) ??
      normalizeAmountToGlw(r.amount) ??
      normalizeAmountToGlw(r.glw) ??
      normalizeAmountToGlw(r.unlocked_glw) ??
      normalizeAmountToGlw(r.unlockedWei);

    if (amount === null) continue;

    const prev = byYear.get(year) ?? null;
    const next = { dateLike: dateLike ?? null, unlocked: amount };

    if (!prev) {
      byYear.set(year, next);
      continue;
    }

    // Prefer the latest dated row when available; otherwise take the max value.
    if (prev.dateLike && next.dateLike) {
      byYear.set(year, prev.dateLike >= next.dateLike ? prev : next);
      continue;
    }

    byYear.set(year, {
      dateLike: prev.dateLike ?? next.dateLike,
      unlocked: Math.max(prev.unlocked, next.unlocked),
    });
  }

  const points = Array.from(byYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, row]) => ({
      year,
      unlocked: row.unlocked / 1_000_000,
    }));

  return points.length ? points : null;
}

function parseCsvToYearlyPoints(csv: string): VestingChartPoint[] | null {
  // Best-effort: accept either "year,unlocked_m" rows, or "date,amount" rows.
  const lines = csv
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const header = lines[0]!.toLowerCase();
  const rows = lines.slice(1);

  const byYear = new Map<string, number>();

  for (const row of rows) {
    const cols = row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 2) continue;

    // If there's an explicit year column
    if (header.includes("year")) {
      const year = cols[0]!;
      const val = Number(cols[1]);
      if (!year || !Number.isFinite(val)) continue;
      byYear.set(year, (byYear.get(year) ?? 0) + val);
      continue;
    }

    // Otherwise treat first column as date-like and second as amount (GLW).
    const dateLike = cols[0]!;
    const amount = Number(cols[1]);
    if (!dateLike || !Number.isFinite(amount)) continue;
    const year = dateLike.slice(0, 4);
    if (!/^\d{4}$/.test(year)) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + amount);
  }

  const points = Array.from(byYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, amount]) => ({
      year,
      // Normalize to "millions" for the existing chart axis labels.
      unlocked: amount / 1_000_000,
    }));

  return points.length ? points : null;
}

export function useGlwVestingSchedule(params: { enabled?: boolean } = {}) {
  const { enabled = true } = params;

  return useQuery({
    queryKey: ["glw-vesting-schedule"] as const,
    enabled,
    staleTime: 300_000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch("/api/glw-vesting-schedule");
      if (!res.ok)
        throw new Error(`Failed to load vesting schedule (${res.status})`);
      const payload = (await res.json()) as GlwVestingScheduleApiResponse;
      const csv = payload?.type === "csv" ? payload.csv : null;
      const points =
        payload?.type === "json"
          ? parseJsonToYearlyPoints(payload.json)
          : csv
            ? parseCsvToYearlyPoints(csv)
            : null;
      return { raw: payload, points };
    },
  });
}
