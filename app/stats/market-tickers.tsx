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

import { Card, CardContent } from "@/components/ui/card";
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
import { useLang } from "@/lib/i18n";

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
    [title, sparkline],
  );
  const chartConfig = React.useMemo(
    () => buildChartConfig(title, deltaPercent ?? undefined),
    [title, deltaPercent],
  );
  const { t } = useLang();
  const s = t.routes.stats;

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="group relative overflow-hidden transition-colors bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 !py-0 !gap-0">
        <CardContent className="!p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="mb-2 h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          ) : (
            <>
              <div className="p-6">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                      {title}
                    </span>
                    {tooltip ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground/60 dark:text-muted-foreground/80 transition-colors hover:text-foreground"
                            aria-label={`Info about ${title}`}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs leading-relaxed">{tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {updateFrequency ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono uppercase tracking-widest border-border/20 dark:border-border/40 text-muted-foreground/60 dark:text-muted-foreground/80"
                      >
                        {updateFrequency}
                      </Badge>
                    ) : null}
                    {externalLink ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={externalLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground/60 dark:text-muted-foreground/80 transition-colors hover:text-foreground"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{externalLink.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>

                <div className="text-3xl font-semibold font-mono tracking-tight">
                  {price}
                </div>

                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mt-2">
                  {source ? source : s.currentPrice}
                </div>

                {typeof deltaPercent === "number" ? (
                  <div className="flex items-center gap-2 mt-3">
                    <div
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                        isPositive
                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                          : "bg-red-500/10 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      <span>
                        {isPositive ? "+" : ""}
                        {deltaPercent.toFixed(2)}%
                      </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                      7d
                    </span>
                  </div>
                ) : null}
              </div>

              {chartData.length > 0 ? (
                <div className="border-t border-border/20 dark:border-border/40 p-6 pt-4">
                  <ChartContainer config={chartConfig}>
                    <AreaChart
                      accessibilityLayer
                      data={chartData}
                      margin={{
                        left: 0,
                        right: 0,
                      }}
                    >
                      <CartesianGrid
                        vertical={false}
                        className="stroke-muted"
                      />
                      <XAxis
                        dataKey="axisLabel"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs text-muted-foreground"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={4}
                        tickFormatter={(value: number) =>
                          `$${Number(value).toFixed(2)}`
                        }
                        className="text-xs text-muted-foreground"
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            labelFormatter={(value) => value}
                            formatter={(value) => [
                              `$${Number(value as number).toFixed(
                                title.includes("GCTL") ? 2 : 4,
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
  const { t } = useLang();
  const s = t.routes.stats;
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
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TickerCard
          title={s.glwSpotPrice}
          price={spotPriceLabel}
          tooltip={s.glwSpotTooltip}
          isLoading={!shouldLoad || spotPriceLoading || poolActivityLoading}
          updateFrequency="~30s"
          externalLink={{
            url: "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d?maker=0x5abcfde6bc010138f65e8dc088927473c49867e4&preferredQuoteTokenAddress=0xf4fbc617a5733eaaf9af08e1ab816b103388d8b6&cache=f235f&quoteToken=token1",
            label: s.viewPairOnDefined,
          }}
        />
        <TickerCard
          title={s.glwEdgapPrice}
          price={edgapPriceLabel}
          tooltip={s.glwEdgapTooltip}
          isLoading={!shouldLoad || edgapPriceLoading}
          updateFrequency="~1m"
        />
        <TickerCard
          title={s.gctlMintPrice}
          price={gctlPriceLabel}
          tooltip={s.gctlMintTooltip}
          isLoading={!shouldLoad || edgapPriceLoading}
          updateFrequency="~1m"
        />
      </div>
    </div>
  );
}
