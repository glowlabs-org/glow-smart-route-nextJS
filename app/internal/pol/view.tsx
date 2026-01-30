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
  total: 120_000_000,
  circulating: 82_400_000,
  vaulted: 37_600_000,
  price: 6.2,
  polUsd: 8_750_000,
};
const UPDATED_AT = new Date("2026-01-29T00:00:00Z");
const PRICE_RANGE = { min: 1, max: 25, step: 0.1 };

const WEEKLY_NET_CHANGES = [
  { week: "W-11", net: -320_000 },
  { week: "W-10", net: 180_000 },
  { week: "W-9", net: 240_000 },
  { week: "W-8", net: -90_000 },
  { week: "W-7", net: 410_000 },
  { week: "W-6", net: 120_000 },
  { week: "W-5", net: -210_000 },
  { week: "W-4", net: 360_000 },
  { week: "W-3", net: 280_000 },
  { week: "W-2", net: -140_000 },
  { week: "W-1", net: 515_000 },
  { week: "Now", net: 190_000 },
];

const MARKET_OVERVIEW = {
  price: 0.3148,
  priceDelta: 0.0,
  marketCap: 6_900_000,
  liquidity: 101_372,
};

const MARKET_TREND = [
  { label: "Oct", price: 0.285 },
  { label: "Nov", price: 0.298 },
  { label: "Dec", price: 0.304 },
  { label: "Jan", price: 0.3148 },
];

const TOTAL_SOLAR = {
  capacityMw: 128.6,
  farms: 102,
  panels: 1_940_000,
  trees: 3_820_000,
};

const CUMULATIVE_POWER = [
  { month: "Apr", mw: 62 },
  { month: "May", mw: 70 },
  { month: "Jun", mw: 82 },
  { month: "Jul", mw: 90 },
  { month: "Aug", mw: 98 },
  { month: "Sep", mw: 108 },
  { month: "Oct", mw: 116 },
  { month: "Nov", mw: 124 },
  { month: "Dec", mw: 128 },
];

const FARM_REVENUE_SERIES = [
  { week: "W-8", lebanon: 42, utah: 28, missouri: 18 },
  { week: "W-7", lebanon: 52, utah: 30, missouri: 21 },
  { week: "W-6", lebanon: 61, utah: 36, missouri: 24 },
  { week: "W-5", lebanon: 70, utah: 44, missouri: 28 },
  { week: "W-4", lebanon: 82, utah: 52, missouri: 32 },
  { week: "W-3", lebanon: 93, utah: 61, missouri: 37 },
  { week: "W-2", lebanon: 105, utah: 69, missouri: 41 },
  { week: "W-1", lebanon: 118, utah: 76, missouri: 46 },
  { week: "Now", lebanon: 134, utah: 82, missouri: 50 },
];

const FARM_REVENUE_ROWS = [
  {
    name: "Lebanon Ridge",
    region: "Lebanon",
    lifetimeUsd: 5_240_000,
    weekUsd: 142_000,
    weekDelta: 6.4,
    credits: 18_900,
    gctlEq: 312_000,
  },
  {
    name: "Utah Mesa",
    region: "Utah",
    lifetimeUsd: 3_880_000,
    weekUsd: 101_000,
    weekDelta: 3.1,
    credits: 13_400,
    gctlEq: 231_500,
  },
  {
    name: "Missouri Plains",
    region: "Missouri",
    lifetimeUsd: 3_210_000,
    weekUsd: 92_500,
    weekDelta: -1.8,
    credits: 12_120,
    gctlEq: 189_400,
  },
  {
    name: "Colorado South",
    region: "Colorado",
    lifetimeUsd: 2_720_000,
    weekUsd: 83_400,
    weekDelta: 2.6,
    credits: 10_680,
    gctlEq: 160_800,
  },
  {
    name: "India Rajasthan",
    region: "India",
    lifetimeUsd: 2_210_000,
    weekUsd: 75_200,
    weekDelta: 4.8,
    credits: 9_950,
    gctlEq: 131_500,
  },
  {
    name: "Clean Grid Alpha",
    region: "Clean Grid",
    lifetimeUsd: 1_480_000,
    weekUsd: 52_900,
    weekDelta: 1.1,
    credits: 8_120,
    gctlEq: 92_700,
  },
  {
    name: "Utah North",
    region: "Utah",
    lifetimeUsd: 960_000,
    weekUsd: 34_800,
    weekDelta: -0.4,
    credits: 6_440,
    gctlEq: 58_900,
  },
];

const REGION_REVENUE_ROWS = [
  {
    region: "Lebanon",
    lifetimeUsd: 6_120_000,
    weekUsd: 172_000,
    credits: 21_800,
    farms: 12,
    stakedGctl: 1_280_000,
  },
  {
    region: "Utah",
    lifetimeUsd: 5_310_000,
    weekUsd: 148_000,
    credits: 18_120,
    farms: 16,
    stakedGctl: 1_040_000,
  },
  {
    region: "Colorado",
    lifetimeUsd: 4_280_000,
    weekUsd: 121_000,
    credits: 15_640,
    farms: 11,
    stakedGctl: 910_000,
  },
  {
    region: "Missouri",
    lifetimeUsd: 3_940_000,
    weekUsd: 110_000,
    credits: 13_700,
    farms: 9,
    stakedGctl: 780_000,
  },
  {
    region: "Clean Grid",
    lifetimeUsd: 2_610_000,
    weekUsd: 88_000,
    credits: 9_340,
    farms: 8,
    stakedGctl: 620_000,
  },
];

const POL_BREAKDOWN = [
  { name: "Endowment", value: 52 },
  { name: "LP Incentives", value: 28 },
  { name: "External LPs", value: 20 },
];

const GCTL_REGIONS = [
  { name: "Utah", value: 32, color: "#2081e2" },
  { name: "Colorado", value: 24, color: "#a855f7" },
  { name: "Missouri", value: 18, color: "#ffb472" },
  { name: "Lebanon", value: 16, color: "#22d3ee" },
  { name: "Clean Grid", value: 10, color: "#4ade80" },
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
  { label: "Delegators", count: 18_240, pct: 13.8 },
  { label: "Miners", count: 4_620, pct: 3.5 },
  { label: "GCTL holders", count: 9_840, pct: 7.4 },
  { label: "Other", count: 99_780, pct: 75.3 },
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
  lebanon: { label: "Lebanon Ridge", color: "hsl(142, 71%, 45%)" },
  utah: { label: "Utah Mesa", color: "hsl(29, 90%, 60%)" },
  missouri: { label: "Missouri Plains", color: "hsl(270, 70%, 60%)" },
} satisfies ChartConfig;

const circulationChartConfig = {
  net: { label: "Weekly net change", color: "hsl(142, 71%, 45%)" },
} satisfies ChartConfig;

const powerChartConfig = {
  mw: { label: "Cumulative MW", color: "hsl(215, 90%, 55%)" },
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

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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
  helper?: string;
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
  helper?: string;
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

function FmiNode({
  title,
  value,
  detail,
  className,
}: {
  title: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-background/40 px-4 py-3 text-left",
            className,
          )}
        >
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
            {title}
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">
            {value}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
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
    const priceDelta = price / SUPPLY_BASELINE.price;
    const vaulted = Math.max(
      22_000_000,
      Math.round(SUPPLY_BASELINE.vaulted * (1 + 0.25 * (priceDelta - 1))),
    );
    const total = SUPPLY_BASELINE.total;
    const circulating = Math.max(total - vaulted, 0);
    const polUsd = Math.round(SUPPLY_BASELINE.polUsd * priceDelta);

    return {
      total,
      vaulted,
      circulating,
      polUsd,
    };
  }, [price]);

  const supplyDelta = supplyModel.circulating - SUPPLY_BASELINE.circulating;

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

  const fmiNodes = [
    {
      title: "Market Cap",
      value: formatUsdCompact(MARKET_OVERVIEW.marketCap),
      detail: "GLW market cap at current price",
    },
    {
      title: "Sell Pressure",
      value: "-$1.4M / wk",
      detail: "Vesting unlocks + seller flow",
    },
    {
      title: "Buy Pressure",
      value: "+$2.1M / wk",
      detail: "PoL revenue (miners + GCTL + yield)",
    },
    {
      title: "Liquidity Pool",
      value: formatUsdCompact(MARKET_OVERVIEW.liquidity),
      detail: "Depth supporting price stability",
    },
  ];

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
              subtitle="Circulation, market health, and total solar impact."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Circulation</div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      12W NET
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Circulating vs total supply with weekly net changes.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid gap-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          Circulating supply
                        </div>
                        <div className="text-3xl font-semibold font-mono tabular-nums">
                          {formatNumber(SUPPLY_BASELINE.circulating)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          Total supply
                        </div>
                        <div className="text-lg font-semibold font-mono tabular-nums">
                          {formatNumber(SUPPLY_BASELINE.total)}
                        </div>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted">
                      <div
                        className="h-2.5 rounded-full bg-primary"
                        style={{ width: `${circulationPercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatPercent(circulationPercent)} of total supply in
                      circulation.
                    </div>
                  </div>
                  <ChartContainer
                    config={circulationChartConfig}
                    className="h-40 w-full"
                  >
                    <BarChart data={WEEKLY_NET_CHANGES}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="week" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        tickFormatter={(value) => `${value / 1000}k`}
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
                  <Button
                    variant="ghost"
                    className="self-start px-0 text-xs font-mono uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/90 hover:text-foreground"
                    onClick={() => setIsSupplyDialogOpen(true)}
                  >
                    Explore Supply Model
                  </Button>
                </CardContent>
              </Card>

              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      Mkt Cap / Liquidity / Price
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      LIVE
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Snapshot of GLW market health indicators.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-background/40 px-4 py-3">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                      Uniswap liquidity
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground/80">
                      {formatNumber(322_014)} GLW · {formatUsdCompact(101_372)}{" "}
                      USDC
                    </div>
                  </div>
                  <MetricCard
                    label="GLW price"
                    value={`$${MARKET_OVERVIEW.price.toFixed(4)}`}
                    helper={
                      MARKET_OVERVIEW.priceDelta === 0
                        ? "Flat 7d"
                        : `${formatPercent(MARKET_OVERVIEW.priceDelta)} 7d`
                    }
                    valueClassName="text-4xl sm:text-5xl"
                    helperClassName="text-xs text-muted-foreground/60 dark:text-muted-foreground/80"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MiniStat
                      label="Market cap"
                      value={formatUsdCompact(MARKET_OVERVIEW.marketCap)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Liquidity"
                      value={formatUsdCompact(MARKET_OVERVIEW.liquidity)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>
                  <ChartContainer
                    config={marketChartConfig}
                    className="h-28 w-full"
                  >
                    <LineChart data={MARKET_TREND}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
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
                  <div className="text-xs text-muted-foreground/70 dark:text-muted-foreground/90">
                    Spot price trend (last 90 days, mock).
                  </div>
                </CardContent>
              </Card>

              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">
                    Total Solar Metrics
                  </div>
                  <p className="text-xs text-muted-foreground">
                    V1 + V2 total impact headline, V2-only growth trend.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <MetricCard
                    label="Total capacity"
                    value={`${TOTAL_SOLAR.capacityMw.toFixed(1)} MW`}
                    helper="V1 + V2 combined"
                    valueClassName="text-4xl sm:text-5xl"
                  />
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <MiniStat
                      label="Farms"
                      value={formatNumber(TOTAL_SOLAR.farms)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Panels"
                      value={formatCompactNumber(TOTAL_SOLAR.panels)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                    <MiniStat
                      label="Trees"
                      value={formatCompactNumber(TOTAL_SOLAR.trees)}
                      valueClassName="text-xl sm:text-2xl tracking-tight"
                    />
                  </div>
                  <ChartContainer
                    config={powerChartConfig}
                    className="h-40 w-full"
                  >
                    <LineChart data={CUMULATIVE_POWER}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        tickFormatter={(value) => `${value}MW`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => `${label} 2025`}
                            formatter={(value) => `${value} MW`}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="mw"
                        stroke="var(--color-mw)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
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
                      Lifetime revenue in USD with GCTL equivalent. Farms with
                      zero revenue are expected for new listings.
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
              <CardContent className="grid gap-8 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  <ChartContainer
                    config={farmChartConfig}
                    className="h-64 xl:h-full w-full"
                  >
                    <AreaChart data={FARM_REVENUE_SERIES}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="week" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        tickFormatter={(value) => `$${value}k`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => `Week ${label}`}
                            formatter={(value, name) => [
                              `$${value}k`,
                              name as string,
                            ]}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="lebanon"
                        stackId="rev"
                        stroke="var(--color-lebanon)"
                        fill="var(--color-lebanon)"
                        fillOpacity={0.22}
                      />
                      <Area
                        type="monotone"
                        dataKey="utah"
                        stackId="rev"
                        stroke="var(--color-utah)"
                        fill="var(--color-utah)"
                        fillOpacity={0.2}
                      />
                      <Area
                        type="monotone"
                        dataKey="missouri"
                        stackId="rev"
                        stroke="var(--color-missouri)"
                        fill="var(--color-missouri)"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
                <div className="xl:col-span-5">
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
                              label="Credits"
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
                                {farm.region}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-mono font-semibold tabular-nums">
                                {formatUsdCompact(farm.lifetimeUsd)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ({formatNumber(farm.gctlEq)} GCTL)
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
                              {formatNumber(farm.credits)}
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
                <CardContent className="grid gap-6">
                  <MetricCard
                    label="Total liquidity"
                    value={formatUsdCompact(8_750_000)}
                    helper="All sources combined"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <MiniStat label="APY" value="14.6%" />
                    <MiniStat label="Weekly revenue" value="$168k" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      <span>Sources</span>
                      <span>Share</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                      {POL_BREAKDOWN.map((segment) => (
                        <div
                          key={segment.name}
                          className="h-full"
                          style={{
                            width: `${segment.value}%`,
                            backgroundColor:
                              segment.name === "Endowment"
                                ? "hsl(142, 71%, 45%)"
                                : segment.name === "LP Incentives"
                                  ? "hsl(29, 90%, 60%)"
                                  : "hsl(270, 70%, 60%)",
                          }}
                        />
                      ))}
                    </div>
                    <div className="grid gap-2 text-xs text-muted-foreground">
                      {POL_BREAKDOWN.map((segment) => (
                        <div
                          key={segment.name}
                          className="flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  segment.name === "Endowment"
                                    ? "hsl(142, 71%, 45%)"
                                    : segment.name === "LP Incentives"
                                      ? "hsl(29, 90%, 60%)"
                                      : "hsl(270, 70%, 60%)",
                              }}
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
                <CardContent className="grid gap-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MiniStat label="Total GCTL" value="4.8M" />
                    <MiniStat label="Staked" value="3.9M (81%)" />
                    <MiniStat label="Mint price" value="$2.49" />
                    <MiniStat label="Unstaked" value="0.9M" />
                  </div>
                  <ChartContainer
                    config={{}}
                    className="h-40 w-full flex items-center"
                  >
                    <PieChart>
                      <Pie
                        data={GCTL_REGIONS}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={70}
                      >
                        {GCTL_REGIONS.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="grid gap-2 text-xs text-muted-foreground">
                    {GCTL_REGIONS.map((region) => (
                      <div
                        key={region.name}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: region.color }}
                          />
                          {region.name}
                        </span>
                        <span>{region.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="!gap-6">
                <CardHeader className="pb-0">
                  <div className="text-sm font-semibold">Wallet Stats</div>
                  <p className="text-xs text-muted-foreground">
                    Adoption snapshot across Glow participants.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard label="Wallets" value="132,480" />
                    <MetricCard label="Delegators" value="18,240" />
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-3">
                      Weekly new wallets (12w)
                    </div>
                    <ChartContainer
                      config={walletGrowthChartConfig}
                      className="h-28 w-full"
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
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-3">
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
                              <span className="text-muted-foreground">
                                {row.label}
                              </span>
                              <span className="font-mono tabular-nums text-foreground">
                                {row.count.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted/50 dark:bg-background/40 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-foreground/20 dark:bg-foreground/30"
                                style={{ width: `${row.pct}%` }}
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
                    Revenue and impact distribution by region.
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
                        {REGION_REVENUE_ROWS.map((region) => (
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
                            <td className="px-4 py-3 font-mono tabular-nums">
                              {formatUsdCompact(region.lifetimeUsd)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-mono tabular-nums">
                                {formatUsdCompact(region.weekUsd)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatNumber(region.credits)} credits
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono tabular-nums">
                              {region.farms}
                            </td>
                          </tr>
                        ))}
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
                  <div className="text-sm font-semibold">FMI Diagram</div>
                  <Link
                    href="/blog/fmi-diagram"
                    className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/90 hover:text-foreground"
                  >
                    Learn more
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  Market cap, buy pressure, sell pressure, and liquidity.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="grid gap-4 md:hidden">
                    {fmiNodes.map((node) => (
                      <FmiNode
                        key={node.title}
                        title={node.title}
                        value={node.value}
                        detail={node.detail}
                      />
                    ))}
                  </div>
                  <div className="hidden md:block">
                    <div className="relative h-64 w-full">
                      <div className="absolute left-1/2 top-0 -translate-x-1/2">
                        <FmiNode
                          {...fmiNodes[0]}
                          className="w-52 text-center"
                        />
                      </div>
                      <div className="absolute left-0 top-1/2 -translate-y-1/2">
                        <FmiNode {...fmiNodes[1]} className="w-52" />
                      </div>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2">
                        <FmiNode {...fmiNodes[2]} className="w-52 text-right" />
                      </div>
                      <div className="absolute left-1/2 bottom-0 -translate-x-1/2">
                        <FmiNode
                          {...fmiNodes[3]}
                          className="w-52 text-center"
                        />
                      </div>
                      <div className="absolute left-1/2 top-16 h-12 w-px -translate-x-1/2 bg-border/60 dark:bg-border/80" />
                      <div className="absolute left-1/2 bottom-16 h-12 w-px -translate-x-1/2 bg-border/60 dark:bg-border/80" />
                      <div className="absolute left-24 top-1/2 h-px w-[calc(50%-120px)] -translate-y-1/2 bg-border/60 dark:bg-border/80" />
                      <div className="absolute right-24 top-1/2 h-px w-[calc(50%-120px)] -translate-y-1/2 bg-border/60 dark:bg-border/80" />
                      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/70" />
                    </div>
                  </div>
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
                    <MetricCard label="FDV" value="$2.4B" />
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
                          <span>230k / week ongoing</span>
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
                <span>${PRICE_RANGE.min.toFixed(0)}</span>
                <span>${PRICE_RANGE.max.toFixed(0)}</span>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MiniStat
                label="Circulating supply"
                value={formatNumber(supplyModel.circulating)}
                helper={`${formatSignedNumber(supplyDelta)} vs current`}
              />
              <MiniStat
                label="Vaulted GLW"
                value={formatNumber(supplyModel.vaulted)}
                helper="Excluded from circulation"
              />
              <MiniStat
                label="Total supply"
                value={formatNumber(supplyModel.total)}
              />
              <MiniStat
                label="Protocol liquidity"
                value={formatUsdCompact(supplyModel.polUsd)}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Circulating supply excludes vaulted GLW. Model is illustrative and
              will be replaced with live data.
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
