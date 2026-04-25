"use client";

import React from "react";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Sun,
  ArrowRight,
} from "lucide-react";
import {
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { useTotalActivelyDelegated } from "@/hooks";
import {
  useCompletedFarms,
  CompletedApplication,
} from "@/hooks/useCompletedFarms";
import {
  DECIMALS_BY_TOKEN,
  PaymentCurrency,
} from "@glowlabs-org/utils/browser";
import { formatUnits } from "viem";
import { DelegationIcon } from "@/components/impact-icons";
import { useLang } from "@/lib/i18n";

interface ProtocolMetricsWidgetProps {
  className?: string;
}

export default function ProtocolMetricsWidget({
  className,
}: ProtocolMetricsWidgetProps) {
  const { t } = useLang();
  // 1. Data Fetching
  const {
    circulatingSupply,
    marketCap,
    glowPrice,
    isLoading: isSupplyLoading,
  } = useGlowCirculatingSupply();

  const { data: totalActivelyDelegatedData, isLoading: isDelegatorsLoading } =
    useTotalActivelyDelegated();

  const { farms: completedFarms, isLoading: isFarmsLoading } =
    useCompletedFarms();

  // 2. Derived Data Calculation - actively delegated GLW from vault ownership endpoint
  const totalGlwDelegated = React.useMemo(() => {
    if (!totalActivelyDelegatedData?.totalGlwDelegatedWei) return 0;
    return Number(
      formatUnits(BigInt(totalActivelyDelegatedData.totalGlwDelegatedWei), 18),
    );
  }, [totalActivelyDelegatedData]);

  const percentGlwDelegated = React.useMemo(() => {
    if (!circulatingSupply || circulatingSupply === 0) return 0;
    return (totalGlwDelegated / circulatingSupply) * 100;
  }, [totalGlwDelegated, circulatingSupply]);

  const spotPrice =
    Number.isFinite(glowPrice) && glowPrice > 0 ? glowPrice : null;

  // 3. Chart Data Processing (Last 3 Months)
  const farmsChartData = React.useMemo(() => {
    if (!completedFarms || completedFarms.length === 0) return [];
    // We need spot price to calculate GLW value
    const currentSpotPrice = spotPrice ?? 0;

    const rows = completedFarms.filter((farm): farm is CompletedApplication =>
      Boolean(farm?.id),
    );

    // Filter for last 3 months
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    const cutoffTime = threeMonthsAgo.getTime();

    const recentRows = rows.filter((row) => {
      const completedDate =
        row.farm?.auditCompleteDate ||
        row.installFinishedDate ||
        row.revisedInstallFinishedDate ||
        row.paymentDate ||
        row.createdAt;
      const ts = completedDate ? Date.parse(completedDate) : 0;
      return ts >= cutoffTime;
    });

    if (recentRows.length === 0) return [];

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    const getWeekStartUtc = (timestamp: number) => {
      const date = new Date(timestamp);
      const utcYear = date.getUTCFullYear();
      const utcMonth = date.getUTCMonth();
      const utcDate = date.getUTCDate();
      const utcDay = date.getUTCDay();

      const start = new Date(Date.UTC(utcYear, utcMonth, utcDate));
      const offset = (utcDay + 6) % 7; // Monday as start of week
      start.setUTCDate(start.getUTCDate() - offset);
      return start.getTime();
    };

    const totalsByWeek = new Map<number, { count: number; valueUsd: number }>();
    let minWeek: number | null = null;
    let maxWeek: number | null = null;

    recentRows.forEach((row) => {
      const completedDate =
        row.farm?.auditCompleteDate ||
        row.installFinishedDate ||
        row.revisedInstallFinishedDate ||
        row.paymentDate ||
        row.createdAt;
      const ts = completedDate ? Date.parse(completedDate) : 0;
      if (!ts) return;

      const weekStart = getWeekStartUtc(ts);
      const current = totalsByWeek.get(weekStart) ?? { count: 0, valueUsd: 0 };

      // Count
      current.count += 1;

      // Value Calculation
      if (row.paymentAmount) {
        try {
          const currency = row.paymentCurrency as PaymentCurrency;
          const decimals = DECIMALS_BY_TOKEN[currency] || 18;
          const amount = parseFloat(
            formatUnits(BigInt(row.paymentAmount), decimals),
          );

          let valueInUsd = 0;
          if (currency === "USDG" || currency === "USDC") {
            valueInUsd = amount;
          } else if (currency === "GLW") {
            valueInUsd = amount * currentSpotPrice;
          }
          // Add to total
          current.valueUsd += valueInUsd;
        } catch (e) {
          console.warn("Failed to parse payment amount", e);
        }
      }

      totalsByWeek.set(weekStart, current);

      if (minWeek === null || weekStart < minWeek) minWeek = weekStart;
      if (maxWeek === null || weekStart > maxWeek) maxWeek = weekStart;
    });

    if (minWeek === null || maxWeek === null) return [];

    const results: {
      weekStart: number;
      weekLabel: string;
      rangeLabel: string;
      count: number;
      valueUsd: number;
    }[] = [];

    // Ensure we have bars for weeks with 0 farms too, within the range
    // Start from cutoffTime (rounded to week start) up to now
    let startTs = getWeekStartUtc(cutoffTime);
    const currentWeekStart = getWeekStartUtc(Date.now());
    const endTs = totalsByWeek.has(currentWeekStart)
      ? currentWeekStart
      : currentWeekStart - WEEK_MS;

    for (let ts = startTs; ts <= endTs; ts += WEEK_MS) {
      const data = totalsByWeek.get(ts) ?? { count: 0, valueUsd: 0 };
      const startDate = new Date(ts);
      const endDate = new Date(ts + WEEK_MS - 1);

      const weekLabel = startDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const rangeLabel = `${startDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} – ${endDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;

      results.push({
        weekStart: ts,
        weekLabel,
        rangeLabel,
        count: data.count,
        valueUsd: data.valueUsd,
      });
    }

    return results;
  }, [completedFarms, spotPrice]);

  const chartConfig = {
    count: {
      label: t.widgets.protocolMetrics.chartConfigFarmsLabel,
      color: "hsl(var(--primary))",
    },
    valueUsd: {
      label: t.widgets.protocolMetrics.chartConfigPdLabel,
      color: "#ff8533", // Orange color requested
    },
  } satisfies ChartConfig;

  // Loading States
  const isMetricsLoading = isSupplyLoading || isDelegatorsLoading;

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: GLW Spot Price */}
        <a
          href="https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d?quoteToken=token1&cache=1dafc"
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <Card className="group bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 hover:bg-muted/40 dark:hover:bg-muted/60 transition-colors cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                  {t.widgets.protocolMetrics.glwPrice}
                </span>
                <div className="text-muted-foreground/60 dark:text-muted-foreground/80 group-hover:text-foreground transition-colors">
                  <ArrowRight className="w-4 h-4 -rotate-45" />
                </div>
              </div>
              <div className="text-3xl font-semibold font-mono tracking-tight">
                {isMetricsLoading || spotPrice === null ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  `$${spotPrice.toFixed(4)}`
                )}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mt-2">
                {t.widgets.protocolMetrics.currentSpotPrice}
              </div>
            </CardContent>
          </Card>
        </a>

        {/* Metric 2: Market Cap */}
        <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {t.widgets.protocolMetrics.marketCap}
              </span>
              <TrendingUp className="w-4 h-4 text-muted-foreground/60 dark:text-muted-foreground/80" />
            </div>
            <div className="text-3xl font-semibold font-mono tracking-tight">
              {isMetricsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `$${(marketCap / 1_000_000).toFixed(1)}M`
              )}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mt-2">
              {t.widgets.protocolMetrics.circulatingSupply}
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Delegated */}
        <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {t.widgets.protocolMetrics.glwDelegated}
              </span>
              <DelegationIcon className="w-4 h-4 text-muted-foreground/60 dark:text-muted-foreground/80" />
            </div>
            <div className="text-3xl font-semibold font-mono tracking-tight">
              {isMetricsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `${percentGlwDelegated.toFixed(1)}%`
              )}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mt-2">
              {t.widgets.protocolMetrics.ofCirculatingSupply}
            </div>
          </CardContent>
        </Card>

        {/* Call to Action Card */}
        <Link href="/stats" className="block h-full group">
          <Card className="!bg-foreground text-primary-foreground border-transparent h-full hover:bg-primary/90 transition-colors cursor-pointer">
            <CardContent className="p-6 flex flex-col justify-center h-full">
              <div className="text-sm font-mono font-bold flex items-center gap-2">
                {t.widgets.protocolMetrics.viewAllStats}{" "}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-primary-foreground/70 mt-2">
                {t.widgets.protocolMetrics.deepDiveSubtitle}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Chart Section */}
      <Card className="bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 font-semibold">
              {t.widgets.protocolMetrics.chartTitle}
            </CardTitle>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mt-1">
              {t.widgets.protocolMetrics.chartSubtitle}
            </p>
          </div>
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 border-border/20 dark:border-border/40 text-muted-foreground/60 dark:text-muted-foreground/80 font-mono text-[10px] uppercase tracking-widest"
          >
            <Sun className="w-3 h-3" />
            {t.widgets.protocolMetrics.lastThreeMonths}
          </Badge>
        </CardHeader>
        <CardContent>
          {isFarmsLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : farmsChartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <ComposedChart
                accessibilityLayer
                data={farmsChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="4 4"
                  className="stroke-muted"
                />
                <XAxis
                  dataKey="weekLabel"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={30}
                  tickFormatter={(value) => value}
                  className="text-xs text-muted-foreground"
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDecimals={false}
                  className="text-xs text-muted-foreground"
                  label={{
                    value: t.widgets.protocolMetrics.chartYAxisFarmsLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: {
                      textAnchor: "middle",
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                    },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) =>
                    `$${value < 1000 ? value : (value / 1000).toFixed(0) + "k"}`
                  }
                  className="text-xs text-muted-foreground"
                  label={{
                    value: t.widgets.protocolMetrics.chartYAxisPdLabel,
                    angle: 90,
                    position: "insideRight",
                    style: {
                      textAnchor: "middle",
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                    },
                  }}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                  content={
                    <ChartTooltipContent
                      className="w-[200px]"
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload.rangeLabel ?? ""
                      }
                      formatter={(value, name) => {
                        if (
                          name === "valueUsd" ||
                          name === t.widgets.protocolMetrics.chartConfigPdLabel
                        ) {
                          return [
                            <span
                              key="pd"
                              className="font-mono text-orange-500 font-semibold"
                            >
                              $
                              {Number(value).toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })}
                            </span>,
                            t.widgets.protocolMetrics.tooltipProtocolDeposit,
                          ];
                        }
                        return [
                          <span
                            key="count"
                            className="font-mono text-primary font-semibold"
                          >
                            {value}
                          </span>,
                          t.widgets.protocolMetrics.tooltipFarmsOnboarded,
                        ];
                      }}
                    />
                  }
                />
                <Bar
                  yAxisId="left"
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="valueUsd"
                  stroke="var(--color-valueUsd)"
                  strokeWidth={3}
                  dot={{ fill: "var(--color-valueUsd)", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground/60 dark:text-muted-foreground/80 text-xs font-mono uppercase tracking-widest">
              {t.widgets.protocolMetrics.emptyChart}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
