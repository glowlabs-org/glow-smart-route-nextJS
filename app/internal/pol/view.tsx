"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const SUPPLY_BASELINE = {
  total: 42_000_000,
  circulating: 22_000_000,
  vaulted: 2_300_000,
  price: 0.3148,
  polUsd: 8_750_000,
};
const UPDATED_AT = new Date("2026-01-29T00:00:00Z");
const PRICE_RANGE = { min: 0.05, max: 25, step: 0.01 };

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

const MARKET_TREND = [
  { label: "Oct", price: 0.285 },
  { label: "Nov", price: 0.298 },
  { label: "Dec", price: 0.304 },
  { label: "Jan", price: 0.3148 },
];

const AGGREGATE_FARM_REVENUE = {
  lifetimeUsd: 3_800_000,
  weeklyUsd: 78_000,
  weekDelta: 3.2,
  farms: 102,
  netPolWeekly: 24_500,
};

const WEEKLY_REVENUE_TREND = [
  { week: "W-11", revenue: 52 },
  { week: "W-10", revenue: 55 },
  { week: "W-9", revenue: 58 },
  { week: "W-8", revenue: 61 },
  { week: "W-7", revenue: 64 },
  { week: "W-6", revenue: 67 },
  { week: "W-5", revenue: 69 },
  { week: "W-4", revenue: 71 },
  { week: "W-3", revenue: 73 },
  { week: "W-2", revenue: 75 },
  { week: "W-1", revenue: 77 },
  { week: "Now", revenue: 78 },
];

const FARM_REVENUE_SERIES = [
  { week: "W-8", shelteredPines: 2.6, lichenHeadland: 2.2, thrivingAlcove: 1.9, emeraldCrossing: 1.6, papayaPrairie: 1.2, freshGrange: 1.0 },
  { week: "W-7", shelteredPines: 2.8, lichenHeadland: 2.4, thrivingAlcove: 2.1, emeraldCrossing: 1.7, papayaPrairie: 1.3, freshGrange: 1.1 },
  { week: "W-6", shelteredPines: 3.0, lichenHeadland: 2.5, thrivingAlcove: 2.2, emeraldCrossing: 1.8, papayaPrairie: 1.4, freshGrange: 1.2 },
  { week: "W-5", shelteredPines: 3.1, lichenHeadland: 2.7, thrivingAlcove: 2.4, emeraldCrossing: 2.0, papayaPrairie: 1.5, freshGrange: 1.2 },
  { week: "W-4", shelteredPines: 3.3, lichenHeadland: 2.8, thrivingAlcove: 2.5, emeraldCrossing: 2.1, papayaPrairie: 1.6, freshGrange: 1.3 },
  { week: "W-3", shelteredPines: 3.4, lichenHeadland: 2.9, thrivingAlcove: 2.6, emeraldCrossing: 2.2, papayaPrairie: 1.6, freshGrange: 1.4 },
  { week: "W-2", shelteredPines: 3.5, lichenHeadland: 3.0, thrivingAlcove: 2.7, emeraldCrossing: 2.3, papayaPrairie: 1.7, freshGrange: 1.5 },
  { week: "W-1", shelteredPines: 3.7, lichenHeadland: 3.1, thrivingAlcove: 2.8, emeraldCrossing: 2.3, papayaPrairie: 1.7, freshGrange: 1.5 },
  { week: "Now", shelteredPines: 3.8, lichenHeadland: 3.2, thrivingAlcove: 2.9, emeraldCrossing: 2.4, papayaPrairie: 1.8, freshGrange: 1.6 },
];

const FARM_REVENUE_ROWS = [
  {
    name: "Sheltered Pines",
    region: "Golden Colorado",
    panels: 85,
    lifetimeUsd: 186_000,
    weekUsd: 3_800,
    weekDelta: 5.2,
    credits: 12.4,
    ccPerWeek: 0.146,
  },
  {
    name: "Lichen Headland",
    region: "Golden Colorado",
    panels: 72,
    lifetimeUsd: 142_000,
    weekUsd: 3_200,
    weekDelta: 2.8,
    credits: 10.1,
    ccPerWeek: 0.174,
  },
  {
    name: "Thriving Alcove",
    region: "Shining Missouri",
    panels: 95,
    lifetimeUsd: 128_000,
    weekUsd: 2_900,
    weekDelta: -1.2,
    credits: 13.4,
    ccPerWeek: 0.141,
  },
  {
    name: "Emerald Crossing",
    region: "Golden Colorado",
    panels: 54,
    lifetimeUsd: 98_000,
    weekUsd: 2_400,
    weekDelta: 4.1,
    credits: 5.7,
    ccPerWeek: 0.106,
  },
  {
    name: "Papaya Prairie",
    region: "Rising Utah",
    panels: 62,
    lifetimeUsd: 82_000,
    weekUsd: 1_800,
    weekDelta: 3.6,
    credits: 2.7,
    ccPerWeek: 0.043,
  },
  {
    name: "Fresh Grange",
    region: "Golden Colorado",
    panels: 48,
    lifetimeUsd: 64_000,
    weekUsd: 1_600,
    weekDelta: 1.8,
    credits: 4.9,
    ccPerWeek: 0.103,
  },
];

const REGION_REVENUE_ROWS = [
  {
    region: "Golden Colorado",
    lifetimeUsd: 1_520_000,
    weekUsd: 32_000,
    credits: 33.1,
    farms: 38,
    stakedGctl: 133_000,
  },
  {
    region: "Rising Utah",
    lifetimeUsd: 920_000,
    weekUsd: 19_200,
    credits: 14.8,
    farms: 26,
    stakedGctl: 84_000,
  },
  {
    region: "Shining Missouri",
    lifetimeUsd: 680_000,
    weekUsd: 14_000,
    credits: 18.2,
    farms: 18,
    stakedGctl: 63_000,
  },
  {
    region: "Clean Grid",
    lifetimeUsd: 420_000,
    weekUsd: 8_400,
    credits: 9.6,
    farms: 12,
    stakedGctl: 42_000,
  },
  {
    region: "Other",
    lifetimeUsd: 260_000,
    weekUsd: 4_400,
    credits: 5.2,
    farms: 8,
    stakedGctl: 28_000,
  },
];

const POL_BREAKDOWN = [
  { name: "Endowment", value: 52, color: "hsl(142, 71%, 45%)" },
  { name: "LP Incentives", value: 28, color: "hsl(29, 90%, 60%)" },
  { name: "External LPs", value: 20, color: "hsl(270, 70%, 60%)" },
];

const POL_GROWTH = [
  { week: "W-11", pol: 6.8 },
  { week: "W-10", pol: 7.0 },
  { week: "W-9", pol: 7.2 },
  { week: "W-8", pol: 7.3 },
  { week: "W-7", pol: 7.5 },
  { week: "W-6", pol: 7.7 },
  { week: "W-5", pol: 7.9 },
  { week: "W-4", pol: 8.1 },
  { week: "W-3", pol: 8.3 },
  { week: "W-2", pol: 8.5 },
  { week: "W-1", pol: 8.6 },
  { week: "Now", pol: 8.75 },
];

const GCTL_REGIONS = [
  { name: "Golden Colorado", value: 38, color: "#a855f7" },
  { name: "Rising Utah", value: 24, color: "#2081e2" },
  { name: "Shining Missouri", value: 18, color: "#ffb472" },
  { name: "Clean Grid", value: 12, color: "#4ade80" },
  { name: "Other", value: 8, color: "#94a3b8" },
];

const WALLET_GROWTH = [
  { week: "W-11", newWallets: 820, newDelegators: 95 },
  { week: "W-10", newWallets: 940, newDelegators: 110 },
  { week: "W-9", newWallets: 1100, newDelegators: 130 },
  { week: "W-8", newWallets: 980, newDelegators: 105 },
  { week: "W-7", newWallets: 1250, newDelegators: 145 },
  { week: "W-6", newWallets: 1180, newDelegators: 160 },
  { week: "W-5", newWallets: 1340, newDelegators: 175 },
  { week: "W-4", newWallets: 1420, newDelegators: 190 },
  { week: "W-3", newWallets: 1560, newDelegators: 210 },
  { week: "W-2", newWallets: 1680, newDelegators: 225 },
  { week: "W-1", newWallets: 1820, newDelegators: 240 },
  { week: "Now", newWallets: 1950, newDelegators: 260 },
];

const WALLET_BREAKDOWN = [
  { label: "Delegators", count: 18_240, pct: 13.8, color: "#a855f7" },
  { label: "Miners", count: 4_620, pct: 3.5, color: "#2081e2" },
  { label: "GCTL holders", count: 9_840, pct: 7.4, color: "#22d3ee" },
  { label: "Other", count: 99_780, pct: 75.3, color: "#4ade80" },
];

const DELEGATION_TREND = [
  { week: "W-11", delegated: 19.2, apy: 13.1 },
  { week: "W-10", delegated: 19.8, apy: 12.8 },
  { week: "W-9", delegated: 20.5, apy: 12.6 },
  { week: "W-8", delegated: 20.9, apy: 12.4 },
  { week: "W-7", delegated: 21.4, apy: 12.1 },
  { week: "W-6", delegated: 22.0, apy: 11.9 },
  { week: "W-5", delegated: 22.6, apy: 11.8 },
  { week: "W-4", delegated: 23.1, apy: 11.6 },
  { week: "W-3", delegated: 23.6, apy: 11.5 },
  { week: "W-2", delegated: 24.0, apy: 11.5 },
  { week: "W-1", delegated: 24.4, apy: 11.4 },
  { week: "Now", delegated: 24.8, apy: 11.4 },
];

const VESTING_SCHEDULE = [
  { year: "2024", unlocked: 10 },
  { year: "2025", unlocked: 18 },
  { year: "2026", unlocked: 28 },
  { year: "2027", unlocked: 44 },
  { year: "2028", unlocked: 60 },
  { year: "2029", unlocked: 72 },
  { year: "2030", unlocked: 86 },
];

const farmChartConfig = {
  shelteredPines: { label: "Sheltered Pines", color: "hsl(142, 71%, 45%)" },
  lichenHeadland: { label: "Lichen Headland", color: "hsl(215, 90%, 55%)" },
  thrivingAlcove: { label: "Thriving Alcove", color: "hsl(22, 80%, 50%)" },
  emeraldCrossing: { label: "Emerald Crossing", color: "hsl(172, 66%, 50%)" },
  papayaPrairie: { label: "Papaya Prairie", color: "hsl(29, 90%, 60%)" },
  freshGrange: { label: "Fresh Grange", color: "hsl(270, 70%, 60%)" },
} satisfies ChartConfig;

const circulationChartConfig = {
  net: { label: "Weekly net change", color: "hsl(142, 71%, 45%)" },
} satisfies ChartConfig;

const revenueChartConfig = {
  revenue: { label: "Weekly revenue", color: "hsl(142, 71%, 45%)" },
} satisfies ChartConfig;

const polGrowthChartConfig = {
  pol: { label: "PoL ($M)", color: "hsl(142, 71%, 45%)" },
} satisfies ChartConfig;

const marketChartConfig = {
  price: { label: "GLW price", color: "hsl(215, 90%, 55%)" },
} satisfies ChartConfig;

const vestingChartConfig = {
  unlocked: { label: "Unlocked supply", color: "hsl(32, 90%, 60%)" },
} satisfies ChartConfig;

const delegationTrendChartConfig = {
  delegated: { label: "GLW delegated (M)", color: "hsl(270, 70%, 60%)" },
  apy: { label: "Est. APY (%)", color: "hsl(142, 71%, 45%)" },
} satisfies ChartConfig;

const walletGrowthChartConfig = {
  newWallets: { label: "New wallets", color: "hsl(215, 90%, 55%)" },
  newDelegators: { label: "New delegators", color: "hsl(270, 70%, 60%)" },
} satisfies ChartConfig;

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

function formatLiquidityCompact(value: number) {
  return `${formatCompactNumber(value)} L`;
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
    breakdown: `${formatUsdCompact(halfUsd)} USD + ${formatCompactNumber(glwTokens)} GLW`,
  };
}

function getLiquidityFromReserves(usdc: number, glw: number) {
  const liquidity = reservesToLiquidity(usdc, glw);

  return {
    liquidity,
    value: formatLiquidityCompact(liquidity),
    breakdown: `${formatUsdCompact(usdc)} USD + ${formatCompactNumber(glw)} GLW`,
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

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  const Icon = active
    ? direction === "asc"
      ? ChevronUp
      : ChevronDown
    : ArrowUpDown;
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest",
        active
          ? "text-foreground"
          : "text-muted-foreground/60 dark:text-muted-foreground/80",
      )}
      onClick={onClick}
    >
      {label}
      <Icon className={cn("h-3 w-3", active ? "opacity-90" : "opacity-50")} />
    </button>
  );
}


export function PolDashboardView() {
  const [isSupplyDialogOpen, setIsSupplyDialogOpen] = React.useState(false);
  const [price, setPrice] = React.useState(SUPPLY_BASELINE.price);
  const [farmSort, setFarmSort] = React.useState<{
    key: "lifetime" | "week" | "credits";
    direction: "asc" | "desc";
  }>({
    key: "lifetime",
    direction: "desc",
  });

  const supplyModel = React.useMemo(() => {
    const priceRatio = price / SUPPLY_BASELINE.price;
    // Available pool = circulating + vaulted (locked/unvested is separate)
    const availablePool = SUPPLY_BASELINE.circulating + SUPPLY_BASELINE.vaulted;
    // Higher price → more vaulting (sqrt elasticity)
    const vaulted = Math.min(
      availablePool,
      Math.max(0, Math.round(SUPPLY_BASELINE.vaulted * Math.sqrt(priceRatio))),
    );
    const circulating = availablePool - vaulted;
    const locked = SUPPLY_BASELINE.total - availablePool;
    const marketCap = price * circulating;
    const polUsd = Math.round(SUPPLY_BASELINE.polUsd * priceRatio);

    return {
      total: SUPPLY_BASELINE.total,
      circulating,
      vaulted,
      locked,
      marketCap,
      polUsd,
    };
  }, [price]);

  const supplyDelta = supplyModel.circulating - SUPPLY_BASELINE.circulating;
  const supplyPolLiquidity = getLiquidityFromUsd(supplyModel.polUsd, price);

  const sortedFarmRows = React.useMemo(() => {
    const rows = [...FARM_REVENUE_ROWS];
    const factor = farmSort.direction === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (farmSort.key === "credits") {
        return (a.credits - b.credits) * factor;
      }
      if (farmSort.key === "week") {
        return (a.weekUsd - b.weekUsd) * factor;
      }
      return (a.lifetimeUsd - b.lifetimeUsd) * factor;
    });
    return rows;
  }, [farmSort]);

  const circulationPercent =
    (SUPPLY_BASELINE.circulating / SUPPLY_BASELINE.total) * 100;

  const marketCapUsd = MARKET_OVERVIEW.price * SUPPLY_BASELINE.circulating;
  const poolLiquidityBreakdown = getLiquidityFromReserves(
    MARKET_OVERVIEW.lpUsdc,
    MARKET_OVERVIEW.lpGlw,
  );
  const totalPolLiquidity = getLiquidityFromUsd(
    MARKET_OVERVIEW.totalLiquidity,
    MARKET_OVERVIEW.price,
  );
  const polWeeklyLiquidity = getLiquidityFromUsd(
    MARKET_OVERVIEW.polWeeklyRevenue,
    MARKET_OVERVIEW.price,
  );
  const fdvLiquidity = getLiquidityFromUsd(
    2_400_000_000,
    MARKET_OVERVIEW.price,
  );

  const fmiSellUsd = 1_400_000;
  const fmiBuyUsd = 2_100_000;
  const fmiPoolUsd = MARKET_OVERVIEW.lpUsdc + MARKET_OVERVIEW.lpGlw * MARKET_OVERVIEW.price;
  const fmiNetPressure = fmiBuyUsd - fmiSellUsd;
  const fmiRatio = fmiBuyUsd / (fmiBuyUsd + fmiSellUsd);
  const fmiScore = Math.round(fmiRatio * 100);
  const fmiLabel = fmiScore >= 55 ? "Accumulating" : fmiScore >= 45 ? "Neutral" : "Distributing";
  const fmiAccentClass = fmiScore >= 55
    ? "text-green-600 dark:text-green-400"
    : fmiScore >= 45
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";
  const fmiBadgeBorder = fmiScore >= 55
    ? "border-green-500/30 bg-green-500/5"
    : fmiScore >= 45
      ? "border-yellow-500/30 bg-yellow-500/5"
      : "border-red-500/30 bg-red-500/5";
  const fmiNetToPool = (fmiNetPressure / fmiPoolUsd) * 100;
  const fmiSellToPool = fmiSellUsd / fmiPoolUsd;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                Protocol Health Dashboard
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Internal protocol health view focused on liquidity, revenue, and
                adoption.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                Internal Preview
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                Updated {formatDateShort(UPDATED_AT)}
              </Badge>
            </div>
          </div>

          <section className="flex flex-col gap-6">
            <SectionHeader
              title="Overview"
              subtitle="Circulation, market health, and protocol revenue."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* ── Card 1: Circulation ── */}
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Circulation</div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      12W NET
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Circulating vs total supply and weekly net changes.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div>
                    <MetricCard
                      label="Circulating supply"
                      value={`${formatCompactNumber(SUPPLY_BASELINE.circulating)} GLW`}
                      helper={`${formatPercent(circulationPercent)} of ${formatCompactNumber(SUPPLY_BASELINE.total)} total`}
                    />
                    <div className="mt-3 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${circulationPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MiniStat
                      label="Total supply"
                      value={formatCompactNumber(SUPPLY_BASELINE.total)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Vaulted"
                      value={formatCompactNumber(SUPPLY_BASELINE.vaulted)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>
                  <ChartContainer
                    config={circulationChartConfig}
                    className="h-32 w-full"
                  >
                    <BarChart data={WEEKLY_NET_CHANGES}>
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
                      <Bar dataKey="net" radius={[6, 6, 0, 0]}>
                        {WEEKLY_NET_CHANGES.map((entry) => (
                          <Cell
                            key={entry.week}
                            fill={
                              entry.net >= 0
                                ? "hsl(142, 71%, 45%)"
                                : "hsl(0, 84%, 60%)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                  <Button onClick={() => setIsSupplyDialogOpen(true)}>
                    Explore Supply Model
                  </Button>
                </CardContent>
              </Card>

              {/* ── Card 2: Market Health ── */}
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Market Health</div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      LIVE
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Market cap, token price, and protocol-owned liquidity.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard
                      label="Market cap"
                      value={formatUsdCompact(marketCapUsd)}
                      helper={
                        MARKET_OVERVIEW.priceDelta === 0
                          ? "Flat 7d"
                          : `${formatPercent(MARKET_OVERVIEW.priceDelta)} 7d`
                      }
                    />
                    <MetricCard
                      label="GLW price"
                      value={`$${MARKET_OVERVIEW.price.toFixed(4)}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                        Liquidity
                      </div>
                      <div className="text-base sm:text-lg font-semibold font-mono tabular-nums tracking-tight">
                        {poolLiquidityBreakdown.value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ({formatUsdCompact(MARKET_OVERVIEW.lpUsdc)} USD +{" "}
                        {formatCompactNumber(MARKET_OVERVIEW.lpGlw)} GLW)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {totalPolLiquidity.value} total PoL
                      </div>
                    </div>
                    <MiniStat
                      label="PoL APY"
                      value={formatPercent(MARKET_OVERVIEW.polApy)}
                      helper={
                        <div className="flex flex-col gap-1">
                          <span>({polWeeklyLiquidity.breakdown})</span>
                          <span>{polWeeklyLiquidity.value} / week</span>
                        </div>
                      }
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>
                  <ChartContainer
                    config={marketChartConfig}
                    className="h-32 w-full"
                  >
                    <LineChart data={MARKET_TREND}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis hide />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => label}
                            formatter={(value) =>
                              `$${Number(value).toFixed(4)}`
                            }
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="var(--color-price)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                  <div className="text-xs text-muted-foreground/60 dark:text-muted-foreground/80">
                    Spot price trend (last 90 days, mock).
                  </div>
                </CardContent>
              </Card>

              {/* ── Card 3: Aggregate Farm Revenue ── */}
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">
                    Aggregate Farm Revenue
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Revenue solar farms generate for the protocol via GCTL
                    minting, PoL yield, and miner sales.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard
                      label="Total lifetime revenue"
                      value={formatUsdCompact(AGGREGATE_FARM_REVENUE.lifetimeUsd)}
                    />
                    <MetricCard
                      label="Active farms"
                      value={formatNumber(AGGREGATE_FARM_REVENUE.farms)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MiniStat
                      label="Weekly revenue"
                      value={formatUsdCompact(AGGREGATE_FARM_REVENUE.weeklyUsd)}
                      helper={`+${formatPercent(AGGREGATE_FARM_REVENUE.weekDelta)} WoW`}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="PoL yield / week"
                      value={formatUsdCompact(AGGREGATE_FARM_REVENUE.netPolWeekly)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>
                  <ChartContainer
                    config={revenueChartConfig}
                    className="h-32 w-full"
                  >
                    <AreaChart data={WEEKLY_REVENUE_TREND}>
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
                        width={40}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `$${v}k`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => `Week ${label}`}
                            formatter={(value) =>
                              formatUsdCompact(Number(value) * 1000)
                            }
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--color-revenue)"
                        fill="var(--color-revenue)"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader
              title="Per-Farm Protocol Revenue"
              subtitle="Stacked revenue trend with sortable farm table."
            />
            <Card className="!gap-6">
              <CardHeader className="border-b border-border/20 dark:border-border/40 pb-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      Per-Farm Protocol Revenue
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Liquidity-denominated revenue with USD + GLW breakdowns.
                      Farms with zero revenue are expected for new listings.
                    </p>
                  </div>
                  <Link
                    href="/blog/sacrifice-your-revenue"
                    className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/90 hover:text-foreground"
                  >
                    Learn more
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-8">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-3">
                    Stacked revenue trend (8w)
                  </div>
                  <ChartContainer
                    config={farmChartConfig}
                    className="h-48 w-full"
                  >
                    <AreaChart data={FARM_REVENUE_SERIES}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `$${v}k`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => `Week ${label}`}
                            formatter={(value, name) => [
                              formatUsdCompact(Number(value) * 1000),
                              name as string,
                            ]}
                          />
                        }
                      />
                      <Area type="monotone" dataKey="shelteredPines" stackId="rev" stroke="var(--color-shelteredPines)" fill="var(--color-shelteredPines)" fillOpacity={0.22} />
                      <Area type="monotone" dataKey="lichenHeadland" stackId="rev" stroke="var(--color-lichenHeadland)" fill="var(--color-lichenHeadland)" fillOpacity={0.2} />
                      <Area type="monotone" dataKey="thrivingAlcove" stackId="rev" stroke="var(--color-thrivingAlcove)" fill="var(--color-thrivingAlcove)" fillOpacity={0.2} />
                      <Area type="monotone" dataKey="emeraldCrossing" stackId="rev" stroke="var(--color-emeraldCrossing)" fill="var(--color-emeraldCrossing)" fillOpacity={0.2} />
                      <Area type="monotone" dataKey="papayaPrairie" stackId="rev" stroke="var(--color-papayaPrairie)" fill="var(--color-papayaPrairie)" fillOpacity={0.2} />
                      <Area type="monotone" dataKey="freshGrange" stackId="rev" stroke="var(--color-freshGrange)" fill="var(--color-freshGrange)" fillOpacity={0.2} />
                    </AreaChart>
                  </ChartContainer>
                </div>
                <div>
                  <div className="overflow-x-auto rounded-2xl border border-border/20 dark:border-border/40">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 dark:bg-background/40">
                        <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                          <th className="px-4 py-3">Farm</th>
                          <th className="px-4 py-3">
                            <SortButton
                              label="Lifetime"
                              active={farmSort.key === "lifetime"}
                              direction={farmSort.direction}
                              onClick={() =>
                                setFarmSort((prev) => ({
                                  key: "lifetime",
                                  direction:
                                    prev.key === "lifetime" &&
                                    prev.direction === "desc"
                                      ? "asc"
                                      : "desc",
                                }))
                              }
                            />
                          </th>
                          <th className="px-4 py-3">
                            <SortButton
                              label="This week"
                              active={farmSort.key === "week"}
                              direction={farmSort.direction}
                              onClick={() =>
                                setFarmSort((prev) => ({
                                  key: "week",
                                  direction:
                                    prev.key === "week" &&
                                    prev.direction === "desc"
                                      ? "asc"
                                      : "desc",
                                }))
                              }
                            />
                          </th>
                          <th className="px-4 py-3">
                            <SortButton
                              label="CC / wk"
                              active={farmSort.key === "credits"}
                              direction={farmSort.direction}
                              onClick={() =>
                                setFarmSort((prev) => ({
                                  key: "credits",
                                  direction:
                                    prev.key === "credits" &&
                                    prev.direction === "desc"
                                      ? "asc"
                                      : "desc",
                                }))
                              }
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedFarmRows.map((farm) => (
                            <tr
                              key={farm.name}
                              className="border-t border-border/10 dark:border-border/20 hover:bg-muted/40 dark:hover:bg-background/60 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="text-sm font-semibold">
                                  {farm.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {farm.region} · {farm.panels} panels
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-mono font-semibold tabular-nums">
                                  {formatUsdCompact(farm.lifetimeUsd)}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-mono font-semibold tabular-nums">
                                  {formatUsdCompact(farm.weekUsd)}
                                </div>
                                <div
                                  className={cn(
                                    "text-xs",
                                    farm.weekDelta >= 0
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-red-600 dark:text-red-400",
                                  )}
                                >
                                  {farm.weekDelta >= 0 ? "+" : ""}
                                  {formatPercent(farm.weekDelta)}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono tabular-nums">
                                {farm.credits.toFixed(1)}
                              </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader
              title="PoL, GCTL, Wallets"
              subtitle="Protocol-owned liquidity, control token distribution, and adoption signals."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* ── Protocol Liquidity ── */}
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      Protocol Liquidity
                    </div>
                    <Link
                      href="/blog/PoL"
                      className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/90 hover:text-foreground"
                    >
                      Learn more
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Protocol-owned liquidity and weekly revenue.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <MetricCard
                    label="Total PoL"
                    value={formatUsdCompact(MARKET_OVERVIEW.totalLiquidity)}
                    helper="Protocol-owned liquidity across all sources"
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
                      value={formatUsdCompact(MARKET_OVERVIEW.lpUsdc + MARKET_OVERVIEW.lpGlw * MARKET_OVERVIEW.price)}
                      valueClassName="text-base sm:text-lg tracking-tight"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      PoL growth (12w)
                    </div>
                    <ChartContainer
                      config={polGrowthChartConfig}
                      className="h-24 w-full"
                    >
                      <AreaChart data={POL_GROWTH}>
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
                          width={28}
                          tick={{ fontSize: 9 }}
                          tickFormatter={(v) => `$${v}M`}
                          domain={[6, 10]}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(label) => label}
                              formatter={(value) => `$${Number(value).toFixed(1)}M`}
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="pol"
                          stroke="var(--color-pol)"
                          fill="var(--color-pol)"
                          fillOpacity={0.12}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      Sources
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                      {POL_BREAKDOWN.map((segment) => (
                        <div
                          key={segment.name}
                          className="h-full"
                          style={{
                            width: `${segment.value}%`,
                            backgroundColor: segment.color,
                          }}
                        />
                      ))}
                    </div>
                    <div className="grid gap-1.5 text-xs text-muted-foreground">
                      {POL_BREAKDOWN.map((segment) => (
                        <div
                          key={segment.name}
                          className="flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: segment.color }}
                            />
                            {segment.name}
                          </span>
                          <span>{segment.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── GCTL ── */}
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">GCTL</div>
                    <Link
                      href="/blog/beginner-guide-to-gctl"
                      className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/90 hover:text-foreground"
                    >
                      Learn more
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Control token supply and regional steering.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <MetricCard
                    label="Total GCTL"
                    value="350K"
                    helper="$2.49 mint price"
                    valueClassName="text-3xl sm:text-4xl"
                  />
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      <span>Staked vs unstaked</span>
                      <span>81% staked</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                      <div
                        className="h-full rounded-full"
                        style={{ width: "81%", background: "hsl(270, 70%, 60%)" }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <MiniStat
                        label="Staked"
                        value="284K"
                        valueClassName="text-base sm:text-lg tracking-tight"
                      />
                      <MiniStat
                        label="Unstaked"
                        value="66K"
                        valueClassName="text-base sm:text-lg tracking-tight"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      Staking by region
                    </div>
                    <div className="grid gap-2">
                      {GCTL_REGIONS.map((region) => {
                        const staked = Math.round(284_000 * region.value / 100);
                        return (
                          <div key={region.name} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="inline-block h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: region.color }}
                                  />
                                  <span className="text-muted-foreground">{region.name}</span>
                                </span>
                                <span className="font-mono tabular-nums text-foreground">
                                  {formatCompactNumber(staked)}
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-muted/50 dark:bg-background/40 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${region.value}%`,
                                    backgroundColor: region.color,
                                  }}
                                />
                              </div>
                            </div>
                            <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60 dark:text-muted-foreground/80 w-8 text-right shrink-0">
                              {region.value}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Wallet Stats ── */}
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">Wallet Stats</div>
                  <p className="text-xs text-muted-foreground">
                    Adoption snapshot across Glow participants.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <MiniStat
                      label="Wallets"
                      value="132,480"
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Delegators"
                      value="18,240"
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      Weekly new wallets (12w)
                    </div>
                    <ChartContainer
                      config={walletGrowthChartConfig}
                      className="h-24 w-full"
                    >
                      <BarChart data={WALLET_GROWTH} barGap={2}>
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
                              formatter={(value, name) => [
                                Number(value).toLocaleString(),
                                name === "newWallets"
                                  ? "Wallets"
                                  : "Delegators",
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
                        <Bar
                          dataKey="newDelegators"
                          fill="var(--color-newDelegators)"
                          radius={[3, 3, 0, 0]}
                          fillOpacity={0.7}
                        />
                      </BarChart>
                    </ChartContainer>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                      Wallet breakdown
                    </div>
                    <div className="flex flex-col gap-2">
                      {WALLET_BREAKDOWN.map((row) => (
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
                                style={{ width: `${row.pct}%`, backgroundColor: row.color }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60 dark:text-muted-foreground/80 w-10 text-right shrink-0">
                            {row.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader
              title="Delegation + Regions"
              subtitle="Delegation health and regional diversification."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">
                    Delegation Metrics
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Delegation health and estimated rewards.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <MiniStat label="GLW delegated" value="24.8M" />
                    <MiniStat label="Delegators" value="18.2k" />
                    <MiniStat label="Est. APY" value="11.4%" />
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-3">
                      Delegation growth vs APY (12w)
                    </div>
                    <ChartContainer
                      config={delegationTrendChartConfig}
                      className="h-36 w-full"
                    >
                      <AreaChart data={DELEGATION_TREND}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="week"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 9 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          yAxisId="left"
                          tickLine={false}
                          axisLine={false}
                          width={32}
                          tick={{ fontSize: 9 }}
                          tickFormatter={(v) => `${v}M`}
                          domain={[18, 26]}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          width={32}
                          tick={{ fontSize: 9 }}
                          tickFormatter={(v) => `${v}%`}
                          domain={[10, 14]}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(label) => label}
                              formatter={(value, name) => [
                                name === "delegated"
                                  ? `${value}M GLW`
                                  : `${value}%`,
                                name === "delegated" ? "Delegated" : "APY",
                              ]}
                            />
                          }
                        />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="delegated"
                          stroke="var(--color-delegated)"
                          fill="var(--color-delegated)"
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="apy"
                          stroke="var(--color-apy)"
                          fill="var(--color-apy)"
                          fillOpacity={0.08}
                          strokeWidth={2}
                          strokeDasharray="4 3"
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
                            width: "30.1%",
                            background:
                              "linear-gradient(90deg, hsl(270, 70%, 60%), hsl(270, 70%, 50%))",
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-foreground">
                        30.1%
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 dark:text-muted-foreground/80 mt-1">
                      24.8M of 82.4M circulating GLW delegated
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      Per-Region Protocol Revenue
                    </div>
                    <Link
                      href="/blog/infrastructure-projects"
                      className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/90 hover:text-foreground"
                    >
                      Learn more
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Liquidity-denominated revenue and impact distribution by
                    region.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border border-border/20 dark:border-border/40">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 dark:bg-background/40">
                        <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                          <th className="px-4 py-3">Region</th>
                          <th className="px-4 py-3">Lifetime</th>
                          <th className="px-4 py-3">This week</th>
                          <th className="px-4 py-3">Farms</th>
                        </tr>
                      </thead>
                      <tbody>
                        {REGION_REVENUE_ROWS.map((region) => {
                          const lifetimeLiquidity = getLiquidityFromUsd(
                            region.lifetimeUsd,
                            MARKET_OVERVIEW.price,
                          );
                          const weekLiquidity = getLiquidityFromUsd(
                            region.weekUsd,
                            MARKET_OVERVIEW.price,
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
                                  {weekLiquidity.value}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ({weekLiquidity.breakdown})
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
            <SectionHeader
              title="FMI"
              subtitle="Buy pressure vs sell pressure and liquidity absorption."
            />
            <Card className="!gap-6">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold">
                      Flywheel Market Index
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
                      fmiBadgeBorder,
                    )}>
                      <span className={cn("text-xs font-semibold font-mono tabular-nums", fmiAccentClass)}>
                        {fmiScore}
                      </span>
                      <span className={cn("text-[10px] font-mono uppercase tracking-widest", fmiAccentClass)}>
                        {fmiLabel}
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/blog/fmi-diagram"
                    className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/90 hover:text-foreground"
                  >
                    Learn more
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  Buy vs sell pressure balance and how protocol liquidity absorbs it. Score above 50 = net accumulation.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                {/* ── Mobile: vertical flow ── */}
                <div className="flex flex-col items-center gap-2 md:hidden">
                  <FlyNode
                    label="Buy Pressure"
                    value={`+${formatUsdCompact(fmiBuyUsd)}/wk`}
                    detail="PoL yield + GCTL minting + miner sales flowing into the protocol weekly"
                    accent="green"
                    className="w-full"
                  />
                  <div className="text-muted-foreground/30">
                    <ChevronDown className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-3 w-full">
                    <FlyNode
                      label="Liquidity Pool"
                      value={formatUsdCompact(fmiPoolUsd)}
                      detail={`${formatUsdCompact(MARKET_OVERVIEW.lpUsdc)} USDC + ${formatCompactNumber(MARKET_OVERVIEW.lpGlw)} GLW absorbing pressure`}
                      className="flex-1"
                    />
                    <div className={cn(
                      "flex flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 shrink-0",
                      fmiBadgeBorder,
                    )}>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Net</span>
                      <span className={cn("text-lg font-semibold font-mono tabular-nums", fmiAccentClass)}>
                        +{formatUsdCompact(fmiNetPressure)}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground/50">/week</span>
                    </div>
                  </div>
                  <div className="text-muted-foreground/30">
                    <ChevronDown className="h-5 w-5" />
                  </div>
                  <FlyNode
                    label="Sell Pressure"
                    value={`-${formatUsdCompact(fmiSellUsd)}/wk`}
                    detail="Vesting unlocks and secondary market seller flow per week"
                    accent="red"
                    className="w-full"
                  />
                  <div className="text-muted-foreground/30">
                    <ChevronDown className="h-5 w-5" />
                  </div>
                  <FlyNode
                    label="Market Cap"
                    value={formatUsdCompact(marketCapUsd)}
                    detail={`${formatCompactNumber(SUPPLY_BASELINE.circulating)} GLW at $${MARKET_OVERVIEW.price.toFixed(4)}`}
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
                        <marker id="arrow-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                          <path d="M0,0 L8,3 L0,6" fill="hsl(142, 71%, 45%)" fillOpacity="0.5" />
                        </marker>
                        <marker id="arrow-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                          <path d="M0,0 L8,3 L0,6" fill="hsl(0, 84%, 60%)" fillOpacity="0.5" />
                        </marker>
                        <marker id="arrow-muted" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                          <path d="M0,0 L8,3 L0,6" fill="currentColor" fillOpacity="0.2" />
                        </marker>
                      </defs>
                      {/* Buy → Market Cap (right to top) */}
                      <path d="M 650,200 Q 650,60 400,60" fill="none" stroke="hsl(142, 71%, 45%)" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="6 4" markerEnd="url(#arrow-green)" />
                      {/* Market Cap → Sell (top to left) */}
                      <path d="M 400,60 Q 150,60 150,200" fill="none" stroke="hsl(0, 84%, 60%)" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="6 4" markerEnd="url(#arrow-red)" />
                      {/* Sell → Liquidity (left to bottom) */}
                      <path d="M 150,200 Q 150,280 400,280" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2" strokeDasharray="6 4" markerEnd="url(#arrow-muted)" />
                      {/* Liquidity → Buy (bottom to right) */}
                      <path d="M 400,280 Q 650,280 650,200" fill="none" stroke="hsl(142, 71%, 45%)" strokeOpacity="0.15" strokeWidth="2" strokeDasharray="6 4" markerEnd="url(#arrow-green)" />
                    </svg>

                    {/* Top: Market Cap */}
                    <div className="absolute left-1/2 top-0 -translate-x-1/2">
                      <FlyNode
                        label="Market Cap"
                        value={formatUsdCompact(marketCapUsd)}
                        detail={`${formatCompactNumber(SUPPLY_BASELINE.circulating)} GLW at $${MARKET_OVERVIEW.price.toFixed(4)}`}
                        className="w-56"
                      />
                    </div>

                    {/* Left: Sell Pressure */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2">
                      <FlyNode
                        label="Sell Pressure"
                        value={`-${formatUsdCompact(fmiSellUsd)}/wk`}
                        detail="Vesting unlocks and secondary market seller flow per week"
                        accent="red"
                        className="w-52"
                      />
                    </div>

                    {/* Right: Buy Pressure */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                      <FlyNode
                        label="Buy Pressure"
                        value={`+${formatUsdCompact(fmiBuyUsd)}/wk`}
                        detail="PoL yield + GCTL minting + miner sales flowing into the protocol weekly"
                        accent="green"
                        className="w-52"
                      />
                    </div>

                    {/* Bottom: Liquidity Pool */}
                    <div className="absolute left-1/2 bottom-0 -translate-x-1/2">
                      <FlyNode
                        label="Liquidity Pool"
                        value={formatUsdCompact(fmiPoolUsd)}
                        detail={`${formatUsdCompact(MARKET_OVERVIEW.lpUsdc)} USDC + ${formatCompactNumber(MARKET_OVERVIEW.lpGlw)} GLW absorbing pressure`}
                        className="w-56"
                      />
                    </div>

                    {/* Center: FMI gauge */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className={cn(
                        "flex flex-col items-center gap-1 rounded-2xl border px-6 py-4",
                        fmiBadgeBorder,
                      )}>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">FMI Score</span>
                        <span className={cn("text-3xl font-semibold font-mono tabular-nums", fmiAccentClass)}>
                          {fmiScore}
                        </span>
                        <span className={cn("text-[10px] font-mono uppercase tracking-widest", fmiAccentClass)}>
                          {fmiLabel}
                        </span>
                        <div className="mt-1.5 flex items-center gap-1">
                          <span className="text-[9px] font-mono text-muted-foreground/50">Net</span>
                          <span className={cn("text-xs font-semibold font-mono tabular-nums", fmiAccentClass)}>
                            +{formatUsdCompact(fmiNetPressure)}/wk
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
                        width: `${(1 - fmiRatio) * 100}%`,
                        background: "hsl(0, 84%, 60%)",
                      }}
                    />
                    <div
                      className="h-full"
                      style={{
                        width: `${fmiRatio * 100}%`,
                        background: "hsl(142, 71%, 45%)",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                    <span className="font-mono tabular-nums">-{formatUsdCompact(fmiSellUsd)}/wk</span>
                    <span className="font-mono tabular-nums">+{formatUsdCompact(fmiBuyUsd)}/wk</span>
                  </div>
                </div>

                {/* Bottom stats */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <MiniStat
                    label="Pool depth"
                    value={formatUsdCompact(fmiPoolUsd)}
                    helper={`${fmiSellToPool.toFixed(1)}x weekly sell pressure`}
                    valueClassName="text-base sm:text-lg tracking-tight"
                  />
                  <MiniStat
                    label="Total PoL"
                    value={formatUsdCompact(MARKET_OVERVIEW.totalLiquidity)}
                    helper="All protocol-owned liquidity"
                    valueClassName="text-base sm:text-lg tracking-tight"
                  />
                  <MiniStat
                    label="Net / week"
                    value={`+${formatUsdCompact(fmiNetPressure)}`}
                    helper={`+${fmiNetToPool.toFixed(1)}% pool growth`}
                    valueClassName="text-base sm:text-lg tracking-tight text-green-600 dark:text-green-400"
                  />
                  <MiniStat
                    label="Buy / Sell ratio"
                    value={`${(fmiBuyUsd / fmiSellUsd).toFixed(2)}x`}
                    helper={`${formatUsdCompact(fmiBuyUsd)} in, ${formatUsdCompact(fmiSellUsd)} out`}
                    valueClassName={cn("text-base sm:text-lg tracking-tight", fmiAccentClass)}
                  />
                </div>
                <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-muted/20 dark:bg-background/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Weekly buy pressure ({formatUsdCompact(fmiBuyUsd)}) exceeds sell pressure ({formatUsdCompact(fmiSellUsd)}) by{" "}
                    <span className={cn("font-semibold", fmiAccentClass)}>
                      {formatUsdCompact(fmiNetPressure)}
                    </span>
                    , yielding a {(fmiBuyUsd / fmiSellUsd).toFixed(2)}x buy/sell ratio.
                    The pool absorbs {fmiSellToPool.toFixed(1)}x its depth in sell flow weekly,
                    with PoL backstop at {formatUsdCompact(MARKET_OVERVIEW.totalLiquidity)}.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col gap-6 pt-16">
            <SectionHeader
              title="Unlock / FDV"
              subtitle="Transparency on vesting schedule and fully diluted valuation."
            />
            <Card className="!gap-6">
              <CardHeader className="pb-0">
                <div className="text-sm font-semibold">Unlock / FDV</div>
                <p className="text-xs text-muted-foreground">
                  Vesting schedule (2024-2030) with FDV snapshot.
                </p>
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
              <DialogDescription className="text-xs text-muted-foreground">
                Model how price changes affect circulating supply and protocol
                liquidity. Mock data for iteration.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                  GLW price
                </div>
                <div className="text-sm font-semibold font-mono">
                  ${price.toFixed(2)}
                </div>
              </div>
              <Slider
                min={PRICE_RANGE.min}
                max={PRICE_RANGE.max}
                step={PRICE_RANGE.step}
                value={[price]}
                onValueChange={(value) => setPrice(value[0] ?? price)}
              />
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                <span>${PRICE_RANGE.min.toFixed(2)}</span>
                <span>${PRICE_RANGE.max.toFixed(0)}</span>
              </div>
            </div>
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
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
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
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-muted-foreground/20" />
                  <span className="text-muted-foreground">Locked</span>
                  <span className="font-mono tabular-nums ml-auto">
                    {formatPercent(
                      (supplyModel.locked / supplyModel.total) * 100,
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MiniStat
                label="Market cap"
                value={formatUsdCompact(supplyModel.marketCap)}
              />
              <MiniStat
                label="Circulating supply"
                value={formatCompactNumber(supplyModel.circulating)}
                helper={`${formatSignedNumber(supplyDelta)} vs current`}
              />
              <MiniStat
                label="Vaulted GLW"
                value={formatCompactNumber(supplyModel.vaulted)}
                helper={`${formatSignedNumber(supplyModel.vaulted - SUPPLY_BASELINE.vaulted)} vs current`}
              />
              <MiniStat
                label="Protocol liquidity"
                value={supplyPolLiquidity.value}
                helper={`(${supplyPolLiquidity.breakdown})`}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Higher price increases vaulting incentives, contracting
              circulating supply. Model is illustrative.
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
