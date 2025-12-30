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
import { DepositDialog } from "@/app/marketplace/deposit-dialog";
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
}

export default function LaunchpadStatusWidget({
  className,
}: LaunchpadStatusWidgetProps) {
  const queryClient = useQueryClient();
  const { isLive, nextBatchAtMs, refreshNextBatchAtMs, isLoading, isError } =
    useLaunchpadStatus();
  const { spotPriceUsd } = useGlowSpotPriceSummary();

  const [liveTypeFilter, setLiveTypeFilter] = React.useState<
    "delegations" | "miners"
  >("delegations");

  const {
    applications: delegationApplications,
    isLoading: isDelegationsLoading,
  } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
    enabled: isLive,
  });
  const { applications: minerApplications, isLoading: isMinersLoading } =
    useMiningCenter({
      filters: { paymentCurrency: "USDC" },
      enabled: isLive,
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
  const shouldShowTypeTabs = isLive && availableTypesCount > 1;
  const listTypeFilter = shouldShowTypeTabs
    ? liveTypeFilter
    : hasDelegationsAvailable
    ? "delegations"
    : hasMinersAvailable
    ? "miners"
    : liveTypeFilter;

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
      setSelectedApplicationForDeposit(application);
      setSelectedRewardScore(scoreData ?? null);
      setDepositOpen(true);
    },
    []
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
        "flex h-full flex-col overflow-hidden bg-card dark:bg-muted/20 border-border shadow-sm gap-2",
        className
      )}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="tracking-tight text-base">
              {isLive ? "Solar Launchpad" : "Next Solar Batch"}
            </CardTitle>
            {isLive ? (
              <span className="inline-flex items-center rounded-full border border-[#C084FC]/25 bg-[#C084FC]/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#C084FC]">
                Live
              </span>
            ) : null}
          </div>

          {isLive ? (
            shouldShowTypeTabs ? (
              <Tabs
                value={listTypeFilter}
                onValueChange={(v) =>
                  setLiveTypeFilter(v as "delegations" | "miners")
                }
                className="shrink-0"
              >
                <TabsList className="rounded-full border border-border bg-muted/10 p-1 h-9">
                  {hasDelegationsAvailable ? (
                    <TabsTrigger
                      value="delegations"
                      className="rounded-full px-3 h-7 text-xs data-[state=active]:bg-[#C084FC]/15 data-[state=active]:text-foreground"
                    >
                      Delegations{" "}
                      <span className="ml-1 font-mono tabular-nums text-[10px] opacity-70">
                        {isDelegationsLoading ? "…" : delegationsAvailableCount}
                      </span>
                    </TabsTrigger>
                  ) : null}
                  {hasMinersAvailable ? (
                    <TabsTrigger
                      value="miners"
                      className="rounded-full px-3 h-7 text-xs data-[state=active]:bg-[color:var(--color-miner-yellow)]/15 data-[state=active]:text-foreground"
                    >
                      Miners{" "}
                      <span className="ml-1 font-mono tabular-nums text-[10px] opacity-70">
                        {isMinersLoading ? "…" : minersAvailableCount}
                      </span>
                    </TabsTrigger>
                  ) : null}
                </TabsList>
              </Tabs>
            ) : (
              <div className="shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-muted/10 px-3 py-1">
                <span className="text-xs font-mono font-medium text-foreground tabular-nums">
                  {hasDelegationsAvailable
                    ? `Delegations ${
                        isDelegationsLoading ? "…" : delegationsAvailableCount
                      }`
                    : hasMinersAvailable
                    ? `Miners ${isMinersLoading ? "…" : minersAvailableCount}`
                    : "No farms"}
                </span>
              </div>
            )
          ) : (
            <div className="shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-muted/10 px-3 py-1">
              <span className="text-xs font-mono font-medium text-foreground tabular-nums">
                GLW {priceLabel}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 flex flex-col p-0">
        {isLoading ? (
          <div className="space-y-4 py-4 px-5 pb-5">
            <Skeleton className="h-16 w-3/4 mx-auto rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center gap-2 px-5 pb-5">
            <div className="text-sm text-muted-foreground">
              Status currently unavailable.
            </div>
          </div>
        ) : isLive ? (
          // --- LIVE STATE ---
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-5 pb-5">
              <LaunchpadView
                variant="widget"
                typeFilter={listTypeFilter}
                onPayDeposit={handlePayDeposit}
              />
            </div>
          </ScrollArea>
        ) : (
          // --- COUNTDOWN STATE ---
          <div className="flex-1 flex flex-col px-5 pb-5">
            {/* Big Countdown Hero */}
            <div className="flex-1 flex flex-col items-center justify-center py-2">
              <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tighter tabular-nums text-foreground">
                <AnimatedCountdownDhms remainingMs={remainingMs} size="xl" />
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
                    Every Tuesday at 1pm ET
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The next batch of{" "}
                    <span className="text-foreground">Delegations</span> and{" "}
                    <span className="text-foreground">Miners</span> goes live at
                    the same time. Buy GLW now so you’re ready to delegate the
                    moment it opens.
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
