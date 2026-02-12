"use client";

import React from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FallbackImage } from "@/components/ui/fallback-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { GlowSymbol } from "@/components/glow-symbol";
import {
  useGctlApi,
  useActiveRegionsSummary,
  useGctlHoldersCount,
  useTotalActivelyDelegated,
  useActivelyDelegatedByWeek,
} from "@/hooks";
import {
  useImpactNewWalletsByWeek,
  useImpactWalletStats,
} from "@/hooks/hub-impact";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { useGlowCirculatingSnapshot } from "@/hooks/useGlowCirculatingSnapshot";
import { usePoolInfo } from "@/hooks/useLiquidityPositionsOptimized";
import { useImpactMetrics } from "@/hooks/useImpactMetrics";
import { usePolLiquiditySnapshot } from "@/hooks/usePolLiquiditySnapshot";
import { usePolLiquidity } from "@/hooks/usePolLiquidity";
import { usePolSummary } from "@/hooks/usePolSummary";
import {
  parseLqUnits,
  usePolRevenueAggregate,
  usePolRevenueFarms,
  usePolRevenueRegions,
} from "@/hooks/usePolRevenue";
import { useGlwVestingSchedule } from "@/hooks/useGlwVestingSchedule";
import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";

import { formatUnits } from "viem";
import { getCurrentWeekNumber } from "@/lib/rewards/weekly-delegations";

const PRICE_RANGE = { min: 0.001, max: 100 };
const SECONDS_PER_WEEK = 7 * 24 * 60 * 60;
const LIQUIDITY_UNIT = "Ⱡ";
const POL_LIQUIDITY_V2_START_WEEK = 97;
const FDV_TOTAL_TOKENS_GLW = 180_000_000;
const MINER_INFLATION_PER_WEEK_GLW = 175_000;
const VETO_COUNCIL_INFLATION_PER_WEEK_GLW = 5_000;
const MIN_LIFETIME_REVENUE_LQ = 2_000;
const DEFINED_FI_GLOW_URL =
  "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";

// TODO: mock data (fallback if live regions unavailable)
const GCTL_REGIONS = [
  { name: "Golden Colorado", value: 38, color: "#a855f7" },
  { name: "Rising Utah", value: 24, color: "#2081e2" },
  { name: "Shining Missouri", value: 18, color: "#ffb472" },
  { name: "Clean Grid", value: 12, color: "#4ade80" },
  { name: "Other", value: 8, color: "#94a3b8" },
];

// TODO: mock data (delegation trend + APY history)
// TODO: mock data (vesting schedule)
const VESTING_SCHEDULE = [
  { year: "2024", unlocked: 10 },
  { year: "2025", unlocked: 18 },
  { year: "2026", unlocked: 28 },
  { year: "2027", unlocked: 44 },
  { year: "2028", unlocked: 60 },
  { year: "2029", unlocked: 72 },
  { year: "2030", unlocked: 86 },
];

const VESTING_CATEGORIES = [
  { key: "solarFarms" as const, label: "Solar farms", color: "#4ade80" },
  { key: "grants" as const, label: "Grants", color: "#ffb472" },
  { key: "governance" as const, label: "Governance", color: "#a855f7" },
  { key: "ecosystem" as const, label: "Ecosystem", color: "#2081e2" },
  {
    key: "earlyStageFunding" as const,
    label: "Early stage funding",
    color: "#d792ff",
  },
  {
    key: "lateStageFunding" as const,
    label: "Late stage funding",
    color: "#06b6d4",
  },
  {
    key: "grantsBootstrap" as const,
    label: "Grants bootstrap",
    color: "#facc15",
  },
  {
    key: "earlyLiquidityBootstrap" as const,
    label: "Liquidity bootstrap",
    color: "#f87171",
  },
];

const vestingCategoryChartConfig = Object.fromEntries(
  VESTING_CATEGORIES.map((c) => [c.key, { label: c.label, color: c.color }])
) as Record<string, { label: string; color: string }> satisfies ChartConfig;

const vestingChartConfig = {
  unlocked: { label: "Unlocked supply", color: "#ffb472" },
} satisfies ChartConfig;

const delegationTrendChartConfig = {
  delegated: { label: "GLW delegated (M)", color: "hsl(270, 70%, 60%)" },
} satisfies ChartConfig;

const gctlRegionChartConfig = Object.fromEntries(
  GCTL_REGIONS.map((r) => [r.name, { label: r.name, color: r.color }])
) as Record<string, { label: string; color: string }> satisfies ChartConfig;

const GCTL_REGION_PIE_DATA = GCTL_REGIONS.map((r) => ({
  name: r.name,
  value: Math.round((284_000 * r.value) / 100),
  fill: r.color,
  pct: r.value,
}));

const walletGrowthChartConfig = {
  newWallets: { label: "New wallets", color: "hsl(215, 90%, 55%)" },
} satisfies ChartConfig;

const polLiquidityChartConfig = {
  liquidity: { label: "PoL liquidity", color: "hsl(142, 71%, 45%)" },
} satisfies ChartConfig;

const REGION_COLORS: Record<string, string> = {
  "Golden Colorado": "#a855f7",
  "Rising Utah": "#2081e2",
  "Shining Missouri": "#ffb472",
  "Clean Grid Project": "#4ade80",
};
const DEFAULT_REGION_COLOR = "#94a3b8";

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
        {title}
      </div>
      {subtitle ? (
        <p className="text-sm text-muted-foreground max-w-3xl">{subtitle}</p>
      ) : null}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUsdCompact(value: number) {
  return formatUsdCompactPrecise(value);
}

function formatUsdCompactNullable(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return formatUsdCompact(value);
}

// For hero KPIs where we always want compact currency formatting (e.g. `$335.7K`)
// instead of switching to full numbers in the mid-six-fig range.
function formatUsdCompactHero(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: abs < 1 ? 4 : 2,
  }).format(value);
}

function formatUsdCompactPrecise(value: number) {
  const abs = Math.abs(value);

  // Keep USD formatting consistent with compact numbers:
  // - Avoid confusing outputs like `$359.922K`.
  // - For mid 6-figure values, show the full number instead of `K`.
  if (abs >= 100_000 && abs < 1_000_000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (abs >= 1_000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: abs < 1 ? 4 : 2,
  }).format(value);
}

function formatUsdWhole(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactNumberPrecise(value: number) {
  const abs = Math.abs(value);

  // Avoid confusing outputs like `359.922K`:
  // - If we use compact (K/M/B), cap at 1 decimal.
  // - For mid 6-figure values, show the full number instead of a highly precise `K`.
  if (abs >= 100_000 && abs < 1_000_000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
      value
    );
  }

  if (abs >= 1_000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: abs < 10 ? 2 : 1,
  }).format(value);
}

function formatCompactNumberTwoDecimals(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLiquidityCompact(value: number) {
  return `${LIQUIDITY_UNIT}${formatCompactNumberPrecise(value)}`;
}

function formatSignedLiquidityCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${LIQUIDITY_UNIT}${formatCompactNumberPrecise(
    Math.abs(value)
  )}`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatSignedNumber(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatNumber(value)}`;
}

function formatNullableNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return formatNumber(value);
}

function formatNullableCompact(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return formatCompactNumberPrecise(value);
}

function formatNullableFixed(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatDateShortUtc(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatDateAxisUtc(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatMonthAxisUtc(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(value);
}

function getWeekStartMs(weekNumber: number) {
  return (GENESIS_TIMESTAMP + weekNumber * SECONDS_PER_WEEK) * 1000;
}

function getWeekEndMs(weekNumber: number) {
  return getWeekStartMs(weekNumber) + SECONDS_PER_WEEK * 1000;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : null;
  if (parsed === null || !Number.isFinite(parsed)) return null;
  return parsed;
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  const random = mulberry32(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled;
}

function reservesToLiquidity(usdc: number, glw: number) {
  return Math.sqrt(Math.abs(usdc) * Math.abs(glw));
}

function getBreakdownFromLq(liquidity: number, pricePerGlw: number) {
  const normalizedPrice = Math.max(pricePerGlw, 0.0001);
  const absLq = Math.abs(liquidity);
  const usdgSide = absLq * Math.sqrt(normalizedPrice);
  const glwSide = usdgSide / normalizedPrice;

  return {
    usdgSide,
    glwSide,
    breakdown: `$${formatCompactNumber(usdgSide)} / ${formatCompactNumber(
      glwSide
    )} GLW`,
  };
}

function getLiquidityFromReserves(usdc: number, glw: number) {
  const liquidity = reservesToLiquidity(usdc, glw);

  return {
    liquidity,
    value: formatLiquidityCompact(liquidity),
    breakdown: `$${formatCompactNumber(usdc)} / ${formatCompactNumber(
      glw
    )} GLW`,
  };
}

function isSolarPanelsImageUrl(url: string) {
  const lower = url.toLowerCase();
  // Heuristic: our curated farm photos that show panels are typically saved as
  // "after_install_pictures_*" (often drone shots). Keep strict to avoid
  // unrelated photos.
  return (
    lower.includes("after_install_pictures") ||
    lower.includes("after-install") ||
    lower.includes("solar_panel") ||
    lower.includes("solar-panel") ||
    lower.includes("solarpanel")
  );
}

function pickSolarPanelsImageUrl(
  urls: Array<string | null | undefined>
): string | null {
  for (const url of urls) {
    if (!url) continue;
    if (isSolarPanelsImageUrl(url)) return url;
  }
  return null;
}

type WalletGrowthDatum = {
  week: string;
  newWallets: number;
  weekNumber?: number;
  weekStartMs?: number;
  weekEndMs?: number;
};

type DelegationTrendDatum = {
  week: string;
  delegated: number;
  weekNumber: number;
  weekStartMs: number;
  weekEndMs: number;
};

type FarmRow = {
  key: string;
  farmId: string | null;
  name: string;
  region: string;
  panels: number;
  lifetimeLq: number | null;
  ccLifetime: number;
  ccPerWeek: number;
  projectedLifetimeCredits: number | null;
  creditType: string;
  lifetimeWeeksElapsed: number | null;
  lifetimeWeeksTarget: number;
  imageUrl: string | null;
  recencyKey?: number;
  auditWeek?: number | null;
};

function WalletGrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: WalletGrowthDatum; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const datum = payload[0]?.payload;
  const weekStart = datum?.weekStartMs ? new Date(datum.weekStartMs) : null;
  const weekEnd = datum?.weekEndMs ? new Date(datum.weekEndMs - 1) : null;

  const value =
    typeof payload[0]?.value === "number"
      ? payload[0]!.value
      : typeof datum?.newWallets === "number"
      ? datum.newWallets
      : 0;

  const labelText = (label ?? "").toString().trim() || "Week";
  const dateText =
    weekStart && weekEnd
      ? `${formatDateShortUtc(weekStart)} - ${formatDateShortUtc(weekEnd)} UTC`
      : null;

  return (
    <div className="rounded-xl border border-border/20 bg-background/95 px-3 py-2 text-xs shadow-none backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
            {labelText}
          </div>
          {dateText ? (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {dateText}
            </div>
          ) : null}
        </div>

        <div className="flex items-start gap-2 shrink-0">
          <span
            className="mt-1 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--color-newWallets)" }}
          />
          <div className="text-right">
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
              New wallets
            </div>
            <div className="mt-0.5 text-base font-mono font-semibold tabular-nums text-foreground leading-none">
              {Math.max(0, Math.round(value)).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FarmDetailsDialog({
  open,
  onOpenChange,
  selectedFarm,
  displayPrice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFarm: FarmRow | null;
  displayPrice: number;
}) {
  const lifetimeValue =
    selectedFarm?.lifetimeLq !== null && selectedFarm?.lifetimeLq !== undefined
      ? formatLiquidityCompact(selectedFarm.lifetimeLq)
      : "—";
  const lifetimeBreakdown =
    selectedFarm?.lifetimeLq !== null &&
    selectedFarm?.lifetimeLq !== undefined &&
    displayPrice > 0
      ? `(${
          getBreakdownFromLq(selectedFarm.lifetimeLq, displayPrice).breakdown
        })`
      : null;
  const lifetimeProgress =
    selectedFarm?.lifetimeWeeksElapsed !== null &&
    selectedFarm?.lifetimeWeeksElapsed !== undefined
      ? `${selectedFarm.lifetimeWeeksElapsed} / ${selectedFarm.lifetimeWeeksTarget} wks`
      : "—";
  const generatedCredits =
    selectedFarm?.ccLifetime !== null && selectedFarm?.ccLifetime !== undefined
      ? formatCompactNumberPrecise(selectedFarm.ccLifetime)
      : "—";
  const projectedCredits =
    selectedFarm?.projectedLifetimeCredits !== null &&
    selectedFarm?.projectedLifetimeCredits !== undefined
      ? formatCompactNumberPrecise(selectedFarm.projectedLifetimeCredits)
      : "—";
  const panels =
    selectedFarm?.panels !== null && selectedFarm?.panels !== undefined
      ? formatNumber(selectedFarm.panels)
      : "—";
  const subtitle = selectedFarm
    ? `${selectedFarm.name} · ${selectedFarm.region} · ${selectedFarm.panels} panels`
    : "Select a farm to view details";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[980px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 shadow-none">
        <div className="border-b border-border/40 pb-6 pt-8 px-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <DialogHeader>
              <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                Farm Details
              </DialogTitle>
              <DialogDescription className="sr-only">
                Farm details dialog
              </DialogDescription>
            </DialogHeader>

            <div className="text-5xl sm:text-6xl font-mono font-semibold text-foreground tracking-tighter tabular-nums">
              {lifetimeValue}
            </div>
            {lifetimeBreakdown ? (
              <div className="text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70 uppercase tracking-wider">
                {lifetimeBreakdown}
              </div>
            ) : null}
            <div className="text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70 uppercase tracking-wider">
              {subtitle}
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-5 space-y-8">
            {!selectedFarm ? (
              <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 text-sm text-muted-foreground">
                Select a farm to view details.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
                  <div className="rounded-xl overflow-hidden bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40">
                    <div className="relative h-44 w-full bg-muted/40 dark:bg-muted/60">
                      {selectedFarm.imageUrl ? (
                        <FallbackImage
                          src={selectedFarm.imageUrl}
                          widthForProxy={900}
                          quality={85}
                          alt={selectedFarm.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted/40 dark:bg-muted/60 flex items-center justify-center">
                          <span className="text-3xl opacity-25">&#9728;</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                          {selectedFarm.region}
                        </div>
                        <div className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                          {selectedFarm.name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {selectedFarm.panels} panels
                        </div>
                      </div>

                      <div className="rounded-xl bg-card border border-border/20 dark:border-border/40 p-3">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                          Lifetime Progress
                        </div>
                        <div className="mt-1 font-mono font-semibold tabular-nums text-foreground">
                          {lifetimeProgress}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                      Solar Farm Economics
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          Generated Revenue (Lifetime)
                        </div>
                        <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums">
                          {lifetimeValue}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {lifetimeBreakdown ?? "Live data unavailable"}
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          Lifetime Progress
                        </div>
                        <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums">
                          {lifetimeProgress}
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          Credit Type
                        </div>
                        <div className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">
                          {selectedFarm.creditType}
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          Generated Credits (Lifetime)
                        </div>
                        <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums">
                          {generatedCredits}
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          Projected Lifetime Credits
                        </div>
                        <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums">
                          {projectedCredits}
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          Number of Panels
                        </div>
                        <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums">
                          {panels}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 space-y-3">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                        How Farm Revenue Works
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Each region earns protocol revenue based on the amount
                        of GCTL staked to that region and the miner sales
                        generated there. Miner-sale proceeds are split across
                        farm subsidies, hard operating costs like audits, and
                        protocol revenue.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Within a region, that revenue is attributed to farms by
                        projected lifetime credit production, so farms expected
                        to generate more credits also generate more revenue.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function MiniBlogDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 shadow-none">
        <div className="border-b border-border/40 pb-5 pt-7 px-6">
          <DialogHeader>
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              {title}
            </DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  label,
  value,
  helper,
  labelClassName,
  valueClassName,
  helperClassName,
}: {
  label: string;
  value: string;
  helper?: React.ReactNode;
  labelClassName?: string;
  valueClassName?: string;
  helperClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70",
          labelClassName
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums",
          valueClassName
        )}
      >
        {value}
      </div>
      {helper ? (
        <div className={cn("text-xs text-muted-foreground", helperClassName)}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  helper,
  valueClassName,
  labelClassName,
}: {
  label: string;
  value: string;
  helper?: React.ReactNode;
  valueClassName?: string;
  labelClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70",
          labelClassName
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "text-2xl sm:text-3xl font-semibold font-mono tabular-nums",
          valueClassName
        )}
      >
        {value}
      </div>
      {helper ? (
        <div className="text-xs text-muted-foreground">{helper}</div>
      ) : null}
    </div>
  );
}

function logSliderToPrice(sliderValue: number) {
  const logMin = Math.log10(PRICE_RANGE.min);
  const logMax = Math.log10(PRICE_RANGE.max);
  return Math.pow(10, logMin + (sliderValue / 100) * (logMax - logMin));
}

function priceToLogSlider(price: number) {
  const logMin = Math.log10(PRICE_RANGE.min);
  const logMax = Math.log10(PRICE_RANGE.max);
  return ((Math.log10(price) - logMin) / (logMax - logMin)) * 100;
}

function PolLiquidityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: any }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as
    | {
        weekStartMs?: number;
        weekEndMs?: number;
        liquidity?: number;
        deltaLiquidity?: number | null;
        endowmentLiquidity?: number;
        deltaEndowmentLiquidity?: number | null;
        botActiveLiquidity?: number;
        deltaBotActiveLiquidity?: number | null;
        usdValue?: number | null;
        deltaUsdValue?: number | null;
        spotPrice?: number | null;
      }
    | undefined;
  if (!p) return null;
  const weekStart =
    typeof p.weekStartMs === "number" ? new Date(p.weekStartMs) : null;
  const weekEnd =
    typeof p.weekEndMs === "number" ? new Date(p.weekEndMs - 1) : null;
  const dateRangeLabel =
    weekStart && weekEnd
      ? `${formatDateShortUtc(weekStart)} - ${formatDateShortUtc(weekEnd)} UTC`
      : null;

  return (
    <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-card px-4 py-3 min-w-[240px]">
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
          {label ?? "Week"}
        </div>
        {dateRangeLabel ? (
          <div className="text-[11px] text-muted-foreground">
            {dateRangeLabel}
          </div>
        ) : null}
      </div>

      <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">PoL liquidity</div>
          <div className="text-sm font-mono font-semibold tabular-nums text-foreground">
            {typeof p.liquidity === "number"
              ? formatLiquidityCompact(p.liquidity)
              : "—"}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">Δ vs prior</div>
          <div className="text-sm font-mono tabular-nums text-foreground">
            {p.deltaLiquidity === null || p.deltaLiquidity === undefined
              ? "—"
              : formatSignedLiquidityCompact(p.deltaLiquidity)}
          </div>
        </div>

        <div className="h-px bg-border/10 dark:bg-border/20" />

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">Endowment</div>
          <div className="text-sm font-mono tabular-nums text-foreground">
            {typeof p.endowmentLiquidity === "number"
              ? formatLiquidityCompact(p.endowmentLiquidity)
              : "—"}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
            Δ Endowment
          </div>
          <div className="text-xs font-mono tabular-nums text-foreground">
            {p.deltaEndowmentLiquidity === null ||
            p.deltaEndowmentLiquidity === undefined
              ? "—"
              : formatSignedLiquidityCompact(p.deltaEndowmentLiquidity)}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">Trading bot</div>
          <div className="text-sm font-mono tabular-nums text-foreground">
            {typeof p.botActiveLiquidity === "number"
              ? formatLiquidityCompact(p.botActiveLiquidity)
              : "—"}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
            Δ Trading bot
          </div>
          <div className="text-xs font-mono tabular-nums text-foreground">
            {p.deltaBotActiveLiquidity === null ||
            p.deltaBotActiveLiquidity === undefined
              ? "—"
              : formatSignedLiquidityCompact(p.deltaBotActiveLiquidity)}
          </div>
        </div>

        <div className="mt-1 rounded-xl bg-muted/20 dark:bg-background/40 border border-border/10 dark:border-border/20 px-3 py-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
            As-of snapshot
          </div>
          <div className="mt-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Spot</span>
              <span className="text-xs font-mono tabular-nums text-foreground">
                {p.spotPrice === null || p.spotPrice === undefined
                  ? "—"
                  : `$${formatNullableFixed(p.spotPrice, 4)}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">USD value</span>
              <span className="text-xs font-mono tabular-nums text-foreground">
                {p.usdValue === null || p.usdValue === undefined
                  ? "—"
                  : formatUsdCompactNullable(p.usdValue)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                Δ USD
              </span>
              <span className="text-xs font-mono tabular-nums text-foreground">
                {p.deltaUsdValue === null || p.deltaUsdValue === undefined
                  ? "—"
                  : formatUsdCompactNullable(p.deltaUsdValue)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PolDashboardView() {
  const [isBannerBlogOpen, setIsBannerBlogOpen] = React.useState(false);
  const [isSupplyDialogOpen, setIsSupplyDialogOpen] = React.useState(false);
  const [isFarmDialogOpen, setIsFarmDialogOpen] = React.useState(false);
  const [isInstallationsDialogOpen, setIsInstallationsDialogOpen] =
    React.useState(false);
  const [isLiquidityGrowthDialogOpen, setIsLiquidityGrowthDialogOpen] =
    React.useState(false);
  const [isCirculatingGrowthDialogOpen, setIsCirculatingGrowthDialogOpen] =
    React.useState(false);
  const [isEmbeddedGrowthDialogOpen, setIsEmbeddedGrowthDialogOpen] =
    React.useState(false);
  const [isPolLiquidityDialogOpen, setIsPolLiquidityDialogOpen] =
    React.useState(false);
  const [isGctlDialogOpen, setIsGctlDialogOpen] = React.useState(false);
  const [isWalletStatsDialogOpen, setIsWalletStatsDialogOpen] =
    React.useState(false);
  const [selectedFarmId, setSelectedFarmId] = React.useState<string | null>(
    null
  );
  const [showAllFarms, setShowAllFarms] = React.useState(false);
  const [farmSortKey, setFarmSortKey] = React.useState<
    "latest" | "lifetime" | "credits"
  >("latest");

  const { poolReserves, priceRatio: poolSpotPrice } = usePoolInfo();

  const { circulatingSupply, totalSupply, marketCap, glowPrice } =
    useGlowCirculatingSupply();

  const { data: polSummary } = usePolSummary();
  const ponderSpotPrice = polSummary?.spotPrice
    ? Number(polSummary.spotPrice)
    : null;

  const livePrice =
    ponderSpotPrice && Number.isFinite(ponderSpotPrice) && ponderSpotPrice > 0
      ? ponderSpotPrice
      : poolSpotPrice > 0
      ? poolSpotPrice
      : glowPrice;

  const hasLivePrice = livePrice > 0;
  const currentPrice = hasLivePrice ? livePrice : 0;
  const hasLiveSupply = circulatingSupply > 0 && totalSupply > 0;
  const currentCirculating = hasLiveSupply ? circulatingSupply : 0;
  const supplyTotal = hasLiveSupply ? totalSupply : 0;
  const hasLiveMarketCap = marketCap > 0 && hasLivePrice && hasLiveSupply;
  const currentMarketCap = hasLiveMarketCap ? marketCap : 0;

  const displayPrice = hasLivePrice ? livePrice : 0;

  const marketCapDisplay = hasLiveMarketCap
    ? formatUsdWhole(currentMarketCap)
    : "—";
  const priceDisplay = hasLivePrice ? `$${currentPrice.toFixed(4)}` : "—";
  const priceDetail = hasLivePrice ? currentPrice.toFixed(4) : "—";

  // ── GCTL live data ──
  const {
    gctlPriceNumber,
    gctlCirculatingSupplyNumber,
    isGctlPriceLoading,
    isGctlCirculatingSupplyLoading,
  } = useGctlApi();

  const { data: activeRegionsSummary, isLoading: isRegionsSummaryLoading } =
    useActiveRegionsSummary();

  const isGctlLoading =
    isGctlPriceLoading ||
    isGctlCirculatingSupplyLoading ||
    isRegionsSummaryLoading;

  const regionNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    const regions = activeRegionsSummary?.regions ?? [];
    for (const r of regions) map.set(r.id, r.name);
    return map;
  }, [activeRegionsSummary]);

  const resolveRegionName = React.useCallback(
    (zoneId: number | string | null | undefined): string => {
      if (zoneId === null || zoneId === undefined) return "—";
      const id = typeof zoneId === "string" ? Number(zoneId) : zoneId;
      if (!Number.isFinite(id)) return "—";
      return regionNameById.get(id) ?? `Zone ${id}`;
    },
    [regionNameById]
  );

  const gctlTotalSupply =
    gctlCirculatingSupplyNumber > 0 ? gctlCirculatingSupplyNumber : 350_000;
  const gctlTotalStaked = activeRegionsSummary?.totalGctlStaked ?? 0;
  const gctlUnstaked = Math.max(0, gctlTotalSupply - gctlTotalStaked);

  const gctlRegionPieData = React.useMemo(() => {
    if (!activeRegionsSummary?.regions?.length) return GCTL_REGION_PIE_DATA;
    return activeRegionsSummary.regions.map((r) => ({
      name: r.name,
      value: Math.round(r.stakedGctl),
      fill: REGION_COLORS[r.name] ?? DEFAULT_REGION_COLOR,
      pct:
        gctlTotalStaked > 0
          ? Math.round((r.stakedGctl / gctlTotalStaked) * 100)
          : 0,
    }));
  }, [activeRegionsSummary, gctlTotalStaked]);

  const gctlRegionChartConfigLive = React.useMemo(() => {
    if (!activeRegionsSummary?.regions?.length) return gctlRegionChartConfig;
    return Object.fromEntries(
      activeRegionsSummary.regions.map((r) => [
        r.name,
        { label: r.name, color: REGION_COLORS[r.name] ?? DEFAULT_REGION_COLOR },
      ])
    ) as Record<string, { label: string; color: string }>;
  }, [activeRegionsSummary]);

  // ── Wallet Stats live data ──
  const { data: impactWalletStats, isLoading: isWalletStatsLoadingApi } =
    useImpactWalletStats();

  const { data: impactMetrics } = useImpactMetrics();

  const { holdersCount: gctlHoldersCount, isLoading: isGctlHoldersLoading } =
    useGctlHoldersCount();

  const walletStats = React.useMemo(() => {
    const totalWallets = impactWalletStats?.totalWallets ?? 0;
    const glwHoldersRaw =
      toFiniteNumber((impactWalletStats as any)?.glwHolders) ??
      toFiniteNumber((impactWalletStats as any)?.glw_holders) ??
      toFiniteNumber((impactWalletStats as any)?.holders) ??
      toFiniteNumber((impactWalletStats as any)?.holdersCount) ??
      null;
    const glwHolders =
      glwHoldersRaw !== null
        ? Math.max(0, Math.min(Math.round(glwHoldersRaw), totalWallets))
        : totalWallets;
    const delegatorCount = impactWalletStats?.delegators ?? 0;
    const minerCount = impactWalletStats?.miners ?? 0;
    const gctlCount =
      gctlHoldersCount > 0 ? Math.min(gctlHoldersCount, totalWallets) : 0;
    const protocolParticipantsRaw =
      toFiniteNumber((impactWalletStats as any)?.protocolParticipants) ??
      toFiniteNumber((impactWalletStats as any)?.protocol_participants) ??
      toFiniteNumber((impactWalletStats as any)?.participantWallets) ??
      toFiniteNumber((impactWalletStats as any)?.participant_wallets) ??
      toFiniteNumber((impactWalletStats as any)?.activeWallets) ??
      toFiniteNumber((impactWalletStats as any)?.active_wallets) ??
      null;
    const protocolParticipants =
      protocolParticipantsRaw !== null
        ? Math.max(
            0,
            Math.min(Math.round(protocolParticipantsRaw), totalWallets)
          )
        : Math.max(delegatorCount, minerCount, gctlCount);
    const nonParticipants = Math.max(0, totalWallets - protocolParticipants);
    const total = totalWallets || 1; // avoid division by zero
    return {
      totalWallets,
      glwHolders,
      protocolParticipants,
      delegatorCount,
      minerCount,
      gctlCount,
      nonParticipants,
      breakdown: [
        {
          label: "Delegators",
          count: delegatorCount,
          pct: Math.round((delegatorCount / total) * 1000) / 10,
          color: "#a855f7",
        },
        {
          label: "Miners",
          count: minerCount,
          pct: Math.round((minerCount / total) * 1000) / 10,
          color: "#2081e2",
        },
        {
          label: "GCTL holders",
          count: gctlCount,
          pct: Math.round((gctlCount / total) * 1000) / 10,
          color: "#22d3ee",
        },
        {
          label: "Non-Participants",
          count: nonParticipants,
          pct: Math.round((nonParticipants / total) * 1000) / 10,
          color: "#4ade80",
        },
      ],
    };
  }, [impactWalletStats, gctlHoldersCount]);

  const isWalletStatsLoading = isWalletStatsLoadingApi || isGctlHoldersLoading;

  const impactTotals = React.useMemo(() => {
    if (!impactMetrics) return null;
    const totalWatts = impactMetrics.totalWatts;
    const capacityMw =
      Number.isFinite(totalWatts) && totalWatts > 0
        ? totalWatts / 1_000_000
        : null;
    return {
      panels: impactMetrics.solarPanelsInstalled ?? null,
      totalFarms: impactMetrics.totalFarms ?? null,
      capacityMw,
      homesPowered: impactMetrics.homesPowered ?? null,
      trees: impactMetrics.adultTreesEquivalent ?? null,
    };
  }, [impactMetrics]);

  // ── Wallet growth chart (new wallets per week) ──
  const currentEpoch = React.useMemo(() => getCurrentEpoch(), []);
  const newWalletsEndWeek = Math.max(97, currentEpoch - 1);
  const newWalletsStartWeek = Math.max(97, newWalletsEndWeek - 11);
  const { data: newWalletsByWeekData } = useImpactNewWalletsByWeek({
    startWeek: newWalletsStartWeek,
    endWeek: newWalletsEndWeek,
  });
  const { data: totalActivelyDelegatedData } = useTotalActivelyDelegated({
    includeApy: true,
  });
  // Pull full V2 history for the delegation chart, while growth KPIs still read
  // the exact weeks they need from this shared payload.
  const supplyGrowthEndWeek = Math.max(97, currentEpoch - 1);
  const supplyGrowthStartWeek = Math.max(97, supplyGrowthEndWeek - 13);
  // "Today vs 3 months ago" should anchor on the current week, not the last completed week.
  const trailing3MonthStartWeek = Math.max(97, currentEpoch - 13);
  const { data: activelyDelegatedByWeekData } = useActivelyDelegatedByWeek({
    startWeek: POL_LIQUIDITY_V2_START_WEEK,
    endWeek: supplyGrowthEndWeek,
  });
  const { data: polLiquiditySnapshot } = usePolLiquiditySnapshot({
    range: "20w",
  });
  const { data: glowCirculatingSnapshot } = useGlowCirculatingSnapshot({
    range: "20w",
    includePartialWeek: true,
  });

  const vaultedGlw = React.useMemo(() => {
    const raw = totalActivelyDelegatedData?.totalGlwDelegatedWei;
    if (raw === null || raw === undefined) return null;
    try {
      return Number(formatUnits(BigInt(raw), 18));
    } catch {
      return null;
    }
  }, [totalActivelyDelegatedData]);

  const polWalletGlw = React.useMemo(() => {
    const raw = polSummary?.total?.breakdown?.glw;
    if (raw === null || raw === undefined) return null;
    try {
      return Number(formatUnits(BigInt(raw), 18));
    } catch {
      return null;
    }
  }, [polSummary]);

  const polGlwInPol = React.useMemo(() => {
    const endowmentGlw = polSummary?.endowment?.glw ?? null;
    const botActiveGlw = polSummary?.botActive?.glw ?? null;
    if (endowmentGlw === null || botActiveGlw === null) return null;
    try {
      const sum = BigInt(endowmentGlw) + BigInt(botActiveGlw);
      return Number(formatUnits(sum, 18));
    } catch {
      return null;
    }
  }, [polSummary]);

  const totalPolLq = React.useMemo(() => {
    const raw = polSummary?.total?.lq;
    if (raw === null || raw === undefined) return null;
    return parseLqUnits(raw);
  }, [polSummary]);

  const walletGrowthLive = React.useMemo(() => {
    const byWeek = newWalletsByWeekData?.byWeek;
    if (!byWeek || Object.keys(byWeek).length < 3) return null;

    const weeks = Object.keys(byWeek)
      .map(Number)
      .sort((a, b) => a - b);

    // Take last 12 weeks of counts (last completed weeks)
    const tail = weeks.slice(-12);
    if (tail.length < 2) return null;

    const result: WalletGrowthDatum[] = [];
    for (let i = 0; i < tail.length; i++) {
      const weekNumber = tail[i];
      const count = byWeek[weekNumber] || 0;
      const weekStartMs = getWeekStartMs(weekNumber);
      const weekEndMs = getWeekEndMs(weekNumber);
      const label = formatDateAxisUtc(new Date(weekEndMs - 1));
      result.push({
        week: label,
        newWallets: Math.max(0, count),
        weekNumber,
        weekStartMs,
        weekEndMs,
      });
    }
    return result;
  }, [newWalletsByWeekData]);

  const isWalletGrowthMock = !walletGrowthLive;
  const hasWalletBreakdown = walletStats.totalWallets > 0;

  const totalDelegatedGlw = React.useMemo(() => {
    const raw = totalActivelyDelegatedData?.totalGlwDelegatedWei;
    if (raw === null || raw === undefined) return null;
    try {
      const value = Number(formatUnits(BigInt(raw), 18));
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }, [totalActivelyDelegatedData]);

  const hasDelegationData = totalDelegatedGlw !== null;
  const delegatorsCount = totalActivelyDelegatedData?.totalWallets ?? null;
  const delegatorsDisplay =
    delegatorsCount !== null && Number.isFinite(delegatorsCount)
      ? formatCompactNumberPrecise(delegatorsCount)
      : "—";
  const averageDelegatorApy = React.useMemo(() => {
    const raw = totalActivelyDelegatedData?.averageDelegatorApy;
    if (raw === null || raw === undefined) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }, [totalActivelyDelegatedData]);
  const averageApyDisplay = React.useMemo(() => {
    if (averageDelegatorApy === null) return "—";
    const pct =
      averageDelegatorApy > 0 && averageDelegatorApy < 2
        ? averageDelegatorApy * 100
        : averageDelegatorApy;
    return formatPercent(pct);
  }, [averageDelegatorApy]);
  const delegatedDisplay =
    totalDelegatedGlw !== null
      ? formatCompactNumberTwoDecimals(totalDelegatedGlw)
      : "—";
  const delegationRatioPct =
    totalDelegatedGlw !== null && currentCirculating > 0
      ? (totalDelegatedGlw / currentCirculating) * 100
      : null;
  const delegationRatioWidth = delegationRatioPct
    ? Math.min(100, Math.max(0, delegationRatioPct))
    : 0;
  const delegationRatioDetail =
    totalDelegatedGlw !== null && currentCirculating > 0
      ? `${formatCompactNumberTwoDecimals(
          totalDelegatedGlw
        )} of ${formatCompactNumberTwoDecimals(
          currentCirculating
        )} circulating GLW delegated`
      : "Live data unavailable";

  const delegationTrendLive = React.useMemo(() => {
    const byWeek = activelyDelegatedByWeekData?.byWeek;
    if (!byWeek || Object.keys(byWeek).length < 2) return null;
    const weeks = Object.keys(byWeek)
      .map(Number)
      .filter((week) => week >= POL_LIQUIDITY_V2_START_WEEK)
      .sort((a, b) => a - b);
    if (!weeks.length) return null;
    return weeks.map((week) => {
      const raw = byWeek[week] ?? "0";
      const weekStartMs = getWeekStartMs(week);
      const weekEndMs = getWeekEndMs(week);
      const label = formatMonthAxisUtc(new Date(weekEndMs - 1));

      let glw = 0;
      try {
        glw = Number(formatUnits(BigInt(raw), 18));
      } catch {
        glw = 0;
      }
      const delegatedM = Number.isFinite(glw) ? glw / 1_000_000 : 0;
      return {
        week: label,
        delegated: delegatedM,
        weekNumber: week,
        weekStartMs,
        weekEndMs,
      } satisfies DelegationTrendDatum;
    });
  }, [activelyDelegatedByWeekData]);

  const delegationTrendTicks = React.useMemo(() => {
    if (!delegationTrendLive || delegationTrendLive.length === 0) return [];
    const ticks: number[] = [];
    const seenMonths = new Set<string>();

    for (const row of delegationTrendLive) {
      const d = new Date(row.weekEndMs - 1);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      if (!seenMonths.has(key)) {
        seenMonths.add(key);
        ticks.push(row.weekEndMs);
      }
    }

    const lastTick = delegationTrendLive[delegationTrendLive.length - 1]?.weekEndMs;
    if (
      typeof lastTick === "number" &&
      Number.isFinite(lastTick) &&
      ticks[ticks.length - 1] !== lastTick
    ) {
      ticks.push(lastTick);
    }
    return ticks;
  }, [delegationTrendLive]);

  // ── Supply model slider ──
  const [price, setPrice] = React.useState(displayPrice);
  const [hasAdjustedSlider, setHasAdjustedSlider] = React.useState(false);
  const [sliderValue, setSliderValue] = React.useState(() =>
    priceToLogSlider(displayPrice)
  );
  const resetSupplyModel = React.useCallback(() => {
    if (!hasLivePrice || livePrice <= 0) return;
    setPrice(livePrice);
    setSliderValue(priceToLogSlider(livePrice));
    setHasAdjustedSlider(false);
  }, [hasLivePrice, livePrice]);

  React.useEffect(() => {
    if (!hasAdjustedSlider && livePrice > 0) {
      setPrice(livePrice);
      setSliderValue(priceToLogSlider(livePrice));
    }
  }, [hasAdjustedSlider, livePrice]);

  const isAtLivePrice = React.useMemo(() => {
    if (!hasLivePrice || displayPrice <= 0 || !Number.isFinite(displayPrice))
      return false;
    if (!Number.isFinite(price) || price <= 0) return false;
    // Slider is log-scale; treat "same price" with a small tolerance.
    return Math.abs(price - displayPrice) / displayPrice < 0.0005; // 0.05%
  }, [displayPrice, hasLivePrice, price]);

  const supplyModel = React.useMemo(() => {
    const poolUsdg = poolReserves?.usdg ?? 0;
    const poolGlw = poolReserves?.glw ?? 0;

    // xy = k with x=USDG, y=GLW, price = USDG/GLW
    // This gives USDG side scaling with sqrt(price), and implies GLW side scales with 1/sqrt(price).
    // IMPORTANT: `usePoolInfo` already reads the full Uniswap reserves. Do NOT
    // add protocol totals from `/pol/summary`, or we'd double-count.
    const k = poolUsdg > 0 && poolGlw > 0 ? poolUsdg * poolGlw : 0;
    const effectivePrice = isAtLivePrice ? displayPrice : price;

    // At the default dialog state (current price), the model should equal live data.
    const modeledUsdg =
      isAtLivePrice && poolUsdg > 0
        ? poolUsdg
        : k > 0 && effectivePrice > 0
        ? Math.sqrt(k * effectivePrice)
        : null;
    const modeledGlw =
      isAtLivePrice && poolGlw > 0
        ? poolGlw
        : k > 0 && effectivePrice > 0
        ? Math.sqrt(k / effectivePrice)
        : null;

    const poolDepthUsd =
      modeledUsdg !== null && modeledGlw !== null && effectivePrice > 0
        ? modeledUsdg + modeledGlw * effectivePrice
        : null;

    return {
      total: supplyTotal,
      modeledPoolUsdg: modeledUsdg,
      modeledPoolGlw: modeledGlw,
      modeledPoolDepthUsd: poolDepthUsd,
    };
  }, [poolReserves, displayPrice, isAtLivePrice, price, supplyTotal]);

  const liquidCirculatingNow = React.useMemo(() => {
    if (!hasLiveSupply) return null;
    // `currentCirculating` is the canonical circulating supply. It excludes:
    // - Vaulted GLW (delegated)
    // - PoL GLW in protocol-owned positions
    return currentCirculating;
  }, [currentCirculating, hasLiveSupply]);

  const modeledPolGlw = React.useMemo(() => {
    if (!hasLiveSupply) return null;

    // Model protocol-owned reserves directly (endowment LP position + trading bot active),
    // per spec: k = Total_USDG_Reserves_current * Total_GLW_Reserves_current.
    const polUsdgMicroRaw = polSummary?.total?.breakdown?.usdg ?? null;
    const polGlwWeiRaw = polSummary?.total?.breakdown?.glw ?? null;
    const effectivePrice = Number.isFinite(price) && price > 0 ? price : null;

    if (
      polUsdgMicroRaw === null ||
      polGlwWeiRaw === null ||
      effectivePrice === null
    ) {
      // Best-effort: fall back to current PoL GLW (so UI doesn't show nonsense).
      return polWalletGlw !== null && Number.isFinite(polWalletGlw)
        ? Math.max(0, polWalletGlw)
        : null;
    }

    const polUsdg = Number(formatUnits(BigInt(polUsdgMicroRaw), 6));
    const polGlw = Number(formatUnits(BigInt(polGlwWeiRaw), 18));
    if (
      !Number.isFinite(polUsdg) ||
      !Number.isFinite(polGlw) ||
      polUsdg <= 0 ||
      polGlw <= 0
    )
      return null;

    const k = polUsdg * polGlw;
    if (!Number.isFinite(k) || k <= 0) return null;

    // At the live price (default), this equals `polGlw` by construction.
    const raw = Math.sqrt(k / effectivePrice);
    // PoL can only absorb from circulating (not from vaulted/other). Since
    // `currentCirculating` already excludes current PoL GLW, the max PoL GLW
    // is (current PoL GLW + current circulating).
    const polNow = polWalletGlw ?? 0;
    const max = Math.max(0, currentCirculating + polNow);
    return Math.min(max, Math.max(0, raw));
  }, [currentCirculating, hasLiveSupply, polSummary, polWalletGlw, price]);

  const modeledPolUsdg = React.useMemo(() => {
    if (!hasLiveSupply) return null;

    const polUsdgMicroRaw = polSummary?.total?.breakdown?.usdg ?? null;
    const polGlwWeiRaw = polSummary?.total?.breakdown?.glw ?? null;
    const effectivePrice = Number.isFinite(price) && price > 0 ? price : null;

    if (
      polUsdgMicroRaw === null ||
      polGlwWeiRaw === null ||
      effectivePrice === null
    ) {
      try {
        const fallbackRaw = polSummary?.total?.breakdown?.usdg ?? null;
        if (fallbackRaw === null || fallbackRaw === undefined) return null;
        const fallback = Number(formatUnits(BigInt(fallbackRaw), 6));
        return Number.isFinite(fallback) ? Math.max(0, fallback) : null;
      } catch {
        return null;
      }
    }

    const polUsdg = Number(formatUnits(BigInt(polUsdgMicroRaw), 6));
    const polGlw = Number(formatUnits(BigInt(polGlwWeiRaw), 18));
    if (
      !Number.isFinite(polUsdg) ||
      !Number.isFinite(polGlw) ||
      polUsdg <= 0 ||
      polGlw <= 0
    )
      return null;

    const k = polUsdg * polGlw;
    if (!Number.isFinite(k) || k <= 0) return null;
    const modeled = Math.sqrt(k * effectivePrice);
    return Number.isFinite(modeled) ? Math.max(0, modeled) : null;
  }, [hasLiveSupply, polSummary, price]);

  const liquidCirculatingModeled = React.useMemo(() => {
    if (!hasLiveSupply || modeledPolGlw === null) return null;
    const polNow = polWalletGlw;
    if (polNow === null || polNow === undefined) return null;
    // If PoL GLW increases by Δ, circulating decreases by Δ (and vice versa).
    const deltaPol = modeledPolGlw - polNow;
    return Math.max(0, currentCirculating - deltaPol);
  }, [currentCirculating, hasLiveSupply, modeledPolGlw, polWalletGlw]);

  const supplyDelta = React.useMemo(() => {
    if (liquidCirculatingModeled === null || liquidCirculatingNow === null)
      return null;
    return liquidCirculatingModeled - liquidCirculatingNow;
  }, [liquidCirculatingModeled, liquidCirculatingNow]);

  const { data: polRevenueAggregate } = usePolRevenueAggregate();
  const { data: polRevenueFarms } = usePolRevenueFarms();
  const { data: polRevenueRegions } = usePolRevenueRegions();

  const ninetyDayApy = React.useMemo(() => {
    const raw = polRevenueAggregate?.ninety_day_apy;
    if (raw === null || raw === undefined) return null;
    const value = typeof raw === "string" ? Number(raw) : raw;
    return Number.isFinite(value) ? value : null;
  }, [polRevenueAggregate]);

  const polApyDisplay = React.useMemo(() => {
    if (ninetyDayApy === null) return "—";
    const pct =
      ninetyDayApy > 0 && ninetyDayApy < 2 ? ninetyDayApy * 100 : ninetyDayApy;
    return formatPercent(pct);
  }, [ninetyDayApy]);

  const lifetimeRevenueLq = parseLqUnits(
    polRevenueAggregate?.lifetime_lq ?? null
  );
  const ninetyDayYieldLq = parseLqUnits(
    polRevenueAggregate?.ninety_day_yield_lq ?? null
  );
  const activeFarmsCount =
    polRevenueAggregate?.active_farms && polRevenueAggregate.active_farms > 0
      ? polRevenueAggregate.active_farms
      : null;
  const totalSolarInstallations = React.useMemo(() => {
    const fromImpact = impactTotals?.totalFarms ?? null;
    if (fromImpact !== null && Number.isFinite(fromImpact) && fromImpact > 0) {
      return Math.round(fromImpact);
    }
    return activeFarmsCount;
  }, [activeFarmsCount, impactTotals?.totalFarms]);

  const lifetimeRevenueDisplay =
    lifetimeRevenueLq !== null
      ? {
          lq: formatLiquidityCompact(lifetimeRevenueLq),
          breakdown:
            displayPrice > 0
              ? getBreakdownFromLq(lifetimeRevenueLq, displayPrice).breakdown
              : null,
        }
      : null;

  // 3 Month Trailing PoL Growth (headline KPI) is defined as the delta in total PoL
  // liquidity between now and ~3 months ago (13 weeks), not the CRM-recognized contribution flow.
  const polLqThirteenWeeksAgo = React.useMemo(() => {
    const series = polLiquiditySnapshot?.series ?? null;
    if (!series || series.length === 0) return null;
    const row = series.find((r) => r.week === trailing3MonthStartWeek) ?? null;
    if (!row) return null;
    return parseLqUnits(row.pol_lq ?? null);
  }, [polLiquiditySnapshot, trailing3MonthStartWeek]);

  const polTrailingPolGrowthLq = React.useMemo(() => {
    if (totalPolLq === null || polLqThirteenWeeksAgo === null) return null;
    const delta = totalPolLq - polLqThirteenWeeksAgo;
    return Number.isFinite(delta) ? delta : null;
  }, [polLqThirteenWeeksAgo, totalPolLq]);

  const polTrailingPolGrowthDisplay =
    polTrailingPolGrowthLq !== null
      ? {
          lq: formatLiquidityCompact(polTrailingPolGrowthLq),
          breakdown:
            displayPrice > 0
              ? getBreakdownFromLq(polTrailingPolGrowthLq, displayPrice)
                  .breakdown
              : null,
        }
      : null;

  const ninetyDayYieldDisplay =
    ninetyDayYieldLq !== null
      ? {
          lq: formatLiquidityCompact(ninetyDayYieldLq),
          breakdown:
            displayPrice > 0
              ? getBreakdownFromLq(ninetyDayYieldLq, displayPrice).breakdown
              : null,
        }
      : null;

  const farmRowsAll = React.useMemo(() => {
    const farms = polRevenueFarms?.farms ?? [];
    return farms
      .map((farm, index) => {
        const farmId =
          (farm as any).farm_id ??
          (farm as any).farmId ??
          (farm as any).id ??
          null;
        const name =
          (farm as any).farm_name ?? (farm as any).name ?? `Farm ${index + 1}`;
        const region =
          resolveRegionName((farm as any).zone_id ?? null) ??
          (farm as any).region ??
          "—";
        const panels = farm.panels ?? 0;
        const lifetime = parseLqUnits(farm.lifetime_lq ?? null);
        const creditsTotalRaw =
          (farm as any).credits_total ?? (farm as any).cc_lifetime ?? 0;
        const ccLifetime = Number(creditsTotalRaw) || 0;
        const ccPerWeekRaw = (farm as any).cc_per_week ?? 0;
        const ccPerWeek = Number(ccPerWeekRaw) || 0;
        const creditType =
          (farm as any).credit_type ??
          (farm as any).creditType ??
          (farm as any).credits_type ??
          "Carbon Credits";
        const imageUrl = pickSolarPanelsImageUrl([
          (farm as any).image_url ?? null,
          ...(Array.isArray((farm as any).images) ? (farm as any).images : []),
        ]);

        const auditWeekRaw =
          (farm as any).audit_week ?? (farm as any).auditWeek ?? null;
        const auditWeek =
          typeof auditWeekRaw === "string"
            ? Number(auditWeekRaw)
            : typeof auditWeekRaw === "number"
            ? auditWeekRaw
            : null;
        const lifetimeWeeksTargetRaw =
          toFiniteNumber((farm as any).lifetime_weeks) ??
          toFiniteNumber((farm as any).projected_lifetime_weeks) ??
          toFiniteNumber((farm as any).lifetimeWeeks) ??
          toFiniteNumber((farm as any).projectedLifetimeWeeks) ??
          100;
        const lifetimeWeeksTarget = Math.max(
          1,
          Math.round(lifetimeWeeksTargetRaw)
        );
        const lifetimeWeeksElapsed =
          auditWeek !== null && Number.isFinite(auditWeek)
            ? Math.min(
                lifetimeWeeksTarget,
                Math.max(0, Math.floor(currentEpoch - auditWeek))
              )
            : null;
        const projectedLifetimeCreditsRaw =
          toFiniteNumber((farm as any).projected_lifetime_credits) ??
          toFiniteNumber((farm as any).projected_credits_total) ??
          toFiniteNumber((farm as any).projectedCreditsLifetime) ??
          toFiniteNumber((farm as any).credits_projection_total) ??
          null;
        const projectedLifetimeCredits =
          projectedLifetimeCreditsRaw !== null
            ? Math.max(0, projectedLifetimeCreditsRaw)
            : ccPerWeek > 0
            ? ccPerWeek * lifetimeWeeksTarget
            : null;

        const recencyKey = (() => {
          // Prefer protocol week (monotonic) when available.
          if (auditWeek !== null && Number.isFinite(auditWeek))
            return auditWeek;

          const rawDate =
            (farm as any).installFinishedDate ??
            (farm as any).install_finished_date ??
            (farm as any).createdAt ??
            (farm as any).created_at ??
            null;
          if (typeof rawDate === "string") {
            const ms = Date.parse(rawDate);
            if (Number.isFinite(ms)) return ms;
          }
          if (typeof farmId === "string") {
            const n = Number(farmId);
            if (Number.isFinite(n)) return n;
          }
          return index;
        })();

        return {
          key: farmId ? String(farmId) : `${name}-${index}`,
          farmId: farmId ? String(farmId) : null,
          name,
          region,
          panels,
          lifetimeLq: lifetime,
          ccLifetime,
          ccPerWeek,
          projectedLifetimeCredits,
          creditType,
          lifetimeWeeksElapsed,
          lifetimeWeeksTarget,
          imageUrl,
          auditWeek: auditWeek ?? null,
          recencyKey,
        };
      })
      .filter((row) => {
        if (!row.name) return false;

        // Exclude farms that have no realized revenue yet (e.g., first week at 0).
        if (row.lifetimeLq !== null && row.lifetimeLq <= 0) return false;

        // Exclude low-signal rows from the Solar Farm Economics cards.
        if (
          row.lifetimeLq !== null &&
          row.lifetimeLq < MIN_LIFETIME_REVENUE_LQ
        ) {
          return false;
        }

        return true;
      });
  }, [currentEpoch, polRevenueFarms, resolveRegionName]);

  const selectedFarm = React.useMemo(() => {
    if (!selectedFarmId) return null;
    return (
      farmRowsAll.find((f: any) => f.farmId === selectedFarmId) ??
      farmRowsAll.find((f: any) => f.key === selectedFarmId) ??
      null
    );
  }, [farmRowsAll, selectedFarmId]);

  const openFarmDialog = React.useCallback((farm: any) => {
    if (!farm || farm.name === "—") return;
    const id = farm.farmId ?? farm.key ?? null;
    if (!id) return;
    setSelectedFarmId(String(id));
    setIsFarmDialogOpen(true);
  }, []);

  const sortedFarmRows = React.useMemo(() => {
    const rows = [...farmRowsAll];
    rows.sort((a, b) => {
      if (farmSortKey === "latest")
        return (b.recencyKey ?? 0) - (a.recencyKey ?? 0);
      if (farmSortKey === "credits")
        return (b.ccPerWeek ?? 0) - (a.ccPerWeek ?? 0);
      return (b.lifetimeLq ?? 0) - (a.lifetimeLq ?? 0);
    });
    return rows;
  }, [farmRowsAll, farmSortKey]);

  const farmRowsForRender = React.useMemo(() => {
    if (sortedFarmRows.length > 0) return sortedFarmRows;
    return Array.from({ length: 6 }).map((_, index) => ({
      key: `farm-placeholder-${index}`,
      farmId: null as string | null,
      name: "—",
      region: "—",
      panels: 0,
      lifetimeLq: null as number | null,
      ccLifetime: 0,
      ccPerWeek: 0,
      projectedLifetimeCredits: null as number | null,
      creditType: "Carbon Credits",
      lifetimeWeeksElapsed: null as number | null,
      lifetimeWeeksTarget: 100,
      imageUrl: null as string | null,
    }));
  }, [sortedFarmRows]);

  const teaserSeed = React.useMemo(() => {
    const utcDate = new Date().toISOString().slice(0, 10);
    return utcDate
      .split("-")
      .join("")
      .split("")
      .reduce((acc, c) => {
        return acc * 31 + c.charCodeAt(0);
      }, 7);
  }, []);

  const farmRowsTeaser = React.useMemo(() => {
    const base =
      farmRowsAll.length > 0
        ? shuffleWithSeed(farmRowsAll, teaserSeed)
        : Array.from({ length: 6 }).map((_, index) => ({
            key: `farm-placeholder-teaser-${index}`,
            farmId: null as string | null,
            name: "—",
            region: "—",
            panels: 0,
            lifetimeLq: null as number | null,
            ccLifetime: 0,
            ccPerWeek: 0,
            projectedLifetimeCredits: null as number | null,
            creditType: "Carbon Credits",
            lifetimeWeeksElapsed: null as number | null,
            lifetimeWeeksTarget: 100,
            imageUrl: null as string | null,
            recencyKey: 0,
          }));
    return base.slice(0, 6);
  }, [farmRowsAll, teaserSeed]);

  const farmRowsToRender = showAllFarms ? farmRowsForRender : farmRowsTeaser;

  const circulatingSupplyForSupplyCard = React.useMemo(() => {
    if (!hasLiveSupply) return currentCirculating;
    // Circulating supply is the canonical value from `getGlowMarketCap`.
    // It now excludes PoL GLW inside protocol-owned positions, so it should
    // match the top banner circulating number.
    return currentCirculating;
  }, [hasLiveSupply, currentCirculating]);

  const circulationPercent = hasLiveSupply
    ? Math.min(100, (circulatingSupplyForSupplyCard / supplyTotal) * 100)
    : 0;
  const vaultedWidth =
    hasLiveSupply && vaultedGlw !== null && vaultedGlw > 0
      ? (vaultedGlw / supplyTotal) * 100
      : 0;

  const liquidityWidth =
    hasLiveSupply && polGlwInPol !== null && polGlwInPol > 0
      ? (polGlwInPol / supplyTotal) * 100
      : 0;

  const polLiquidityRange = React.useMemo(() => {
    const currentWeek = getCurrentWeekNumber(Date.now());
    const weeks = Math.max(1, currentWeek - POL_LIQUIDITY_V2_START_WEEK + 1);
    return `${weeks}w`;
  }, []);
  const { data: polLiquiditySeries } = usePolLiquidity({
    range: polLiquidityRange,
  });

  const supplyGrowthTrailing = React.useMemo(() => {
    if (!hasLiveSupply) return null;
    const series = glowCirculatingSnapshot?.series ?? null;
    if (!series || series.length === 0) return null;

    const byWeek = activelyDelegatedByWeekData?.byWeek ?? null;
    if (!byWeek) return null;

    // For a trailing 3-month KPI, use strictly completed weeks so the number doesn't
    // drift mid-week.
    const endRow = series.find((r) => r.week === supplyGrowthEndWeek) ?? null;
    if (!endRow) return null;

    const endWeek = supplyGrowthEndWeek;
    const startWeek = Math.max(97, endWeek - 13); // 13 elapsed weeks

    const startRow = series.find((r) => r.week === startWeek) ?? null;
    if (!startRow) return null;
    const elapsedWeeks = Math.max(0, endWeek - startWeek);
    const vetoUnchanged =
      startRow.breakdown.veto_council_wei === endRow.breakdown.veto_council_wei;
    const syntheticVetoAccrualGlw = vetoUnchanged
      ? VETO_COUNCIL_INFLATION_PER_WEEK_GLW * elapsedWeeks
      : 0;

    const vaultedStartWei = byWeek[startWeek];
    if (vaultedStartWei === undefined) return null;

    const vaultedEndWei = byWeek[endWeek];
    if (vaultedEndWei === undefined) return null;

    let onchainStart: number;
    let onchainEnd: number;
    let vaultedStart: number;
    let vaultedEnd: number;
    let totalSupplyStart: number;
    let totalSupplyEnd: number;
    try {
      onchainStart = Number(formatUnits(BigInt(startRow.circulating_wei), 18));
      onchainEnd = Number(formatUnits(BigInt(endRow.circulating_wei), 18));
      vaultedStart = Number(formatUnits(BigInt(vaultedStartWei), 18));
      vaultedEnd = Number(formatUnits(BigInt(vaultedEndWei), 18));
      totalSupplyStart = Number(
        formatUnits(BigInt(startRow.breakdown.total_supply_wei), 18)
      );
      totalSupplyEnd = Number(
        formatUnits(BigInt(endRow.breakdown.total_supply_wei), 18)
      );
    } catch {
      return null;
    }
    if (
      !Number.isFinite(onchainStart) ||
      !Number.isFinite(onchainEnd) ||
      !Number.isFinite(vaultedStart) ||
      !Number.isFinite(vaultedEnd) ||
      !Number.isFinite(totalSupplyStart) ||
      !Number.isFinite(totalSupplyEnd)
    )
      return null;

    // Ponder circulating excludes the off-chain "vaulted/actively delegated" term.
    // Build a canonical weekly series point by subtracting the vaulted GLW for that week.
    const canonicalStartRaw = onchainStart - vaultedStart;
    const canonicalEnd = onchainEnd - vaultedEnd - syntheticVetoAccrualGlw;
    // Normalize miner inflation in-window to exactly 175k/week by assigning any
    // observed mint residual to the starting baseline (carryover from prior weeks).
    const observedTotalSupplyDelta = totalSupplyEnd - totalSupplyStart;
    const expectedMinerInflationDelta = MINER_INFLATION_PER_WEEK_GLW * elapsedWeeks;
    const mintResidualCarryover =
      observedTotalSupplyDelta - expectedMinerInflationDelta;
    const canonicalStart = canonicalStartRaw + mintResidualCarryover;
    if (
      !Number.isFinite(canonicalStart) ||
      !Number.isFinite(canonicalEnd) ||
      canonicalStart <= 0 ||
      canonicalEnd <= 0
    )
      return null;

    const ratio = canonicalEnd / canonicalStart;
    if (!Number.isFinite(ratio) || ratio <= 0) return null;

    const trailing = ratio - 1;
    return Number.isFinite(trailing) ? trailing : null;
  }, [
    activelyDelegatedByWeekData,
    glowCirculatingSnapshot,
    hasLiveSupply,
    supplyGrowthEndWeek,
  ]);

  const supplyGrowthAnnual = React.useMemo(() => {
    if (supplyGrowthTrailing === null) return null;
    const ratio = 1 + supplyGrowthTrailing;
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    const annualized = Math.pow(ratio, 52 / 13) - 1;
    return Number.isFinite(annualized) ? annualized : null;
  }, [supplyGrowthTrailing]);

  const supplyGrowthAnnualDisplay =
    supplyGrowthAnnual !== null ? formatPercent(supplyGrowthAnnual * 100) : "—";

  const polGrowthAnnual = React.useMemo(() => {
    const series = polLiquiditySnapshot?.series ?? null;
    if (!series || series.length === 0) return null;
    const start = series.find((r) => r.week === supplyGrowthStartWeek);
    const end = series.find((r) => r.week === supplyGrowthEndWeek);
    if (!start || !end) return null;
    const startLq = parseLqUnits(start.pol_lq ?? null);
    const endLq = parseLqUnits(end.pol_lq ?? null);
    if (
      startLq === null ||
      endLq === null ||
      !Number.isFinite(startLq) ||
      !Number.isFinite(endLq) ||
      startLq <= 0
    )
      return null;
    const ratio = endLq / startLq;
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    const annualized = Math.pow(ratio, 52 / 13) - 1;
    return Number.isFinite(annualized) ? annualized : null;
  }, [polLiquiditySnapshot, supplyGrowthEndWeek, supplyGrowthStartWeek]);

  const polGrowthAnnualDisplay =
    polGrowthAnnual !== null ? formatPercent(polGrowthAnnual * 100) : "—";
  const polGrowthHelper =
    polGrowthAnnual !== null
      ? "Annualized growth from PoL liquidity snapshots (Ⱡ)"
      : "Requires PoL liquidity snapshots";

  const poolUsdg = poolReserves?.usdg ?? 0;
  const poolGlw = poolReserves?.glw ?? 0;
  const hasPoolReserves = poolUsdg > 0 && poolGlw > 0;
  const poolLiquidityBreakdown = hasPoolReserves
    ? getLiquidityFromReserves(poolUsdg, poolGlw)
    : { liquidity: 0, value: "—", breakdown: "—" };
  const poolDepthDisplay = poolLiquidityBreakdown.value;
  const poolDepthHelper = hasPoolReserves
    ? `(${poolLiquidityBreakdown.breakdown})`
    : "Live data unavailable";

  // What % of the market cap can be exited through PoL?
  // Model: dump the full circulating supply into the PoL constant-product invariant.
  // x=USDG, y=GLW, k=x*y. Add S to y, solve x' = k/(y+S), dollars out = x - x'.
  const polExitabilityPct = React.useMemo(() => {
    if (!hasLiveMarketCap || currentMarketCap <= 0) return null;
    if (!hasLiveSupply || currentCirculating <= 0) return null;

    const usdgMicroRaw = polSummary?.total?.breakdown?.usdg ?? null;
    const glwWeiRaw = polSummary?.total?.breakdown?.glw ?? null;
    if (usdgMicroRaw === null || glwWeiRaw === null) return null;

    const x = Number(formatUnits(BigInt(usdgMicroRaw), 6));
    const y = Number(formatUnits(BigInt(glwWeiRaw), 18));
    if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0)
      return null;

    const k = x * y;
    if (!Number.isFinite(k) || k <= 0) return null;

    const yAfter = y + currentCirculating;
    if (!Number.isFinite(yAfter) || yAfter <= 0) return null;

    const xAfter = k / yAfter;
    const usdOut = Math.max(0, Math.min(x, x - xAfter));
    const ratio = usdOut / currentMarketCap;
    if (!Number.isFinite(ratio) || ratio < 0) return null;
    return Math.min(1, ratio) * 100;
  }, [
    currentCirculating,
    currentMarketCap,
    hasLiveMarketCap,
    hasLiveSupply,
    polSummary,
  ]);

  const polExitabilityDisplay =
    polExitabilityPct !== null ? formatPercent(polExitabilityPct) : "—";

  const totalPolBreakdown = React.useMemo(() => {
    if (!polSummary || !displayPrice || displayPrice <= 0) return null;
    const usdMicroRaw = polSummary?.total?.usd ?? null;
    const usdgMicroRaw = polSummary?.total?.breakdown?.usdg ?? null;
    const glwWeiRaw = polSummary?.total?.breakdown?.glw ?? null;
    if (usdMicroRaw === null || usdgMicroRaw === null || glwWeiRaw === null)
      return null;

    const usd = Number(formatUnits(BigInt(usdMicroRaw), 6));
    const usdg = Number(formatUnits(BigInt(usdgMicroRaw), 6));
    const glw = Number(formatUnits(BigInt(glwWeiRaw), 18));
    const lq = totalPolLq ?? null;
    return {
      lq,
      usd,
      breakdown: `$${formatCompactNumber(usdg)} / ${formatCompactNumber(
        glw
      )} GLW`,
    };
  }, [polSummary, displayPrice, totalPolLq]);

  const fdvUsd = React.useMemo(() => {
    if (!hasLivePrice) return null;
    return FDV_TOTAL_TOKENS_GLW * currentPrice;
  }, [hasLivePrice, currentPrice]);

  const polLiquidityTrend = React.useMemo(() => {
    const series = polLiquiditySeries?.series;
    if (!series || series.length < 2) return null;
    const sorted = series.slice().sort((a, b) => a.weekNumber - b.weekNumber);
    const completed = sorted.length > 1 ? sorted.slice(0, -1) : sorted;
    const windowed = completed.filter(
      (row) => row.weekNumber >= POL_LIQUIDITY_V2_START_WEEK
    );
    if (windowed.length < 2) return null;

    return windowed.map((row, index) => {
      const prev = index > 0 ? windowed[index - 1] : null;
      const liquidity = parseLqUnits(row.totalLq) ?? 0;
      const prevLiquidity = prev ? parseLqUnits(prev.totalLq) ?? 0 : null;
      const deltaLiquidity =
        prevLiquidity === null ? null : liquidity - prevLiquidity;

      const endowmentLiquidity = parseLqUnits(row.endowmentLq) ?? 0;
      const prevEndowmentLiquidity = prev
        ? parseLqUnits(prev.endowmentLq) ?? 0
        : null;
      const deltaEndowmentLiquidity =
        prevEndowmentLiquidity === null
          ? null
          : endowmentLiquidity - prevEndowmentLiquidity;

      const botActiveLiquidity = parseLqUnits(row.botActiveLq) ?? 0;
      const prevBotActiveLiquidity = prev
        ? parseLqUnits(prev.botActiveLq) ?? 0
        : null;
      const deltaBotActiveLiquidity =
        prevBotActiveLiquidity === null
          ? null
          : botActiveLiquidity - prevBotActiveLiquidity;

      const usdValue = (() => {
        const raw = row.totalUsdUsdc6;
        if (!raw) return null;
        try {
          const n = Number(formatUnits(BigInt(raw), 6));
          return Number.isFinite(n) ? n : null;
        } catch {
          return null;
        }
      })();
      const prevUsdValue = prev?.totalUsdUsdc6
        ? (() => {
            try {
              const n = Number(formatUnits(BigInt(prev.totalUsdUsdc6), 6));
              return Number.isFinite(n) ? n : null;
            } catch {
              return null;
            }
          })()
        : null;
      const deltaUsdValue =
        prevUsdValue === null || usdValue === null
          ? null
          : usdValue - prevUsdValue;

      const spotPrice = (() => {
        const raw = row.spotPriceUsdgPerGlw;
        if (!raw) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      })();
      const weekEndMs =
        row.asOfTimestamp && Number.isFinite(row.asOfTimestamp)
          ? row.asOfTimestamp * 1000
          : getWeekEndMs(row.weekNumber);
      const weekStartMs = Math.max(0, weekEndMs - SECONDS_PER_WEEK * 1000);
      const epochEndMs = getWeekEndMs(row.weekNumber);

      return {
        week: formatDateAxisUtc(new Date(epochEndMs - 1)),
        weekStartMs,
        weekEndMs,
        liquidity,
        deltaLiquidity,
        endowmentLiquidity,
        deltaEndowmentLiquidity,
        botActiveLiquidity,
        deltaBotActiveLiquidity,
        usdValue,
        deltaUsdValue,
        spotPrice,
      };
    });
  }, [polLiquiditySeries]);
  const polLiquidityChartData = polLiquidityTrend ?? [];
  const polLiquidityIsLive = Boolean(polLiquidityTrend);
  const regionsTableRows = React.useMemo(() => {
    const rows = polRevenueRegions?.regions ?? [];
    return rows.map((r, idx) => ({
      region:
        resolveRegionName((r as any).zone_id ?? null) ??
        (r as any).region ??
        `Region ${idx + 1}`,
      lifetimeLq: parseLqUnits(r.lifetime_lq ?? null),
      ninetyDayLq: parseLqUnits(r.ninety_day_lq ?? null),
      farms: (r as any).farm_count ?? (r as any).farms ?? 0,
      ccPerWeek:
        (r as any).cc_per_week !== null && (r as any).cc_per_week !== undefined
          ? Number((r as any).cc_per_week)
          : null,
      stakedGctl: (() => {
        const raw = (r as any).staked_gctl ?? (r as any).gctl_staked ?? null;
        if (raw === null || raw === undefined) return null;
        try {
          // GCTL is 6 decimals (atomic USDC6-style).
          return Number(formatUnits(BigInt(raw), 6));
        } catch {
          if (typeof raw === "string" && raw.includes(".")) {
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
          }
          const n = Number(raw);
          return Number.isFinite(n) ? n / 1e6 : null;
        }
      })(),
    }));
  }, [polRevenueRegions, resolveRegionName]);

  const regionsRowsForRender = React.useMemo(() => {
    if (regionsTableRows.length > 0) return regionsTableRows;
    return Array.from({ length: 5 }).map((_, index) => ({
      region: `—${index ? ` ${index + 1}` : ""}`,
      lifetimeLq: null as number | null,
      ninetyDayLq: null as number | null,
      farms: 0,
      ccPerWeek: null as number | null,
      stakedGctl: null as number | null,
    }));
  }, [regionsTableRows]);

  const { data: vestingSchedule } = useGlwVestingSchedule();
  const vestingSeries = vestingSchedule?.points ?? VESTING_SCHEDULE;
  const vestingCategorySeries = vestingSchedule?.categoryPoints ?? null;
  const vestingBreakdown = vestingSchedule?.breakdown ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-8">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-6">
            <SectionHeader title="Overview" />

            {/* ── Row 1: Headline banner ── */}
            <Card
              className={cn(
                "!gap-0 glow-gradient border border-border/20 transition-colors cursor-pointer hover:border-border/40 dark:hover:border-border/60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
              role="button"
              tabIndex={0}
              aria-label="Open Glow economy basics"
              onClick={() => setIsBannerBlogOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsBannerBlogOpen(true);
                }
              }}
            >
              <CardContent className="relative px-5 py-10 pt-14 sm:px-12 sm:py-14 sm:pt-16 lg:py-16 lg:pt-16">
                <div className="absolute right-[32px] top-[0px]">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-black/55">
                    Click for basics ↗
                  </div>
                </div>
                <div className="mx-auto w-full max-w-5xl grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-16 md:gap-y-8 md:items-end">
                  <div className="grid grid-rows-[auto_auto] gap-3 md:col-span-2 md:justify-self-center md:items-center md:text-center">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-black/55">
                      Market Cap
                    </div>
                    <div className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight font-mono tabular-nums leading-none text-black">
                      {marketCapDisplay}
                    </div>
                  </div>

                  <div className="grid grid-rows-[auto_auto_auto] gap-3 md:justify-self-start md:items-center md:text-center">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-black/55">
                      GLW Price
                    </div>
                    <div className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none text-black">
                      {priceDisplay}
                    </div>
                    <Link
                      href={DEFINED_FI_GLOW_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-black/60 hover:text-black/80 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Pool activity ↗
                    </Link>
                  </div>

                  <div className="grid grid-rows-[auto_auto_auto] gap-3 md:justify-self-end md:items-center md:text-center">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-black/55">
                      Embedded Liquidity
                    </div>
                    <div className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none text-black">
                      {totalPolLq !== null
                        ? formatLiquidityCompact(totalPolLq)
                        : "—"}
                    </div>
                    <div className="text-sm text-black/60 text-center">
                      {totalPolBreakdown?.breakdown
                        ? `(${totalPolBreakdown.breakdown})`
                        : "Live data unavailable"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Row 2: Growth cards + Supply/Circulation ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr] lg:items-stretch">
              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:h-full lg:grid-rows-2">
                <Card
                  className={cn(
                    "!gap-0 !py-0 h-full relative overflow-hidden transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                  role="button"
                  tabIndex={0}
                  aria-label="Open total solar installations notes"
                  onClick={() => setIsInstallationsDialogOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsInstallationsDialogOpen(true);
                    }
                  }}
                >
                  <GlowSymbol className="!text-[var(--color-glow-orange)] absolute -top-5 -right-5 w-28 h-28 opacity-20 pointer-events-none -rotate-12" />
                  <CardContent className="relative h-full flex flex-col px-5 py-5 pb-14 sm:px-8 sm:py-7 sm:pb-14">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Total Solar Installations
                    </div>
                    <div className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                      {totalSolarInstallations !== null
                        ? formatNumber(totalSolarInstallations)
                        : "—"}
                    </div>
                    <div className="pointer-events-none absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-black text-sm text-white dark:border-white/40 dark:bg-white dark:text-black">
                      ↗
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    "!gap-0 !py-0 h-full relative overflow-hidden transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                  role="button"
                  tabIndex={0}
                  aria-label="Open embedded liquidity growth notes"
                  onClick={() => setIsLiquidityGrowthDialogOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsLiquidityGrowthDialogOpen(true);
                    }
                  }}
                >
                  <GlowSymbol className="!text-[var(--color-glow-purple)] absolute -top-5 -right-5 w-28 h-28 opacity-15 pointer-events-none rotate-6" />
                  <CardContent className="relative h-full flex flex-col px-5 py-5 pb-14 sm:px-8 sm:py-7 sm:pb-14">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Embedded Liquidity Growth (3 Months)
                    </div>
                    <div className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                      {polTrailingPolGrowthDisplay?.lq ?? "—"}
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      {polTrailingPolGrowthDisplay?.breakdown
                        ? `(${polTrailingPolGrowthDisplay.breakdown})`
                        : "Live data unavailable"}
                    </div>
                    <div className="pointer-events-none absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-black text-sm text-white dark:border-white/40 dark:bg-white dark:text-black">
                      ↗
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className={cn(
                    "!gap-0 !py-0 h-full relative overflow-hidden transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                  role="button"
                  tabIndex={0}
                  aria-label="Open annualized circulating growth notes"
                  onClick={() => setIsCirculatingGrowthDialogOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsCirculatingGrowthDialogOpen(true);
                    }
                  }}
                >
                  <GlowSymbol className="!text-[var(--color-glow-green)] absolute -top-6 -right-6 w-32 h-32 opacity-25 dark:opacity-15 pointer-events-none rotate-12" />
                  <CardContent className="relative h-full flex flex-col px-5 py-5 pb-14 sm:px-8 sm:py-7 sm:pb-14">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Annualized Circulating Supply Growth
                    </div>
                    <div className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                      {supplyGrowthAnnualDisplay}
                    </div>
                    <div className="pointer-events-none absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-black text-sm text-white dark:border-white/40 dark:bg-white dark:text-black">
                      ↗
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    "!gap-0 !py-0 h-full relative overflow-hidden transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                  role="button"
                  tabIndex={0}
                  aria-label="Open annualized embedded liquidity growth notes"
                  onClick={() => setIsEmbeddedGrowthDialogOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsEmbeddedGrowthDialogOpen(true);
                    }
                  }}
                >
                  <GlowSymbol className="!text-[var(--color-glow-orange)] absolute -top-5 -right-5 w-28 h-28 opacity-15 pointer-events-none -rotate-6" />
                  <CardContent className="relative h-full flex flex-col px-5 py-5 pb-14 sm:px-8 sm:py-7 sm:pb-14">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Annualized Embedded Liquidity Growth
                    </div>
                    <div className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                      {polGrowthAnnualDisplay}
                    </div>
                    <div className="pointer-events-none absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-black text-sm text-white dark:border-white/40 dark:bg-white dark:text-black">
                      ↗
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card
                className={cn(
                  "!gap-6 lg:h-full transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                role="button"
                tabIndex={0}
                aria-label="Open supply model explorer"
                onClick={() => setIsSupplyDialogOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsSupplyDialogOpen(true);
                  }
                }}
              >
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">
                      Supply &amp; Circulation
                    </div>
                    <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                      Click to explore ↗
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div>
                    <MetricCard
                      label="Circulating supply"
                      value={
                        hasLiveSupply
                          ? `${formatCompactNumberPrecise(
                              circulatingSupplyForSupplyCard
                            )} GLW`
                          : "—"
                      }
                    />
                    <div className="flex items-center justify-center gap-4 mt-4">
                      <div className="relative shrink-0">
                        <ChartContainer
                          config={{
                            circulating: {
                              label: "Circulating",
                              color: "#4ade80",
                            },
                            vaulted: { label: "Vaulted", color: "#a855f7" },
                            pol: { label: "PoL GLW", color: "#ffb472" },
                            other: {
                              label: "Structurally Locked",
                              color: "hsl(0 0% 80%)",
                            },
                          }}
                          className="h-36 w-36"
                        >
                          <PieChart>
                            <Pie
                              data={[
                                {
                                  name: "Circulating",
                                  value: Math.round(
                                    circulatingSupplyForSupplyCard
                                  ),
                                  fill: "#4ade80",
                                },
                                {
                                  name: "Vaulted",
                                  value: Math.round(vaultedGlw ?? 0),
                                  fill: "#a855f7",
                                },
                                {
                                  name: "PoL GLW",
                                  value: Math.round(polGlwInPol ?? 0),
                                  fill: "#ffb472",
                                },
                                {
                                  name: "Structurally Locked",
                                  value: Math.max(
                                    0,
                                    Math.round(
                                      supplyTotal -
                                        circulatingSupplyForSupplyCard -
                                        (vaultedGlw ?? 0) -
                                        (polGlwInPol ?? 0)
                                    )
                                  ),
                                  fill: "hsl(0 0% 85%)",
                                },
                              ].filter((d) => d.value > 0)}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={38}
                              outerRadius={62}
                              strokeWidth={2}
                              stroke="var(--color-card)"
                            />
                            <ChartTooltip
                              content={
                                <ChartTooltipContent
                                  formatter={(value) => {
                                    const n =
                                      typeof value === "number"
                                        ? value
                                        : Number(value);
                                    return `${formatCompactNumberPrecise(
                                      n
                                    )} GLW`;
                                  }}
                                />
                              }
                            />
                          </PieChart>
                        </ChartContainer>
                      </div>
                      <div className="flex flex-col gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ background: "#4ade80" }}
                          />
                          <span className="text-muted-foreground">
                            Circulating
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ background: "#a855f7" }}
                          />
                          <span className="text-muted-foreground">Vaulted</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ background: "#ffb472" }}
                          />
                          <span className="text-muted-foreground">PoL GLW</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ background: "hsl(0 0% 85%)" }}
                          />
                          <span className="text-muted-foreground">
                            Structurally Locked
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MiniStat
                      label="Vaulted"
                      value={
                        vaultedGlw !== null
                          ? formatCompactNumberPrecise(vaultedGlw)
                          : "—"
                      }
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="PoL GLW"
                      value={
                        polGlwInPol !== null
                          ? `${formatCompactNumberPrecise(polGlwInPol)} GLW`
                          : "—"
                      }
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSupplyDialogOpen(true);
                    }}
                  >
                    Explore Supply Model
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeader title="Solar Farm Economics" />

              <div className="flex items-center justify-end gap-3">
                {showAllFarms ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                      Sort by
                    </span>
                    <select
                      value={farmSortKey}
                      onChange={(e) =>
                        setFarmSortKey(
                          e.target.value as "latest" | "lifetime" | "credits"
                        )
                      }
                      className="rounded-lg border border-border/40 bg-background px-2.5 py-1.5 text-xs font-mono cursor-pointer hover:border-border/60 transition-colors"
                    >
                      <option value="latest">Latest</option>
                      <option value="lifetime">Lifetime</option>
                      <option value="credits">CC / Week</option>
                    </select>
                  </div>
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllFarms((v) => !v)}
                >
                  {showAllFarms ? "Show less" : "See all"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {farmRowsToRender.map((farm) => {
                const lifetimeLq =
                  farm.lifetimeLq !== null && displayPrice > 0
                    ? {
                        value: formatLiquidityCompact(farm.lifetimeLq),
                        breakdown: getBreakdownFromLq(
                          farm.lifetimeLq,
                          displayPrice
                        ).breakdown,
                      }
                    : { value: "—", breakdown: "—" };
                const lifetimeProgress =
                  farm.lifetimeWeeksElapsed !== null
                    ? `${farm.lifetimeWeeksElapsed} / ${farm.lifetimeWeeksTarget} wks`
                    : "—";
                return (
                  <Card
                    key={farm.key}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open details for ${farm.name}`}
                    onClick={() => openFarmDialog(farm)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openFarmDialog(farm);
                      }
                    }}
                    className={cn(
                      "!gap-0 !py-0 group overflow-hidden transition-all duration-200",
                      "hover:border-border/60 dark:hover:border-border/80 cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                  >
                    <CardContent className="p-0">
                      {/* Farm image header */}
                      <div className="relative h-40 w-full overflow-hidden bg-muted/30">
                        {farm.imageUrl ? (
                          <FallbackImage
                            src={farm.imageUrl}
                            widthForProxy={600}
                            quality={80}
                            alt={farm.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-muted/40 via-muted/20 to-muted/40 flex items-center justify-center">
                            <span className="text-3xl opacity-30">&#9728;</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                          <h3 className="font-bold text-white text-sm leading-tight truncate">
                            {farm.name}
                          </h3>
                        </div>
                        <div className="absolute top-3 right-3 z-10 rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest text-white/80">
                          Open ↗
                        </div>
                      </div>
                      <div className="px-5 pt-4 pb-0">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono uppercase tracking-widest">
                            {farm.region}
                          </span>
                        </div>
                      </div>
                      {/* Revenue metrics */}
                      <div className="px-5 pt-4 pb-4 grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                            Generated Revenue (Lifetime)
                          </div>
                          <div className="text-xl font-semibold font-mono tabular-nums tracking-tight">
                            {lifetimeLq.value}
                          </div>
                          <div className="text-[10px] text-muted-foreground leading-tight">
                            ({lifetimeLq.breakdown})
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                            Lifetime Progress
                          </div>
                          <div className="text-xl font-semibold font-mono tabular-nums tracking-tight">
                            {lifetimeProgress}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Card className="!gap-0">
              <CardContent className="p-6 sm:p-8">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                  Mini Blog
                </div>
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Each region generates revenue from GCTL staked to that
                    region and from miner sales that originate there. When a
                    miner is sold, part of the cash subsidizes solar farms, part
                    covers hard costs like auditing, and part becomes protocol
                    revenue.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Within each region, revenue is attributed to farms based on
                    projected lifetime credit production. Farms projected to
                    produce more credits are attributed more revenue.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader title="PoL, GCTL, Wallets" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* ── Protocol Liquidity ── */}
              <Card
                className={cn(
                  "!gap-6 h-full transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                role="button"
                tabIndex={0}
                aria-label="Open protocol liquidity notes"
                onClick={() => setIsPolLiquidityDialogOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsPolLiquidityDialogOpen(true);
                  }
                }}
              >
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">
                      Protocol Liquidity
                    </div>
                    <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                      Click for notes ↗
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5 h-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <MetricCard
                      label="Embedded Liquidity"
                      value={
                        totalPolLq !== null
                          ? formatLiquidityCompact(totalPolLq)
                          : "—"
                      }
                      helper={
                        totalPolBreakdown?.breakdown
                          ? `(${totalPolBreakdown.breakdown})`
                          : "Live data unavailable"
                      }
                      valueClassName="text-3xl sm:text-4xl"
                    />
                    <MetricCard
                      label="APY"
                      value={polApyDisplay}
                      helper={
                        ninetyDayApy !== null
                          ? "From recent trading activity"
                          : "Live data unavailable"
                      }
                      valueClassName="text-3xl sm:text-4xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-1">
                      <MiniStat
                        label="3 Month Yield"
                        value={ninetyDayYieldDisplay?.lq ?? "—"}
                        helper={
                          ninetyDayYieldDisplay?.breakdown
                            ? `(${ninetyDayYieldDisplay.breakdown})`
                            : "Live data unavailable"
                        }
                        valueClassName="text-base sm:text-lg tracking-tight"
                      />
                    </div>
                    <MiniStat
                      label="Market cap exitable"
                      value={polExitabilityDisplay}
                      valueClassName="text-base sm:text-lg tracking-tight"
                    />
                  </div>
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      Embedded Liquidity
                      {polLiquidityIsLive ? "" : " · Live data unavailable"}
                    </div>
                    <ChartContainer
                      config={polLiquidityChartConfig}
                      className="min-h-[120px] flex-1 w-full"
                    >
                      <AreaChart data={polLiquidityChartData}>
                        <XAxis
                          dataKey="week"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 9 }}
                          interval="preserveStartEnd"
                        />
                        <ChartTooltip content={<PolLiquidityTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="liquidity"
                          stroke="var(--color-liquidity)"
                          fill="var(--color-liquidity)"
                          fillOpacity={0.2}
                          strokeWidth={2}
                          dot={false}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>

              {/* ── GCTL ── */}
              <Card
                className={cn(
                  "!gap-6 transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                role="button"
                tabIndex={0}
                aria-label="Open GCTL notes"
                onClick={() => setIsGctlDialogOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsGctlDialogOpen(true);
                  }
                }}
              >
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">GCTL</div>
                    <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                      Click for notes ↗
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <MetricCard
                      label="Total GCTL"
                      value={
                        isGctlLoading
                          ? "..."
                          : formatCompactNumberPrecise(gctlTotalSupply)
                      }
                      valueClassName="text-3xl sm:text-4xl"
                    />
                    <MetricCard
                      label="Mint Price"
                      value={
                        isGctlLoading ? "..." : `$${gctlPriceNumber.toFixed(2)}`
                      }
                      valueClassName="text-3xl sm:text-4xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MiniStat
                      label="Staked"
                      value={
                        isGctlLoading
                          ? "..."
                          : formatCompactNumberPrecise(gctlTotalStaked)
                      }
                      valueClassName="text-base sm:text-lg tracking-tight"
                    />
                    <MiniStat
                      label="Unstaked"
                      value={
                        isGctlLoading
                          ? "..."
                          : formatCompactNumberPrecise(gctlUnstaked)
                      }
                      valueClassName="text-base sm:text-lg tracking-tight"
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Staking by region
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center gap-5 pt-2">
                      <ChartContainer
                        config={gctlRegionChartConfigLive}
                        className="h-48 w-48 shrink-0"
                      >
                        <PieChart>
                          <Pie
                            data={gctlRegionPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={42}
                            outerRadius={82}
                            strokeWidth={2}
                            stroke="var(--color-card)"
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value, name) => {
                                  const region = gctlRegionPieData.find(
                                    (r) => r.name === name
                                  );
                                  return `${formatCompactNumberPrecise(
                                    Number(value)
                                  )} (${region?.pct ?? 0}%)`;
                                }}
                              />
                            }
                          />
                        </PieChart>
                      </ChartContainer>
                    </div>
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                      {gctlRegionPieData.map((region) => (
                        <div
                          key={region.name}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                            <span
                              className="inline-block h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: region.fill }}
                            />
                            <span className="truncate">{region.name}</span>
                          </span>
                          <span className="font-mono tabular-nums text-foreground shrink-0">
                            {formatCompactNumberPrecise(region.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Wallet Stats ── */}
              <Card
                className={cn(
                  "!gap-6 transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                role="button"
                tabIndex={0}
                aria-label="Open wallet stats notes"
                onClick={() => setIsWalletStatsDialogOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsWalletStatsDialogOpen(true);
                  }
                }}
              >
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Wallet Stats</div>
                    <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                      Click for notes ↗
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <MiniStat
                      label="GLW Holders"
                      value={
                        isWalletStatsLoading
                          ? "..."
                          : formatNumber(walletStats.glwHolders)
                      }
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Protocol Participants"
                      value={
                        isWalletStatsLoading
                          ? "..."
                          : formatNumber(walletStats.protocolParticipants)
                      }
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      New wallets per week (12w)
                      {isWalletGrowthMock ? " · Live data unavailable" : ""}
                    </div>
                    <ChartContainer
                      config={walletGrowthChartConfig}
                      className="h-24 w-full"
                    >
                      <BarChart data={walletGrowthLive ?? []} barGap={2}>
                        <XAxis
                          dataKey="week"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 9 }}
                          interval="preserveStartEnd"
                        />
                        <ChartTooltip content={<WalletGrowthTooltip />} />
                        <Bar
                          dataKey="newWallets"
                          fill="var(--color-newWallets)"
                          radius={[3, 3, 0, 0]}
                          fillOpacity={0.7}
                        />
                      </BarChart>
                    </ChartContainer>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      Wallet breakdown
                      {hasWalletBreakdown ? "" : " · Live data unavailable"}
                    </div>
                    {hasWalletBreakdown ? (
                      <div className="mb-2 text-[10px] text-muted-foreground">
                        Category percentages can total over 100% because a
                        wallet can be a delegator, miner, and GCTL holder.
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-3">
                      {hasWalletBreakdown ? (
                        walletStats.breakdown.map((row) => (
                          <div
                            key={row.label}
                            className="flex items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="inline-block h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: row.color }}
                                  />
                                  <span className="text-muted-foreground">
                                    {row.label}
                                  </span>
                                </span>
                                <span className="font-mono tabular-nums text-foreground">
                                  {row.count.toLocaleString()}
                                </span>
                              </div>
                              <div className="h-3 w-full rounded-full bg-muted/50 dark:bg-background/40 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${row.pct}%`,
                                    backgroundColor: row.color,
                                  }}
                                />
                              </div>
                            </div>
                            <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60 dark:text-muted-foreground/80 w-10 text-right shrink-0">
                              {row.pct}%
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          Live data unavailable
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader title="Delegation + Regions" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
              <Card className="!gap-6 flex flex-col">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">
                    Delegation Metrics
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-6 h-full">
                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <MiniStat
                      label="GLW delegated"
                      value={delegatedDisplay}
                      helper={
                        hasDelegationData ? undefined : "Live data unavailable"
                      }
                      valueClassName="text-lg sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Delegators"
                      value={delegatorsDisplay}
                      helper={
                        delegatorsCount !== null
                          ? undefined
                          : "Live data unavailable"
                      }
                      valueClassName="text-lg sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Est. APY"
                      value={averageApyDisplay}
                      helper={
                        averageDelegatorApy !== null
                          ? undefined
                          : "Live data unavailable"
                      }
                      valueClassName="text-lg sm:text-2xl tracking-tight"
                    />
                  </div>

                  <div className="flex flex-col">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-3">
                      Delegation growth (V2)
                    </div>
                    <ChartContainer
                      config={delegationTrendChartConfig}
                      className="h-36 sm:h-40 w-full"
                    >
                      <AreaChart data={delegationTrendLive ?? []}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="weekEndMs"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          ticks={delegationTrendTicks}
                          tickFormatter={(value) =>
                            formatMonthAxisUtc(new Date(Number(value) - 1))
                          }
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 9 }}
                          interval={0}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={36}
                          tick={{ fontSize: 9 }}
                          tickFormatter={(v) => `${v}M`}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(label, payload) => {
                                const datum = (payload?.[0] as any)
                                  ?.payload as DelegationTrendDatum | undefined;
                                const weekStart = datum?.weekStartMs
                                  ? new Date(datum.weekStartMs)
                                  : null;
                                const weekEnd = datum?.weekEndMs
                                  ? new Date(datum.weekEndMs - 1)
                                  : null;

                                if (weekStart && weekEnd) {
                                  return `${formatDateShortUtc(
                                    weekStart
                                  )} - ${formatDateShortUtc(weekEnd)} UTC`;
                                }

                                if (typeof label === "number") {
                                  return formatDateAxisUtc(
                                    new Date(Number(label) - 1)
                                  );
                                }
                                return String(label ?? "");
                              }}
                              formatter={(value) => {
                                const numeric =
                                  typeof value === "number"
                                    ? value
                                    : Number(value);
                                const formatted = Number.isFinite(numeric)
                                  ? numeric.toFixed(3)
                                  : value;
                                return [`${formatted}M GLW`, "Delegated"];
                              }}
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="delegated"
                          stroke="var(--color-delegated)"
                          fill="var(--color-delegated)"
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      Delegation ratio
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 rounded-full bg-muted/50 dark:bg-background/40 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${delegationRatioWidth.toFixed(1)}%`,
                            background:
                              "linear-gradient(90deg, hsl(270, 70%, 60%), hsl(270, 70%, 50%))",
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-foreground">
                        {delegationRatioPct !== null
                          ? `${delegationRatioPct.toFixed(1)}%`
                          : "—"}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 dark:text-muted-foreground/80 mt-1">
                      {delegationRatioDetail}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">
                    Per-Region Protocol Revenue
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border border-border/20 dark:border-border/40">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 dark:bg-background/40">
                        <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                          <th className="px-3 sm:px-4 py-3">Region</th>
                          <th className="px-3 sm:px-4 py-3">Lifetime</th>
                          <th className="px-3 sm:px-4 py-3">3 Month</th>
                          <th className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                            Farms
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {regionsRowsForRender.map((region) => {
                          const lifetimeLiquidity =
                            region.lifetimeLq !== null && displayPrice > 0
                              ? {
                                  value: formatLiquidityCompact(
                                    region.lifetimeLq
                                  ),
                                  breakdown: getBreakdownFromLq(
                                    region.lifetimeLq,
                                    displayPrice
                                  ).breakdown,
                                }
                              : { value: "—", breakdown: "—" };
                          const ninetyDayLiquidity =
                            region.ninetyDayLq !== null && displayPrice > 0
                              ? {
                                  value: formatLiquidityCompact(
                                    region.ninetyDayLq
                                  ),
                                  breakdown: getBreakdownFromLq(
                                    region.ninetyDayLq,
                                    displayPrice
                                  ).breakdown,
                                }
                              : { value: "—", breakdown: "—" };

                          return (
                            <tr
                              key={region.region}
                              className="border-t border-border/10 dark:border-border/20 hover:bg-muted/40 dark:hover:bg-background/60 transition-colors"
                            >
                              <td className="px-3 sm:px-4 py-3">
                                <div className="font-semibold text-xs sm:text-sm">
                                  {region.region}
                                </div>
                                <div className="text-[10px] sm:text-xs text-muted-foreground">
                                  {region.stakedGctl !== null
                                    ? `${formatNumber(
                                        region.stakedGctl
                                      )} GCTL staked`
                                    : "—"}
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="font-mono tabular-nums text-xs sm:text-sm">
                                  {lifetimeLiquidity.value}
                                </div>
                                <div className="text-[10px] sm:text-xs text-muted-foreground">
                                  ({lifetimeLiquidity.breakdown})
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="font-mono tabular-nums text-xs sm:text-sm">
                                  {ninetyDayLiquidity.value}
                                </div>
                                <div className="text-[10px] sm:text-xs text-muted-foreground">
                                  ({ninetyDayLiquidity.breakdown})
                                </div>
                                <div className="text-[10px] sm:text-xs text-muted-foreground">
                                  {region.ccPerWeek !== null
                                    ? `${region.ccPerWeek.toFixed(1)} cc/wk`
                                    : "—"}
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3 font-mono tabular-nums hidden sm:table-cell">
                                {region.farms}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader title="Network Impact" />
            <Card className="!gap-0">
              <CardContent className="px-4 py-6 sm:px-10 sm:py-12">
                <div className="grid grid-cols-2 gap-4 sm:gap-8 sm:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Total Panels
                    </div>
                    <div className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono tabular-nums">
                      {formatNullableNumber(impactTotals?.panels ?? null)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Verified installations
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Installed Capacity
                    </div>
                    <div className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono tabular-nums">
                      {formatNullableFixed(impactTotals?.capacityMw ?? null, 1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      MW total capacity
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Homes Powered
                    </div>
                    <div className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono tabular-nums">
                      {formatNullableNumber(impactTotals?.homesPowered ?? null)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Equivalent households
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Trees Equivalent
                    </div>
                    <div className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono tabular-nums">
                      {formatNullableCompact(impactTotals?.trees ?? null)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      CO2 offset equivalent
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* FMI temporarily hidden (extracted to app/internal/pol/fmi-widget.tsx). */}

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader title="Token Supply Over Time" />
            <Card className="!gap-6">
              <CardHeader className="pb-0">
                <div className="text-sm font-semibold">
                  Token Supply Over Time
                </div>
              </CardHeader>
              <CardContent className="grid gap-8 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  {vestingCategorySeries ? (
                    <ChartContainer
                      config={vestingCategoryChartConfig}
                      className="!aspect-auto h-full min-h-[120px] w-full pb-2 pl-2 pr-3 [&_.recharts-yAxis]:translate-x-0"
                    >
                      <AreaChart
                        data={vestingCategorySeries}
                        margin={{ top: 8, right: 10, bottom: 10, left: 0 }}
                        stackOffset="none"
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="period"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fontSize: 9,
                            fill: "var(--muted-foreground)",
                          }}
                          tickMargin={10}
                          interval="preserveStartEnd"
                          minTickGap={40}
                          padding={{ left: 4, right: 4 }}
                          tickFormatter={(v) => {
                            if (
                              typeof v === "string" &&
                              /^\d{4}-\d{2}$/.test(v)
                            ) {
                              const [y, m] = v.split("-");
                              const month = new Date(
                                Number(y),
                                Number(m) - 1
                              ).toLocaleString("en-US", { month: "short" });
                              return `${month} ${y!.slice(2)}`;
                            }
                            return String(v);
                          }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={44}
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          tickMargin={8}
                          tickFormatter={(value) =>
                            `${Math.round(Number(value))}M`
                          }
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(label) => {
                                if (
                                  typeof label === "string" &&
                                  /^\d{4}-\d{2}$/.test(label)
                                ) {
                                  const [y, m] = label.split("-");
                                  const month = new Date(
                                    Number(y),
                                    Number(m) - 1
                                  ).toLocaleString("en-US", { month: "long" });
                                  return `${month} ${y}`;
                                }
                                return `Year ${label}`;
                              }}
                              formatter={(value, name, item) => {
                                const n =
                                  typeof value === "number"
                                    ? value
                                    : Number(value);
                                const color =
                                  item?.color ||
                                  (item?.payload as Record<string, unknown>)
                                    ?.fill;
                                return (
                                  <>
                                    <div
                                      className="shrink-0 h-2.5 w-2.5 rounded-full"
                                      style={{
                                        backgroundColor: color as string,
                                      }}
                                    />
                                    <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                                      <span className="text-muted-foreground">
                                        {name}
                                      </span>
                                      <span className="font-mono font-medium tabular-nums text-foreground">
                                        {Math.round(n)}M GLW
                                      </span>
                                    </div>
                                  </>
                                );
                              }}
                            />
                          }
                        />
                        {[...VESTING_CATEGORIES].reverse().map((c) => (
                          <Area
                            key={c.key}
                            type="monotone"
                            dataKey={c.key}
                            name={c.label}
                            stackId="1"
                            stroke={c.color}
                            strokeWidth={1}
                            fill={c.color}
                            fillOpacity={0.85}
                            dot={false}
                            activeDot={false}
                          />
                        ))}
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <ChartContainer
                      config={vestingChartConfig}
                      className="!aspect-auto h-full min-h-[120px] w-full pb-2 pl-2 pr-3 [&_.recharts-yAxis]:translate-x-0"
                    >
                      <AreaChart
                        data={vestingSeries}
                        margin={{ top: 8, right: 10, bottom: 10, left: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="vestingGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#ffb472"
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="100%"
                              stopColor="#ffb472"
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="year"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          tickMargin={10}
                          padding={{ left: 8, right: 8 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={44}
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          tickMargin={8}
                          tickFormatter={(value) =>
                            `${Math.round(Number(value))}M`
                          }
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(label) => `Year ${label}`}
                              formatter={(value) => {
                                const n =
                                  typeof value === "number"
                                    ? value
                                    : Number(value);
                                return `${Math.round(n)}M GLW unlocked`;
                              }}
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="unlocked"
                          stroke="#ffb472"
                          strokeWidth={2.5}
                          fill="url(#vestingGradient)"
                          dot={false}
                          activeDot={{
                            r: 5,
                            fill: "#ffb472",
                            stroke: "var(--card)",
                            strokeWidth: 2,
                          }}
                        />
                      </AreaChart>
                    </ChartContainer>
                  )}
                </div>
                <div className="xl:col-span-5">
                  <div className="grid gap-4">
                    <MetricCard
                      label="FDV"
                      value={
                        fdvUsd !== null ? formatUsdCompactPrecise(fdvUsd) : "—"
                      }
                      helper={
                        fdvUsd !== null && hasLivePrice
                          ? `${formatCompactNumberPrecise(
                              FDV_TOTAL_TOKENS_GLW
                            )} GLW at $${priceDetail}`
                          : "Live data unavailable"
                      }
                    />
                    <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-muted/20 dark:bg-background/40 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          Token breakdown
                        </div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          {vestingBreakdown
                            ? `${formatCompactNumberPrecise(
                                vestingBreakdown.total
                              )} GLW total`
                            : `${formatCompactNumberPrecise(
                                FDV_TOTAL_TOKENS_GLW
                              )} GLW total`}
                        </div>
                      </div>

                      {vestingBreakdown ? (
                        (() => {
                          const total = Math.max(1, vestingBreakdown.total);
                          const rows = VESTING_CATEGORIES.map((c) => ({
                            key: c.key,
                            label: c.label,
                            color: c.color,
                            value: vestingBreakdown.categories[c.key],
                          })).filter(
                            (r) => Number.isFinite(r.value) && r.value > 0
                          );

                          const pct = (value: number) =>
                            Math.max(0, (value / total) * 100);

                          return (
                            <div className="mt-4">
                              <div className="h-2.5 rounded-full bg-muted/50 dark:bg-background/40 overflow-hidden flex">
                                {rows.map((r) => (
                                  <div
                                    key={r.key}
                                    className="h-full"
                                    style={{
                                      width: `${pct(r.value)}%`,
                                      background: r.color,
                                    }}
                                  />
                                ))}
                              </div>

                              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {rows.map((r) => (
                                  <div
                                    key={r.key}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                        style={{ background: r.color }}
                                      />
                                      <span className="text-xs text-muted-foreground truncate">
                                        {r.label}
                                      </span>
                                    </div>
                                    <div className="flex items-baseline gap-2 shrink-0">
                                      <span className="text-xs font-mono tabular-nums text-foreground">
                                        {formatCompactNumberPrecise(r.value)}{" "}
                                        GLW
                                      </span>
                                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground/70">
                                        {pct(r.value).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="mt-3 text-sm text-muted-foreground">
                          Live breakdown unavailable.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </section>

      <Dialog open={isSupplyDialogOpen} onOpenChange={setIsSupplyDialogOpen}>
        <DialogContent className="sm:max-w-[720px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Explore Supply Model</DialogTitle>
            <DialogDescription>
              Interactive supply model for circulating and embedded liquidity.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="min-w-0">
                <MetricCard
                  label="Circulating Supply"
                  value={
                    liquidCirculatingModeled !== null
                      ? `${formatCompactNumberPrecise(
                          liquidCirculatingModeled
                        )} GLW`
                      : "—"
                  }
                  valueClassName="break-words leading-tight !text-[clamp(1.2rem,5vw,1.9rem)] md:!text-[clamp(1.3rem,2.6vw,2rem)]"
                />
              </div>
              <div className="min-w-0">
                <MetricCard
                  label="Embedded GLW"
                  value={
                    modeledPolGlw !== null
                      ? `${formatCompactNumberPrecise(modeledPolGlw)} GLW`
                      : "—"
                  }
                  valueClassName="break-words leading-tight !text-[clamp(1.2rem,5vw,1.9rem)] md:!text-[clamp(1.3rem,2.6vw,2rem)]"
                />
              </div>
              <div className="min-w-0">
                <MetricCard
                  label="Embedded USDC"
                  value={
                    modeledPolUsdg !== null
                      ? formatUsdCompactHero(modeledPolUsdg)
                      : "—"
                  }
                  valueClassName="break-words leading-tight !text-[clamp(1.2rem,5vw,1.9rem)] md:!text-[clamp(1.3rem,2.6vw,2rem)]"
                />
              </div>
            </div>

            <div>
              {(() => {
                const denom = supplyModel.total > 0 ? supplyModel.total : 1;
                const vaulted = vaultedGlw ?? 0;
                const polNow = polWalletGlw ?? 0;
                const other = hasLiveSupply
                  ? Math.max(
                      0,
                      supplyTotal - (currentCirculating + polNow + vaulted)
                    )
                  : 0;
                const pol = modeledPolGlw ?? 0;
                const deltaPol = pol - polNow;
                const circulating = hasLiveSupply
                  ? Math.max(0, currentCirculating - deltaPol)
                  : 0;

                const circulatingPct = (circulating / denom) * 100;
                const polPct = (pol / denom) * 100;
                const vaultedPct = (vaulted / denom) * 100;
                const otherPct = (other / denom) * 100;
                return (
                  <>
                    <div className="h-6 rounded-full bg-muted/50 overflow-hidden flex">
                      <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                          width: `${circulatingPct}%`,
                          background: "hsl(142, 71%, 45%)",
                        }}
                      />
                      <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                          width: `${polPct}%`,
                          background: "hsl(29, 90%, 60%)",
                        }}
                      />
                      <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                          width: `${vaultedPct}%`,
                          background: "hsl(270, 70%, 60%)",
                        }}
                      />
                      <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                          width: `${otherPct}%`,
                          background: "hsl(240, 3.8%, 46.1%)",
                          opacity: 0.35,
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ background: "hsl(142, 71%, 45%)" }}
                        />
                        <span className="text-muted-foreground">
                          Circulating
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ background: "hsl(29, 90%, 60%)" }}
                        />
                        <span className="text-muted-foreground">
                          Embedded GLW
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ background: "hsl(270, 70%, 60%)" }}
                        />
                        <span className="text-muted-foreground">Vaulted</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{
                            background: "hsl(240, 3.8%, 46.1%)",
                            opacity: 0.5,
                          }}
                        />
                        <span className="text-muted-foreground">
                          Structurally Locked
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 font-semibold">
                  GLW price
                </div>
                <div className="text-lg font-semibold font-mono tabular-nums">
                  ${price.toFixed(price < 0.01 ? 4 : price < 1 ? 3 : 2)}
                </div>
              </div>
              <Slider
                min={0}
                max={100}
                step={0.1}
                value={[sliderValue]}
                onValueChange={(value) => {
                  const sv = value[0] ?? sliderValue;
                  setSliderValue(sv);
                  setPrice(logSliderToPrice(sv));
                  setHasAdjustedSlider(true);
                }}
                className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-2"
              />
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                <span>${PRICE_RANGE.min}</span>
                <span>${PRICE_RANGE.max}</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Embedded liquidity is a protocol-owned portfolio that is
                perfectly balanced between GLW and USDC. This means that as the
                GLW price drops, the portfolio automatically buys up GLW tokens,
                taking them out of circulation until the price recovers. In
                other words, the GLW supply contracts as the price goes down.
                This also means that as the GLW price increases, the portfolio
                automatically sells GLW, increasing the total amount of USDC
                that is available as exit liquidity to GLW holders.
              </p>
              <p className="text-sm text-muted-foreground">
                You can play with the slider to see the relationship between
                circulating supply and available exit liquidity as the GLW price
                changes.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Link
                href="/blog/glw-tokenomics"
                className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/90 hover:text-foreground"
              >
                Learn more about structurally locked tokens
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={resetSupplyModel}
                disabled={!hasAdjustedSlider}
              >
                Reset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FarmDetailsDialog
        open={isFarmDialogOpen}
        onOpenChange={(open) => {
          setIsFarmDialogOpen(open);
          if (!open) setSelectedFarmId(null);
        }}
        selectedFarm={selectedFarm}
        displayPrice={displayPrice}
      />

      <MiniBlogDialog
        open={isBannerBlogOpen}
        onOpenChange={setIsBannerBlogOpen}
        title="Glow Economy Basics"
      >
        <Link
          href={DEFINED_FI_GLOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs font-mono uppercase tracking-widest text-muted-foreground/80 hover:text-foreground"
        >
          defined.fi price page ↗
        </Link>
        <p className="text-sm text-muted-foreground">
          Just as Bitcoin turned tokens into mining machines, Glow turns tokens
          into solar farms. Glow generates revenue by selling the ability to
          control where these solar farms get built.
        </p>
        <p className="text-sm text-muted-foreground">
          Just as BTC is the central token of the Bitcoin economy, GLW is the
          central token of the Glow economy. Every week, new GLW is minted via
          inflation and distributed to farms being built on the protocol.
        </p>
        <p className="text-sm text-muted-foreground">
          As users pay for control rights, protocol revenue is used to
          permanently add liquidity to GLW. In Glow terms, this is called
          Embedded Liquidity.
        </p>
        <div className="flex flex-wrap gap-4 pt-1">
          <Link
            href="/blog/glw-tokenomics"
            className="text-xs font-mono uppercase tracking-widest text-muted-foreground/80 hover:text-foreground"
          >
            Learn More: Tokenomics
          </Link>
          <Link
            href="/internal/referral"
            className="text-xs font-mono uppercase tracking-widest text-muted-foreground/80 hover:text-foreground"
          >
            Learn More: Ecosystem
          </Link>
        </div>
      </MiniBlogDialog>

      <MiniBlogDialog
        open={isInstallationsDialogOpen}
        onOpenChange={setIsInstallationsDialogOpen}
        title="Total Solar Installations"
      >
        <p className="text-sm text-muted-foreground">
          This count includes every solar installation Glow has funded and
          built, including installations that are no longer earning rewards.
        </p>
        <p className="text-sm text-muted-foreground">
          Glow uses the term “solar farm” broadly. Even smaller deployments with
          a limited number of panels are often referred to as solar farms in
          protocol reporting.
        </p>
        <p className="text-sm text-muted-foreground">
          Installations vary meaningfully in size across regions, from small
          collections of panels to larger commercial deployments.
        </p>
      </MiniBlogDialog>

      <MiniBlogDialog
        open={isLiquidityGrowthDialogOpen}
        onOpenChange={setIsLiquidityGrowthDialogOpen}
        title="Embedded Liquidity Growth (3 Months)"
      >
        <p className="text-sm text-muted-foreground">
          Embedded liquidity growth over the last 3 months mainly comes from
          three sources: miner sales, GCTL sales, and liquidity yield generated
          by trading activity.
        </p>
        <p className="text-sm text-muted-foreground">
          These flows accumulate into protocol-owned liquidity and expand total
          exit liquidity over time.
        </p>
      </MiniBlogDialog>

      <MiniBlogDialog
        open={isCirculatingGrowthDialogOpen}
        onOpenChange={setIsCirculatingGrowthDialogOpen}
        title="Annualized Circulating Supply Growth"
      >
        <p className="text-sm text-muted-foreground">
          This value is annualized from the last 13 weeks of data. Glow uses 13
          weeks because protocol metrics update on a strict weekly cadence.
        </p>
        <p className="text-sm text-muted-foreground">
          Major growth drivers include inflation and unlocked vault supply.
          Anti-growth forces include new delegations and new embedded liquidity
          that remove liquid GLW from circulation.
        </p>
      </MiniBlogDialog>

      <MiniBlogDialog
        open={isEmbeddedGrowthDialogOpen}
        onOpenChange={setIsEmbeddedGrowthDialogOpen}
        title="Annualized Embedded Liquidity Growth"
      >
        <p className="text-sm text-muted-foreground">
          Glow is still a relatively young protocol, so embedded liquidity can
          compound quickly from a smaller base even when the absolute level is
          already meaningful.
        </p>
        <p className="text-sm text-muted-foreground">
          Embedded liquidity is permanent protocol-owned liquidity and is not
          designed to be withdrawn during downturns.
        </p>
      </MiniBlogDialog>

      <MiniBlogDialog
        open={isPolLiquidityDialogOpen}
        onOpenChange={setIsPolLiquidityDialogOpen}
        title="Protocol Liquidity Notes"
      >
        <p className="text-sm text-muted-foreground">
          APY here comes from trading activity in protocol-owned liquidity, not
          from protocol revenue. That means embedded liquidity can continue
          increasing even in periods with no miner or GCTL sale revenue.
        </p>
        <p className="text-sm text-muted-foreground">
          Market cap exitable is the estimated share of GLW market cap that can
          currently be exited through PoL depth.
        </p>
      </MiniBlogDialog>

      <MiniBlogDialog
        open={isGctlDialogOpen}
        onOpenChange={setIsGctlDialogOpen}
        title="GCTL Notes"
      >
        <p className="text-sm text-muted-foreground">
          GCTL is the asset used to direct where solar is built on the protocol.
          Staking GCTL toward a region helps route deployment and revenue there.
        </p>
        <p className="text-sm text-muted-foreground">
          GCTL is currently a control asset and is not tradable.
        </p>
      </MiniBlogDialog>

      <MiniBlogDialog
        open={isWalletStatsDialogOpen}
        onOpenChange={setIsWalletStatsDialogOpen}
        title="Wallet Stats Notes"
      >
        <p className="text-sm text-muted-foreground">
          A wallet is counted if it holds at least 0.01 GLW or at least 0.01
          points.
        </p>
        <p className="text-sm text-muted-foreground">
          Breakdown percentages can add up to more than 100% because one wallet
          can be a delegator, a miner, and a GCTL holder at the same time.
        </p>
      </MiniBlogDialog>
    </div>
  );
}
