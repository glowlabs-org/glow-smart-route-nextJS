"use client";

import React from "react";
import Link from "next/link";

import {
  TrendingUp,
  Activity,
  Building,
  ExternalLink,
  Sun,
} from "lucide-react";
import { BarChart, CartesianGrid, XAxis, YAxis, Bar } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  isGlwDataLoading?: boolean;
}

function formatPayment(
  amount?: string,
  currency?: PaymentCurrency
): string | null {
  if (!amount) return null;
  const numericAmount = parseFloat(
    formatUnits(
      BigInt(amount),
      DECIMALS_BY_TOKEN[currency as keyof typeof DECIMALS_BY_TOKEN]
    )
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
    <div className="grid gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-border bg-muted/30 p-6"
          >
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-muted/30 p-6">
        <Skeleton className="mb-6 h-[220px] w-full" />
      </div>
      <div className="rounded-xl border border-border bg-muted/30 p-6">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="flex items-center justify-between border-b border-border/50 py-3 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-5 w-16" />
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
    "group flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/30 p-4 transition-all sm:flex-row sm:items-center sm:justify-between";
  const interactiveClassName = row.auditUrl
    ? " hover:border-border hover:bg-muted hover:shadow-sm"
    : "";

  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          <Sun className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{row.name}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {row.zoneName ? (
              <Badge
                variant="secondary"
                className="h-5 px-2 text-xs font-medium"
              >
                {row.zoneName}
              </Badge>
            ) : null}
            {row.netCCProduction ? (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="whitespace-nowrap">
                  {row.netCCProduction} cc/week
                </span>
              </>
            ) : null}
            {solarPanelsLabel ? (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="whitespace-nowrap">{solarPanelsLabel}</span>
              </>
            ) : null}
            <span className="hidden sm:inline">·</span>
            <span className="whitespace-nowrap">{row.timestampLabel}</span>
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
          <Badge variant="secondary" className="gap-1">
            See audit
            <ExternalLink className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
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
}: LifetimeFarmsProps) {
  const { farms: completedFarms, isLoading: completedLoading } =
    useCompletedFarms({ enabled: shouldLoad });

  const completedRows = React.useMemo(() => {
    const rows = (completedFarms || []).filter(
      (farm): farm is CompletedApplication => Boolean(farm?.id)
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
  const farmsThisMonth = React.useMemo(() => {
    if (completedRows.length === 0) return 0;
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).getTime();
    return completedRows.filter((row) => row.timestampMs >= startOfMonth)
      .length;
  }, [completedRows]);

  const currentMonthLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
      }).format(new Date()),
    []
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
      } satisfies ChartConfig),
    []
  );

  if (completedLoading || !shouldLoad) {
    return <FarmsSkeleton />;
  }

  return (
    <div className="grid gap-6">
      {/* <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">
                Lifetime Farms Onboarded
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Solar farms brought online
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              <TrendingUp className="mr-1 h-3 w-3" />
              {totalFarms}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {farmsChartData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              No historical data available.
            </div>
          ) : (
            <ChartContainer
              config={farmsChartConfig}
              className="aspect-auto h-[260px] w-full"
            >
              <BarChart
                accessibilityLayer
                data={farmsChartData}
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
                      formatter={(value) => [String(value), "Farms onboarded"]}
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
      </Card> */}

      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="pb-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-border/50">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total Onboarded
              </div>
              <div className="text-4xl font-bold tracking-tight">
                {totalFarms.toLocaleString()}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Lifetime farms with completed audits
              </p>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total GLW Delegated
              </div>
              <div className="text-4xl font-bold tracking-tight">
                {isGlwDataLoading || totalGlwDelegated === undefined
                  ? "--"
                  : totalGlwDelegated.toLocaleString()}{" "}
                <span className="text-2xl text-muted-foreground">GLW</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Delegated to solar farms
              </p>
            </div>
          </div>
          <div className="pt-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Completed Timeline</div>
              <Badge variant="outline" className="shrink-0 text-xs">
                <Activity className="mr-1 h-3 w-3" />
                Live
              </Badge>
            </div>
            {completedRows.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 py-12 text-center sm:py-16">
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
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {completedRows.map((row) => (
                  <CompletedTimelineRow key={row.id} row={row} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
