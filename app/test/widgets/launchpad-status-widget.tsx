"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, ShoppingCart } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AnimatedCountdownDhms,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import { useLaunchpadStatus } from "@/hooks/useLaunchpadStatus";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { useGlowLaunchpad, useMiningCenter } from "@/hooks";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { SponsoredFarmsActivity } from "@/app/marketplace/sponsored-farms-activity";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { trackEvent } from "@/lib/telemetry";
import { useAccount } from "wagmi";
import Link from "next/link";
import { CashMinerIcon, DelegationIcon } from "@/components/impact-icons";
import type {
  LaunchpadRewardScore,
  MiningCenterScore,
} from "@/app/marketplace/deposit-dialog";
import { LaunchpadView } from "@/app/marketplace/launchpad-view";
import type { TaggedAuctionApplication } from "@/app/marketplace/launchpad-view";

function formatUsdPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$—";
  const decimals = value < 1 ? 3 : 2;
  return `$${value.toFixed(decimals)}`;
}

function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function countAvailableApplications(
  applications: Array<{
    activeFraction: { isFilled: boolean; remainingSteps: number | null } | null;
  }>
) {
  return applications.reduce((count, app) => {
    const fraction = app.activeFraction;
    if (!fraction) return count;
    const remainingSteps = fraction.remainingSteps ?? 0;
    const hasAvailability = !fraction.isFilled && remainingSteps > 0;
    return hasAvailability ? count + 1 : count;
  }, 0);
}

interface LaunchpadStatusWidgetProps {
  className?: string;
  forcedType?: "delegations" | "miners";
  variant?: "card" | "full-row" | "flow" | "minimal";
  isApproaching?: boolean;
  onPayDeposit?: (
    application: TaggedAuctionApplication,
    scoreData?: LaunchpadRewardScore | MiningCenterScore | null
  ) => void;
}

export default function LaunchpadStatusWidget({
  className,
  forcedType,
  variant = "card",
  isApproaching = false,
  onPayDeposit,
}: LaunchpadStatusWidgetProps) {
  const { address, isConnected } = useAccount();
  const walletAddress = address?.toLowerCase() ?? null;
  const source = "launchpad_status_widget";
  const queryClient = useQueryClient();
  const { isLive, nextBatchAtMs, refreshNextBatchAtMs, isLoading, isError } =
    useLaunchpadStatus();
  const { spotPriceUsd } = useGlowSpotPriceSummary();
  const { usdcBalance } = useWalletTokenBalances(address);
  const isMobile = useIsMobile();
  const isFullRow = variant === "full-row";
  const isFlow = variant === "flow";
  const isMinimal = variant === "minimal";

  const ONE_HOUR_MS = 60 * 60 * 1000;
  const internalIsApproaching = React.useMemo(() => {
    if (isLive) return false;
    const now = Date.now();
    const timeUntilLive = nextBatchAtMs - now;
    return timeUntilLive > 0 && timeUntilLive <= ONE_HOUR_MS;
  }, [isLive, nextBatchAtMs]);

  const effectiveIsApproaching = isApproaching || internalIsApproaching;

  type ListTypeFilter = "all" | "delegations" | "miners" | "activity";
  const [liveTypeFilter, setLiveTypeFilter] = React.useState<ListTypeFilter>(
    () => "all"
  );

  const shouldForceType = forcedType != null;
  const delegationsEnabled =
    isLive && (!shouldForceType || forcedType === "delegations");
  const minersEnabled = isLive && (!shouldForceType || forcedType === "miners");

  const {
    applications: delegationApplications,
    isLoading: isDelegationsLoading,
  } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
    enabled: delegationsEnabled,
  });
  const { applications: minerApplications, isLoading: isMinersLoading } =
    useMiningCenter({
      filters: { paymentCurrency: "USDC" },
      enabled: minersEnabled,
    });

  const delegationsAvailableCount = React.useMemo(
    () => countAvailableApplications(delegationApplications),
    [delegationApplications]
  );
  const minersAvailableCount = React.useMemo(
    () => countAvailableApplications(minerApplications),
    [minerApplications]
  );
  const hasDelegationsAvailable = delegationsAvailableCount > 0;
  const hasMinersAvailable = minersAvailableCount > 0;
  const availableTypesCount =
    Number(hasDelegationsAvailable) + Number(hasMinersAvailable);
  const shouldShowAllTab = availableTypesCount > 1;

  const resolvedTab = React.useMemo((): ListTypeFilter => {
    if (!isLive) return liveTypeFilter;
    if (liveTypeFilter === "activity") return "activity";
    if (shouldForceType) return forcedType!;
    if (liveTypeFilter === "all" && !shouldShowAllTab)
      return hasDelegationsAvailable ? "delegations" : "miners";
    if (liveTypeFilter === "delegations" && !hasDelegationsAvailable)
      return hasMinersAvailable ? "miners" : "all";
    if (liveTypeFilter === "miners" && !hasMinersAvailable)
      return hasDelegationsAvailable ? "delegations" : "all";
    return liveTypeFilter;
  }, [
    forcedType,
    hasDelegationsAvailable,
    hasMinersAvailable,
    isLive,
    liveTypeFilter,
    shouldForceType,
    shouldShowAllTab,
  ]);

  const launchpadTypeFilter = React.useMemo(():
    | "all"
    | "delegations"
    | "miners" => {
    if (resolvedTab === "activity")
      return hasDelegationsAvailable ? "delegations" : "miners";
    return resolvedTab;
  }, [hasDelegationsAvailable, resolvedTab]);

  const [buyGlowOpen, setBuyGlowOpen] = React.useState(false);

  const handleCountdownComplete = React.useCallback(() => {
    refreshNextBatchAtMs();
    void (async () => {
      try {
        await queryClient.refetchQueries({ queryKey: ["sponsor-listings"] });
      } catch {}
    })();
  }, [queryClient, refreshNextBatchAtMs]);

  const remainingMs = useCountdownTo({
    targetAtMs: nextBatchAtMs,
    onComplete: handleCountdownComplete,
  });

  const priceLabel = React.useMemo(
    () => formatUsdPrice(spotPriceUsd),
    [spotPriceUsd]
  );

  const handlePayDeposit = React.useCallback(
    (
      application: TaggedAuctionApplication,
      scoreData?: LaunchpadRewardScore | MiningCenterScore | null
    ) => {
      onPayDeposit?.(application, scoreData);
    },
    [onPayDeposit]
  );

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden min-w-0 gap-2 pt-0 w-full",
        isMinimal
          ? "bg-transparent border-transparent h-full"
          : isFlow
          ? "bg-card/30 border-foreground/5 min-h-[380px]"
          : isFullRow
          ? "bg-card dark:bg-muted/20 border-foreground/10 dark:border-border"
          : cn(
              "bg-card dark:bg-muted/20 border-foreground/10 dark:border-border",
              isMobile ? "min-h-[620px]" : "h-full"
            ),
        className
      )}
    >
      <CardHeader
        className={cn(
          "pb-0",
          isFullRow
            ? "px-3 pt-3 pb-0 border-b border-border/40 [.border-b]:pb-2"
            : "pt-4"
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            !isLive ? "items-center" : "items-start",
            isFullRow ? "min-h-0" : null
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle
              className={cn(
                "tracking-tight text-foreground",
                isFullRow
                  ? "text-xl font-semibold"
                  : "text-lg font-semibold tracking-tight text-foreground"
              )}
            >
              {isLive
                ? "Glow Launchpad"
                : effectiveIsApproaching
                ? "Launchpad Opening Soon"
                : "New Solar Farm Listing In..."}
            </CardTitle>
          </div>

          {isLive && variant === "full-row" ? (
            <Tabs
              value={resolvedTab}
              onValueChange={(v) => {
                trackEvent("dashboard_launchpad_tab_change", {
                  source,
                  wallet_connected: isConnected,
                  wallet_address: walletAddress,
                  tab: v,
                });
                setLiveTypeFilter(v as ListTypeFilter);
              }}
              className="w-full shrink-0 sm:w-auto"
            >
              <TabsList
                className={cn(
                  "rounded-full border border-border bg-muted/10 p-1",
                  "h-10 sm:h-12",
                  "w-full sm:w-auto",
                  "justify-start overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                )}
              >
                {shouldForceType ? (
                  <TabsTrigger
                    value={forcedType}
                    className={cn(
                      "rounded-full data-[state=active]:bg-background/40 data-[state=active]:text-foreground",
                      isFullRow ? "px-2 h-5 text-[10px]" : "px-3 h-7 text-xs"
                    )}
                  >
                    {forcedType === "delegations" ? "Delegations" : "Miners"}{" "}
                    <span className="ml-1 font-mono tabular-nums text-[10px] opacity-70">
                      {forcedType === "delegations"
                        ? isDelegationsLoading
                          ? "…"
                          : delegationsAvailableCount
                        : isMinersLoading
                        ? "…"
                        : minersAvailableCount}
                    </span>
                  </TabsTrigger>
                ) : (
                  <>
                    {shouldShowAllTab ? (
                      <TabsTrigger
                        value="all"
                        className={cn(
                          "rounded-full data-[state=active]:bg-background/40 data-[state=active]:text-foreground",
                          isFullRow
                            ? "px-2 h-5 text-[10px]"
                            : "px-3 h-7 text-xs"
                        )}
                      >
                        All{" "}
                        <span className="ml-1 font-mono tabular-nums text-[10px] opacity-70">
                          {isDelegationsLoading || isMinersLoading
                            ? "…"
                            : delegationsAvailableCount + minersAvailableCount}
                        </span>
                      </TabsTrigger>
                    ) : null}
                    {hasDelegationsAvailable ? (
                      <TabsTrigger
                        value="delegations"
                        className={cn(
                          "rounded-full data-[state=active]:bg-delegation-purple/15 data-[state=active]:text-foreground",
                          isFullRow
                            ? "px-2 h-5 text-[10px]"
                            : "px-3 h-7 text-xs"
                        )}
                      >
                        Delegations{" "}
                        <span className="ml-1 font-mono tabular-nums text-[10px] opacity-70">
                          {isDelegationsLoading
                            ? "…"
                            : delegationsAvailableCount}
                        </span>
                      </TabsTrigger>
                    ) : null}
                    {hasMinersAvailable ? (
                      <TabsTrigger
                        value="miners"
                        className={cn(
                          "rounded-full data-[state=active]:bg-primary/15 data-[state=active]:text-foreground",
                          isFullRow
                            ? "px-2 h-5 text-[10px]"
                            : "px-3 h-7 text-xs"
                        )}
                      >
                        Miners{" "}
                        <span className="ml-1 font-mono tabular-nums text-[10px] opacity-70">
                          {isMinersLoading ? "…" : minersAvailableCount}
                        </span>
                      </TabsTrigger>
                    ) : null}
                  </>
                )}

                <TabsTrigger
                  value="activity"
                  className={cn(
                    "rounded-full data-[state=active]:bg-background/40 data-[state=active]:text-foreground",
                    isFullRow ? "px-2 h-5 text-[10px]" : "px-3 h-7 text-xs"
                  )}
                >
                  Activity
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                trackEvent("launchpad_widget_buy_glw_click", {
                  source,
                  wallet_connected: isConnected,
                  wallet_address: walletAddress,
                });
                setBuyGlowOpen(true);
              }}
              className={cn(
                "shrink-0 rounded-full border-border ",
                "h-9 px-4 text-sm"
              )}
            >
              <ShoppingCart
                className={cn("mr-1.5", isFullRow ? "h-3 w-3" : "h-4 w-4")}
              />
              Buy GLW
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          "min-h-0 min-w-0 w-full flex-1 flex flex-col overflow-hidden",
          variant === "full-row"
            ? resolvedTab === "activity"
              ? "p-0"
              : "pt-3 pb-4"
            : "p-0"
        )}
      >
        {isLoading ? (
          <div
            className={cn(
              "space-y-4",
              variant === "full-row" ? "p-0" : "py-4 px-5 pb-5"
            )}
          >
            <Skeleton className="h-16 w-3/4 mx-auto rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center text-center gap-2",
              variant === "full-row" ? "p-0" : "px-5 pb-5"
            )}
          >
            <div className="text-sm text-muted-foreground">
              Status currently unavailable.
            </div>
          </div>
        ) : isLive ? (
          // --- LIVE STATE ---
          resolvedTab === "activity" ? (
            <div
              className={cn(
                "min-w-0 w-full overflow-y-auto overflow-x-hidden",
                isMobile ? "h-[min(55vh,520px)]" : "min-h-0 flex-1"
              )}
            >
              <SponsoredFarmsActivity variant="widget" />
            </div>
          ) : variant === "full-row" ? (
            <div className="min-h-0 flex-1">
              <LaunchpadView
                variant="widget"
                typeFilter={launchpadTypeFilter}
                widgetLayout="carousel"
                widgetCarouselVariant="hero"
                onPayDeposit={handlePayDeposit}
              />
            </div>
          ) : (
            <div
              className={cn(
                "min-h-0 flex-1 flex flex-col",
                isMobile ? "px-4 pb-6" : "px-5 pb-5"
              )}
            >
              <div className="flex flex-col gap-3 h-full">
                <Link
                  href="https://glow.org/blog/guide-to-delegating-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-delegation-purple/50 flex-1 flex flex-col justify-center"
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      topic: "delegation",
                      url: "https://glow.org/blog/guide-to-delegating-glow",
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 transition-colors group-hover:border-delegation-purple/30">
                      <DelegationIcon className="h-6 w-6 text-foreground group-hover:text-delegation-purple transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-foreground transition-colors group-hover:text-delegation-purple">
                        Guide to Delegation
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        Delegate your GLW tokens to specific solar farms. If the
                        farm is efficient, you earn yield. If it underperforms,
                        you may forfeit tokens.
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-delegation-purple/80 transition-colors flex items-center gap-1">
                        Learn more <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </div>
                </Link>

                <Link
                  href="https://glow.org/blog/guide-to-glow-mining"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-[color:var(--color-miner)]/50 flex-1 flex flex-col justify-center"
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      topic: "mining",
                      url: "https://glow.org/blog/guide-to-glow-mining",
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 transition-colors group-hover:border-[color:var(--color-miner)]/30">
                      <CashMinerIcon className="h-6 w-6 text-foreground group-hover:text-[color:var(--color-miner)] transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-foreground transition-colors group-hover:text-[color:var(--color-miner-contrast)]">
                        How Mining Works
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        Buy "miners" (digital solar representations) with USDC.
                        They produce GLW tokens for 99 weeks based on real-world
                        electricity generation.
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-[color:var(--color-miner-contrast)]/80 transition-colors flex items-center gap-1">
                        Learn more <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          )
        ) : effectiveIsApproaching ? (
          // --- APPROACHING STATE (within 1h of launch) ---
          isFullRow ? (
            // Full-row: show countdown bar + educational cards
            <div className="flex-1 flex flex-col gap-6">
              {/* Countdown Bar */}
              <div className="flex items-center justify-center gap-4 py-4 px-6 bg-muted/10 rounded-xl border border-border/50">
                <div className="text-sm font-medium text-muted-foreground">
                  New listings in
                </div>
                <div className="font-mono font-bold tracking-tighter tabular-nums text-foreground">
                  <div className="sm:hidden">
                    <AnimatedCountdownDhms
                      remainingMs={remainingMs}
                      size="sm"
                      showLabels
                    />
                  </div>
                  <div className="hidden sm:block">
                    <AnimatedCountdownDhms
                      remainingMs={remainingMs}
                      size="md"
                      showLabels
                    />
                  </div>
                </div>
              </div>

              {/* Educational Cards Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-1">
                <Link
                  href="https://glow.org/blog/guide-to-delegating-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-delegation-purple/50 flex flex-col justify-center"
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      topic: "delegation",
                      url: "https://glow.org/blog/guide-to-delegating-glow",
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 transition-colors group-hover:border-delegation-purple/30">
                      <DelegationIcon className="h-6 w-6 text-foreground group-hover:text-delegation-purple transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-foreground transition-colors group-hover:text-delegation-purple">
                        Guide to Delegation
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        Delegate your GLW tokens to specific solar farms. If the
                        farm is efficient, you earn yield. If it underperforms,
                        you may forfeit tokens.
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-delegation-purple/80 transition-colors flex items-center gap-1">
                        Learn more <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </div>
                </Link>

                <Link
                  href="https://glow.org/blog/guide-to-glow-mining"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-[color:var(--color-miner)]/50 flex flex-col justify-center"
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      topic: "mining",
                      url: "https://glow.org/blog/guide-to-glow-mining",
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 transition-colors group-hover:border-[color:var(--color-miner)]/30">
                      <CashMinerIcon className="h-6 w-6 text-foreground group-hover:text-[color:var(--color-miner)] transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-foreground transition-colors group-hover:text-[color:var(--color-miner-contrast)]">
                        How Mining Works
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        Buy "miners" (digital solar representations) with USDC.
                        They produce GLW tokens for 99 weeks based on real-world
                        electricity generation.
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-[color:var(--color-miner-contrast)]/80 transition-colors flex items-center gap-1">
                        Learn more <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          ) : (
            // Non-full-row (minimal): show educational UI only (no countdown - full-row shows it)
            <div
              className={cn(
                "min-h-0 flex-1 flex flex-col",
                isMobile ? "px-4 pb-6" : "px-5 pb-5"
              )}
            >
              <div className="flex flex-col gap-3 h-full">
                <Link
                  href="https://glow.org/blog/guide-to-delegating-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-delegation-purple/50 flex-1 flex flex-col justify-center"
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      topic: "delegation",
                      url: "https://glow.org/blog/guide-to-delegating-glow",
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 transition-colors group-hover:border-delegation-purple/30">
                      <DelegationIcon className="h-6 w-6 text-foreground group-hover:text-delegation-purple transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-foreground transition-colors group-hover:text-delegation-purple">
                        Guide to Delegation
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        Delegate your GLW tokens to specific solar farms. If the
                        farm is efficient, you earn yield. If it underperforms,
                        you may forfeit tokens.
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-delegation-purple/80 transition-colors flex items-center gap-1">
                        Learn more <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </div>
                </Link>

                <Link
                  href="https://glow.org/blog/guide-to-glow-mining"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-[color:var(--color-miner)]/50 flex-1 flex flex-col justify-center"
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      topic: "mining",
                      url: "https://glow.org/blog/guide-to-glow-mining",
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 transition-colors group-hover:border-[color:var(--color-miner)]/30">
                      <CashMinerIcon className="h-6 w-6 text-foreground group-hover:text-[color:var(--color-miner)] transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-foreground transition-colors group-hover:text-[color:var(--color-miner-contrast)]">
                        How Mining Works
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        Buy "miners" (digital solar representations) with USDC.
                        They produce GLW tokens for 99 weeks based on real-world
                        electricity generation.
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-[color:var(--color-miner-contrast)]/80 transition-colors flex items-center gap-1">
                        Learn more <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          )
        ) : (
          // --- COUNTDOWN STATE (not approaching, more than 1h away) ---
          <div
            className={cn(
              "flex-1 flex flex-col gap-6",
              variant === "full-row" ? "p-0" : "px-5 pb-5"
            )}
          >
            {/* Big Countdown Hero */}
            <div className="flex-1 flex flex-col items-center justify-center py-2 gap-6">
              <div className="font-mono font-bold tracking-tighter tabular-nums text-foreground">
                <div className="sm:hidden text-3xl">
                  <AnimatedCountdownDhms
                    remainingMs={remainingMs}
                    size="sm"
                    showLabels
                  />
                </div>
                <div className="hidden sm:block text-5xl">
                  <AnimatedCountdownDhms
                    remainingMs={remainingMs}
                    size="xl"
                    showLabels
                  />
                </div>
              </div>
            </div>

            {/* Prep Section */}
            <div className="mt-auto space-y-4">
              <div className="bg-muted/20 rounded-xl p-4 flex gap-4 border border-border/50 flex-col sm:flex-row text-center sm:text-left">
                {/* GLW Price - styled like the icon box in gctl widget */}
                <div className="shrink-0 flex flex-col items-center justify-center p-3 rounded-xl bg-background/50 border border-border/60 min-w-[100px] gap-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    GLW
                  </span>
                  <span className="text-xl font-mono font-bold text-foreground tabular-nums tracking-tight">
                    {priceLabel}
                  </span>
                </div>

                <div className="flex-1 space-y-1 py-0.5">
                  <p className="text-base font-semibold text-foreground">
                    Have your GLW ready to delegate.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every Tuesday at 1 PM EST, Glow lists at least one new solar
                    farm for crowdfunding. Users can delegate GLW tokens to help
                    fund the farm, support real-world impact, and earn GLW
                    tokens weekly for 100 weeks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <BuyGlowDialog
          open={buyGlowOpen}
          onOpenChange={setBuyGlowOpen}
          usdcBalance={usdcBalance ?? null}
          glowSpotPrice={spotPriceUsd}
          source="launchpad_status_widget"
          onSuccess={() => {
            void (async () => {
              try {
                await queryClient.refetchQueries({
                  queryKey: ["sponsor-listings"],
                });
              } catch {}
            })();
          }}
        />
      </CardContent>
    </Card>
  );
}
