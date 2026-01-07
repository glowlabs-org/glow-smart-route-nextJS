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
import { ArrowLeftRight, ArrowUpRight, ListTree, Send } from "lucide-react";
import { useAccount, useChainId } from "wagmi";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/connect-button";
import { Skeleton } from "@/components/ui/skeleton";
import { SwapDialog } from "@/components/dialogs/swap-dialog";
import { SendDialog } from "@/components/send-dialog";
import {
  GlowWorthBreakdownDialog,
  type GlowWorthBreakdown,
} from "@/components/dialogs/glow-worth-breakdown-dialog";
import { cn } from "@/lib/utils";
import { weekToTimestamp } from "@/lib/rewards/weekly-delegations";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { trackEvent } from "@/lib/telemetry";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { GlowSymbol } from "@/components/glow-symbol";

import OnboardingHeroWidget from "./onboarding-hero-widget";
import {
  useWalletPortfolio,
  type GlowWorthPoint,
} from "./use-wallet-portfolio";

const GLOW_GREEN = "#4ADE80";
const DEFINED_POOL_ACTIVITY_URL =
  "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";

const TOKEN_ICON_SRC_BY_SYMBOL = {
  ETH: "/images/tokens/eth.svg",
  USDC: "/images/tokens/usdc.svg",
} as const;

const HOLDING_FALLBACK_BY_SYMBOL = {
  GLW: {
    letter: "G",
    bgClassName: "bg-emerald-500/20",
    ringClassName: "ring-emerald-500/30",
    textClassName: "text-emerald-500",
  },
  USDG: {
    letter: "U",
    bgClassName: "bg-cyan-500/20",
    ringClassName: "ring-cyan-500/30",
    textClassName: "text-cyan-500",
  },
} as const;

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function HoldingIcon(props: { symbol: "ETH" | "GLW" | "USDC" | "USDG" }) {
  const { symbol } = props;

  if (symbol === "GLW") {
    return (
      <div className="h-6 w-6 rounded-full bg-muted border border-foreground/10 flex items-center justify-center">
        <GlowSymbol className="h-4 w-4" />
      </div>
    );
  }

  const iconSrc =
    symbol === "ETH" || symbol === "USDC"
      ? TOKEN_ICON_SRC_BY_SYMBOL[symbol]
      : null;

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={`${symbol} token`}
        className="h-6 w-6 rounded-full"
        draggable={false}
      />
    );
  }

  const fallback =
    symbol === "USDG" ? HOLDING_FALLBACK_BY_SYMBOL[symbol] : null;
  const letter = fallback?.letter ?? symbol.slice(0, 1);

  return (
    <div
      className={cn(
        "h-6 w-6 rounded-full ring-1 flex items-center justify-center",
        fallback?.bgClassName ?? "bg-muted/30",
        fallback?.ringClassName ?? "ring-foreground/15"
      )}
    >
      <span
        className={cn(
          "text-[11px] font-mono font-bold leading-none",
          fallback?.textClassName ?? "text-foreground/90"
        )}
      >
        {letter}
      </span>
    </div>
  );
}

function formatHoldingAmount(
  symbol: "ETH" | "GLW" | "USDC" | "USDG",
  value: number
) {
  if (!Number.isFinite(value) || value <= 0) return "0";

  if (symbol === "ETH") {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: value < 1 ? 0 : 2,
      maximumFractionDigits: value < 1 ? 4 : 2,
    });
  }

  if (symbol === "GLW") {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: value < 100 ? 2 : 0,
      maximumFractionDigits: value < 100 ? 2 : 0,
    });
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
    <div className="rounded-xl border border-foreground/10 dark:border-zinc-800 bg-popover/95 px-3 py-2 shadow-xl">
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
  const { address: connectedAddress } = useAccount();
  const [isSwapOpen, setIsSwapOpen] = React.useState(false);
  const [isSendOpen, setIsSendOpen] = React.useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = React.useState(false);
  // Removed isBuyOpen state since button is gone
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "net_worth_widget";

  const {
    hasWallet,
    shouldShowSkeleton,
    showEmptyState,
    headlineStats,
    ethPriceInUSD,
    glowWorthGlw,
    glowWorthBreakdown,
    weeklyAccumulatedGlw,
    chartData,
    yDomain,
    holdings,
  } = useWalletPortfolio({ walletAddress });

  const buyWalletAddress = connectedAddress ?? walletAddress ?? null;
  const { usdcBalance } = useWalletTokenBalances(buyWalletAddress, {
    enabled: Boolean(buyWalletAddress),
  });
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();

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

  const holdingsRows = React.useMemo(() => {
    const bySymbol = new Map(
      holdings.map((h) => [h.symbol, h.amount] as const)
    );
    return (["GLW", "ETH", "USDC", "USDG"] as const).map((symbol) => ({
      symbol,
      amount: bySymbol.get(symbol) ?? 0,
    }));
  }, [holdings]);

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

  const breakdownForDialog = glowWorthBreakdown
    ? ({
        glowWorthGlw: glowWorthBreakdown.glowWorthGlw,
        liquidGlw: glowWorthBreakdown.liquidGlw,
        delegatedActiveGlw: glowWorthBreakdown.delegatedActiveGlw,
        unclaimedGlwRewards: glowWorthBreakdown.unclaimedGlwRewards,
      } satisfies GlowWorthBreakdown)
    : null;

  return (
    <Card className="h-full min-h-[420px] lg:min-h-0 overflow-hidden flex flex-col gap-2 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border pt-4">
      <CardHeader className="py-0 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
            Glow Worth
          </div>

          <div className="flex items-center gap-2">
            {hasWallet ? (
              <button
                type="button"
                className="group h-8 inline-flex items-center gap-2 rounded-full px-3 text-[11px] font-mono tracking-wider backdrop-blur-sm border-2 border-border hover:bg-foreground hover:text-background transition-all duration-300 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                <span>Breakdown</span>
              </button>
            ) : null}

            <a
              href={DEFINED_POOL_ACTIVITY_URL}
              target="_blank"
              rel="noreferrer"
              className="group h-8 inline-flex items-center gap-2 rounded-full px-3 text-xs md:text-[11px] font-mono tracking-wider backdrop-blur-sm border-2 border-border hover:bg-foreground hover:text-background transition-all duration-300 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span>Pool Activity</span>
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
              "pointer-events-none select-none blur-[5px] opacity-60 bg-background"
          )}
        >
          <div className="flex flex-1 min-h-[240px] lg:min-h-0">
            <div className="flex flex-col sm:flex-row flex-1 min-h-0">
              {/* Left Side: Chart */}
              <div
                className={cn(
                  "px-4 lg:pr-1 flex-1 min-h-0",
                  hasWallet ? "pb-1" : ""
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
                      <Badge className="h-7 px-2.5 rounded-lg font-mono text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/15 transition-colors">
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
                      margin={{ top: 74, right: 10, left: 10, bottom: 0 }}
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
                        strokeWidth={1.5}
                        fill="url(#glowWorthDots)"
                        fillOpacity={0.9}
                        dot={false}
                        activeDot={{
                          r: 4,
                          strokeWidth: 2,
                          stroke: "var(--background)",
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right Side: Holdings Rail (Expanded) */}
              <div className="shrink-0 border-t border-foreground/10 sm:border-t-0 sm:border-l sm:border-foreground/10 px-6 sm:px-5 pb-4 sm:pb-3 pt-4 md:pt-0 sm:w-[240px] flex flex-col">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 mb-2">
                  Your Wallet
                </div>

                <div className="flex-1 flex flex-col justify-center gap-3">
                  {holdingsRows.map((row) => {
                    const displayValue = formatHoldingAmount(
                      row.symbol,
                      row.amount
                    );

                    return (
                      <div
                        key={row.symbol}
                        className="grid grid-cols-[28px_1fr_auto] items-center gap-3 group cursor-default py-1"
                      >
                        <div className="w-[28px] flex items-center justify-center">
                          <HoldingIcon symbol={row.symbol} />
                        </div>
                        <div className="text-sm font-mono text-muted-foreground group-hover:text-foreground/80 transition-colors">
                          {row.symbol}
                        </div>
                        <div className="text-sm font-mono font-medium tabular-nums text-foreground/90 max-w-[140px] truncate text-right">
                          {displayValue}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasWallet ? (
                  <div className="mt-auto pt-4 pb-1">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full px-3 text-[11px] font-mono tracking-wider gap-2 bg-background/50 backdrop-blur-sm w-full"
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
                        <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Swap</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full px-3 text-[11px] font-mono tracking-wider gap-2 bg-background/50 backdrop-blur-sm w-full"
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
                        <Send className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Send</span>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
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
      <GlowWorthBreakdownDialog
        open={isBreakdownOpen}
        onOpenChange={setIsBreakdownOpen}
        breakdown={breakdownForDialog}
      />
    </Card>
  );
}
