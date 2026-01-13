"use client";

import * as React from "react";
import { useChainId } from "wagmi";
import { Zap, Sun, ArrowUpRight, BatteryCharging } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ConnectButton } from "@/components/connect-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";

import { useWalletPortfolio } from "./use-wallet-portfolio";
import { Button } from "@/components/ui/button";

// Standard definition of a panel for estimation purposes
const WATTS_PER_PANEL = 300;

interface ImpactAccumulatorWidgetProps {
  walletAddress?: string | null;
  variant?: "default" | "minimal";
}

function ImpactAccumulatorSkeleton() {
  return (
    <Card className="h-full overflow-hidden flex flex-col gap-2 bg-transparent border-transparent pt-0 w-full">
      <CardHeader className="py-0 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
            My Power Plant
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-0 px-4">
        <div className="flex flex-col py-6 gap-6">
          {/* Main KPIs Skeleton */}
          <div className="flex items-center gap-8">
            <div className="flex items-baseline gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
            <Skeleton className="hidden sm:block h-10 w-px" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          </div>

          {/* Progress Bar Skeleton */}
          <div className="mt-2 p-4 rounded-xl border border-border/50 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ImpactAccumulatorWidget({
  walletAddress,
  variant = "default",
}: ImpactAccumulatorWidgetProps) {
  const chainId = useChainId();
  const isMinimal = variant === "minimal";
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "impact_accumulator_widget";

  const {
    hasWallet,
    shouldShowSkeleton,
    // In a real scenario, we would use real physical data hooks here.
    // For now, we use the wallet state to determine if we show mock data.
  } = useWalletPortfolio({ walletAddress });

  // --- MOCK DATA GENERATION FOR VISUALIZATION ---
  // This simulates data that would eventually come from an infrastructure hook.
  const mockData = React.useMemo(() => {
    if (!hasWallet) {
      return {
        totalPanels: 0,
        totalWatts: 0,
        nextPanelNumber: 1,
        progressPercentage: 0,
        panelsPerWeekVelocity: 0,
      };
    }

    // Simulate an active user
    const totalPanels = 15;
    const totalWatts = totalPanels * WATTS_PER_PANEL;
    const nextPanelNumber = totalPanels + 1;
    // Simulate them earning enough rewards to buy ~42% of a panel this week
    const progressPercentage = 42;
    const panelsPerWeekVelocity = 0.42;

    return {
      totalPanels,
      totalWatts,
      nextPanelNumber,
      progressPercentage,
      panelsPerWeekVelocity,
    };
  }, [hasWallet]);
  // -------------------------------------------

  if (shouldShowSkeleton) return <ImpactAccumulatorSkeleton />;

  return (
    <Card
      className={cn(
        "overflow-hidden flex flex-col gap-2 pt-0 w-full py-0",
        isMinimal
          ? "bg-transparent border-transparent h-full"
          : "h-full min-h-[300px] lg:min-h-0 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border"
      )}
    >
      <CardHeader className="py-0 px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BatteryCharging className="h-5 w-5 text-green-500" />
            <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
              IMPACT ACCUMULATOR
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="#" // Replace with link to infrastructure explorer
              onClick={(e) => {
                e.preventDefault();
                trackEvent("dashboard_impact_explorer_click", {
                  source,
                  wallet_connected: Boolean(normalizedWalletAddress),
                  chain_id: chainId,
                });
              }}
              className="h-8 inline-flex items-center gap-2 rounded-full px-3 text-[11px] font-mono tracking-wider border border-border hover:bg-muted/50 transition-colors"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>View Assets</span>
            </a>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-0 relative">
        {/* Main Content Layer */}
        <div
          aria-hidden={!hasWallet}
          className={cn(
            "flex flex-col flex-1 min-h-0 px-4 py-4 sm:py-6 gap-6 sm:gap-8 z-10",
            !hasWallet &&
              "pointer-events-none select-none opacity-30 transition-opacity"
          )}
        >
          {/* TOP SECTION: Big Physical KPIs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
            {/* Watts - The "Power" Number */}
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-yellow-500" />
                <span>Live Capacity</span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-foreground tabular-nums leading-none drop-shadow-sm">
                  <NumberTicker
                    value={mockData.totalWatts}
                    decimalPlaces={0}
                    className="tracking-tight"
                  />
                </div>
                <span className="text-xl sm:text-2xl font-mono font-bold text-muted-foreground/70">
                  W
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-12 w-px bg-border/60" />

            {/* Panels - The Tangible Asset Equivalent */}
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <Sun className="h-3.5 w-3.5 text-orange-500" />
                <span>Infrastructure Equivalent</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl sm:text-5xl font-semibold text-foreground tabular-nums leading-none">
                  <NumberTicker value={mockData.totalPanels} />
                </span>
                <span className="font-mono text-lg sm:text-xl font-medium text-muted-foreground/70">
                  Panels
                </span>
              </div>
            </div>
          </div>

          {/* BOTTOM SECTION: Gamified Progress Loop */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-muted/40 to-muted/10 border border-border/60 space-y-3 relative overflow-hidden">
            {/* Subtle background glow effect for the progress section */}
            <div
              className="absolute inset-0 bg-green-500/5 pointer-events-none"
              aria-hidden="true"
            />

            <div className="flex justify-between items-center text-sm relative z-10">
              <span className="font-bold text-foreground font-mono text-xs uppercase tracking-wider flex items-center gap-2">
                <Sun className="h-4 w-4 text-green-500" />
                Progress to Panel #{mockData.nextPanelNumber}
              </span>
              <span className="font-mono font-black text-lg text-green-600 dark:text-green-400 tabular-nums">
                <NumberTicker
                  value={mockData.progressPercentage}
                  decimalPlaces={0}
                />
                %
              </span>
            </div>

            {/* Custom styled Progress bar to look like an energy bar */}
            <Progress
              value={mockData.progressPercentage}
              className="h-3.5 bg-zinc-200/50 dark:bg-zinc-800/50 border border-black/5 dark:border-white/5"
              // Using a gradient for the indicator bar for a "charging" effect
              style={{
                background:
                  "linear-gradient(to right, #4ADE80 0%, #34D399 50%, #10B981 100%)",
              }}
            />
          </div>
          <div className="flex  gap-2">
            <Button variant="default" className="w-full">
              Get more panels
            </Button>
            <Button variant="outline" className="w-full">
              Boost your points
            </Button>
          </div>
        </div>

        {/* Disconnected State Overlay */}
        {!hasWallet ? (
          <div className="absolute inset-0 flex items-center justify-center z-20 pb-4">
            {/* Grid pattern background for empty state */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, currentColor 1px, transparent 1px)",
                backgroundSize: "22px 22px",
                opacity: 0.05,
              }}
            />
            <div className="rounded-xl border border-border bg-background/95 p-4 text-center max-w-xs mx-auto shadow-sm backdrop-blur-sm">
              <div className="mt-1 text-sm font-medium text-foreground">
                Connect your wallet to see your impact.
              </div>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Start accumulating real solar infrastructure.
              </p>
              <div>
                <ConnectButton className="w-full" variant="default" />
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
