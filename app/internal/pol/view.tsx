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
import { useImpactNewWalletsByWeek, useImpactWalletStats } from "@/hooks/hub-impact";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { usePoolInfo } from "@/hooks/useLiquidityPositionsOptimized";
import { useImpactMetrics } from "@/hooks/useImpactMetrics";
import { useFmiPressure } from "@/hooks/useFmiPressure";
import { usePolLiquiditySnapshot } from "@/hooks/usePolLiquiditySnapshot";
import { getCurrentEpoch } from "@/utils/getCurrentEpoch";

// TODO: mock data (replace with live on-chain + CRM sources)
const SUPPLY_BASELINE = {
  total: 42_000_000,
  circulating: 21_800_000,
  vaulted: 2_300_000,
  price: 0.2982,
  polUsd: 2_600_000,
};
const PRICE_RANGE = { min: 0.001, max: 100 };

// TODO: mock data (weekly circulating supply deltas)
const WEEKLY_NET_CHANGES = [
  { week: "W-11", net: -45_000 },
  { week: "W-10", net: 120_000 },
  { week: "W-9", net: 175_000 },
  { week: "W-8", net: -20_000 },
  { week: "W-7", net: 210_000 },
  { week: "W-6", net: 85_000 },
  { week: "W-5", net: -60_000 },
  { week: "W-4", net: 195_000 },
  { week: "W-3", net: 160_000 },
  { week: "W-2", net: -30_000 },
  { week: "W-1", net: 220_000 },
  { week: "Now", net: 140_000 },
];

// TODO: mock data (protocol liquidity overview)
const MARKET_OVERVIEW = {
  price: 0.3148,
  priceDelta: 0.0,
  liquidity: 101_372,
  totalLiquidity: 8_750_000,
  lpGlw: 322_014,
  lpUsdc: 101_372,
  polApy: 14.6,
  polWeeklyRevenue: 168_000,
};

// TODO: mock data (aggregate farm revenue)
const AGGREGATE_FARM_REVENUE = {
  lifetimeUsd: 3_800_000,
  ninetyDayUsd: 78_000 * 13,
  ninetyDayDelta: 3.2,
  farms: 102,
  netPolNinetyDay: 24_500 * 13,
};

// TODO: mock data (per-farm revenue)
const FARM_REVENUE_ROWS = [
  {
    name: "Sheltered Pines",
    region: "Golden Colorado",
    panels: 85,
    lifetimeUsd: 186_000,
    ninetyDayUsd: 3_800 * 13,
    ninetyDayDelta: 5.2,
    credits: 12.4,
    ccPerWeek: 0.146,
    imageUrl: null as string | null,
  },
  {
    name: "Lichen Headland",
    region: "Golden Colorado",
    panels: 72,
    lifetimeUsd: 142_000,
    ninetyDayUsd: 3_200 * 13,
    ninetyDayDelta: 2.8,
    credits: 10.1,
    ccPerWeek: 0.174,
    imageUrl:
      "https://pub-e71c2d06062242109db2bdd6b0bb5ee0.r2.dev/b4d5f092-9c99-44ee-a14a-bcf7ed2fc636/misc_after_install_pictures_dji_fly_20250122_112352_436_1737570344222_photo_optimized.jpg",
  },
  {
    name: "Thriving Alcove",
    region: "Shining Missouri",
    panels: 95,
    lifetimeUsd: 128_000,
    ninetyDayUsd: 2_900 * 13,
    ninetyDayDelta: -1.2,
    credits: 13.4,
    ccPerWeek: 0.141,
    imageUrl: null as string | null,
  },
  {
    name: "Emerald Crossing",
    region: "Golden Colorado",
    panels: 54,
    lifetimeUsd: 98_000,
    ninetyDayUsd: 2_400 * 13,
    ninetyDayDelta: 4.1,
    credits: 5.7,
    ccPerWeek: 0.106,
    imageUrl: null as string | null,
  },
  {
    name: "Papaya Prairie",
    region: "Rising Utah",
    panels: 62,
    lifetimeUsd: 82_000,
    ninetyDayUsd: 1_800 * 13,
    ninetyDayDelta: 3.6,
    credits: 2.7,
    ccPerWeek: 0.043,
    imageUrl:
      "https://pub-e71c2d06062242109db2bdd6b0bb5ee0.r2.dev/cc098775-8a92-4f28-924e-4c1ba8c7a4f6/misc_after_install_pictures_dji_fly_20260107_141538_764_1767820610384_photo_optimized.jpg",
  },
  {
    name: "Fresh Grange",
    region: "Golden Colorado",
    panels: 48,
    lifetimeUsd: 64_000,
    ninetyDayUsd: 1_600 * 13,
    ninetyDayDelta: 1.8,
    credits: 4.9,
    ccPerWeek: 0.103,
    imageUrl:
      "https://pub-e71c2d06062242109db2bdd6b0bb5ee0.r2.dev/51e2d48b-243c-4909-bc26-2b15b77daed7/misc_after_install_pictures_copy_of_dji_fly_20250119_134838_80_1737319751976_photo_optimized.jpg",
  },
];

// TODO: mock data (per-region revenue)
const REGION_REVENUE_ROWS = [
  {
    region: "Golden Colorado",
    lifetimeUsd: 1_520_000,
    ninetyDayUsd: 32_000 * 13,
    credits: 33.1,
    farms: 38,
    stakedGctl: 133_000,
  },
  {
    region: "Rising Utah",
    lifetimeUsd: 920_000,
    ninetyDayUsd: 19_200 * 13,
    credits: 14.8,
    farms: 26,
    stakedGctl: 84_000,
  },
  {
    region: "Shining Missouri",
    lifetimeUsd: 680_000,
    ninetyDayUsd: 14_000 * 13,
    credits: 18.2,
    farms: 18,
    stakedGctl: 63_000,
  },
  {
    region: "Clean Grid",
    lifetimeUsd: 420_000,
    ninetyDayUsd: 8_400 * 13,
    credits: 9.6,
    farms: 12,
    stakedGctl: 42_000,
  },
  {
    region: "Other",
    lifetimeUsd: 260_000,
    ninetyDayUsd: 4_400 * 13,
    credits: 5.2,
    farms: 8,
    stakedGctl: 28_000,
  },
];

// TODO: mock data (PoL sources)
const POL_BREAKDOWN = [
  { name: "Endowment", value: 52, color: "hsl(142, 71%, 45%)" },
  { name: "LP Incentives", value: 28, color: "hsl(29, 90%, 60%)" },
  { name: "External LPs", value: 20, color: "hsl(270, 70%, 60%)" },
];

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

const circulationChartConfig = {
  net: { label: "Weekly net change", color: "hsl(142, 71%, 45%)" },
} satisfies ChartConfig;

const vestingChartConfig = {
  unlocked: { label: "Unlocked supply", color: "hsl(32, 90%, 60%)" },
} satisfies ChartConfig;

const delegationTrendChartConfig = {
  delegated: { label: "GLW delegated (M)", color: "hsl(270, 70%, 60%)" },
} satisfies ChartConfig;

const gctlRegionChartConfig = Object.fromEntries(
  GCTL_REGIONS.map((r) => [
    r.name,
    { label: r.name, color: r.color },
  ]),
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
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 10_000_000 ? 3 : 2,
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

function usdToLiquidity(valueUsd: number, pricePerGlw: number) {
  const normalizedPrice = Math.max(pricePerGlw, 0.0001);
  const absUsd = Math.abs(valueUsd);
  return (absUsd / 2) * Math.sqrt(1 / normalizedPrice);
}

function reservesToLiquidity(usdc: number, glw: number) {
  return Math.sqrt(Math.abs(usdc) * Math.abs(glw));
}

function getLiquidityFromUsd(totalUsd: number, pricePerGlw: number) {
  const normalizedPrice = Math.max(pricePerGlw, 0.0001);
  const absUsd = Math.abs(totalUsd);
  const halfUsd = absUsd / 2;
  const glwTokens = halfUsd / normalizedPrice;
  const liquidity = usdToLiquidity(absUsd, normalizedPrice);

  return {
    liquidity,
    value: formatLiquidityCompact(liquidity),
    breakdown: `$${formatCompactNumber(halfUsd)} / ${formatCompactNumber(glwTokens)} GLW`,
  };
}

function getLiquidityFromReserves(usdc: number, glw: number) {
  const liquidity = reservesToLiquidity(usdc, glw);

  return {
    liquidity,
    value: formatLiquidityCompact(liquidity),
    breakdown: `$${formatCompactNumber(usdc)} / ${formatCompactNumber(glw)} GLW`,
  };
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
          labelClassName,
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "text-3xl sm:text-4xl font-semibold tracking-tight font-mono tabular-nums",
          valueClassName,
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
          labelClassName,
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "text-2xl sm:text-3xl font-semibold font-mono tabular-nums",
          valueClassName,
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
            className,
          )}
        >
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
            {label}
          </div>
          <div
            className={cn(
              "mt-1.5 text-2xl font-semibold font-mono tabular-nums tracking-tight",
              accent === "green" && "text-green-600 dark:text-green-400",
              accent === "red" && "text-red-600 dark:text-red-400",
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
  const [farmSortKey, setFarmSortKey] = React.useState<
    "lifetime" | "ninetyDay" | "credits"
  >("lifetime");

  const { poolReserves, priceRatio: poolSpotPrice } = usePoolInfo();

  const {
    circulatingSupply,
    totalSupply,
    marketCap,
    glowPrice,
  } = useGlowCirculatingSupply();

  const livePrice = poolSpotPrice > 0 ? poolSpotPrice : glowPrice;
  const hasLivePrice = livePrice > 0;
  const currentPrice = hasLivePrice ? livePrice : 0;
  const hasLiveSupply = circulatingSupply > 0 && totalSupply > 0;
  const currentCirculating = hasLiveSupply ? circulatingSupply : 0;
  const supplyTotal = hasLiveSupply ? totalSupply : 0;
  const hasLiveMarketCap = marketCap > 0 && hasLivePrice && hasLiveSupply;
  const currentMarketCap = hasLiveMarketCap ? marketCap : 0;

  // TODO: mock PoL USD baseline (replace with live PoL aggregation)
  const polMockUsd = SUPPLY_BASELINE.polUsd;
  const mockPrice = SUPPLY_BASELINE.price;
  const displayPrice = hasLivePrice ? livePrice : mockPrice;

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

  const {
    data: activeRegionsSummary,
    isLoading: isRegionsSummaryLoading,
  } = useActiveRegionsSummary();

  const isGctlLoading = isGctlPriceLoading || isGctlCirculatingSupplyLoading || isRegionsSummaryLoading;

  const gctlTotalSupply = gctlCirculatingSupplyNumber > 0 ? gctlCirculatingSupplyNumber : 350_000;
  const gctlTotalStaked = activeRegionsSummary?.totalGctlStaked ?? 0;
  const gctlUnstaked = Math.max(0, gctlTotalSupply - gctlTotalStaked);
  const gctlStakedPct = gctlTotalSupply > 0 ? Math.round((gctlTotalStaked / gctlTotalSupply) * 100) : 0;

  const gctlRegionPieData = React.useMemo(() => {
    if (!activeRegionsSummary?.regions?.length) return GCTL_REGION_PIE_DATA;
    return activeRegionsSummary.regions.map((r) => ({
      name: r.name,
      value: Math.round(r.stakedGctl),
      fill: REGION_COLORS[r.name] ?? DEFAULT_REGION_COLOR,
      pct: gctlTotalStaked > 0 ? Math.round((r.stakedGctl / gctlTotalStaked) * 100) : 0,
    }));
  }, [activeRegionsSummary, gctlTotalStaked]);

  const gctlRegionChartConfigLive = React.useMemo(() => {
    if (!activeRegionsSummary?.regions?.length) return gctlRegionChartConfig;
    return Object.fromEntries(
      activeRegionsSummary.regions.map((r) => [
        r.name,
        { label: r.name, color: REGION_COLORS[r.name] ?? DEFAULT_REGION_COLOR },
      ]),
    ) as Record<string, { label: string; color: string }>;
  }, [activeRegionsSummary]);

  // ── Wallet Stats live data ──
  const {
    data: impactWalletStats,
    isLoading: isWalletStatsLoadingApi,
  } = useImpactWalletStats();

  const { data: impactMetrics } = useImpactMetrics();

  const {
    holdersCount: gctlHoldersCount,
    isLoading: isGctlHoldersLoading,
  } = useGctlHoldersCount();

  const walletStats = React.useMemo(() => {
    const totalWallets = impactWalletStats?.totalWallets ?? 0;
    const delegatorCount = impactWalletStats?.delegators ?? 0;
    const minerCount = impactWalletStats?.miners ?? 0;
    const gctlCount =
      gctlHoldersCount > 0 ? Math.min(gctlHoldersCount, totalWallets) : 0;
    const otherCount = Math.max(
      0,
      totalWallets - delegatorCount - minerCount - gctlCount,
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

  const isWalletStatsLoading =
    isWalletStatsLoadingApi || isGctlHoldersLoading;

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
  const { data: activelyDelegatedByWeekData } = useActivelyDelegatedByWeek();

  const walletGrowthLive = React.useMemo(() => {
    const byWeek = newWalletsByWeekData?.byWeek;
    if (!byWeek || Object.keys(byWeek).length < 3) return null;

    const weeks = Object.keys(byWeek)
      .map(Number)
      .sort((a, b) => a - b);

    // Take last 12 weeks of counts (last completed weeks)
    const tail = weeks.slice(-12);
    if (tail.length < 2) return null;

    const result: { week: string; newWallets: number }[] = [];
    for (let i = 0; i < tail.length; i++) {
      const count = byWeek[tail[i]] || 0;
      const label = `W-${tail.length - i}`;
      result.push({ week: label, newWallets: Math.max(0, count) });
    }
    return result;
  }, [newWalletsByWeekData]);

  const isWalletGrowthMock = !walletGrowthLive;
  const hasWalletBreakdown = walletStats.totalWallets > 0;

  const totalDelegatedGlw = React.useMemo(() => {
    const raw = totalActivelyDelegatedData?.totalGlwDelegatedWei;
    if (!raw) return null;
    const value = Number(raw) / 1e18;
    return Number.isFinite(value) ? value : null;
  }, [totalActivelyDelegatedData]);

  const hasDelegated = totalDelegatedGlw !== null && totalDelegatedGlw > 0;
  const delegatorsDisplay =
    totalActivelyDelegatedData?.totalWallets &&
    totalActivelyDelegatedData.totalWallets > 0
      ? formatCompactNumber(totalActivelyDelegatedData.totalWallets)
      : "—";
  const averageDelegatorApy = React.useMemo(() => {
    const raw = totalActivelyDelegatedData?.averageDelegatorApy;
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }, [totalActivelyDelegatedData]);
  const averageApyDisplay =
    averageDelegatorApy !== null ? formatPercent(averageDelegatorApy) : "—";
  const delegatedDisplay = hasDelegated
    ? formatCompactNumber(totalDelegatedGlw!)
    : "—";
  const delegationRatioPct =
    hasDelegated && currentCirculating > 0
      ? (totalDelegatedGlw! / currentCirculating) * 100
      : null;
  const delegationRatioWidth = delegationRatioPct
    ? Math.min(100, Math.max(0, delegationRatioPct))
    : 0;
  const delegationRatioDetail =
    hasDelegated && currentCirculating > 0
      ? `${formatCompactNumber(totalDelegatedGlw!)} of ${formatCompactNumber(currentCirculating)} circulating GLW delegated`
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
      const label = idx === tail.length - 1 ? "Now" : `W-${tail.length - 1 - idx}`;
      return { week: label, delegated: delegatedM };
    });
  }, [activelyDelegatedByWeekData]);

  // ── Supply model slider ──
  const [price, setPrice] = React.useState(displayPrice);
  const [hasAdjustedSlider, setHasAdjustedSlider] = React.useState(false);
  const [sliderValue, setSliderValue] = React.useState(() =>
    priceToLogSlider(displayPrice),
  );

  React.useEffect(() => {
    if (!hasAdjustedSlider && livePrice > 0) {
      setPrice(livePrice);
      setSliderValue(priceToLogSlider(livePrice));
    }
  }, [hasAdjustedSlider, livePrice]);

  // TODO: mock supply model; replace with finalized model once confirmed
  const supplyModel = React.useMemo(() => {
    const priceRatio = price / SUPPLY_BASELINE.price;
    const availablePool = SUPPLY_BASELINE.circulating + SUPPLY_BASELINE.vaulted;
    // As price goes up, tokens come out of vaults into circulation
    // As price goes down, tokens get locked/vaulted to support price
    const adjustment = Math.round(
      SUPPLY_BASELINE.vaulted * (Math.sqrt(priceRatio) - 1),
    );
    const circulating = Math.min(
      availablePool,
      Math.max(0, SUPPLY_BASELINE.circulating + adjustment),
    );
    const vaulted = availablePool - circulating;
    const locked = SUPPLY_BASELINE.total - availablePool;
    const marketCap = price * circulating;
    const polUsd = Math.round(polMockUsd * priceRatio);

    return {
      total: SUPPLY_BASELINE.total,
      circulating,
      vaulted,
      locked,
      marketCap,
      polUsd,
    };
  }, [price, polMockUsd]);

  const supplyDelta = hasLiveSupply
    ? supplyModel.circulating - currentCirculating
    : null;

  const sortedFarmRows = React.useMemo(() => {
    const rows = [...FARM_REVENUE_ROWS];
    rows.sort((a, b) => {
      if (farmSortKey === "credits") return b.credits - a.credits;
      if (farmSortKey === "ninetyDay") return b.ninetyDayUsd - a.ninetyDayUsd;
      return b.lifetimeUsd - a.lifetimeUsd;
    });
    return rows;
  }, [farmSortKey]);

  const circulationPercent =
    hasLiveSupply
      ? Math.min(100, (currentCirculating / supplyTotal) * 100)
      : 0;
  const circulatingWidth = hasLiveSupply
    ? (currentCirculating / supplyTotal) * 100
    : 0;
  const vaultedMock = SUPPLY_BASELINE.vaulted;
  const vaultedWidth = hasLiveSupply
    ? (vaultedMock / supplyTotal) * 100
    : 0;

  const poolUsdg = poolReserves?.usdg ?? 0;
  const poolGlw = poolReserves?.glw ?? 0;
  const hasPoolReserves = poolUsdg > 0 && poolGlw > 0;
  const poolLiquidityBreakdown = hasPoolReserves
    ? getLiquidityFromReserves(poolUsdg, poolGlw)
    : { liquidity: 0, value: "—", breakdown: "—" };

  const totalPolLiquidity = getLiquidityFromUsd(
    polMockUsd,
    displayPrice,
  );
  const fdvLiquidity = getLiquidityFromUsd(
    2_400_000_000,
    displayPrice,
  );

  const { data: fmiPressure } = useFmiPressure({ range: "7d" });
  const fmiBuyUsd = React.useMemo(() => {
    const raw = fmiPressure?.buy?.usdg;
    if (!raw) return null;
    const value = Number(raw) / 1e6;
    return Number.isFinite(value) ? value : null;
  }, [fmiPressure]);
  const fmiSellUsd = React.useMemo(() => {
    const raw = fmiPressure?.sell?.usdg;
    if (!raw) return null;
    const value = Number(raw) / 1e6;
    return Number.isFinite(value) ? value : null;
  }, [fmiPressure]);
  const hasFmiPressure = fmiBuyUsd !== null && fmiSellUsd !== null;
  const poolPriceForDepth =
    hasLivePrice
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
    hasFmiPressure && fmiSellUsd !== null && fmiSellUsd > 0 && fmiBuyUsd !== null
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
      ? `${fmiNetPressure >= 0 ? "+" : ""}${formatUsdCompact(fmiNetPressure)}/wk`
      : "—";
  const fmiSellToPoolDisplay =
    fmiSellToPool !== null ? fmiSellToPool.toFixed(1) : "—";
  const fmiNetToPoolDisplay =
    fmiNetToPool !== null ? fmiNetToPool.toFixed(1) : "—";

  const { data: polLiquiditySnapshot } = usePolLiquiditySnapshot({
    range: "12w",
  });
  const polLiquidityPerLp = React.useMemo(() => {
    const totalLiquidity = polLiquiditySnapshot?.currentTotalLiquidity;
    const totalSupply = polLiquiditySnapshot?.currentTotalSupply;
    if (!totalLiquidity || !totalSupply) return null;
    const liquidityNum = Number(totalLiquidity);
    const supplyNum = Number(totalSupply);
    if (!Number.isFinite(liquidityNum) || supplyNum <= 0) return null;
    return liquidityNum / supplyNum;
  }, [polLiquiditySnapshot]);
  const polLiquidityTrend = React.useMemo(() => {
    const series = polLiquiditySnapshot?.series;
    if (!series || !polLiquidityPerLp) return null;
    const sorted = series.slice().sort((a, b) => a.week - b.week);
    const completed = sorted.length > 1 ? sorted.slice(0, -1) : sorted;
    const tail = completed.slice(-12);
    if (tail.length < 2) return null;
    return tail.map((row, index) => ({
      week: `W-${tail.length - index}`,
      liquidity: Number(row.balanceLiquidity) * polLiquidityPerLp,
    }));
  }, [polLiquiditySnapshot, polLiquidityPerLp]);
  const polLiquidityChartData = polLiquidityTrend ?? [];
  const polLiquidityIsLive = Boolean(polLiquidityTrend);

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
                      {formatCompactNumberPrecise(totalPolLiquidity.liquidity)} lq
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      ({totalPolLiquidity.breakdown})
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Row 2: Aggregate Farm Revenue (left) | Circulation (right) ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
              {/* ── Left: Protocol Revenue (4 KPI cards) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-[3fr_2fr] gap-4">
                {/* Lifetime Revenue */}
                <Card className="!gap-0 relative overflow-hidden">
                  <GlowSymbol
                    className="!text-[var(--color-glow-green)] absolute -top-6 -right-6 w-32 h-32 opacity-50 dark:opacity-20 pointer-events-none rotate-12"
                  />
                  <CardContent className="relative flex flex-col justify-center px-8 py-10 sm:px-10 sm:py-12">
                    <div className="text-sm font-medium text-muted-foreground tracking-wide">
                      Lifetime Revenue
                    </div>
                    <div className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                      {
                        getLiquidityFromUsd(
                          AGGREGATE_FARM_REVENUE.lifetimeUsd,
                          displayPrice,
                        ).value
                      }
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      ({getLiquidityFromUsd(AGGREGATE_FARM_REVENUE.lifetimeUsd, displayPrice).breakdown})
                    </div>
                  </CardContent>
                </Card>

                {/* Active Farms */}
                <Card className="!gap-0 relative overflow-hidden">
                  <GlowSymbol
                    className="!text-[var(--color-glow-orange)] absolute -top-5 -right-5 w-28 h-28 opacity-20 pointer-events-none -rotate-12"
                  />
                  <CardContent className="relative flex flex-col justify-center px-8 py-10 sm:px-10 sm:py-12">
                    <div className="text-sm font-medium text-muted-foreground tracking-wide">
                      Active Farms
                    </div>
                    <div className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                      {formatNumber(AGGREGATE_FARM_REVENUE.farms)}
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      Across all regions
                    </div>
                  </CardContent>
                </Card>

                {/* 90d Revenue */}
                <Card className="!gap-0 relative overflow-hidden">
                  <GlowSymbol
                    className="!text-[var(--color-glow-purple)] absolute -top-5 -right-5 w-28 h-28 opacity-15 pointer-events-none rotate-6"
                  />
                  <CardContent className="relative flex flex-col justify-center px-8 py-8 sm:px-10 sm:py-10">
                    <div className="text-sm font-medium text-muted-foreground tracking-wide">
                      90d Revenue
                    </div>
                    <div className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                      {
                        getLiquidityFromUsd(
                          AGGREGATE_FARM_REVENUE.ninetyDayUsd,
                          displayPrice,
                        ).value
                      }
                    </div>
                    <div className="mt-2.5 text-sm text-muted-foreground">
                      ({getLiquidityFromUsd(AGGREGATE_FARM_REVENUE.ninetyDayUsd, displayPrice).breakdown})
                    </div>
                  </CardContent>
                </Card>

                {/* 90d PoL Yield */}
                <Card className="!gap-0 relative overflow-hidden">
                  <GlowSymbol
                    className="!text-[var(--color-glow-yellow)] absolute -top-4 -right-4 w-24 h-24 opacity-50 dark:opacity-20 pointer-events-none -rotate-6"
                  />
                  <CardContent className="relative flex flex-col justify-center px-8 py-8 sm:px-10 sm:py-10">
                    <div className="text-sm font-medium text-muted-foreground tracking-wide">
                      90d PoL Yield
                    </div>
                    <div className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                      {
                        getLiquidityFromUsd(
                          AGGREGATE_FARM_REVENUE.netPolNinetyDay,
                          displayPrice,
                        ).value
                      }
                    </div>
                    <div className="mt-2.5 text-sm text-muted-foreground">
                      ({getLiquidityFromUsd(AGGREGATE_FARM_REVENUE.netPolNinetyDay, displayPrice).breakdown})
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ── Right: Where the money goes ── */}
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
                      value={hasLiveSupply ? `${formatCompactNumber(currentCirculating)} GLW` : "—"}
                      helper={
                        hasLiveSupply
                          ? `${formatPercent(circulationPercent)} of ${formatCompactNumber(supplyTotal)} total`
                          : "Live data unavailable"
                      }
                    />
                    <div className="mt-3 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, circulatingWidth))}%`,
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
                        className="h-full flex-1"
                        style={{
                          background: "hsl(215, 15%, 35%)",
                        }}
                      />
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
                        <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-muted-foreground/40 dark:bg-muted-foreground/60" />
                        <span className="text-muted-foreground">Other</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MiniStat
                      label="Vaulted"
                      value={formatCompactNumber(vaultedMock)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Liquidity"
                      value={poolLiquidityBreakdown.value}
                      helper={
                        hasPoolReserves
                          ? `(${poolLiquidityBreakdown.breakdown})`
                          : "Live data unavailable"
                      }
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>
                  <ChartContainer
                    config={circulationChartConfig}
                    className="h-32 w-full"
                  >
                    <LineChart data={WEEKLY_NET_CHANGES}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="week"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => `Week ${label}`}
                            formatter={(value) =>
                              `${formatSignedNumber(Number(value))} GLW`
                            }
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        stroke="hsl(142, 71%, 45%)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                  <Button onClick={() => setIsSupplyDialogOpen(true)}>
                    Explore Supply Model
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader title="Every Farm Adds Value" />
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                  Sort by
                </span>
                <select
                  value={farmSortKey}
                  onChange={(e) =>
                    setFarmSortKey(
                      e.target.value as "lifetime" | "ninetyDay" | "credits",
                    )
                  }
                  className="rounded-lg border border-border/40 bg-background px-2.5 py-1.5 text-xs font-mono cursor-pointer hover:border-border/60 transition-colors"
                >
                  <option value="lifetime">Lifetime</option>
                  <option value="ninetyDay">90d Revenue</option>
                  <option value="credits">CC / Week</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedFarmRows.map((farm) => {
                const lifetimeLq = getLiquidityFromUsd(
                  farm.lifetimeUsd,
                  displayPrice,
                );
                const ninetyDayLq = getLiquidityFromUsd(
                  farm.ninetyDayUsd,
                  displayPrice,
                );
                return (
                  <Card
                    key={farm.name}
                    className="!gap-0 !py-0 group overflow-hidden hover:border-border/60 dark:hover:border-border/80 transition-all duration-200"
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
                            farm.ninetyDayDelta >= 0
                              ? "bg-green-600/80 text-white"
                              : "bg-red-600/80 text-white",
                          )}
                        >
                          {farm.ninetyDayDelta >= 0 ? "+" : ""}
                          {formatPercent(farm.ninetyDayDelta)}
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
                            {farm.ccPerWeek.toFixed(3)}
                          </span>
                          <span>cc/wk</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">
                            {farm.credits.toFixed(1)}
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
                    value={formatUsdCompact(MARKET_OVERVIEW.totalLiquidity)}
                    helper={`Protocol-owned liquidity across all sources`}
                    valueClassName="text-3xl sm:text-4xl"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat
                      label="APY"
                      value={formatPercent(MARKET_OVERVIEW.polApy)}
                      valueClassName="text-base sm:text-lg tracking-tight"
                    />
                    <MiniStat
                      label="Yield / wk"
                      value={formatUsdCompact(MARKET_OVERVIEW.polWeeklyRevenue)}
                      valueClassName="text-base sm:text-lg tracking-tight"
                    />
                    <MiniStat
                      label="Pool depth"
                      value={poolDepthDisplay}
                      helper={hasPoolReserves ? undefined : "Live data unavailable"}
                      valueClassName="text-base sm:text-lg tracking-tight"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      PoL liquidity (12w){polLiquidityIsLive ? "" : " · Live data unavailable"}
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
                                `${formatCompactNumberPrecise(Number(value))} lq`,
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
                      {POL_BREAKDOWN.map((segment) => (
                        <div key={segment.name} className="flex flex-col gap-1.5">
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
                    value={isGctlLoading ? "..." : formatCompactNumber(gctlTotalSupply)}
                    helper={isGctlLoading ? "Loading..." : `$${gctlPriceNumber.toFixed(2)} mint price`}
                    valueClassName="text-3xl sm:text-4xl"
                  />
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      <span>Staked vs unstaked</span>
                      <span>{isGctlLoading ? "..." : `${gctlStakedPct}% staked`}</span>
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
                        value={isGctlLoading ? "..." : formatCompactNumber(gctlTotalStaked)}
                        valueClassName="text-base sm:text-lg tracking-tight"
                      />
                      <MiniStat
                        label="Unstaked"
                        value={isGctlLoading ? "..." : formatCompactNumber(gctlUnstaked)}
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
                                  const region = gctlRegionPieData.find((r) => r.name === name);
                                  return `${formatCompactNumber(Number(value))} (${region?.pct ?? 0}%)`;
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
                      value={isWalletStatsLoading ? "..." : formatNumber(walletStats.totalWallets)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Delegators"
                      value={isWalletStatsLoading ? "..." : formatNumber(walletStats.delegatorCount)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      New wallets per week (12w){isWalletGrowthMock ? " · Live data unavailable" : ""}
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
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(label) => label}
                              formatter={(value) => [
                                Number(value).toLocaleString(),
                                "New wallets",
                              ]}
                            />
                          }
                        />
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
                      Wallet breakdown{hasWalletBreakdown ? "" : " · Live data unavailable"}
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
                      helper={hasDelegated ? undefined : "Live data unavailable"}
                    />
                    <MiniStat
                      label="Delegators"
                      value={delegatorsDisplay}
                      helper={
                        totalActivelyDelegatedData?.totalWallets &&
                        totalActivelyDelegatedData.totalWallets > 0
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

                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-3">
                      Delegation growth (12w)
                    </div>
                    <ChartContainer
                      config={delegationTrendChartConfig}
                      className="flex-1 w-full min-h-[140px]"
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
                        {REGION_REVENUE_ROWS.map((region) => {
                          const lifetimeLiquidity = getLiquidityFromUsd(
                            region.lifetimeUsd,
                            displayPrice,
                          );
                          const ninetyDayLiquidity = getLiquidityFromUsd(
                            region.ninetyDayUsd,
                            displayPrice,
                          );

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
                                  {formatNumber(region.stakedGctl)} GCTL staked
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
                                  {region.credits.toFixed(1)} cc/wk
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
                        fmiBadgeBorder,
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-semibold font-mono tabular-nums",
                          fmiAccentClass,
                        )}
                      >
                        {fmiScoreDisplay}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-mono uppercase tracking-widest",
                          fmiAccentClass,
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
                      value={poolDepthDisplay}
                      detail={
                        hasPoolReserves
                          ? `${formatUsdCompact(poolUsdg)} USDC + ${formatCompactNumber(poolGlw)} GLW absorbing pressure`
                          : "Live data unavailable"
                      }
                      className="flex-1"
                    />
                    <div
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 shrink-0",
                        fmiBadgeBorder,
                      )}
                    >
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                        Net
                      </span>
                      <span
                        className={cn(
                          "text-lg font-semibold font-mono tabular-nums",
                          fmiAccentClass,
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
                          ? `${formatCompactNumber(currentCirculating)} GLW at $${priceDetail}`
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
                            ? `${formatCompactNumber(currentCirculating)} GLW at $${priceDetail}`
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
                        value={poolDepthDisplay}
                        detail={
                          hasPoolReserves
                            ? `${formatUsdCompact(poolUsdg)} USDC + ${formatCompactNumber(poolGlw)} GLW absorbing pressure`
                            : "Live data unavailable"
                        }
                        className="w-56"
                      />
                    </div>

                    {/* Center: FMI gauge */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl border px-6 py-4",
                          fmiBadgeBorder,
                        )}
                      >
                        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                          FMI Score
                        </span>
                        <span
                          className={cn(
                            "text-3xl font-semibold font-mono tabular-nums",
                            fmiAccentClass,
                          )}
                        >
                          {fmiScoreDisplay}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-mono uppercase tracking-widest",
                            fmiAccentClass,
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
                              fmiAccentClass,
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
                        width: `${fmiRatio !== null ? (1 - fmiRatio) * 100 : 50}%`,
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
                    value={poolDepthDisplay}
                    helper={
                      hasPoolReserves && fmiSellToPoolDisplay !== "—"
                        ? `${fmiSellToPoolDisplay}x weekly sell pressure`
                        : "Live data unavailable"
                    }
                    valueClassName="text-base sm:text-lg tracking-tight"
                  />
                  <MiniStat
                    label="Total PoL"
                    value={formatUsdCompact(MARKET_OVERVIEW.totalLiquidity)}
                    helper={`All protocol-owned liquidity`}
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
                      fmiAccentClass,
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
                      fmiAccentClass,
                    )}
                  />
                </div>
                <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-muted/20 dark:bg-background/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Weekly buy pressure ({fmiBuyUsdDisplay}) exceeds
                    sell pressure ({fmiSellUsdDisplay}) by{" "}
                    <span className={cn("font-semibold", fmiAccentClass)}>
                      {fmiNetPressureDisplay}
                    </span>
                    , yielding a {fmiBuySellRatioDisplay}x buy/sell
                    ratio. The pool absorbs {fmiSellToPoolDisplay}x its
                    depth in sell flow weekly, with PoL backstop at{" "}
                    {formatUsdCompact(MARKET_OVERVIEW.totalLiquidity)}.{" "}

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
                    className="h-56 w-full"
                  >
                    <LineChart data={VESTING_SCHEDULE}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="year" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={36}
                        tickFormatter={(value) => `${value}M`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => `Year ${label}`}
                            formatter={(value) => `${value}M GLW`}
                          />
                        }
                      />
                      <Line
                        type="stepAfter"
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
                      value={fdvLiquidity.value}
                      helper={`(${fdvLiquidity.breakdown})`}
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
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
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
: modeled supply (not live data)
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
                label="USDC Liquidity"
                value={formatUsdCompact(supplyModel.polUsd)}
                helper={`${formatSignedNumber(supplyModel.polUsd - polMockUsd)} vs current`}
              />
            </div>

            {/* ── Supply breakdown bar (circulating / vaulted) ── */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                <span>Supply breakdown</span>
                <span>{formatCompactNumber(supplyModel.total)} total</span>
              </div>
              <div className="h-6 rounded-full bg-muted/50 overflow-hidden flex">
                <div
                  className="h-full transition-all duration-300 ease-out"
                  style={{
                    width: `${(supplyModel.circulating / supplyModel.total) * 100}%`,
                    background: "hsl(142, 71%, 45%)",
                  }}
                />
                <div
                  className="h-full transition-all duration-300 ease-out"
                  style={{
                    width: `${(supplyModel.vaulted / supplyModel.total) * 100}%`,
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
                  <span className="text-muted-foreground">Circulating</span>
                  <span className="font-mono tabular-nums ml-auto">
                    {formatPercent(
                      (supplyModel.circulating / supplyModel.total) * 100,
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ background: "hsl(270, 70%, 60%)" }}
                  />
                  <span className="text-muted-foreground">Vaulted</span>
                  <span className="font-mono tabular-nums ml-auto">
                    {formatPercent(
                      (supplyModel.vaulted / supplyModel.total) * 100,
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Log-scale price slider (prominent) ── */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 font-semibold">
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
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
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
    </div>
  );
}
