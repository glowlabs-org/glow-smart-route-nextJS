"use client";

import * as React from "react";
import { ConnectKitButton } from "connectkit";
import { Rocket, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { useAccount } from "wagmi";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { cn } from "@/lib/utils";
import {
  AnimatedCountdownDhms,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import { useLaunchpadStatus } from "@/hooks/useLaunchpadStatus";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";

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

interface LaunchpadStatusWidgetProps {
  className?: string;
}

export default function LaunchpadStatusWidget({
  className,
}: LaunchpadStatusWidgetProps) {
  const { isConnected } = useAccount();
  const {
    isLive,
    activeFarmsCount,
    nextBatchAtMs,
    refreshNextBatchAtMs,
    isLoading,
    isError,
  } = useLaunchpadStatus();
  const { spotPriceUsd, deltaPercent24h } = useGlowSpotPriceSummary();

  const [isBuyOpen, setIsBuyOpen] = React.useState(false);
  const [isLaunchpadOpen, setIsLaunchpadOpen] = React.useState(false);
  const [shouldOpenLaunchpadOnConnect, setShouldOpenLaunchpadOnConnect] =
    React.useState(false);

  const remainingMs = useCountdownTo({
    targetAtMs: nextBatchAtMs,
    onComplete: refreshNextBatchAtMs,
  });

  const priceLabel = React.useMemo(
    () => formatUsdPrice(spotPriceUsd),
    [spotPriceUsd]
  );
  const deltaLabel = React.useMemo(
    () => formatSignedPercent(deltaPercent24h),
    [deltaPercent24h]
  );
  const isPositive = (deltaPercent24h ?? 0) >= 0;

  React.useEffect(() => {
    if (!isConnected) return;
    if (!shouldOpenLaunchpadOnConnect) return;
    setShouldOpenLaunchpadOnConnect(false);
    setIsLaunchpadOpen(true);
  }, [isConnected, shouldOpenLaunchpadOnConnect]);

  return (
    <Card
      className={cn(
        "flex h-full flex-col overflow-hidden bg-card dark:bg-muted/20 border-border shadow-sm",
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

          <div className="shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-muted/10 px-3 py-1">
            <span className="text-xs font-mono font-medium text-foreground tabular-nums">
              GLW {priceLabel}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 flex flex-col px-5 pb-5">
        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-16 w-3/4 mx-auto rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center gap-2">
            <div className="text-sm text-muted-foreground">
              Status currently unavailable.
            </div>
          </div>
        ) : isLive ? (
          // --- LIVE STATE ---
          <div className="flex-1 flex flex-col justify-between">
            <div className="py-2">
              <div className="text-3xl sm:text-4xl font-mono font-bold tracking-tighter text-foreground mb-2">
                {activeFarmsCount}{" "}
                <span className="text-xl sm:text-2xl font-sans font-normal text-muted-foreground">
                  Farms
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Solar farms are currently accepting delegations. Connect your
                wallet to steer rewards.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <ConnectKitButton.Custom>
                {({ isConnected: isConnectKitConnected, show }) => (
                  <Button
                    type="button"
                    size="lg"
                    className="w-full font-semibold shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 transition-all bg-[#C084FC] hover:bg-[#a668e0] text-white border-0"
                    onClick={() => {
                      if (!isConnectKitConnected) {
                        setShouldOpenLaunchpadOnConnect(true);
                        show?.();
                        return;
                      }
                      setIsLaunchpadOpen(true);
                    }}
                  >
                    <Rocket className="mr-2 size-4" />
                    Browse Active Farms
                  </Button>
                )}
              </ConnectKitButton.Custom>
            </div>
          </div>
        ) : (
          // --- COUNTDOWN STATE ---
          <div className="flex-1 flex flex-col">
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
                  <p className="text-xs font-semibold text-foreground">
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

        {/* Dialogs */}
        <LaunchpadDialog
          open={isLaunchpadOpen}
          onOpenChange={setIsLaunchpadOpen}
        />
        <BuyGlowDialog
          key={isBuyOpen ? "buy-glow-open" : "buy-glow-closed"}
          open={isBuyOpen}
          onOpenChange={setIsBuyOpen}
          usdcBalance={null}
          glowSpotPrice={spotPriceUsd || 0}
          defaultUsdcAmount="20"
        />
      </CardContent>
    </Card>
  );
}
