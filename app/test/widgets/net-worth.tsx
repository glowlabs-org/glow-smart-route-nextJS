"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { ArrowLeftRight, Send } from "lucide-react";
import { useChainId } from "wagmi";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/connect-button";
import { Skeleton } from "@/components/ui/skeleton";
import { SwapDialog } from "@/components/dialogs/swap-dialog";
import { SendDialog } from "@/components/send-dialog";
import { cn } from "@/lib/utils";
import { weekToTimestamp } from "@/lib/rewards/weekly-delegations";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { trackEvent } from "@/lib/telemetry";

import OnboardingHeroWidget from "./onboarding-hero-widget";
import {
  useWalletPortfolio,
  type GlowWorthPoint,
} from "./use-wallet-portfolio";

const GLOW_GREEN = "#4ADE80";

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

interface NetWorthWidgetProps {
  walletAddress?: string | null;
}

function GlowWorthChartTooltip({
  active,
  payload,
}: RechartsTooltipProps<number, string>) {
  if (!active) return null;
  const point = payload?.[0]?.payload as GlowWorthPoint | undefined;
  const safeGlw = point?.glw ?? NaN;
  const week = point?.week;
  const isCurrent = Boolean(point?.isCurrent);
  const liquid = point?.liquidGlw ?? NaN;
  const delegated = point?.delegatedActiveGlw ?? NaN;
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
    <div className="rounded-xl border border-foreground/10 dark:border-zinc-800 bg-popover/95 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
        {isCurrent
          ? `Current · ${currentDateLabel}`
          : dateLabel
          ? `Week ${week} · ${dateLabel}`
          : week
          ? `Week ${week}`
          : "GLW worth"}
      </div>
      <div className="font-mono text-sm font-bold tabular-nums text-foreground">
        {safeGlw.toLocaleString("en-US", { maximumFractionDigits: 0 })} GLW
      </div>
      {Number.isFinite(liquid) &&
      Number.isFinite(delegated) &&
      Number.isFinite(unclaimed) ? (
        <div className="mt-2 space-y-1 text-[11px] font-mono text-muted-foreground/80 dark:text-zinc-400">
          <div className="flex items-center justify-between gap-4">
            <span>Liquid</span>
            <span className="tabular-nums text-foreground">
              {liquid.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Delegated</span>
            <span className="tabular-nums text-foreground">
              {delegated.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Unclaimed</span>
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
  return (
    <Card className="h-full overflow-hidden flex flex-col gap-2 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
            GLOW WORTH
          </span>
          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-muted/20 px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-800/50">
            <Skeleton className="h-4 w-16 rounded-md" />
            <span className="font-mono text-[11px] text-muted-foreground">
              GLW price
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-0">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-col gap-2 p-4 pb-3 pt-0 shrink-0">
            <div className="flex items-baseline gap-3">
              <Skeleton className="h-14 w-44 rounded-2xl" />
              <Skeleton className="h-7 w-14 rounded-xl" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-4 w-36 rounded-md" />
            </div>
          </div>

          <div className="px-4 flex-1 min-h-[100px]">
            <div className="h-full w-full rounded-2xl border border-border/60 bg-muted/10" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NetWorthWidget({ walletAddress }: NetWorthWidgetProps) {
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const [isSwapOpen, setIsSwapOpen] = React.useState(false);
  const [isSendOpen, setIsSendOpen] = React.useState(false);
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "net_worth_widget";

  const {
    hasWallet,
    shouldShowSkeleton,
    showEmptyState,
    headlineStats,
    ethPriceInUSD,
    glowWorthGlw,
    weeklyAccumulatedGlw,
    chartData,
    yDomain,
  } = useWalletPortfolio({ walletAddress });

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

  const handleSwapOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setIsSwapOpen(nextOpen);
      if (nextOpen) return;
      if (!walletAddress) return;

      void (async () => {
        try {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.balances.tokens(chainId, walletAddress),
            }),
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.impact.glowWorth(walletAddress),
            }),
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.impact.scoreBreakdown(walletAddress),
            }),
          ]);
        } catch {}
      })();
    },
    [chainId, queryClient, walletAddress]
  );

  if (shouldShowSkeleton) return <NetWorthSkeleton />;
  if (showEmptyState) return <OnboardingHeroWidget className="h-full" />;

  return (
    <Card className="h-full min-h-[420px] lg:min-h-0 overflow-hidden flex flex-col gap-2 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold tracking-tight text-foreground">
            Glow Worth
          </div>

          {hasWallet ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-[11px] font-mono  tracking-wider gap-2"
                onClick={() => {
                  trackEvent("dashboard_swap_open_click", {
                    source,
                    wallet_connected: Boolean(normalizedWalletAddress),
                    wallet_address: normalizedWalletAddress,
                    chain_id: chainId,
                    cta: "swap",
                  });
                  setIsSwapOpen(true);
                }}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>Swap</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-[11px] font-mono  tracking-wider gap-2"
                onClick={() => {
                  trackEvent("dashboard_send_open_click", {
                    source,
                    wallet_connected: Boolean(normalizedWalletAddress),
                    wallet_address: normalizedWalletAddress,
                    chain_id: chainId,
                  });
                  setIsSendOpen(true);
                }}
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-0">
        <div
          aria-hidden={!hasWallet}
          className={cn(
            "flex flex-col flex-1 min-h-0",
            !hasWallet &&
              "pointer-events-none select-none blur-[5px] opacity-60 bg-background"
          )}
        >
          <div
            className={cn(
              "px-4  flex-1 min-h-[240px]",
              hasWallet ? "lg:min-h-[220px]" : "lg:min-h-[280px]"
            )}
          >
            <div className="relative h-full w-full">
              <div className="absolute left-0 top-0 z-10">
                <div className="flex items-baseline gap-2">
                  <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums leading-none">
                    <NumberTicker
                      value={glowWorthGlw}
                      decimalPlaces={0}
                      className="tracking-tight"
                    />
                  </div>
                  <span className="text-base sm:text-lg font-mono font-semibold text-zinc-500">
                    GLW
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="h-7 px-2.5 rounded-lg font-mono text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                    +
                    {weeklyAccumulatedGlw.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    GLW
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    accumulated this week
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 74, right: 10, left: 10, bottom: 4 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeOpacity={0.16}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="week"
                    ticks={monthTicks}
                    padding={{ left: 14, right: 14 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
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
                    cursor={{ stroke: "var(--border)", strokeOpacity: 0.35 }}
                    content={GlowWorthChartTooltip}
                  />
                  <defs>
                    <pattern
                      id="glowWorthDots"
                      x="0"
                      y="0"
                      width="7"
                      height="7"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle
                        cx="5"
                        cy="5"
                        r="1.5"
                        fill={GLOW_GREEN}
                        opacity={0.45}
                      />
                    </pattern>
                  </defs>
                  <Area
                    type="natural"
                    dataKey="glw"
                    stroke={GLOW_GREEN}
                    strokeWidth={1.25}
                    fill="url(#glowWorthDots)"
                    fillOpacity={0.9}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {!hasWallet ? (
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-center max-w-xs mx-auto">
              <div className="mt-1 text-sm text-muted-foreground">
                Connect your wallet to Begin.
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

      <SwapDialog
        open={isSwapOpen}
        onOpenChange={handleSwapOpenChange}
        headlineStats={headlineStats}
        ethPriceInUSD={ethPriceInUSD}
      />
      <SendDialog open={isSendOpen} onOpenChange={setIsSendOpen} />
    </Card>
  );
}
