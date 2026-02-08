"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { usePoolInfo } from "@/hooks/useLiquidityPositionsOptimized";
import { useImpactMetrics } from "@/hooks/useImpactMetrics";
import { useFmiPressure } from "@/hooks/useFmiPressure";
import { usePolLiquiditySnapshot } from "@/hooks/usePolLiquiditySnapshot";
import { usePolSummary } from "@/hooks/usePolSummary";
import {
  parseLqUnits,
  usePolRevenueAggregate,
  usePolRevenueFarms,
  usePolRevenueRegions,
} from "@/hooks/usePolRevenue";
import { usePolFarmRevenueSeries } from "@/hooks/usePolFarmRevenueSeries";
import { useGlwVestingSchedule } from "@/hooks/useGlwVestingSchedule";
import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";
import { formatUnits } from "viem";

const PRICE_RANGE = { min: 0.001, max: 100 };
const SECONDS_PER_WEEK = 7 * 24 * 60 * 60;

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

const vestingChartConfig = {
  unlocked: { label: "Unlocked supply", color: "hsl(32, 90%, 60%)" },
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUsdCompactNullable(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return formatUsdCompact(value);
}

function formatUsdCompactPrecise(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 10_000_000 ? 3 : 2,
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

function formatLiquidityCompact(value: number) {
  return `${formatCompactNumber(value)} lq`;
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
  return formatCompactNumber(value);
}

function formatNullableFixed(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatDateShort(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatDateShortUtc(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
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

type FarmRow = {
  key: string;
  farmId: string | null;
  name: string;
  region: string;
  panels: number;
  lifetimeLq: number | null;
  ninetyDayLq: number | null;
  ninetyDayDelta: number;
  ccLifetime: number;
  ccPerWeek: number;
  imageUrl: string | null;
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
  const weekNumber = datum?.weekNumber ?? null;
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
            {weekNumber !== null ? (
              <span className="text-muted-foreground/40">{` · wk ${weekNumber}`}</span>
            ) : null}
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
  selectedFarmSeries,
  isSelectedFarmSeriesLoading,
  displayPrice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFarm: FarmRow | null;
  selectedFarmSeries: any;
  isSelectedFarmSeriesLoading: boolean;
  displayPrice: number;
}) {
  const ninetyDayValue =
    selectedFarm?.ninetyDayLq !== null && selectedFarm?.ninetyDayLq !== undefined
      ? `${formatCompactNumberPrecise(selectedFarm.ninetyDayLq)} lq`
      : "—";
  const ninetyDayBreakdown =
    selectedFarm?.ninetyDayLq !== null &&
    selectedFarm?.ninetyDayLq !== undefined &&
    displayPrice > 0
      ? `(${getBreakdownFromLq(selectedFarm.ninetyDayLq, displayPrice).breakdown})`
      : null;
  const subtitle =
    selectedFarm
      ? `${selectedFarm.name} · ${selectedFarm.region} · ${selectedFarm.panels} panels`
      : "Select a farm to view details";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 shadow-none">
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
              {ninetyDayValue}
            </div>
            {ninetyDayBreakdown ? (
              <div className="text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70 uppercase tracking-wider">
                {ninetyDayBreakdown}
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
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
                  {/* Image + quick stats */}
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

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-card border border-border/20 dark:border-border/40 p-3">
                          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                            CC / week
                          </div>
                          <div className="mt-1 font-mono font-semibold tabular-nums text-foreground">
                            {(selectedFarm.ccPerWeek ?? 0).toFixed(3)}
                          </div>
                        </div>
                        <div className="rounded-xl bg-card border border-border/20 dark:border-border/40 p-3">
                          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                            Total credits
                          </div>
                          <div className="mt-1 font-mono font-semibold tabular-nums text-foreground">
                            {(selectedFarm.ccLifetime ?? 0).toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                        Revenue Summary
                      </h3>

                      {(() => {
                        const lifetime =
                          selectedFarm.lifetimeLq !== null
                            ? {
                                value: `${formatCompactNumberPrecise(
                                  selectedFarm.lifetimeLq
                                )} lq`,
                                breakdown:
                                  displayPrice > 0
                                    ? getBreakdownFromLq(
                                        selectedFarm.lifetimeLq,
                                        displayPrice
                                      ).breakdown
                                    : null,
                              }
                            : null;
                        const ninety =
                          selectedFarm.ninetyDayLq !== null
                            ? {
                                value: `${formatCompactNumberPrecise(
                                  selectedFarm.ninetyDayLq
                                )} lq`,
                                breakdown:
                                  displayPrice > 0
                                    ? getBreakdownFromLq(
                                        selectedFarm.ninetyDayLq,
                                        displayPrice
                                      ).breakdown
                                    : null,
                              }
                            : null;
                        const weekly =
                          selectedFarm.ninetyDayLq !== null
                            ? selectedFarm.ninetyDayLq / 13
                            : null;

                        return (
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                              <MetricCard
                                label="Lifetime revenue"
                                value={lifetime?.value ?? "—"}
                                helper={
                                  lifetime?.breakdown
                                    ? `(${lifetime.breakdown})`
                                    : "Live data unavailable"
                                }
                                labelClassName="text-muted-foreground/60 dark:text-muted-foreground/80"
                              />
                            </div>
                            <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                              <MetricCard
                                label="90d revenue"
                                value={ninety?.value ?? "—"}
                                helper={
                                  ninety?.breakdown
                                    ? `(${ninety.breakdown})`
                                    : "Live data unavailable"
                                }
                                labelClassName="text-muted-foreground/60 dark:text-muted-foreground/80"
                              />
                            </div>
                            <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                              <MetricCard
                                label="Weekly avg (90d)"
                                value={
                                  weekly !== null
                                    ? `${formatCompactNumberPrecise(weekly)} lq`
                                    : "—"
                                }
                                helper="ninety_day_lq / 13"
                                labelClassName="text-muted-foreground/60 dark:text-muted-foreground/80"
                              />
                            </div>
                            <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                              <MetricCard
                                label="Delta (90d)"
                                value={`${(selectedFarm.ninetyDayDelta ?? 0) >= 0 ? "+" : ""}${formatPercent(
                                  selectedFarm.ninetyDayDelta ?? 0
                                )}`}
                                helper="Trailing 13w vs previous 13w"
                                labelClassName="text-muted-foreground/60 dark:text-muted-foreground/80"
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                            Revenue Over Time
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Weekly components (miner sales, mints, yield)
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const pts = selectedFarmSeries?.series ?? null;
                        const hasData =
                          pts && pts.some((p: any) => parseLqUnits(p.total_lq) !== null);

                        if (isSelectedFarmSeriesLoading) {
                          return (
                            <div className="mt-3 text-sm text-muted-foreground">
                              Loading weekly series...
                            </div>
                          );
                        }

                        if (!pts || pts.length === 0 || !hasData) {
                          return (
                            <div className="mt-3 text-sm text-muted-foreground">
                              No weekly data available for this farm in the selected
                              range.
                            </div>
                          );
                        }

                        const chartData = pts.map((p: any) => ({
                          week: `W${p.week}`,
                          total: parseLqUnits(p.total_lq) ?? 0,
                          miner: parseLqUnits(p.miner_sales_lq) ?? 0,
                          mints: parseLqUnits(p.gctl_mints_lq) ?? 0,
                          yield: parseLqUnits(p.pol_yield_lq) ?? 0,
                        }));

                        const farmSeriesChartConfig = {
                          miner: { label: "Miner sales", color: "hsl(29, 90%, 60%)" },
                          mints: { label: "GCTL mints", color: "hsl(270, 70%, 60%)" },
                          yield: { label: "PoL yield", color: "hsl(142, 71%, 45%)" },
                        } satisfies ChartConfig;

                        return (
                          <div className="mt-4 rounded-xl bg-card border border-border/20 dark:border-border/40 p-3">
                            <ChartContainer
                              config={farmSeriesChartConfig}
                              className="h-48 w-full"
                            >
                              <AreaChart data={chartData} stackOffset="none">
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="week"
                                  tickLine={false}
                                  axisLine={false}
                                  interval="preserveStartEnd"
                                  minTickGap={18}
                                />
                                <YAxis
                                  tickLine={false}
                                  axisLine={false}
                                  width={46}
                                  tickFormatter={(v) =>
                                    typeof v === "number"
                                      ? formatCompactNumberPrecise(v)
                                      : String(v)
                                  }
                                />
                                <ChartTooltip
                                  content={
                                    <ChartTooltipContent
                                      formatter={(value, name) => {
                                        const v =
                                          typeof value === "number"
                                            ? value
                                            : Number(value);
                                        const pretty = Number.isFinite(v)
                                          ? `${formatCompactNumberPrecise(v)} lq`
                                          : `${String(value)} lq`;
                                        return [pretty, String(name)];
                                      }}
                                    />
                                  }
                                />
                                <Area
                                  type="monotone"
                                  dataKey="miner"
                                  name="Miner sales"
                                  stackId="rev"
                                  stroke="var(--color-miner)"
                                  fill="var(--color-miner)"
                                  fillOpacity={0.12}
                                  strokeWidth={2}
                                  dot={false}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="mints"
                                  name="GCTL mints"
                                  stackId="rev"
                                  stroke="var(--color-mints)"
                                  fill="var(--color-mints)"
                                  fillOpacity={0.10}
                                  strokeWidth={2}
                                  dot={false}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="yield"
                                  name="PoL yield"
                                  stackId="rev"
                                  stroke="var(--color-yield)"
                                  fill="var(--color-yield)"
                                  fillOpacity={0.10}
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </AreaChart>
                            </ChartContainer>
                          </div>
                        );
                      })()}
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
          "text-3xl sm:text-4xl font-semibold tracking-tight font-mono tabular-nums",
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

function FlyNode({
  label,
  value,
  detail,
  accent,
  className,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "green" | "red";
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-center cursor-default transition-colors",
            "border-border/20 dark:border-border/40 bg-card hover:bg-muted/40 dark:hover:bg-background/60",
            className
          )}
        >
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
            {label}
          </div>
          <div
            className={cn(
              "mt-1.5 text-2xl font-semibold font-mono tabular-nums tracking-tight",
              accent === "green" && "text-green-600 dark:text-green-400",
              accent === "red" && "text-red-600 dark:text-red-400"
            )}
          >
            {value}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-xs">
        {detail}
      </TooltipContent>
    </Tooltip>
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

export function PolDashboardView() {
  const [isSupplyDialogOpen, setIsSupplyDialogOpen] = React.useState(false);
  const [isFarmDialogOpen, setIsFarmDialogOpen] = React.useState(false);
  const [selectedFarmId, setSelectedFarmId] = React.useState<string | null>(
    null
  );
  const [showAllFarms, setShowAllFarms] = React.useState(false);
  const [farmSortKey, setFarmSortKey] = React.useState<
    "lifetime" | "ninetyDay" | "credits"
  >("lifetime");

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
    ? formatUsdCompactPrecise(currentMarketCap)
    : "—";
  const marketCapDisplayCompact = hasLiveMarketCap
    ? formatUsdCompact(currentMarketCap)
    : "—";
  const marketCapHelper = hasLiveSupply
    ? `${formatCompactNumber(currentCirculating)} GLW circulating`
    : "Live data unavailable";
  const priceDisplay = hasLivePrice ? `$${currentPrice.toFixed(4)}` : "—";
  const priceHelper = hasLivePrice ? "Spot price" : "Live data unavailable";
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
  const gctlStakedPct =
    gctlTotalSupply > 0
      ? Math.round((gctlTotalStaked / gctlTotalSupply) * 100)
      : 0;

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
    const delegatorCount = impactWalletStats?.delegators ?? 0;
    const minerCount = impactWalletStats?.miners ?? 0;
    const gctlCount =
      gctlHoldersCount > 0 ? Math.min(gctlHoldersCount, totalWallets) : 0;
    const otherCount = Math.max(
      0,
      totalWallets - delegatorCount - minerCount - gctlCount
    );
    const total = totalWallets || 1; // avoid division by zero
    return {
      totalWallets,
      delegatorCount,
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
          label: "Other",
          count: otherCount,
          pct: Math.round((otherCount / total) * 1000) / 10,
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
  // Pull just enough weeks to cover the 13w annualized growth computation and charts.
  const supplyGrowthEndWeek = Math.max(97, currentEpoch - 1);
  const supplyGrowthStartWeek = Math.max(97, supplyGrowthEndWeek - 13);
  const { data: activelyDelegatedByWeekData } = useActivelyDelegatedByWeek({
    startWeek: supplyGrowthStartWeek,
    endWeek: supplyGrowthEndWeek,
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
      const label = `W-${tail.length - i}`;
      const weekStartMs = (GENESIS_TIMESTAMP + weekNumber * SECONDS_PER_WEEK) * 1000;
      const weekEndMs = weekStartMs + SECONDS_PER_WEEK * 1000;
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
    const value = Number(raw) / 1e18;
    return Number.isFinite(value) ? value : null;
  }, [totalActivelyDelegatedData]);

  const hasDelegationData = totalDelegatedGlw !== null;
  const delegatorsCount = totalActivelyDelegatedData?.totalWallets ?? null;
  const delegatorsDisplay =
    delegatorsCount !== null && Number.isFinite(delegatorsCount)
      ? formatCompactNumber(delegatorsCount)
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
    totalDelegatedGlw !== null ? formatCompactNumber(totalDelegatedGlw) : "—";
  const delegationRatioPct =
    totalDelegatedGlw !== null && currentCirculating > 0
      ? (totalDelegatedGlw / currentCirculating) * 100
      : null;
  const delegationRatioWidth = delegationRatioPct
    ? Math.min(100, Math.max(0, delegationRatioPct))
    : 0;
  const delegationRatioDetail =
    totalDelegatedGlw !== null && currentCirculating > 0
      ? `${formatCompactNumber(totalDelegatedGlw)} of ${formatCompactNumber(
          currentCirculating
        )} circulating GLW delegated`
      : "Live data unavailable";

  const delegationTrendLive = React.useMemo(() => {
    const byWeek = activelyDelegatedByWeekData?.byWeek;
    if (!byWeek || Object.keys(byWeek).length < 2) return null;
    const weeks = Object.keys(byWeek)
      .map(Number)
      .sort((a, b) => a - b);
    const tail = weeks.slice(-12);
    if (!tail.length) return null;
    return tail.map((week, idx) => {
      const raw = byWeek[week] ?? "0";
      const glw = Number(raw) / 1e18;
      const delegatedM = Number.isFinite(glw) ? glw / 1_000_000 : 0;
      const label =
        idx === tail.length - 1 ? "Now" : `W-${tail.length - 1 - idx}`;
      return { week: label, delegated: delegatedM };
    });
  }, [activelyDelegatedByWeekData]);

  // ── Supply model slider ──
  const [price, setPrice] = React.useState(displayPrice);
  const [hasAdjustedSlider, setHasAdjustedSlider] = React.useState(false);
  const [sliderValue, setSliderValue] = React.useState(() =>
    priceToLogSlider(displayPrice)
  );

  React.useEffect(() => {
    if (!hasAdjustedSlider && livePrice > 0) {
      setPrice(livePrice);
      setSliderValue(priceToLogSlider(livePrice));
    }
  }, [hasAdjustedSlider, livePrice]);

  const supplyModel = React.useMemo(() => {
    const poolUsdg = poolReserves?.usdg ?? 0;
    const poolGlw = poolReserves?.glw ?? 0;

    const polUsdg = polSummary?.total?.breakdown?.usdg
      ? Number(formatUnits(BigInt(polSummary.total.breakdown.usdg), 6))
      : 0;
    const polGlw = polSummary?.total?.breakdown?.glw
      ? Number(formatUnits(BigInt(polSummary.total.breakdown.glw), 18))
      : 0;

    const totalUsdg = Math.max(0, poolUsdg + polUsdg);
    const totalGlw = Math.max(0, poolGlw + polGlw);

    // xy = k with x=USDG, y=GLW, price = USDG/GLW
    // This gives USDG side scaling with sqrt(price), and implies GLW side scales with 1/sqrt(price).
    const k = totalUsdg > 0 && totalGlw > 0 ? totalUsdg * totalGlw : 0;
    const p0 = displayPrice > 0 ? displayPrice : 0;
    const glw0 = k > 0 && p0 > 0 ? Math.sqrt(k / p0) : null;

    const modeledUsdg = k > 0 && price > 0 ? Math.sqrt(k * price) : null;
    const modeledGlw = k > 0 && price > 0 ? Math.sqrt(k / price) : null;

    const circulatingUnclamped =
      modeledGlw !== null && glw0 !== null
        ? Math.max(0, currentCirculating + (glw0 - modeledGlw))
        : currentCirculating;
    const circulating =
      supplyTotal > 0
        ? Math.min(supplyTotal, circulatingUnclamped)
        : circulatingUnclamped;

    return {
      total: supplyTotal,
      circulating,
      // "USDG liquidity" is the modeled USDG side for this illustrative model.
      usdgLiquidity: modeledUsdg,
    };
  }, [
    poolReserves,
    polSummary,
    price,
    displayPrice,
    currentCirculating,
    supplyTotal,
  ]);

  const supplyDelta = hasLiveSupply
    ? supplyModel.circulating - currentCirculating
    : null;

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
  const ninetyDayRevenueLq = parseLqUnits(
    polRevenueAggregate?.ninety_day_lq ?? null
  );
  const ninetyDayYieldLq = parseLqUnits(
    polRevenueAggregate?.ninety_day_yield_lq ?? null
  );
  const activeFarmsCount =
    polRevenueAggregate?.active_farms && polRevenueAggregate.active_farms > 0
      ? polRevenueAggregate.active_farms
      : null;

  const lifetimeRevenueDisplay =
    lifetimeRevenueLq !== null && displayPrice > 0
      ? {
          lq: `${formatCompactNumberPrecise(lifetimeRevenueLq)} lq`,
          breakdown: getBreakdownFromLq(lifetimeRevenueLq, displayPrice)
            .breakdown,
        }
      : null;

  const ninetyDayRevenueDisplay =
    ninetyDayRevenueLq !== null && displayPrice > 0
      ? {
          lq: `${formatCompactNumberPrecise(ninetyDayRevenueLq)} lq`,
          breakdown: getBreakdownFromLq(ninetyDayRevenueLq, displayPrice)
            .breakdown,
        }
      : null;

  const ninetyDayYieldDisplay =
    ninetyDayYieldLq !== null && displayPrice > 0
      ? {
          lq: `${formatCompactNumberPrecise(ninetyDayYieldLq)} lq`,
          breakdown: getBreakdownFromLq(ninetyDayYieldLq, displayPrice)
            .breakdown,
        }
      : null;

  const weeklyYieldLq =
    ninetyDayYieldLq !== null ? ninetyDayYieldLq / 13 : null;

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
        const ninetyDay = parseLqUnits(farm.ninety_day_lq ?? null);
        const ninetyDayDelta = farm.ninety_day_delta_pct ?? 0;
        const creditsTotalRaw =
          (farm as any).credits_total ?? (farm as any).cc_lifetime ?? 0;
        const ccLifetime = Number(creditsTotalRaw) || 0;
        const ccPerWeekRaw = (farm as any).cc_per_week ?? 0;
        const ccPerWeek = Number(ccPerWeekRaw) || 0;
        const imageUrl = pickSolarPanelsImageUrl([
          (farm as any).image_url ?? null,
          ...(Array.isArray((farm as any).images) ? (farm as any).images : []),
        ]);

        return {
          key: farmId ? String(farmId) : `${name}-${index}`,
          farmId: farmId ? String(farmId) : null,
          name,
          region,
          panels,
          lifetimeLq: lifetime,
          ninetyDayLq: ninetyDay,
          ninetyDayDelta,
          ccLifetime,
          ccPerWeek,
          imageUrl,
        };
      })
      .filter((row) => row.name);
  }, [polRevenueFarms, resolveRegionName]);

  const selectedFarm = React.useMemo(() => {
    if (!selectedFarmId) return null;
    return (
      farmRowsAll.find((f: any) => f.farmId === selectedFarmId) ??
      farmRowsAll.find((f: any) => f.key === selectedFarmId) ??
      null
    );
  }, [farmRowsAll, selectedFarmId]);

  const { data: selectedFarmSeries, isLoading: isSelectedFarmSeriesLoading } =
    usePolFarmRevenueSeries({
      farmId: selectedFarm?.farmId ?? null,
      range: "20w",
      enabled: isFarmDialogOpen,
    });

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
      if (farmSortKey === "credits")
        return (b.ccPerWeek ?? 0) - (a.ccPerWeek ?? 0);
      if (farmSortKey === "ninetyDay")
        return (b.ninetyDayLq ?? 0) - (a.ninetyDayLq ?? 0);
      return (b.lifetimeLq ?? 0) - (a.lifetimeLq ?? 0);
    });
    return rows;
  }, [farmRowsAll, farmSortKey]);

  const farmRowsForRender = React.useMemo(() => {
    if (sortedFarmRows.length > 0) return sortedFarmRows;
    return Array.from({ length: 6 }).map((_, index) => ({
      key: `farm-placeholder-${index}`,
      name: "—",
      region: "—",
      panels: 0,
      lifetimeLq: null as number | null,
      ninetyDayLq: null as number | null,
      ninetyDayDelta: 0,
      ccLifetime: 0,
      ccPerWeek: 0,
      imageUrl: null as string | null,
    }));
  }, [sortedFarmRows]);

  const farmRowsTeaser = React.useMemo(() => {
    const base =
      farmRowsAll.length > 0
        ? farmRowsAll
        : Array.from({ length: 3 }).map((_, index) => ({
            key: `farm-placeholder-teaser-${index}`,
            name: "—",
            region: "—",
            panels: 0,
            lifetimeLq: null as number | null,
            ninetyDayLq: null as number | null,
            ninetyDayDelta: 0,
            ccLifetime: 0,
            ccPerWeek: 0,
            imageUrl: null as string | null,
          }));
    return base.slice(-3);
  }, [farmRowsAll]);

  const farmRowsToRender = showAllFarms ? farmRowsForRender : farmRowsTeaser;

  const circulatingSupplyForSupplyCard = React.useMemo(() => {
    if (!hasLiveSupply) return currentCirculating;
    // `getGlowMarketCap` excludes PoL wallet balances, but does not exclude
    // GLW owned inside PoL LP positions. Subtract it here so the "Liquidity"
    // slice (PoL LP) isn't double-counted inside "Circulating".
    const polLpGlw = polWalletGlw ?? 0;
    const adjusted = currentCirculating - polLpGlw;
    return Number.isFinite(adjusted) ? Math.max(0, adjusted) : currentCirculating;
  }, [hasLiveSupply, currentCirculating, polWalletGlw]);

  const circulationPercent = hasLiveSupply
    ? Math.min(100, (circulatingSupplyForSupplyCard / supplyTotal) * 100)
    : 0;
  const circulatingWidth = hasLiveSupply
    ? (circulatingSupplyForSupplyCard / supplyTotal) * 100
    : 0;

  const vaultedWidth =
    hasLiveSupply && vaultedGlw !== null && vaultedGlw > 0
      ? (vaultedGlw / supplyTotal) * 100
      : 0;

  const liquidityWidth =
    hasLiveSupply && polWalletGlw !== null && polWalletGlw > 0
      ? (polWalletGlw / supplyTotal) * 100
      : 0;

  const { data: polLiquiditySnapshot } = usePolLiquiditySnapshot({
    range: "20w",
  });

  const supplyGrowthAnnual = React.useMemo(() => {
    if (!hasLiveSupply) return null;
    if (polWalletGlw === null || totalDelegatedGlw === null) return null;

    const byWeek = activelyDelegatedByWeekData?.byWeek ?? null;
    if (!byWeek) return null;

    const delegatedStartWei = byWeek[supplyGrowthStartWeek];
    const delegatedEndWei = byWeek[supplyGrowthEndWeek];
    if (delegatedStartWei === undefined || delegatedEndWei === undefined) return null;

    const delegatedStart = Number(delegatedStartWei) / 1e18;
    const delegatedEnd = Number(delegatedEndWei) / 1e18;
    if (!Number.isFinite(delegatedStart) || !Number.isFinite(delegatedEnd)) return null;

    const polSeries = polLiquiditySnapshot?.series ?? null;
    if (!polSeries || polSeries.length === 0) return null;
    const polStart = polSeries.find((r) => r.week === supplyGrowthStartWeek);
    const polEnd = polSeries.find((r) => r.week === supplyGrowthEndWeek);
    if (!polStart || !polEnd) return null;

    const polGlwStart = Number(polStart.pol_glw) / 1e18;
    const polGlwEnd = Number(polEnd.pol_glw) / 1e18;
    if (!Number.isFinite(polGlwStart) || !Number.isFinite(polGlwEnd)) return null;

    // Approximate circulating at week end by back-casting from "now", using only the
    // two moving components we have weekly snapshots for (PoL + delegated).
    const circStart =
      currentCirculating -
      (polWalletGlw - polGlwStart) -
      (totalDelegatedGlw - delegatedStart);
    const circEnd =
      currentCirculating -
      (polWalletGlw - polGlwEnd) -
      (totalDelegatedGlw - delegatedEnd);

    if (!Number.isFinite(circStart) || !Number.isFinite(circEnd) || circStart <= 0)
      return null;

    const ratio = circEnd / circStart;
    if (!Number.isFinite(ratio) || ratio <= 0) return null;

    const annualized = Math.pow(ratio, 52 / 13) - 1;
    return Number.isFinite(annualized) ? annualized : null;
  }, [
    activelyDelegatedByWeekData,
    currentCirculating,
    hasLiveSupply,
    polLiquiditySnapshot,
    polWalletGlw,
    supplyGrowthEndWeek,
    supplyGrowthStartWeek,
    totalDelegatedGlw,
  ]);

  const supplyGrowthAnnualDisplay =
    supplyGrowthAnnual !== null ? formatPercent(supplyGrowthAnnual * 100) : "—";
  const supplyGrowthHelper =
    supplyGrowthAnnual !== null
      ? "Approx from PoL + delegated weekly snapshots (protocol weeks)"
      : "Requires weekly circulating supply snapshots (or PoL + delegated history)";

  const poolUsdg = poolReserves?.usdg ?? 0;
  const poolGlw = poolReserves?.glw ?? 0;
  const hasPoolReserves = poolUsdg > 0 && poolGlw > 0;
  const poolLiquidityBreakdown = hasPoolReserves
    ? getLiquidityFromReserves(poolUsdg, poolGlw)
    : { liquidity: 0, value: "—", breakdown: "—" };
  const poolLiquidityDisplay = hasPoolReserves
    ? poolLiquidityBreakdown.value
    : "—";
  const poolLiquidityDetail = hasPoolReserves
    ? `${formatCompactNumber(poolUsdg)} USDG + ${formatCompactNumber(
        poolGlw
      )} GLW absorbing pressure`
    : "Live data unavailable";

  const totalPolLq = React.useMemo(() => {
    const raw = polSummary?.total?.lq;
    if (raw === null || raw === undefined) return null;
    return parseLqUnits(raw);
  }, [polSummary]);

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

  const polBackstopUsdDisplay =
    totalPolBreakdown?.usd !== null &&
    totalPolBreakdown?.usd !== undefined &&
    Number.isFinite(totalPolBreakdown.usd)
      ? formatUsdCompact(totalPolBreakdown.usd)
      : "—";

  const fdvUsd = React.useMemo(() => {
    if (!hasLiveSupply || !hasLivePrice) return null;
    const polGlw = polWalletGlw ?? 0;
    const maxSupplyMinusPol = Math.max(0, supplyTotal - polGlw);
    return maxSupplyMinusPol * currentPrice;
  }, [hasLiveSupply, hasLivePrice, polWalletGlw, supplyTotal, currentPrice]);

  const { data: fmiPressure } = useFmiPressure();
  const fmiBuyUsd = React.useMemo(() => {
    const raw = fmiPressure?.buy?.usdg;
    if (raw === null || raw === undefined) return null;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return null;
    // buy/sell.usdg is always in micro units (1e6).
    return numeric / 1e6;
  }, [fmiPressure]);
  const fmiSellUsd = React.useMemo(() => {
    const raw = fmiPressure?.sell?.usdg;
    if (raw === null || raw === undefined) return null;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return null;
    return numeric / 1e6;
  }, [fmiPressure]);
  const hasFmiPressure = fmiBuyUsd !== null && fmiSellUsd !== null;
  const poolPriceForDepth = hasLivePrice
    ? currentPrice
    : hasPoolReserves && poolGlw > 0
    ? poolUsdg / poolGlw
    : 0;
  const fmiPoolUsd =
    hasPoolReserves && poolPriceForDepth > 0
      ? poolUsdg + poolGlw * poolPriceForDepth
      : 0;
  const poolDepthDisplay = hasPoolReserves ? formatUsdCompact(fmiPoolUsd) : "—";
  const fmiNetPressure =
    hasFmiPressure && fmiBuyUsd !== null && fmiSellUsd !== null
      ? fmiBuyUsd - fmiSellUsd
      : null;
  const fmiRatio =
    hasFmiPressure && fmiBuyUsd + fmiSellUsd > 0
      ? fmiBuyUsd / (fmiBuyUsd + fmiSellUsd)
      : null;
  const fmiScore = fmiRatio !== null ? Math.round(fmiRatio * 100) : null;
  const fmiLabel =
    fmiScore === null
      ? "—"
      : fmiScore >= 55
      ? "Accumulating"
      : fmiScore >= 45
      ? "Neutral"
      : "Distributing";
  const fmiAccentClass =
    fmiScore === null
      ? "text-muted-foreground"
      : fmiScore >= 55
      ? "text-green-600 dark:text-green-400"
      : fmiScore >= 45
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";
  const fmiBadgeBorder =
    fmiScore === null
      ? "border-border/40 bg-muted/40"
      : fmiScore >= 55
      ? "border-green-500/30 bg-green-500/5"
      : fmiScore >= 45
      ? "border-yellow-500/30 bg-yellow-500/5"
      : "border-red-500/30 bg-red-500/5";
  const fmiPoolUsdSafe = fmiPoolUsd > 0 ? fmiPoolUsd : null;
  const fmiNetToPool =
    fmiNetPressure !== null && fmiPoolUsdSafe
      ? (fmiNetPressure / fmiPoolUsdSafe) * 100
      : null;
  const fmiSellToPool =
    fmiSellUsd !== null && fmiPoolUsdSafe ? fmiSellUsd / fmiPoolUsdSafe : null;
  const fmiBuyUsdDisplay = formatUsdCompactNullable(fmiBuyUsd);
  const fmiSellUsdDisplay = formatUsdCompactNullable(fmiSellUsd);
  const fmiNetPressureDisplay = formatUsdCompactNullable(fmiNetPressure);
  const fmiScoreDisplay = fmiScore !== null ? fmiScore : "—";
  const fmiBuySellRatio =
    hasFmiPressure &&
    fmiSellUsd !== null &&
    fmiSellUsd > 0 &&
    fmiBuyUsd !== null
      ? fmiBuyUsd / fmiSellUsd
      : null;
  const fmiBuySellRatioDisplay =
    fmiBuySellRatio !== null ? fmiBuySellRatio.toFixed(2) : "—";
  const fmiNetPressureSignedDisplay =
    fmiNetPressure !== null && Number.isFinite(fmiNetPressure)
      ? `${fmiNetPressure >= 0 ? "+" : ""}${formatUsdCompact(fmiNetPressure)}`
      : "—";
  const fmiNetPressurePerWeekDisplay =
    fmiNetPressure !== null && Number.isFinite(fmiNetPressure)
      ? `${fmiNetPressure >= 0 ? "+" : ""}${formatUsdCompact(
          fmiNetPressure
        )}/wk`
      : "—";
  const fmiSellToPoolDisplay =
    fmiSellToPool !== null ? fmiSellToPool.toFixed(1) : "—";
  const fmiNetToPoolDisplay =
    fmiNetToPool !== null ? fmiNetToPool.toFixed(1) : "—";
  const polLiquidityTrend = React.useMemo(() => {
    const series = polLiquiditySnapshot?.series;
    if (!series || series.length < 2) return null;
    const sorted = series.slice().sort((a, b) => a.week - b.week);
    const completed = sorted.length > 1 ? sorted.slice(0, -1) : sorted;
    const tail = completed.slice(-12);
    if (tail.length < 2) return null;
    return tail.map((row, index) => ({
      week: `W-${tail.length - index}`,
      liquidity: parseLqUnits(row.pol_lq) ?? 0,
    }));
  }, [polLiquiditySnapshot]);
  const polLiquidityChartData = polLiquidityTrend ?? [];
  const polLiquidityIsLive = Boolean(polLiquidityTrend);

  const polSources = React.useMemo(() => {
    const endowmentLq = parseLqUnits(polSummary?.endowment?.lq ?? null) ?? 0;
    const botLq = parseLqUnits(polSummary?.botActive?.lq ?? null) ?? 0;
    const total = endowmentLq + botLq;
    if (total <= 0) {
      return [
        { name: "Bot active", value: 100, color: "hsl(142, 71%, 45%)" },
        { name: "Endowment", value: 0, color: "hsl(29, 90%, 60%)" },
      ];
    }
    return [
      {
        name: "Bot active",
        value: Math.round((botLq / total) * 100),
        color: "hsl(142, 71%, 45%)",
      },
      {
        name: "Endowment",
        value: Math.max(0, 100 - Math.round((botLq / total) * 100)),
        color: "hsl(29, 90%, 60%)",
      },
    ];
  }, [polSummary]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-8">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-6">
            <SectionHeader title="Overview" />

            {/* ── Row 1: Headline banner ── */}
            <Card className="!gap-0 !bg-zinc-950 dark:!bg-white border-zinc-800/60 dark:border-zinc-200/60">
              <CardContent className="px-8 py-10 sm:px-10 sm:py-12">
                <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 tracking-wide">
                      Market Cap
                    </div>
                    <div className="text-4xl sm:text-5xl font-semibold tracking-tight font-mono tabular-nums text-white dark:text-zinc-950 leading-none">
                      {marketCapDisplay}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {marketCapHelper}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 tracking-wide">
                      GLW Price
                    </div>
                    <div className="text-4xl sm:text-5xl font-semibold tracking-tight font-mono tabular-nums text-white dark:text-zinc-950 leading-none">
                      {priceDisplay}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {priceHelper}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 tracking-wide">
                      Total PoL
                    </div>
                    <div className="text-4xl sm:text-5xl font-semibold tracking-tight font-mono tabular-nums text-white dark:text-zinc-950 leading-none">
                      {totalPolLq !== null
                        ? `${formatCompactNumberPrecise(totalPolLq)} lq`
                        : "—"}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      ({totalPolBreakdown?.breakdown ?? "—"})
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Row 2: Aggregate Farm Revenue (left) | Circulation (right) ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
              {/* ── Left: Protocol Revenue (4 KPI cards) ── */}
              <div className="flex flex-col gap-4 items-start">
                {/* Row 1: keep original proportions */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-[3fr_2fr] gap-4">
                  {/* Lifetime Revenue */}
                  <Card className="!gap-0 relative overflow-hidden">
                    <GlowSymbol className="!text-[var(--color-glow-green)] absolute -top-6 -right-6 w-32 h-32 opacity-50 dark:opacity-20 pointer-events-none rotate-12" />
                    <CardContent className="relative flex flex-col px-8 py-8 sm:px-10 sm:py-10">
                      <div className="text-sm font-medium text-muted-foreground tracking-wide">
                        Lifetime Revenue
                      </div>
                      <div className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                        {lifetimeRevenueDisplay?.lq ?? "—"}
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        ({lifetimeRevenueDisplay?.breakdown ?? "—"})
                      </div>
                    </CardContent>
                  </Card>

                  {/* Active Farms */}
                  <Card className="!gap-0 relative overflow-hidden">
                    <GlowSymbol className="!text-[var(--color-glow-orange)] absolute -top-5 -right-5 w-28 h-28 opacity-20 pointer-events-none -rotate-12" />
                    <CardContent className="relative flex flex-col px-8 py-8 sm:px-10 sm:py-10">
                      <div className="text-sm font-medium text-muted-foreground tracking-wide">
                        Active Farms
                      </div>
                      <div className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                        {activeFarmsCount !== null
                          ? formatNumber(activeFarmsCount)
                          : "—"}
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        Across all regions
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Row 2: give 20% width from yield -> revenue (swap ratio) */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-[4fr_3fr] gap-4">
                  {/* 90d PoL Yield */}
                  <Card className="!gap-0 relative overflow-hidden">
                    <GlowSymbol className="!text-[var(--color-glow-yellow)] absolute -top-4 -right-4 w-24 h-24 opacity-50 dark:opacity-20 pointer-events-none -rotate-6" />
                    <CardContent className="relative flex flex-col px-8 py-7 sm:px-10 sm:py-9">
                      <div className="text-sm font-medium text-muted-foreground tracking-wide">
                        90d PoL Yield
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-4">
                        <div className="text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                          {ninetyDayYieldDisplay?.lq ?? "—"}
                        </div>
                      </div>
                      <div className="mt-2.5 text-sm text-muted-foreground">
                        ({ninetyDayYieldDisplay?.breakdown ?? "—"})
                      </div>
                    </CardContent>
                  </Card>

                  {/* 90d Revenue */}
                  <Card className="!gap-0 relative overflow-hidden">
                    <GlowSymbol className="!text-[var(--color-glow-purple)] absolute -top-5 -right-5 w-28 h-28 opacity-15 pointer-events-none rotate-6" />
                    <CardContent className="relative flex flex-col px-8 py-7 sm:px-10 sm:py-9">
                      <div className="text-sm font-medium text-muted-foreground tracking-wide">
                        90d Revenue
                      </div>
                      <div className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                        {ninetyDayRevenueDisplay?.lq ?? "—"}
                      </div>
                      <div className="mt-2.5 text-sm text-muted-foreground">
                        ({ninetyDayRevenueDisplay?.breakdown ?? "—"})
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* ── Right: Supply & Circulation ── */}
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">
                    Supply &amp; Circulation
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div>
                    <MetricCard
                      label="Circulating supply"
                      value={
                        hasLiveSupply
                          ? `${formatCompactNumber(circulatingSupplyForSupplyCard)} GLW`
                          : "—"
                      }
                      helper={
                        hasLiveSupply
                          ? `${formatPercent(
                              circulationPercent
                            )} of ${formatCompactNumber(supplyTotal)} total (excl. PoL LP)`
                          : "Live data unavailable"
                      }
                    />
                    <div className="mt-3 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, circulatingWidth)
                          )}%`,
                          background: "hsl(142, 71%, 45%)",
                        }}
                      />
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, vaultedWidth))}%`,
                          background: "hsl(270, 70%, 60%)",
                        }}
                      />
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, liquidityWidth)
                          )}%`,
                          background: "hsl(29, 90%, 60%)",
                        }}
                      />
                      <div className="h-full flex-1 bg-muted-foreground/30 dark:bg-muted-foreground/50" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
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
                          style={{ background: "hsl(270, 70%, 60%)" }}
                        />
                        <span className="text-muted-foreground">Vaulted</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ background: "hsl(29, 90%, 60%)" }}
                        />
                        <span className="text-muted-foreground">PoL LP</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MiniStat
                      label="Vaulted"
                      value={
                        vaultedGlw !== null
                          ? formatCompactNumber(vaultedGlw)
                          : "—"
                      }
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="PoL LP"
                      value={
                        polWalletGlw !== null
                          ? formatCompactNumber(polWalletGlw)
                          : "—"
                      }
                      helper={
                        totalPolBreakdown?.breakdown
                          ? `(${totalPolBreakdown.breakdown})`
                          : "Live data unavailable"
                      }
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>
                  <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-muted/20 dark:bg-background/40 px-4 py-3">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                      Annualized circulating growth (13w)
                    </div>
                    <div className="mt-1 text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight">
                      {supplyGrowthAnnualDisplay}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {supplyGrowthHelper}
                    </div>
                  </div>
                  <Button onClick={() => setIsSupplyDialogOpen(true)}>
                    Explore Supply Model
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader title="Every Farm Adds Value" />
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
                        e.target.value as "lifetime" | "ninetyDay" | "credits"
                      )
                    }
                    className="rounded-lg border border-border/40 bg-background px-2.5 py-1.5 text-xs font-mono cursor-pointer hover:border-border/60 transition-colors"
                  >
                    <option value="lifetime">Lifetime</option>
                    <option value="ninetyDay">90d Revenue</option>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {farmRowsToRender.map((farm) => {
                const lifetimeLq =
                  farm.lifetimeLq !== null && displayPrice > 0
                    ? {
                        value: `${formatCompactNumberPrecise(
                          farm.lifetimeLq
                        )} lq`,
                        breakdown: getBreakdownFromLq(
                          farm.lifetimeLq,
                          displayPrice
                        ).breakdown,
                      }
                    : { value: "—", breakdown: "—" };
                const ninetyDayLq =
                  farm.ninetyDayLq !== null && displayPrice > 0
                    ? {
                        value: `${formatCompactNumberPrecise(
                          farm.ninetyDayLq
                        )} lq`,
                        breakdown: getBreakdownFromLq(
                          farm.ninetyDayLq,
                          displayPrice
                        ).breakdown,
                      }
                    : { value: "—", breakdown: "—" };
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
                        <Badge
                          variant="outline"
                          className={cn(
                            "absolute top-2.5 right-2.5 text-[10px] font-mono tabular-nums shrink-0 border-0",
                            (farm.ninetyDayDelta ?? 0) >= 0
                              ? "bg-green-600/80 text-white"
                              : "bg-red-600/80 text-white"
                          )}
                        >
                          {(farm.ninetyDayDelta ?? 0) >= 0 ? "+" : ""}
                          {formatPercent(farm.ninetyDayDelta ?? 0)}
                        </Badge>
                        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                          <Badge
                            variant="secondary"
                            className="bg-white/20 hover:bg-white/30 text-white border-0 text-[9px] px-1.5 h-4 mb-1.5 font-medium w-fit"
                          >
                            {farm.region}
                          </Badge>
                          <h3 className="font-bold text-white text-sm leading-tight truncate">
                            {farm.name}
                          </h3>
                          <p className="text-white/60 text-[11px] mt-0.5">
                            {farm.panels} panels
                          </p>
                        </div>
                      </div>
                      {/* Revenue metrics */}
                      <div className="px-5 pt-4 pb-4 grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                            Lifetime
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
                            90d
                          </div>
                          <div className="text-xl font-semibold font-mono tabular-nums tracking-tight">
                            {ninetyDayLq.value}
                          </div>
                          <div className="text-[10px] text-muted-foreground leading-tight">
                            ({ninetyDayLq.breakdown})
                          </div>
                        </div>
                      </div>
                      {/* Footer with carbon stats */}
                      <div className="px-5 py-3 border-t border-border/10 dark:border-border/20 bg-muted/20 dark:bg-background/30 flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500/60" />
                          <span className="font-mono tabular-nums">
                            {(farm.ccPerWeek ?? 0).toFixed(3)}
                          </span>
                          <span>cc/wk</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">
                            {(farm.ccLifetime ?? 0).toFixed(1)}
                          </span>{" "}
                          total credits
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader title="PoL, GCTL, Wallets" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* ── Protocol Liquidity ── */}
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">
                    Protocol Liquidity
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <MetricCard
                    label="Total PoL"
                    value={
                      totalPolLq !== null
                        ? `${formatCompactNumberPrecise(totalPolLq)} lq`
                        : "—"
                    }
                    helper={
                      totalPolBreakdown?.breakdown
                        ? `(${totalPolBreakdown.breakdown})`
                        : "Live data unavailable"
                    }
                    valueClassName="text-3xl sm:text-4xl"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat
                      label="Yield / wk"
                      value={
                        weeklyYieldLq !== null
                          ? `${formatCompactNumberPrecise(weeklyYieldLq)} lq`
                          : "—"
                      }
                      valueClassName="text-base sm:text-lg tracking-tight"
                    />
                    <MiniStat
                      label="Pool depth"
                      value={poolDepthDisplay}
                      helper={
                        hasPoolReserves ? undefined : "Live data unavailable"
                      }
                      valueClassName="text-base sm:text-lg tracking-tight"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      PoL liquidity (12w)
                      {polLiquidityIsLive ? "" : " · Live data unavailable"}
                    </div>
                    <ChartContainer
                      config={polLiquidityChartConfig}
                      className="h-24 w-full"
                    >
                      <AreaChart data={polLiquidityChartData}>
                        <XAxis
                          dataKey="week"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 9 }}
                          interval="preserveStartEnd"
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(label) => label}
                              formatter={(value) => [
                                `${formatCompactNumberPrecise(
                                  Number(value)
                                )} lq`,
                                "PoL liquidity",
                              ]}
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="liquidity"
                          stroke="var(--color-liquidity)"
                          fill="var(--color-liquidity)"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </div>
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Sources
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-4">
                      {polSources.map((segment) => (
                        <div
                          key={segment.name}
                          className="flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: segment.color }}
                              />
                              {segment.name}
                            </span>
                            <span className="font-mono tabular-nums font-medium text-foreground">
                              {segment.value}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted/50 dark:bg-background/40 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${segment.value}%`,
                                backgroundColor: segment.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── GCTL ── */}
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">GCTL</div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <MetricCard
                    label="Total GCTL"
                    value={
                      isGctlLoading
                        ? "..."
                        : formatCompactNumber(gctlTotalSupply)
                    }
                    helper={
                      isGctlLoading
                        ? "Loading..."
                        : `$${gctlPriceNumber.toFixed(2)} mint price`
                    }
                    valueClassName="text-3xl sm:text-4xl"
                  />
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      <span>Staked vs unstaked</span>
                      <span>
                        {isGctlLoading ? "..." : `${gctlStakedPct}% staked`}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${gctlStakedPct}%`,
                          background: "hsl(270, 70%, 60%)",
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <MiniStat
                        label="Staked"
                        value={
                          isGctlLoading
                            ? "..."
                            : formatCompactNumber(gctlTotalStaked)
                        }
                        valueClassName="text-base sm:text-lg tracking-tight"
                      />
                      <MiniStat
                        label="Unstaked"
                        value={
                          isGctlLoading
                            ? "..."
                            : formatCompactNumber(gctlUnstaked)
                        }
                        valueClassName="text-base sm:text-lg tracking-tight"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      Staking by region
                    </div>
                    <div className="flex items-center gap-4">
                      <ChartContainer
                        config={gctlRegionChartConfigLive}
                        className="h-36 w-36 shrink-0"
                      >
                        <PieChart>
                          <Pie
                            data={gctlRegionPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={60}
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
                                  return `${formatCompactNumber(
                                    Number(value)
                                  )} (${region?.pct ?? 0}%)`;
                                }}
                              />
                            }
                          />
                        </PieChart>
                      </ChartContainer>
                      <div className="flex-1 grid gap-1.5">
                        {gctlRegionPieData.map((region) => (
                          <div
                            key={region.name}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span
                                className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: region.fill }}
                              />
                              {region.name}
                            </span>
                            <span className="font-mono tabular-nums text-foreground">
                              {formatCompactNumber(region.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Wallet Stats ── */}
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">Wallet Stats</div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <MiniStat
                      label="Wallets"
                      value={
                        isWalletStatsLoading
                          ? "..."
                          : formatNumber(walletStats.totalWallets)
                      }
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Delegators"
                      value={
                        isWalletStatsLoading
                          ? "..."
                          : formatNumber(walletStats.delegatorCount)
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
                    <div className="flex flex-col gap-2">
                      {hasWalletBreakdown ? (
                        walletStats.breakdown.map((row) => (
                          <div
                            key={row.label}
                            className="flex items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-xs mb-1">
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
                              <div className="h-1.5 w-full rounded-full bg-muted/50 dark:bg-background/40 overflow-hidden">
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
                  <div className="grid gap-4 sm:grid-cols-3">
                    <MiniStat
                      label="GLW delegated"
                      value={delegatedDisplay}
                      helper={
                        hasDelegationData ? undefined : "Live data unavailable"
                      }
                    />
                    <MiniStat
                      label="Delegators"
                      value={delegatorsDisplay}
                      helper={
                        delegatorsCount !== null
                          ? undefined
                          : "Live data unavailable"
                      }
                    />
                    <MiniStat
                      label="Est. APY"
                      value={averageApyDisplay}
                      helper={
                        averageDelegatorApy !== null
                          ? undefined
                          : "Live data unavailable"
                      }
                    />
                  </div>

                  <div className="flex flex-col">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-3">
                      Delegation growth (12w)
                    </div>
                    <ChartContainer
                      config={delegationTrendChartConfig}
                      className="h-36 sm:h-40 w-full"
                    >
                      <AreaChart data={delegationTrendLive ?? []}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="week"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 9 }}
                          interval="preserveStartEnd"
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
                              labelFormatter={(label) => label}
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
                          <th className="px-4 py-3">Region</th>
                          <th className="px-4 py-3">Lifetime</th>
                          <th className="px-4 py-3">90d</th>
                          <th className="px-4 py-3">Farms</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regionsRowsForRender.map((region) => {
                          const lifetimeLiquidity =
                            region.lifetimeLq !== null && displayPrice > 0
                              ? {
                                  value: `${formatCompactNumberPrecise(
                                    region.lifetimeLq
                                  )} lq`,
                                  breakdown: getBreakdownFromLq(
                                    region.lifetimeLq,
                                    displayPrice
                                  ).breakdown,
                                }
                              : { value: "—", breakdown: "—" };
                          const ninetyDayLiquidity =
                            region.ninetyDayLq !== null && displayPrice > 0
                              ? {
                                  value: `${formatCompactNumberPrecise(
                                    region.ninetyDayLq
                                  )} lq`,
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
                              <td className="px-4 py-3">
                                <div className="font-semibold">
                                  {region.region}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {region.stakedGctl !== null
                                    ? `${formatNumber(
                                        region.stakedGctl
                                      )} GCTL staked`
                                    : "—"}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-mono tabular-nums">
                                  {lifetimeLiquidity.value}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ({lifetimeLiquidity.breakdown})
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-mono tabular-nums">
                                  {ninetyDayLiquidity.value}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ({ninetyDayLiquidity.breakdown})
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {region.ccPerWeek !== null
                                    ? `${region.ccPerWeek.toFixed(1)} cc/wk`
                                    : "—"}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono tabular-nums">
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
              <CardContent className="px-8 py-10 sm:px-10 sm:py-12">
                <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
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

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader title="FMI" />
            <Card className="!gap-6">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold">
                      Flywheel Market Index
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
                        fmiBadgeBorder
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-semibold font-mono tabular-nums",
                          fmiAccentClass
                        )}
                      >
                        {fmiScoreDisplay}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-mono uppercase tracking-widest",
                          fmiAccentClass
                        )}
                      >
                        {fmiLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                {/* ── Mobile: vertical flow ── */}
                <div className="flex flex-col items-center gap-2 md:hidden">
                  <FlyNode
                    label="Buy Pressure"
                    value={
                      fmiBuyUsdDisplay === "—" ? "—" : `+${fmiBuyUsdDisplay}/wk`
                    }
                    detail={`PoL yield + GCTL minting + miner sales flowing into the protocol weekly`}
                    accent="green"
                    className="w-full"
                  />
                  <div className="text-muted-foreground/30">
                    <ChevronDown className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-3 w-full">
                    <FlyNode
                      label="Liquidity Pool"
                      value={poolLiquidityDisplay}
                      detail={poolLiquidityDetail}
                      className="flex-1"
                    />
                    <div
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 shrink-0",
                        fmiBadgeBorder
                      )}
                    >
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                        Net
                      </span>
                      <span
                        className={cn(
                          "text-lg font-semibold font-mono tabular-nums",
                          fmiAccentClass
                        )}
                      >
                        {fmiNetPressureSignedDisplay}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground/50">
                        /week
                      </span>
                    </div>
                  </div>
                  <div className="text-muted-foreground/30">
                    <ChevronDown className="h-5 w-5" />
                  </div>
                  <FlyNode
                    label="Sell Pressure"
                    value={
                      fmiSellUsdDisplay === "—"
                        ? "—"
                        : `-${fmiSellUsdDisplay}/wk`
                    }
                    detail={`Vesting unlocks and secondary market seller flow per week`}
                    accent="red"
                    className="w-full"
                  />
                  <div className="text-muted-foreground/30">
                    <ChevronDown className="h-5 w-5" />
                  </div>
                  <FlyNode
                    label="Market Cap"
                    value={marketCapDisplayCompact}
                    detail={
                      hasLivePrice && hasLiveSupply
                        ? `${formatCompactNumber(
                            currentCirculating
                          )} GLW at $${priceDetail}`
                        : "Live data unavailable"
                    }
                    className="w-full"
                  />
                </div>

                {/* ── Desktop: interactive flywheel ── */}
                <div className="hidden md:block">
                  <div className="relative w-full" style={{ height: 340 }}>
                    {/* SVG connecting arcs */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 800 340"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <defs>
                        <marker
                          id="arrow-green"
                          markerWidth="8"
                          markerHeight="6"
                          refX="8"
                          refY="3"
                          orient="auto"
                        >
                          <path
                            d="M0,0 L8,3 L0,6"
                            fill="hsl(142, 71%, 45%)"
                            fillOpacity="0.5"
                          />
                        </marker>
                        <marker
                          id="arrow-red"
                          markerWidth="8"
                          markerHeight="6"
                          refX="8"
                          refY="3"
                          orient="auto"
                        >
                          <path
                            d="M0,0 L8,3 L0,6"
                            fill="hsl(0, 84%, 60%)"
                            fillOpacity="0.5"
                          />
                        </marker>
                        <marker
                          id="arrow-muted"
                          markerWidth="8"
                          markerHeight="6"
                          refX="8"
                          refY="3"
                          orient="auto"
                        >
                          <path
                            d="M0,0 L8,3 L0,6"
                            fill="currentColor"
                            fillOpacity="0.2"
                          />
                        </marker>
                      </defs>
                      {/* Buy → Market Cap (right to top) */}
                      <path
                        d="M 650,200 Q 650,60 400,60"
                        fill="none"
                        stroke="hsl(142, 71%, 45%)"
                        strokeOpacity="0.25"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                        markerEnd="url(#arrow-green)"
                      />
                      {/* Market Cap → Sell (top to left) */}
                      <path
                        d="M 400,60 Q 150,60 150,200"
                        fill="none"
                        stroke="hsl(0, 84%, 60%)"
                        strokeOpacity="0.25"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                        markerEnd="url(#arrow-red)"
                      />
                      {/* Sell → Liquidity (left to bottom) */}
                      <path
                        d="M 150,200 Q 150,280 400,280"
                        fill="none"
                        stroke="currentColor"
                        strokeOpacity="0.12"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                        markerEnd="url(#arrow-muted)"
                      />
                      {/* Liquidity → Buy (bottom to right) */}
                      <path
                        d="M 400,280 Q 650,280 650,200"
                        fill="none"
                        stroke="hsl(142, 71%, 45%)"
                        strokeOpacity="0.15"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                        markerEnd="url(#arrow-green)"
                      />
                    </svg>

                    {/* Top: Market Cap */}
                    <div className="absolute left-1/2 top-0 -translate-x-1/2">
                      <FlyNode
                        label="Market Cap"
                        value={marketCapDisplayCompact}
                        detail={
                          hasLivePrice && hasLiveSupply
                            ? `${formatCompactNumber(
                                currentCirculating
                              )} GLW at $${priceDetail}`
                            : "Live data unavailable"
                        }
                        className="w-56"
                      />
                    </div>

                    {/* Left: Sell Pressure */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2">
                      <FlyNode
                        label="Sell Pressure"
                        value={
                          fmiSellUsdDisplay === "—"
                            ? "—"
                            : `-${fmiSellUsdDisplay}/wk`
                        }
                        detail={`Vesting unlocks and secondary market seller flow per week`}
                        accent="red"
                        className="w-52"
                      />
                    </div>

                    {/* Right: Buy Pressure */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                      <FlyNode
                        label="Buy Pressure"
                        value={
                          fmiBuyUsdDisplay === "—"
                            ? "—"
                            : `+${fmiBuyUsdDisplay}/wk`
                        }
                        detail={`PoL yield + GCTL minting + miner sales flowing into the protocol weekly`}
                        accent="green"
                        className="w-52"
                      />
                    </div>

                    {/* Bottom: Liquidity Pool */}
                    <div className="absolute left-1/2 bottom-0 -translate-x-1/2">
                      <FlyNode
                        label="Liquidity Pool"
                        value={poolLiquidityDisplay}
                        detail={poolLiquidityDetail}
                        className="w-56"
                      />
                    </div>

                    {/* Center: FMI gauge */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl border px-6 py-4",
                          fmiBadgeBorder
                        )}
                      >
                        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                          FMI Score
                        </span>
                        <span
                          className={cn(
                            "text-3xl font-semibold font-mono tabular-nums",
                            fmiAccentClass
                          )}
                        >
                          {fmiScoreDisplay}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-mono uppercase tracking-widest",
                            fmiAccentClass
                          )}
                        >
                          {fmiLabel}
                        </span>
                        <div className="mt-1.5 flex items-center gap-1">
                          <span className="text-[9px] font-mono text-muted-foreground/50">
                            Net
                          </span>
                          <span
                            className={cn(
                              "text-xs font-semibold font-mono tabular-nums",
                              fmiAccentClass
                            )}
                          >
                            {fmiNetPressurePerWeekDisplay}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pressure balance bar */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                    <span>Sell pressure</span>
                    <span>Buy pressure</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden flex">
                    <div
                      className="h-full"
                      style={{
                        width: `${
                          fmiRatio !== null ? (1 - fmiRatio) * 100 : 50
                        }%`,
                        background: "hsl(0, 84%, 60%)",
                      }}
                    />
                    <div
                      className="h-full"
                      style={{
                        width: `${fmiRatio !== null ? fmiRatio * 100 : 50}%`,
                        background: "hsl(142, 71%, 45%)",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                    <span className="font-mono tabular-nums">
                      {fmiSellUsdDisplay === "—"
                        ? "—"
                        : `-${fmiSellUsdDisplay}/wk`}
                    </span>
                    <span className="font-mono tabular-nums">
                      {fmiBuyUsdDisplay === "—"
                        ? "—"
                        : `+${fmiBuyUsdDisplay}/wk`}
                    </span>
                  </div>
                </div>

                {/* Bottom stats */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <MiniStat
                    label="Pool depth"
                    value={poolLiquidityDisplay}
                    helper={
                      hasPoolReserves && fmiSellToPoolDisplay !== "—"
                        ? `${fmiSellToPoolDisplay}x weekly sell pressure`
                        : "Live data unavailable"
                    }
                    valueClassName="text-base sm:text-lg tracking-tight"
                  />
                  <MiniStat
                    label="Total PoL"
                    value={
                      totalPolLq !== null
                        ? `${formatCompactNumberPrecise(totalPolLq)} lq`
                        : "—"
                    }
                    helper={
                      totalPolBreakdown?.breakdown
                        ? `(${totalPolBreakdown.breakdown})`
                        : "Live data unavailable"
                    }
                    valueClassName="text-base sm:text-lg tracking-tight"
                  />
                  <MiniStat
                    label="Net / week"
                    value={fmiNetPressureSignedDisplay}
                    helper={
                      fmiNetToPoolDisplay !== "—"
                        ? `+${fmiNetToPoolDisplay}% pool growth`
                        : "Live data unavailable"
                    }
                    valueClassName={cn(
                      "text-base sm:text-lg tracking-tight",
                      fmiAccentClass
                    )}
                  />
                  <MiniStat
                    label="Buy / Sell ratio"
                    value={
                      fmiBuySellRatioDisplay === "—"
                        ? "—"
                        : `${fmiBuySellRatioDisplay}x`
                    }
                    helper={`${fmiBuyUsdDisplay} in, ${fmiSellUsdDisplay} out`}
                    valueClassName={cn(
                      "text-base sm:text-lg tracking-tight",
                      fmiAccentClass
                    )}
                  />
                </div>
                <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-muted/20 dark:bg-background/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Weekly buy pressure ({fmiBuyUsdDisplay}) exceeds sell
                    pressure ({fmiSellUsdDisplay}) by{" "}
                    <span className={cn("font-semibold", fmiAccentClass)}>
                      {fmiNetPressureDisplay}
                    </span>
                    , yielding a {fmiBuySellRatioDisplay}x buy/sell ratio. The
                    pool absorbs {fmiSellToPoolDisplay}x its depth in sell flow
                    weekly, with PoL backstop at {polBackstopUsdDisplay}.{" "}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader title="Unlock / FDV" />
            <Card className="!gap-6">
              <CardHeader className="pb-0">
                <div className="text-sm font-semibold">Unlock / FDV</div>
              </CardHeader>
              <CardContent className="grid gap-8 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  <ChartContainer
                    config={vestingChartConfig}
                    className="h-56 w-full pb-2 pl-2 pr-3 [&_.recharts-yAxis]:translate-x-0"
                  >
                    <LineChart
                      data={vestingSeries}
                      margin={{ top: 8, right: 10, bottom: 10, left: 0 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="year"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 9 }}
                        tickMargin={8}
                        interval="preserveStartEnd"
                        minTickGap={14}
                        padding={{ left: 8, right: 8 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        tick={{ fontSize: 9 }}
                        tickMargin={8}
                        tickFormatter={(value) => `${Math.round(Number(value))}M`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => `Year ${label}`}
                            formatter={(value) => {
                              const numeric =
                                typeof value === "number" ? value : Number(value);
                              const v = Number.isFinite(numeric) ? Math.round(numeric) : 0;
                              return `${formatNumber(v)}M GLW`;
                            }}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="unlocked"
                        stroke="var(--color-unlocked)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
                <div className="xl:col-span-5">
                  <div className="grid gap-4">
                    <MetricCard
                      label="FDV"
                      value={
                        fdvUsd !== null ? formatUsdCompactPrecise(fdvUsd) : "—"
                      }
                      helper={
                        fdvUsd !== null && polWalletGlw !== null && hasLivePrice
                          ? `${formatCompactNumber(
                              Math.max(0, supplyTotal - polWalletGlw)
                            )} GLW at $${priceDetail} (excl. PoL wallets)`
                          : "Live data unavailable"
                      }
                    />
                    <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-muted/20 dark:bg-background/40 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                        Vesting breakdown
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Founding contributors</span>
                          <span>40M (Dec 2026 to Dec 2029)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Early investors</span>
                          <span>32M (Dec 2026 to Dec 2029)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Weekly emissions</span>
                          <span>175k / week ongoing</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </section>

      <Dialog open={isSupplyDialogOpen} onOpenChange={setIsSupplyDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 shadow-none">
          <div className="border-b border-border/40 pb-6 pt-8 px-6">
            <DialogHeader>
              <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                Supply Model Explorer
              </DialogTitle>
              <DialogDescription className="sr-only">
                Supply model explorer
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-6">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              Modeled supply (not live data)
            </div>
            {/* ── Key metrics that change with price ── */}
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                label="Circulating supply"
                value={`${formatCompactNumber(supplyModel.circulating)} GLW`}
                helper={
                  supplyDelta !== null
                    ? `${formatSignedNumber(supplyDelta)} vs current`
                    : "Live data unavailable"
                }
              />
              <MetricCard
                label="USDG liquidity"
                value={
                  supplyModel.usdgLiquidity !== null
                    ? formatUsdCompact(supplyModel.usdgLiquidity)
                    : "—"
                }
                helper={
                  supplyModel.usdgLiquidity !== null && poolUsdg > 0
                    ? `${formatSignedNumber(
                        Math.round(supplyModel.usdgLiquidity - poolUsdg)
                      )} vs current pool`
                    : "Live data unavailable"
                }
              />
            </div>

            {/* ── Supply breakdown bar (circulating / vaulted) ── */}
            <div>
              {(() => {
                const denom = supplyModel.total > 0 ? supplyModel.total : 1;
                const vaulted = vaultedGlw !== null ? vaultedGlw : 0;
                const circulatingPct = (supplyModel.circulating / denom) * 100;
                const vaultedPct = (vaulted / denom) * 100;
                return (
                  <>
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      <span>Supply breakdown</span>
                      <span>
                        {formatCompactNumber(supplyModel.total)} total
                      </span>
                    </div>
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
                          width: `${vaultedPct}%`,
                          background: "hsl(270, 70%, 60%)",
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ background: "hsl(142, 71%, 45%)" }}
                        />
                        <span className="text-muted-foreground">
                          Circulating
                        </span>
                        <span className="font-mono tabular-nums ml-auto">
                          {formatPercent(circulatingPct)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ background: "hsl(270, 70%, 60%)" }}
                        />
                        <span className="text-muted-foreground">Vaulted</span>
                        <span className="font-mono tabular-nums ml-auto">
                          {formatPercent(vaultedPct)}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ── Log-scale price slider (prominent) ── */}
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

            <div className="pt-2">
              <Link
                href="/blog/glw-tokenomics"
                className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/90 hover:text-foreground"
              >
                Read GLW tokenomics
              </Link>
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
        selectedFarmSeries={selectedFarmSeries}
        isSelectedFarmSeriesLoading={isSelectedFarmSeriesLoading}
        displayPrice={displayPrice}
      />
    </div>
  );
}
