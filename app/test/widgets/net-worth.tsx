"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  type TooltipProps as RechartsTooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { useChainId } from "wagmi";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ConnectButton } from "@/components/connect-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GlowWorthBreakdownDialog,
  type GlowWorthBreakdown,
} from "@/components/dialogs/glow-worth-breakdown-dialog";
import { cn } from "@/lib/utils";
import { weekToTimestamp } from "@/lib/rewards/weekly-delegations";
import { trackEvent } from "@/lib/telemetry";
import { useLang, type Strings } from "@/lib/i18n";

import OnboardingHeroWidget from "./onboarding-hero-widget";
import {
  useWalletPortfolio,
  type GlowWorthPoint,
} from "./use-wallet-portfolio";
import { ArrowUpRight } from "lucide-react";

const GLOW_GREEN = "#4ADE80";
const DEFINED_POOL_ACTIVITY_URL =
  "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

interface NetWorthWidgetProps {
  walletAddress?: string | null;
  variant?: "default" | "minimal";
  onBuyGlowClick?: () => void;
}

function GlowWorthChartTooltip({
  active,
  payload,
  labels,
}: RechartsTooltipProps<number | string, string | number> & {
  labels: Strings["widgets"]["netWorthWidget"];
}) {
  if (!active) return null;
  const point = payload?.[0]?.payload as GlowWorthPoint | undefined;
  const safeGlw = point?.glw ?? NaN;
  const week = point?.week;
  const isCurrent = Boolean(point?.isCurrent);
  const liquid = point?.liquidGlw ?? NaN;
  const delegated = point?.delegatedActiveGlw ?? NaN;
  const pendingRecovery = point?.pendingRecoveredGlw ?? NaN;
  const unclaimed = point?.unclaimedGlwRewards ?? NaN;
  if (!Number.isFinite(safeGlw)) return null;

  const dateLabel = (() => {
    if (typeof week !== "number" || !Number.isFinite(week)) return null;
    const startMs = weekToTimestamp(week);
    if (!Number.isFinite(startMs)) return null;
    return new Date(startMs).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  })();

  const currentDateLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-foreground/10 dark:border-zinc-800 bg-popover/95 px-3 py-2 shadow-xl">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
        {isCurrent
          ? labels.tooltipCurrentPrefix(currentDateLabel)
          : typeof week === "number" && dateLabel
            ? labels.tooltipWeekWithDate(week, dateLabel)
            : typeof week === "number"
              ? labels.tooltipWeek(week)
              : labels.tooltipFallback}
      </div>
      <div className="font-mono text-sm font-bold tabular-nums text-foreground">
        {safeGlw.toLocaleString("en-US", { maximumFractionDigits: 0 })} GLW
      </div>
      {Number.isFinite(liquid) &&
      Number.isFinite(delegated) &&
      Number.isFinite(unclaimed) ? (
        <div className="mt-2 space-y-1 text-[11px] font-mono text-muted-foreground/80 dark:text-zinc-400">
          <div className="flex items-center justify-between gap-4">
            <span>{labels.tooltipLiquid}</span>
            <span className="tabular-nums text-foreground">
              {liquid.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>{labels.tooltipDelegated}</span>
            <span className="tabular-nums text-foreground">
              {delegated.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
          {Number.isFinite(pendingRecovery) && pendingRecovery > 0 ? (
            <div className="flex items-center justify-between gap-4">
              <span>{labels.tooltipPendingRecovery}</span>
              <span className="tabular-nums text-foreground">
                {pendingRecovery.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <span>{labels.tooltipUnclaimed}</span>
            <span className="tabular-nums text-foreground">
              {unclaimed.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NetWorthSkeleton() {
  const { t } = useLang();
  return (
    <Card className="h-full overflow-hidden flex flex-col gap-2 bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl pt-6 pb-0 w-full">
      <CardHeader className="py-0 px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
            {t.widgets.netWorthWidget.title}
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-0">
        <div className="flex flex-1 min-h-[300px] max-h-[300px] lg:min-h-0 lg:max-h-[400px]">
          <div className="px-6 flex-1 min-h-0">
            <div className="relative h-full w-full">
              {/* Grid pattern background */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: 0,
                  left: 0,
                  right: 56,
                  bottom: 30,
                  backgroundImage:
                    "radial-gradient(circle, currentColor 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                  opacity: 0.1,
                }}
              />

              {/* Value display skeleton */}
              <div className="absolute left-0 top-0 z-10 bg-transparent p-2">
                <div className="flex items-baseline gap-2">
                  <Skeleton className="h-10 w-32 rounded-xl" />
                  <Skeleton className="h-6 w-12 rounded-xl" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Skeleton className="h-7 w-24 rounded-xl" />
                  <Skeleton className="h-4 w-40 rounded-xl" />
                </div>
              </div>

              {/* Chart skeleton */}
              <div
                className="absolute inset-0"
                style={{ marginTop: 74, marginRight: 10, marginLeft: 10 }}
              >
                {/* Y-axis skeleton */}
                <div className="absolute right-0 top-0 bottom-0 w-14 flex flex-col justify-between py-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-3 w-10 ml-auto" />
                  ))}
                </div>

                {/* X-axis skeleton */}
                <div className="absolute bottom-0 left-0 right-14 flex justify-between px-4 pb-2">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-3 w-8" />
                  ))}
                </div>

                {/* Chart area skeleton - wavy line effect */}
                <div className="absolute inset-0 bottom-8 right-14">
                  <svg className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient
                        id="skeletonGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="currentColor"
                          stopOpacity="0.1"
                        />
                        <stop
                          offset="100%"
                          stopColor="currentColor"
                          stopOpacity="0.02"
                        />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 80 Q 25 70, 50 60 T 100 50 T 150 45 T 200 40 T 250 38 T 300 35 L 300 100 L 0 100 Z"
                      fill="url(#skeletonGradient)"
                      className="text-muted-foreground"
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d="M 0 80 Q 25 70, 50 60 T 100 50 T 150 45 T 200 40 T 250 38 T 300 35"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-muted-foreground opacity-20"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NetWorthWidget({
  walletAddress,
  variant = "default",
  onBuyGlowClick,
}: NetWorthWidgetProps) {
  const { t } = useLang();
  const chainId = useChainId();
  const isMinimal = variant === "minimal";
  const [isBreakdownOpen, setIsBreakdownOpen] = React.useState(false);
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "net_worth_widget";

  const {
    hasWallet,
    shouldShowSkeleton,
    showEmptyState,
    glowWorthGlw,
    glowWorthBreakdown,
    weeklyAccumulatedGlw,
    chartData,
    yDomain,
  } = useWalletPortfolio({ walletAddress, includeWeeklyHistory: true });

  const monthTicks = React.useMemo(() => {
    const ticks: number[] = [];
    let prevMonthKey: string | null = null;

    for (const point of chartData) {
      if (typeof point.week !== "number" || !Number.isFinite(point.week))
        continue;
      const ms = weekToTimestamp(point.week);
      if (!Number.isFinite(ms)) continue;

      const d = new Date(ms);
      const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      if (monthKey === prevMonthKey) continue;

      ticks.push(point.week);
      prevMonthKey = monthKey;
    }

    return ticks;
  }, [chartData]);

  if (shouldShowSkeleton) return <NetWorthSkeleton />;
  if (showEmptyState)
    return (
      <OnboardingHeroWidget
        className="h-full"
        variant={variant}
        onBuyGlowClick={onBuyGlowClick}
      />
    );

  const breakdownForDialog = glowWorthBreakdown
    ? ({
        glowWorthGlw: glowWorthBreakdown.glowWorthGlw,
        liquidGlw: glowWorthBreakdown.liquidGlw,
        delegatedActiveGlw: glowWorthBreakdown.delegatedActiveGlw,
        pendingRecoveredGlw: glowWorthBreakdown.pendingRecoveredGlw,
        unclaimedGlwRewards: glowWorthBreakdown.unclaimedGlwRewards,
      } satisfies GlowWorthBreakdown)
    : null;

  return (
    <Card
      className={cn(
        "overflow-hidden flex flex-col gap-3 pt-6 pb-0 w-full",
        isMinimal
          ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl h-full max-h-[540px]"
          : "h-full bg-card dark:bg-card border-border/20",
      )}
    >
      <CardHeader className="py-0 px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
            {t.widgets.netWorthWidget.title}
          </div>
          <div className="flex items-center gap-2">
            {hasWallet ? (
              <button
                type="button"
                className="h-8 inline-flex items-center gap-2 rounded-full px-3 text-[11px] font-mono tracking-wider border border-border hover:bg-muted/50 transition-colors"
                onClick={() => {
                  trackEvent("dashboard_glow_worth_breakdown_open_click", {
                    source,
                    wallet_connected: Boolean(normalizedWalletAddress),
                    wallet_address: normalizedWalletAddress,
                    chain_id: chainId,
                  });
                  setIsBreakdownOpen(true);
                }}
              >
                <span>{t.widgets.netWorthWidget.breakdown}</span>
              </button>
            ) : null}
            <a
              href={DEFINED_POOL_ACTIVITY_URL}
              target="_blank"
              rel="noreferrer"
              className="h-8 inline-flex items-center gap-2 rounded-full px-3 text-[11px] font-mono tracking-wider border border-border hover:bg-muted/50 transition-colors"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>{t.widgets.netWorthWidget.priceChart}</span>
            </a>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-0">
        <div
          aria-hidden={!hasWallet}
          className={cn(
            "flex flex-col flex-1 min-h-0",
            !hasWallet &&
              cn(
                "pointer-events-none select-none blur-[5px] opacity-60",
                isMinimal ? "bg-transparent" : "bg-card dark:bg-card",
              ),
          )}
        >
          <div className="flex flex-1 min-h-[200px]">
            <div className="flex flex-col sm:flex-row flex-1 min-h-0">
              {/* Left Side: Chart */}
              <div
                className={cn(
                  "flex-1 min-h-0",
                  isMinimal ? "px-6" : "px-4 lg:pr-1",
                  hasWallet ? "pb-1" : "",
                )}
              >
                <div className="relative h-full w-full">
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top: 0,
                      left: 0,
                      right: 56,
                      bottom: 30,
                      backgroundImage:
                        "radial-gradient(circle, currentColor 1px, transparent 1px)",
                      backgroundSize: "22px 22px",
                      opacity: 0.1,
                    }}
                  />
                  <div
                    className={cn(
                      "absolute left-0 top-0 z-10 p-2",
                      isMinimal ? "bg-transparent" : "bg-card dark:bg-card",
                    )}
                  >
                    <div className="flex items-baseline gap-3">
                      <div className="font-mono text-4xl sm:text-5xl font-semibold tracking-tight text-foreground tabular-nums leading-none">
                        <NumberTicker
                          value={glowWorthGlw}
                          decimalPlaces={0}
                          className="tracking-tight"
                        />
                      </div>
                      <span className="text-lg sm:text-xl font-mono font-medium text-muted-foreground/50">
                        GLW
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge className="h-7 px-2.5 rounded-xl font-mono text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/15 transition-colors">
                        +
                        {weeklyAccumulatedGlw.toLocaleString("en-US", {
                          maximumFractionDigits: 0,
                        })}{" "}
                        GLW
                      </Badge>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                        {t.widgets.netWorthWidget.thisWeek}
                      </span>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 74, right: 10, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid
                        vertical={true}
                        stroke="var(--border)"
                        strokeOpacity={0.12}
                        strokeDasharray="0"
                      />
                      <XAxis
                        dataKey="week"
                        ticks={monthTicks}
                        padding={{ left: 14, right: 14 }}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        interval={0}
                        tick={{
                          fill: "var(--muted-foreground)",
                          fontSize: 10,
                        }}
                        tickFormatter={(value: number) => {
                          if (!Number.isFinite(value)) return "";
                          try {
                            const ms = weekToTimestamp(value);
                            return new Intl.DateTimeFormat("en-US", {
                              month: "short",
                            }).format(new Date(ms));
                          } catch {
                            return "";
                          }
                        }}
                      />
                      <YAxis
                        width={56}
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tickMargin={8}
                        tick={{
                          fill: "var(--muted-foreground)",
                          fontSize: 10,
                        }}
                        tickFormatter={(value: number) => formatCompact(value)}
                        domain={yDomain}
                      />
                      <RechartsTooltip
                        cursor={{
                          stroke: "var(--border)",
                          strokeOpacity: 0.35,
                        }}
                        content={((props: any) => (
                          <GlowWorthChartTooltip
                            {...props}
                            labels={t.widgets.netWorthWidget}
                          />
                        )) as any}
                      />
                      <defs>
                        <linearGradient
                          id="glowWorthAreaGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={GLOW_GREEN}
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="100%"
                            stopColor={GLOW_GREEN}
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="glw"
                        stroke={GLOW_GREEN}
                        strokeWidth={1.5}
                        fill="url(#glowWorthAreaGradient)"
                        fillOpacity={1}
                        dot={false}
                        activeDot={{
                          r: 3,
                          strokeWidth: 1.5,
                          stroke: "var(--background)",
                          fill: GLOW_GREEN,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!hasWallet ? (
          <div className="px-6 pb-6">
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-center max-w-xs mx-auto">
              <div className="mt-1 text-sm text-muted-foreground">
                {t.widgets.netWorthWidget.connectWalletPrompt}
              </div>
              <div className="mt-3">
                <ConnectButton
                  className="w-full"
                  variant="default"
                  size="large"
                />
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>

      <GlowWorthBreakdownDialog
        open={isBreakdownOpen}
        onOpenChange={setIsBreakdownOpen}
        breakdown={breakdownForDialog}
      />
    </Card>
  );
}
