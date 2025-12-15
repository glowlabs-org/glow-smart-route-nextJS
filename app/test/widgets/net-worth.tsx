"use client";

import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  type TooltipProps as RechartsTooltipProps,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  Tooltip as UiTooltip,
  TooltipContent as UiTooltipContent,
  TooltipProvider as UiTooltipProvider,
  TooltipTrigger as UiTooltipTrigger,
} from "@/components/ui/tooltip";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { usePoolActivity } from "@/hooks/useGlowPrices";
import { cn } from "@/lib/utils";

const GLOW_GREEN = "#4ADE80";

// Glow Worth = Liquid GLW + Delegated GLW + Unclaimed Rewards (in GLW)
const MOCK_LIQUID_GLW = 35_200;
const MOCK_DELEGATED_GLW = 9_100;
const MOCK_UNCLAIMED_REWARDS_GLW = 900;
const MOCK_WEEKLY_ACCUMULATED_GLW = 1_250;

const ACCUMULATION_DELTAS_GLW: number[] = [
  0,
  320,
  540,
  240,
  0,
  760,
  -900, // outflow dip
  1200,
  420,
  310,
  0, // plateau
  680,
  430,
  -250, // small outflow
  920,
  520,
  0, // plateau
  780,
  260,
  -600, // outflow dip
  1050,
  410,
  360,
  250,
];

const HOLDINGS = [
  { symbol: "GLW", amount: 45_200 },
  { symbol: "USDC", amount: 4200 },
  { symbol: "USDG", amount: 0 },
  { symbol: "GCTL", amount: 520 },
] as const;

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatUsdCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSpotPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$—";
  const decimals = value < 1 ? 3 : 2;
  return `$${value.toFixed(decimals)}`;
}

interface GlowWorthPoint {
  glw: number;
}

function GlowWorthChartTooltip({
  active,
  payload,
}: RechartsTooltipProps<number, string>) {
  if (!active) return null;
  const safeGlw =
    (payload?.[0]?.payload as GlowWorthPoint | undefined)?.glw ?? NaN;
  if (!Number.isFinite(safeGlw)) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
        GLW worth
      </div>
      <div className="font-mono text-sm font-bold tabular-nums text-foreground">
        {safeGlw.toLocaleString("en-US", { maximumFractionDigits: 0 })} GLW
      </div>
    </div>
  );
}

export default function NetWorthWidget() {
  const glowWorth =
    MOCK_LIQUID_GLW + MOCK_DELEGATED_GLW + MOCK_UNCLAIMED_REWARDS_GLW;
  const visibleHoldings = HOLDINGS.filter((h) => h.amount > 0);

  const { glowPrice, marketCap } = useGlowCirculatingSupply();
  const { deltaPercent: deltaPercent24h, currentPrice: vwapPrice24h } =
    usePoolActivity("day", "hour");

  const spotPrice = React.useMemo(() => {
    if (Number.isFinite(glowPrice) && glowPrice > 0) return glowPrice;
    if (Number.isFinite(vwapPrice24h) && (vwapPrice24h ?? 0) > 0)
      return vwapPrice24h ?? 0;
    return 0;
  }, [glowPrice, vwapPrice24h]);

  const formattedSpotPrice = React.useMemo(
    () => formatSpotPrice(spotPrice),
    [spotPrice]
  );
  const formattedDeltaPercent = React.useMemo(() => {
    if (!Number.isFinite(deltaPercent24h as number) || deltaPercent24h === null)
      return null;
    const sign = deltaPercent24h >= 0 ? "+" : "";
    return `${sign}${deltaPercent24h.toFixed(1)}%`;
  }, [deltaPercent24h]);

  const deltaClassName =
    formattedDeltaPercent === null
      ? "text-muted-foreground"
      : (deltaPercent24h ?? 0) >= 0
      ? "text-green-400"
      : "text-red-400";

  const chartData = React.useMemo(() => {
    const totalDelta = ACCUMULATION_DELTAS_GLW.reduce((sum, d) => sum + d, 0);
    let current = glowWorth - totalDelta;
    const points: Array<{ glw: number }> = [{ glw: current }];
    ACCUMULATION_DELTAS_GLW.forEach((d) => {
      current += d;
      points.push({ glw: current });
    });
    return points;
  }, [glowWorth]);

  return (
    <Card className="h-[340px] overflow-hidden flex flex-col gap-2">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
            GLOW WORTH
          </span>

          <UiTooltipProvider delayDuration={150}>
            <UiTooltip>
              <UiTooltipTrigger asChild>
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/50 px-2.5 py-1">
                  <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                    {formattedSpotPrice}
                  </span>
                  <span className={cn("font-mono text-[11px]")}>GLW price</span>
                </div>
              </UiTooltipTrigger>
              <UiTooltipContent side="bottom" align="end" sideOffset={10}>
                <div className="font-mono text-[10px]">
                  Market Cap: {formatUsdCompact(marketCap)}
                </div>
              </UiTooltipContent>
            </UiTooltip>
          </UiTooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-0">
        <div className="flex flex-col gap-2 p-4 pb-3 pt-0 shrink-0">
          <div className="font-mono text-5xl md:text-6xl font-bold tracking-tighter text-foreground tabular-nums">
            <NumberTicker
              value={glowWorth}
              decimalPlaces={0}
              className="tracking-tighter"
            />
            <span className="ml-2 text-xl md:text-2xl font-mono font-semibold text-zinc-500">
              GLW
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="px-2 py-1 rounded-md font-mono text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
              +{MOCK_WEEKLY_ACCUMULATED_GLW.toLocaleString("en-US")} GLW
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              accumulated this week
            </span>
          </div>
        </div>

        <div className="px-4 flex-1 min-h-[100px]">
          <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeOpacity={0.12}
                />
                <YAxis
                  width={56}
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickFormatter={(value: number) => formatCompact(value)}
                  domain={[
                    (min: number) => min - 900,
                    (max: number) => max + 900,
                  ]}
                />
                <RechartsTooltip
                  cursor={{ stroke: "var(--border)", strokeOpacity: 0.35 }}
                  content={GlowWorthChartTooltip}
                />
                <defs>
                  <linearGradient
                    id="glowWorthGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={GLOW_GREEN}
                      stopOpacity={0.35}
                    />
                    <stop offset="95%" stopColor={GLOW_GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="glw"
                  stroke={GLOW_GREEN}
                  strokeWidth={3}
                  fill="url(#glowWorthGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border-t border-border/60 bg-muted/10 shrink-0">
          <div className="p-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {visibleHoldings.map((holding) => (
                <div
                  key={holding.symbol}
                  className="shrink-0 rounded-xl border border-zinc-800 bg-background/40 px-3 py-2 min-w-[132px]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                      {holding.symbol}
                    </div>
                    <div className="font-mono text-sm font-bold text-foreground tabular-nums">
                      {holding.symbol === "GLW"
                        ? `${formatCompact(holding.amount)}`
                        : formatCompact(holding.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
