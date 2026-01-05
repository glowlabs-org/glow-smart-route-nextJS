"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AnimatedCountdownDhms,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import { useLaunchpadStatus } from "@/hooks/useLaunchpadStatus";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { useGlowLaunchpad, useMiningCenter } from "@/hooks";
import { useIsMobile } from "@/hooks/use-mobile";
import { DepositDialog } from "@/app/marketplace/deposit-dialog";
import { SponsoredFarmsActivity } from "@/app/marketplace/sponsored-farms-activity";
import { trackEvent } from "@/lib/telemetry";
import { useAccount } from "wagmi";
import type {
  LaunchpadRewardScore,
  MiningCenterScore,
} from "@/app/marketplace/deposit-dialog";
import { LaunchpadView } from "@/app/marketplace/launchpad-view";
import type { TaggedAuctionApplication } from "@/app/marketplace/launchpad-view";

function formatUsdPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$—";
  const decimals = value < 1 ? 4 : 2;
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
  variant?: "card" | "full-row";
}

export default function LaunchpadStatusWidget({
  className,
  forcedType,
  variant = "card",
}: LaunchpadStatusWidgetProps) {
  const { address, isConnected } = useAccount();
  const walletAddress = address?.toLowerCase() ?? null;
  const source = "launchpad_status_widget";
  const queryClient = useQueryClient();
  const { isLive, nextBatchAtMs, refreshNextBatchAtMs, isLoading, isError } =
    useLaunchpadStatus();
  const { spotPriceUsd } = useGlowSpotPriceSummary();
  const isMobile = useIsMobile();
  const isFullRow = variant === "full-row";

  type ListTypeFilter = "all" | "delegations" | "miners" | "activity";
  const [liveTypeFilter, setLiveTypeFilter] = React.useState<ListTypeFilter>(
    () => (variant === "full-row" ? "all" : "delegations")
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
  const shouldShowAllTab = variant === "full-row" && availableTypesCount > 1;

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

  const [depositOpen, setDepositOpen] = React.useState(false);
  const [selectedApplicationForDeposit, setSelectedApplicationForDeposit] =
    React.useState<TaggedAuctionApplication | null>(null);
  const [selectedRewardScore, setSelectedRewardScore] = React.useState<
    LaunchpadRewardScore | MiningCenterScore | null
  >(null);

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
      trackEvent("dashboard_launchpad_deposit_open_click", {
        source,
        wallet_connected: isConnected,
        wallet_address: walletAddress,
        application_id: application.id,
        listing_type: application._type,
        payment_currency: application._type === "miners" ? "USDC" : "GLW",
      });
      setSelectedApplicationForDeposit(application);
      setSelectedRewardScore(scoreData ?? null);
      setDepositOpen(true);
    },
    [isConnected, source, walletAddress]
  );

  const handleDepositOpenChange = React.useCallback((nextOpen: boolean) => {
    setDepositOpen(nextOpen);
    if (nextOpen) return;
    setSelectedApplicationForDeposit(null);
    setSelectedRewardScore(null);
  }, []);

  return (
    <Card
      className={cn(
        isFullRow
          ? "flex flex-col overflow-hidden bg-card dark:bg-muted/20 border-border shadow-sm gap-2 pt-2"
          : cn(
              "flex flex-col overflow-hidden bg-card dark:bg-muted/20 border-border shadow-sm gap-2 pt-2",
              isMobile ? "min-h-[620px]" : "h-full"
            ),
        // full-row stays stacked (header above carousel/content)
        className
      )}
    >
      <CardHeader
        className={cn(
          "pb-0",
          isFullRow
            ? "px-3 py-0 border-b border-border/40 [.border-b]:pb-2"
            : null
        )}
      >
        <div
          className={cn(
            "flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between",
            isFullRow ? "min-h-0" : null
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle
              className={cn(
                "tracking-tight",
                isFullRow ? "text-xl" : "text-base"
              )}
            >
              {isLive ? "Glow Launchpad" : "New Solar Farm Listing In..."}
            </CardTitle>
          </div>

          {isLive ? (
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
                          "rounded-full data-[state=active]:bg-[#C084FC]/15 data-[state=active]:text-foreground",
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
            <div
              className={cn(
                "shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-muted/10",
                isFullRow ? "px-2 py-0.5" : "px-3 py-1"
              )}
            >
              <span className="text-xs font-mono font-medium text-foreground tabular-nums">
                GLW {priceLabel}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          "min-h-0 flex-1 flex flex-col",
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
            <ScrollArea className="min-h-0 flex-1">
              <SponsoredFarmsActivity />
            </ScrollArea>
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
              className={cn("min-h-0 flex-1", isMobile ? "px-4 pb-6" : null)}
            >
              {isMobile ? (
                <LaunchpadView
                  variant="widget"
                  typeFilter={launchpadTypeFilter}
                  widgetLayout="carousel"
                  widgetCarouselVariant="compact"
                  onPayDeposit={handlePayDeposit}
                />
              ) : (
                <ScrollArea className="min-h-0 flex-1">
                  <div className="px-5 pb-5">
                    <LaunchpadView
                      variant="widget"
                      typeFilter={launchpadTypeFilter}
                      widgetLayout="stack"
                      onPayDeposit={handlePayDeposit}
                    />
                  </div>
                </ScrollArea>
              )}
            </div>
          )
        ) : (
          // --- COUNTDOWN STATE ---
          <div
            className={cn(
              "flex-1 flex flex-col",
              variant === "full-row" ? "p-0" : "px-5 pb-5"
            )}
          >
            {/* Big Countdown Hero */}
            <div className="flex-1 flex flex-col items-center justify-center py-2">
              <div className="font-mono font-bold tracking-tighter tabular-nums text-foreground">
                <div className="sm:hidden text-3xl">
                  <AnimatedCountdownDhms remainingMs={remainingMs} size="sm" />
                </div>
                <div className="hidden sm:block text-5xl">
                  <AnimatedCountdownDhms remainingMs={remainingMs} size="xl" />
                </div>
              </div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-2 opacity-60">
                Time Remaining
              </p>
            </div>

            {/* Prep Section */}
            <div className="mt-auto space-y-4">
              <div className="bg-muted/20 rounded-xl p-3.5 flex gap-3 items-start border border-border/50">
                <div className="shrink-0 mt-0.5 p-1.5 bg-glow-orange/10 rounded-full">
                  <Sparkles className="size-3.5 text-glow-orange" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xl font-semibold text-foreground">
                    Have your GLW ready to delegate.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every Tuesday at 1 PM EST, Glow lists at least one new solar
                    farm for crowdfunding. Users can delegate GLW tokens to help
                    fund the farm, support real-world impact, and earn GLW
                    tokens weekly for 100 weeks for contributing to the network.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedApplicationForDeposit?._type === "miners" ? (
          <DepositDialog
            open={depositOpen}
            onOpenChange={handleDepositOpenChange}
            application={selectedApplicationForDeposit}
            selectedCurrency="USDC"
            rewardScore={selectedRewardScore as MiningCenterScore | null}
          />
        ) : (
          <DepositDialog
            open={depositOpen}
            onOpenChange={handleDepositOpenChange}
            application={selectedApplicationForDeposit}
            selectedCurrency="GLW"
            rewardScore={selectedRewardScore as LaunchpadRewardScore | null}
          />
        )}
      </CardContent>
    </Card>
  );
}
