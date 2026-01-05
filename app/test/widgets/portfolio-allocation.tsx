"use client";

import * as React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  type TooltipProps as RechartsTooltipProps,
} from "recharts";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  useWalletPortfolio,
  type AllocationItem,
  type PortfolioTokenSymbol,
} from "./use-wallet-portfolio";
import { Button } from "@/components/ui/button";
import { SwapDialog } from "@/components/dialogs/swap-dialog";

const TOKEN_COLORS: Record<PortfolioTokenSymbol, string> = {
  GLW: "#4ADE80",
  ETH: "#C084FC",
  USDC: "#60A5FA",
  USDG: "#F59E0B",
};

function formatTokenAmount(symbol: PortfolioTokenSymbol, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  const maximumFractionDigits = symbol === "ETH" ? 4 : symbol === "GLW" ? 0 : 2;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(amount)} ${symbol}`;
}

function AllocationSkeleton() {
  return (
    <Card className="h-full overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-center">
          <Skeleton className="h-6 w-36 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 p-4">
        <div className="flex flex-1 min-h-0 items-center gap-5 flex-col sm:flex-row sm:items-stretch">
          <div className="flex flex-1 min-h-0 items-center justify-center">
            <Skeleton className="h-[200px] w-[200px] sm:h-[240px] sm:w-[240px] rounded-full shrink-0" />
          </div>
          <div className="w-full max-w-[340px] sm:max-w-[220px]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:block sm:space-y-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-2 rounded-full" />
                    <Skeleton className="h-4 w-14 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-14 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AllocationDatum {
  symbol: PortfolioTokenSymbol;
  name: string;
  usdValue: number;
  amount: number;
}

function AllocationTooltip({
  active,
  payload,
}: RechartsTooltipProps<number, string>) {
  if (!active) return null;
  const point = payload?.[0]?.payload as AllocationDatum | undefined;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-foreground/10 dark:border-zinc-800 bg-popover/95 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
        {point.name}
      </div>
      <div className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
        {formatTokenAmount(point.symbol, point.amount)}
      </div>
    </div>
  );
}

function normalizeAllocations(items: AllocationItem[]) {
  const filtered = items
    .filter((i) => i.amount > 0)
    .sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));

  const chartData: AllocationDatum[] = filtered
    .filter(
      (i) => i.usdValue != null && Number.isFinite(i.usdValue) && i.usdValue > 0
    )
    .map((i) => ({
      symbol: i.symbol,
      name: i.symbol,
      usdValue: i.usdValue as number,
      amount: i.amount,
    }));

  return { legendItems: filtered, chartData };
}

interface PortfolioAllocationWidgetProps {
  walletAddress?: string | null;
  className?: string;
}

export default function PortfolioAllocationWidget({
  walletAddress,
  className,
}: PortfolioAllocationWidgetProps) {
  const {
    hasWallet,
    shouldShowSkeleton,
    showEmptyState,
    allocationItems,
    headlineStats,
    ethPriceInUSD,
  } = useWalletPortfolio({ walletAddress });

  const [isSwapDialogOpen, setIsSwapDialogOpen] = React.useState(false);

  if (shouldShowSkeleton) return <AllocationSkeleton />;

  const { legendItems, chartData } = normalizeAllocations(allocationItems);
  const hasChartData = chartData.length > 0;
  const isEmptyPortfolio = legendItems.length === 0;
  const hasNonGlwTokens = legendItems.some((item) => item.symbol !== "GLW");
  const shouldShowGlwEmptyState = showEmptyState && !hasNonGlwTokens;

  return (
    <Card
      className={cn(
        "h-full overflow-hidden flex flex-col gap-4 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border",
        className
      )}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-center">
          <div className="font-semibold tracking-tight">Portfolio</div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-4">
        <div
          aria-hidden={!hasWallet}
          className={cn(
            "flex flex-1 min-h-0",
            !hasWallet &&
              "pointer-events-none select-none blur-[5px] opacity-60 bg-background"
          )}
        >
          {isEmptyPortfolio ? (
            <div className="flex flex-1 min-h-0 items-center justify-center">
              <div className="mx-auto w-full max-w-[360px] text-center">
                <div className="text-sm font-medium text-foreground">
                  No assets yet
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Buy or receive tokens to see your portfolio.
                </div>
                <div className="mt-4 flex items-center justify-center">
                  <Button
                    onClick={() => setIsSwapDialogOpen(true)}
                    variant="outline"
                  >
                    Swap tokens
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "flex flex-1 min-h-0 items-center gap-5 sm:gap-6",
                "flex-col sm:flex-row sm:items-stretch"
              )}
            >
              <div className="flex flex-1 min-h-0 items-center justify-center">
                <div className="w-[220px] h-[220px] sm:w-[260px] sm:h-[260px] max-w-full max-h-full">
                  {hasChartData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart
                        margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
                      >
                        <defs>
                          <pattern
                            id="glw-stripes"
                            width="10"
                            height="10"
                            patternUnits="userSpaceOnUse"
                            patternTransform="rotate(45)"
                          >
                            <rect
                              width="10"
                              height="10"
                              fill={TOKEN_COLORS.GLW}
                              opacity={0.22}
                            />
                            <rect
                              x="0"
                              y="0"
                              width="5"
                              height="10"
                              fill={TOKEN_COLORS.GLW}
                              opacity={0.9}
                            />
                          </pattern>
                        </defs>

                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius="58%"
                          outerRadius="82%"
                          minAngle={4}
                          paddingAngle={2}
                          dataKey="usdValue"
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                          isAnimationActive
                        >
                          {chartData.map((entry) => {
                            const fill =
                              entry.symbol === "GLW"
                                ? "url(#glw-stripes)"
                                : TOKEN_COLORS[entry.symbol];
                            return (
                              <Cell
                                key={entry.symbol}
                                fill={fill}
                                className="outline-none"
                              />
                            );
                          })}
                        </Pie>
                        <RechartsTooltip content={AllocationTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full rounded-full border border-border/60 bg-muted/10" />
                  )}
                </div>
              </div>

              <div className="w-full sm:w-[220px] shrink-0">
                <div className="mx-auto w-full max-w-[340px] sm:max-w-none">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:block sm:space-y-4">
                    {legendItems.map((item) => {
                      const color = TOKEN_COLORS[item.symbol];
                      return (
                        <div
                          key={item.symbol}
                          className="flex items-start gap-3 min-w-0"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className={cn(
                                "mt-1 h-6 w-2 rounded-full shrink-0"
                              )}
                              style={{
                                backgroundColor: color,
                                opacity: item.symbol === "GLW" ? 0.75 : 0.9,
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm text-foreground">
                                {item.symbol}
                              </div>
                              <div className="text-[11px] text-muted-foreground tabular-nums leading-tight truncate">
                                {formatTokenAmount(item.symbol, item.amount)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {shouldShowGlwEmptyState ? (
                  <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3 text-center">
                    <div className="text-xs text-muted-foreground">
                      No GLW yet.
                    </div>
                    <div className="mt-2 flex items-center justify-center">
                      <Button
                        size="sm"
                        onClick={() => setIsSwapDialogOpen(true)}
                      >
                        Swap for GLW
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <SwapDialog
          open={isSwapDialogOpen}
          onOpenChange={setIsSwapDialogOpen}
          headlineStats={headlineStats}
          ethPriceInUSD={ethPriceInUSD}
        />
      </CardContent>
    </Card>
  );
}
