"use client";

import React from "react";
import Link from "next/link";

import { ExternalLink, Sun } from "lucide-react";
import { BarChart, CartesianGrid, XAxis, YAxis, Bar } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  DECIMALS_BY_TOKEN,
  PaymentCurrency,
} from "@glowlabs-org/utils/browser";
import { formatUnits } from "viem";
import {
  CompletedApplication,
  useCompletedFarms,
} from "@/hooks/useCompletedFarms";
import {
  CompletedFarmsDialog,
  type CompletedFarmItem,
} from "@/components/dialogs/completed-farms-dialog";

interface CompletedFarmRow {
  id: string;
  name: string;
  zoneName: string;
  netCCProduction?: string;
  paymentAmount?: string;
  paymentCurrency?: PaymentCurrency;
  solarPanelsQuantity?: number;
  status: string;
  timestampMs: number;
  timestampLabel: string;
  auditUrl?: string;
}

interface FarmsChartDatum {
  weekStart: number;
  weekLabel: string;
  rangeLabel: string;
  count: number;
}

interface LifetimeFarmsProps {
  shouldLoad?: boolean;
  totalGlwDelegated?: number;
  withChart?: boolean;
  isGlwDataLoading?: boolean;
}

type ChartRangeValue = "3m" | "6m" | "all";

interface ChartRangeOption {
  value: ChartRangeValue;
  label: string;
  description: string;
  months?: number;
}

const CHART_RANGE_OPTIONS: ChartRangeOption[] = [
  { value: "3m", label: "3M", description: "last 3 months", months: 3 },
  { value: "6m", label: "6M", description: "last 6 months", months: 6 },
  { value: "all", label: "All", description: "entire history" },
];

const DEFAULT_CHART_RANGE: ChartRangeValue = "3m";

function formatPayment(
  amount?: string,
  currency?: PaymentCurrency,
): string | null {
  if (!amount) return null;
  const numericAmount = parseFloat(
    formatUnits(
      BigInt(amount),
      DECIMALS_BY_TOKEN[currency as keyof typeof DECIMALS_BY_TOKEN],
    ),
  );
  const formatted = Number.isFinite(numericAmount)
    ? numericAmount.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })
    : amount;
  return currency ? `${formatted} ${currency}` : formatted;
}

function FarmsSkeleton() {
  return (
    <div className="grid gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-border/20 dark:border-border/40 bg-card p-8"
          >
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card p-8">
        <Skeleton className="mb-8 h-[260px] w-full" />
      </div>
      <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card p-8">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="flex items-center justify-between border-b border-border/20 dark:border-border/40 py-4 last:border-b-0"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div>
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompletedTimelineRow({ row }: { row: CompletedFarmRow }) {
  const paymentLabel = formatPayment(row.paymentAmount, row.paymentCurrency);
  const solarPanelsLabel =
    typeof row.solarPanelsQuantity === "number" &&
    Number.isFinite(row.solarPanelsQuantity)
      ? `${row.solarPanelsQuantity.toLocaleString()} panels`
      : null;

  const baseClassName =
    "group flex flex-col gap-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between";
  const interactiveClassName = row.auditUrl
    ? " hover:border-border/40 dark:hover:border-border/60 hover:bg-muted/50 dark:hover:bg-muted/60"
    : "";

  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-glow-orange/20 bg-glow-orange/10">
          <Sun className="h-5 w-5 text-glow-orange" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold tracking-tight text-foreground">{row.name}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground/70">
            {row.zoneName ? (
              <Badge
                variant="secondary"
                className="h-5 px-2 text-[10px] font-medium"
              >
                {row.zoneName}
              </Badge>
            ) : null}
            {row.netCCProduction ? (
              <>
                <span className="hidden sm:inline text-muted-foreground/40">·</span>
                <span className="whitespace-nowrap text-muted-foreground/60">
                  {row.netCCProduction} cc/week
                </span>
              </>
            ) : null}
            {solarPanelsLabel ? (
              <>
                <span className="hidden sm:inline text-muted-foreground/40">·</span>
                <span className="whitespace-nowrap text-muted-foreground/60">{solarPanelsLabel}</span>
              </>
            ) : null}
            <span className="hidden sm:inline text-muted-foreground/40">·</span>
            <span className="whitespace-nowrap text-muted-foreground/60">{row.timestampLabel}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {paymentLabel ? (
          <Badge
            variant="outline"
            className="text-xs font-semibold leading-none"
          >
            {paymentLabel}
          </Badge>
        ) : null}
        {row.auditUrl ? (
          <Badge variant="secondary" className="gap-1 text-xs">
            See audit
            <ExternalLink className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground/60">
            Audit pending
          </Badge>
        )}
      </div>
    </>
  );

  if (row.auditUrl) {
    return (
      <Link
        href={row.auditUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClassName}${interactiveClassName}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`${baseClassName}${interactiveClassName}`}>{content}</div>
  );
}

export function LifetimeFarms({
  shouldLoad = true,
  totalGlwDelegated,
  isGlwDataLoading = false,
  withChart = false,
}: LifetimeFarmsProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const { farms: completedFarms, isLoading: completedLoading } =
    useCompletedFarms({ enabled: shouldLoad });

  const completedRows = React.useMemo(() => {
    const rows = (completedFarms || []).filter(
      (farm): farm is CompletedApplication => Boolean(farm?.id),
    );

    return rows
      .map((application) => {
        const farmName = application.farm?.name || application.id;
        const zoneName = application.zone?.name || "Clean Grid Project";
        const status = application.status || "Unknown";
        const completedDate =
          application.farm?.auditCompleteDate ||
          application.installFinishedDate ||
          application.revisedInstallFinishedDate ||
          application.paymentDate ||
          application.createdAt;
        const paymentAmount = application.paymentAmount;
        const paymentCurrency = application.paymentCurrency;
        const netCCProduction = application.netCarbonCreditEarningWeekly;
        const solarPanelsQuantity = application.solarPanelsQuantity;
        const timestampMs = completedDate ? Date.parse(completedDate) : 0;
        const timestampLabel = completedDate
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(completedDate))
          : "Date pending";
        const auditUrl = application.farm?.id
          ? `https://glow.org/audits/${application.farm.id}`
          : undefined;

        return {
          id: application.id,
          name: farmName,
          zoneName,
          netCCProduction,
          solarPanelsQuantity,
          status,
          timestampMs,
          timestampLabel,
          auditUrl,
          paymentAmount,
          paymentCurrency,
        } satisfies CompletedFarmRow;
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [completedFarms]);

  const totalFarms = completedRows.length;

  const dialogFarms = React.useMemo<CompletedFarmItem[]>(() => {
    return completedRows.map((row) => ({
      id: row.id,
      name: row.name,
      zoneName: row.zoneName,
      netCCProduction: row.netCCProduction,
      solarPanelsQuantity: row.solarPanelsQuantity,
      timestampLabel: row.timestampLabel,
      auditUrl: row.auditUrl,
      paymentLabel: formatPayment(row.paymentAmount, row.paymentCurrency),
    }));
  }, [completedRows]);

  const farmsThisMonth = React.useMemo(() => {
    if (completedRows.length === 0) return 0;
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).getTime();
    return completedRows.filter((row) => row.timestampMs >= startOfMonth)
      .length;
  }, [completedRows]);

  const currentMonthLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
      }).format(new Date()),
    [],
  );

  const farmsChartData = React.useMemo(() => {
    if (completedRows.length === 0) return [];

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

    const totalsByWeek = new Map<number, number>();
    let minWeek: number | null = null;
    let maxWeek: number | null = null;

    completedRows.forEach((row) => {
      if (!row.timestampMs) return;
      const weekStart = getWeekStartUtc(row.timestampMs);
      totalsByWeek.set(weekStart, (totalsByWeek.get(weekStart) ?? 0) + 1);
      if (minWeek === null || weekStart < minWeek) minWeek = weekStart;
      if (maxWeek === null || weekStart > maxWeek) maxWeek = weekStart;
    });

    if (minWeek === null || maxWeek === null) return [];

    const results: {
      weekStart: number;
      weekLabel: string;
      rangeLabel: string;
      count: number;
    }[] = [];

    for (let ts: number = minWeek; ts <= maxWeek; ts += WEEK_MS) {
      const count = totalsByWeek.get(ts) ?? 0;
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
        count,
      });
    }

    return results;
  }, [completedRows]);

  const farmsChartConfig = React.useMemo(
    () =>
      ({
        weeklyCount: {
          label: "Farms onboarded",
          color: "var(--chart-1)",
        },
      }) satisfies ChartConfig,
    [],
  );

  const [selectedChartRange, setSelectedChartRange] =
    React.useState<ChartRangeValue>(DEFAULT_CHART_RANGE);

  const activeRangeOption =
    CHART_RANGE_OPTIONS.find((option) => option.value === selectedChartRange) ??
    CHART_RANGE_OPTIONS[0];
  const activeRangeMonths = activeRangeOption.months ?? null;

  const filteredFarmsChartData = React.useMemo(() => {
    if (farmsChartData.length === 0) return [];
    if (activeRangeMonths === null) return farmsChartData;

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - activeRangeMonths);
    const cutoffTime = cutoffDate.getTime();

    return farmsChartData.filter((datum) => datum.weekStart >= cutoffTime);
  }, [farmsChartData, activeRangeMonths]);

  if (completedLoading || !shouldLoad) {
    return <FarmsSkeleton />;
  }

  return (
    <div className="grid gap-8">
      {withChart && (
        <Card className="overflow-hidden bg-card border-border/20 dark:border-border/40 !py-0 !gap-0">
          <CardHeader className="border-b border-border/20 dark:border-border/40 !py-6 !px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Lifetime Farms Onboarded
                </h3>
                <p className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                  Solar farms brought online
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="!p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground/60">
                Showing {activeRangeOption.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CHART_RANGE_OPTIONS.map((option) => {
                  const isActive = option.value === selectedChartRange;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={isActive ? "default" : "ghost"}
                      className={`h-7 rounded-full px-3 text-xs ${
                        isActive ? "" : "text-muted-foreground hover:text-foreground"
                      }`}
                      aria-pressed={isActive}
                      onClick={() => setSelectedChartRange(option.value)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            {filteredFarmsChartData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-xs text-muted-foreground/60">
                {farmsChartData.length === 0
                  ? "No historical data available."
                  : "No data for the selected timeframe."}
              </div>
            ) : (
              <ChartContainer
                config={farmsChartConfig}
                className="aspect-auto h-[260px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={filteredFarmsChartData}
                  margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="weekLabel"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tickMargin={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="w-[180px]"
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload.rangeLabel ?? ""
                        }
                        formatter={(value) => [
                          String(value),
                          " Farms onboarded",
                        ]}
                      />
                    }
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-weeklyCount)"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden bg-card border-border/20 dark:border-border/40 !py-0 !gap-0">
        <CardContent className="!p-8">
          <div className="pb-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-border/20 dark:border-border/40">
            <div>
              <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                Total Onboarded
              </div>
              <div className="text-5xl font-bold tracking-tight text-foreground">
                {totalFarms.toLocaleString()}
              </div>
              <p className="mt-2 text-xs text-muted-foreground/60">
                Lifetime farms with completed audits
              </p>
            </div>
            <div>
              <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                Total GLW Delegated
              </div>
              <div className="text-5xl font-bold tracking-tight text-foreground">
                {isGlwDataLoading || totalGlwDelegated === undefined
                  ? "--"
                  : totalGlwDelegated.toLocaleString()}{" "}
                <span className="text-xl text-muted-foreground/60">GLW</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground/60">
                Delegated to solar farms
              </p>
            </div>
          </div>
          <div className="pt-8">
            <div className="mb-6 flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">Completed Timeline</span>
              {completedRows.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setIsDialogOpen(true)}
                >
                  See All
                </Button>
              )}
            </div>
            {completedRows.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border/30 dark:border-border/40 bg-muted/20 dark:bg-muted/50 py-12 text-center sm:py-16">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Sun className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mb-1 text-sm font-medium text-foreground">
                  No completed farms yet
                </p>
                <p className="mx-auto max-w-sm px-4 text-sm text-muted-foreground">
                  Completed farms will appear here once audits are finalized.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedRows.slice(0, 5).map((row) => (
                  <CompletedTimelineRow key={row.id} row={row} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CompletedFarmsDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        farms={dialogFarms}
      />
    </div>
  );
}
