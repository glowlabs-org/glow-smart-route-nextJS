"use client";

import React from "react";
import Link from "next/link";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  HelpCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useGlowPrices } from "@/hooks/useGlowPrices";

interface TickerCardProps {
  title: string;
  price: string;
  delta?: number | null;
  deltaPercent?: number | null;
  tooltip: string;
  sparkline?: number[];
  isLoading?: boolean;
  source?: string;
  updateFrequency?: string;
  externalLink?: { url: string; label: string };
}

interface MarketTickersProps {
  shouldLoad?: boolean;
}

function buildChartConfig(title: string, deltaPercent?: number | null) {
  const isPositive = (deltaPercent ?? 0) >= 0;
  return {
    value: {
      label: title,
      color: isPositive
        ? "hsl(142, 71%, 45%)"
        : deltaPercent !== undefined && deltaPercent !== null
        ? "hsl(0, 84%, 60%)"
        : "hsl(var(--primary))",
    },
  } satisfies ChartConfig;
}

function getChartData(title: string, sparkline: number[] | undefined) {
  if (!sparkline || sparkline.length === 0) return [];

  const totalPoints = sparkline.length;
  const hoursPerPoint = (7 * 24) / totalPoints;
  const now = Date.now();

  return sparkline.map((value, index) => {
    const hoursAgo = Math.round((totalPoints - index - 1) * hoursPerPoint);
    const timestamp = now - hoursAgo * 60 * 60 * 1000;
    const date = new Date(timestamp);
    const daysAgo = Math.floor(hoursAgo / 24);
    const remainingHours = hoursAgo % 24;

    let timeLabel: string;
    if (hoursAgo === 0) timeLabel = "Now";
    else if (hoursAgo < 24) timeLabel = `${hoursAgo}h ago`;
    else if (remainingHours === 0) timeLabel = `${daysAgo}d ago`;
    else timeLabel = `${daysAgo}d ${remainingHours}h ago`;

    const axisLabel = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    return {
      time: timeLabel,
      axisLabel,
      value,
      timestamp,
      date,
      index,
    };
  });
}

function TickerCard({
  title,
  price,
  delta,
  deltaPercent,
  tooltip,
  sparkline,
  isLoading,
  source,
  updateFrequency,
  externalLink,
}: TickerCardProps) {
  const isPositive = (delta ?? 0) >= 0;
  const chartData = React.useMemo(
    () => getChartData(title, sparkline),
    [title, sparkline]
  );
  const chartConfig = React.useMemo(
    () => buildChartConfig(title, deltaPercent ?? undefined),
    [title, deltaPercent]
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="group relative overflow-hidden transition-all duration-300">
        <CardContent className="p-0">
          {isLoading ? (
            <>
              <div className="p-6">
                <Skeleton className="mb-3 h-4 w-32" />
                <Skeleton className="mb-3 h-10 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="border-t border-border/60 p-6 pt-4">
                <Skeleton className="h-32 w-full" />
              </div>
            </>
          ) : (
            <>
              <div className="p-6 pb-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {title}
                        </span>
                        {tooltip ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground transition-colors hover:text-primary"
                                aria-label={`Info about ${title}`}
                              >
                                <HelpCircle className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs leading-relaxed">
                                {tooltip}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                      {source ? (
                        <Badge variant="outline" className="h-5 px-2 text-xs">
                          <Activity className="mr-1 h-3 w-3" />
                          {source}
                        </Badge>
                      ) : null}
                    </div>
                    {externalLink ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={externalLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground transition-colors hover:text-primary"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{externalLink.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                  {updateFrequency ? (
                    <Badge variant="secondary" className="text-xs">
                      {updateFrequency}
                    </Badge>
                  ) : null}
                </div>

                <div className="mb-3 text-4xl font-bold tracking-tight">
                  {price}
                </div>

                {typeof deltaPercent === "number" ? (
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold ${
                        isPositive
                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                          : "bg-red-500/10 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                      <span>
                        {isPositive ? "+" : ""}
                        {deltaPercent.toFixed(2)}%
                      </span>
                    </div>
                    <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                      7d
                    </span>
                  </div>
                ) : null}
              </div>

              {chartData.length > 0 ? (
                <div className="border-t border-border/60 p-6 pt-4">
                  <ChartContainer config={chartConfig}>
                    <AreaChart
                      accessibilityLayer
                      data={chartData}
                      margin={{
                        left: 0,
                        right: 0,
                      }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="axisLabel"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={4}
                        tickFormatter={(value: number) =>
                          `$${Number(value).toFixed(2)}`
                        }
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            labelFormatter={(value) => value}
                            formatter={(value) => [
                              `$${Number(value as number).toFixed(
                                title.includes("GCTL") ? 2 : 4
                              )}`,
                              title,
                            ]}
                          />
                        }
                      />
                      <Area
                        dataKey="value"
                        type="natural"
                        fill="var(--color-value)"
                        fillOpacity={0.4}
                        stroke="var(--color-value)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export function MarketTickers({ shouldLoad = true }: MarketTickersProps) {
  const {
    spotPrice,
    spotPriceLoading,
    spotSparkline,
    spotDelta,
    spotDeltaPercent,
    edgapPrice,
    edgapPriceLoading,
    edgapSparkline,
    edgapDelta,
    edgapDeltaPercent,
    gctlMintPrice,
    gctlMintSparkline,
    gctlMintDelta,
    gctlMintDeltaPercent,
    poolActivityLoading,
  } = useGlowPrices({ enabled: shouldLoad });

  const spotPriceLabel = React.useMemo(() => {
    if (spotPrice === null || spotPrice === undefined) return "$--";
    return `$${spotPrice.toFixed(4)}`;
  }, [spotPrice]);

  const edgapPriceLabel = React.useMemo(() => {
    if (edgapPrice === null || edgapPrice === undefined) return "$--";
    return `$${edgapPrice.toFixed(4)}`;
  }, [edgapPrice]);

  const gctlPriceLabel = React.useMemo(() => {
    if (gctlMintPrice === null || gctlMintPrice === undefined) return "$--";
    return `$${gctlMintPrice.toFixed(2)}`;
  }, [gctlMintPrice]);

  return (
    <section className="py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Market Tickers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time pricing data for GLW and GCTL tokens
          </p>
        </div>
        <Badge variant="outline" className="hidden md:flex">
          <Activity className="mr-1 h-3 w-3" />
          Live
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TickerCard
          title="GLW Spot Price"
          price={spotPriceLabel}
          delta={spotDelta ?? undefined}
          deltaPercent={spotDeltaPercent ?? undefined}
          tooltip="Real-time market price from Uniswap pool. This is the current trading price where you can buy or sell GLW tokens on the open market."
          sparkline={spotSparkline}
          isLoading={!shouldLoad || spotPriceLoading || poolActivityLoading}
          updateFrequency="~30s"
          externalLink={{
            url: "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d?maker=0x5abcfde6bc010138f65e8dc088927473c49867e4&preferredQuoteTokenAddress=0xf4fbc617a5733eaaf9af08e1ab816b103388d8b6&cache=f235f&quoteToken=token1",
            label: "View pair on Defined.fi",
          }}
        />
        <TickerCard
          title="GLW Edgap Price"
          price={edgapPriceLabel}
          delta={edgapDelta ?? undefined}
          deltaPercent={edgapDeltaPercent ?? undefined}
          tooltip="Exponentially-Decayed, liquidity-aware price. A smoothed, stable price signal used by the protocol for GCTL pricing. Reacts to market changes but filters out short-term noise."
          sparkline={edgapSparkline}
          isLoading={!shouldLoad || edgapPriceLoading}
          updateFrequency="~1m"
        />
        <TickerCard
          title="GCTL Mint Price"
          price={gctlPriceLabel}
          delta={gctlMintDelta ?? undefined}
          deltaPercent={gctlMintDeltaPercent ?? undefined}
          tooltip="Dynamic price to mint new GCTL tokens = ceil(√GLW Price / $0.05) × $0.05. The price is the square root of GLW price, rounded up to the nearest 5 cents."
          sparkline={gctlMintSparkline}
          isLoading={!shouldLoad || edgapPriceLoading}
          updateFrequency="~1m"
        />
      </div>
    </section>
  );
}
