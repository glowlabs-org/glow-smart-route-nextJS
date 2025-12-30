"use client";

import React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { Droplets, Zap, CreditCard, Wind } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { AddLiquidityQuickDialog } from "./add-liquidity-quick-dialog";
import { useSponsorListings } from "@/hooks";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";
import {
  AnimatedCountdown,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { countActiveListings } from "@/utils/launchpad";

interface ActionTileProps {
  href?: string;
  onClick?: () => void;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  meta?: React.ReactNode;
  className?: string;
}

function ActionTile({
  href,
  onClick,
  title,
  subtitle,
  icon: Icon,
  meta,
  className,
}: ActionTileProps) {
  const Comp = href ? Link : "button";
  const compProps = href
    ? ({ href } as const)
    : ({ type: "button", onClick } as const);

  return (
    <Comp
      {...(compProps as any)}
      className={cn(
        "group relative flex h-full flex-col rounded-2xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-foreground/20 dark:hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/60 text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="truncate font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {title}
          </div>
          <div className="mt-1 truncate text-base font-semibold tracking-tight text-foreground">
            {subtitle}
          </div>
        </div>
      </div>

      {meta ? <div className="mt-auto pt-4">{meta}</div> : null}
    </Comp>
  );
}

interface QuickActionsWidgetProps {
  walletAddress?: string | null;
  onMintAndStakeClick?: () => void;
}

export default function QuickActionsWidget({
  walletAddress,
  onMintAndStakeClick,
}: QuickActionsWidgetProps) {
  const queryClient = useQueryClient();
  const { address: connectedAddress } = useAccount();
  const effectiveWalletAddress = walletAddress ?? connectedAddress ?? null;
  const { glwBalance, usdcBalance, usdgBalance } = useWalletTokenBalances(
    effectiveWalletAddress
  );
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();

  const { applications: launchpadApplications } = useSponsorListings({
    filters: { paymentCurrency: "GLW" },
  });
  const { applications: minersApplications } = useSponsorListings({
    filters: { paymentCurrency: "USDC", type: "mining-center" },
  });

  const [isBuyGlwOpen, setIsBuyGlwOpen] = React.useState(false);
  const [isAddLiquidityOpen, setIsAddLiquidityOpen] = React.useState(false);
  const [isLaunchpadOpen, setIsLaunchpadOpen] = React.useState(false);
  const [minersNextBatchAtMs, setMinersNextBatchAtMs] = React.useState(() =>
    getNextTuesdayAt1pmET().getTime()
  );

  const activeDelegationsListingsCount = React.useMemo(
    () => countActiveListings(launchpadApplications),
    [launchpadApplications]
  );
  const isDelegationsLive = activeDelegationsListingsCount > 0;

  const highlightedAction = React.useMemo(() => {
    return isDelegationsLive ? "launchpad" : "buy-glw";
  }, [isDelegationsLive]);

  const activeMinersListingsCount = React.useMemo(
    () => countActiveListings(minersApplications),
    [minersApplications]
  );
  const activeLaunchpadFarmsCount =
    activeDelegationsListingsCount + activeMinersListingsCount;
  const isMinersSoldOut = activeMinersListingsCount === 0;
  const handleMinersCountdownComplete = React.useCallback(() => {
    setMinersNextBatchAtMs(getNextTuesdayAt1pmET().getTime());
    void (async () => {
      try {
        await queryClient.refetchQueries({ queryKey: ["sponsor-listings"] });
      } catch {}
    })();
  }, [queryClient]);
  const minersRemainingMs = useCountdownTo({
    targetAtMs: minersNextBatchAtMs,
    onComplete: handleMinersCountdownComplete,
  });

  const glwPriceLabel = React.useMemo(() => {
    if (!glwSpotPrice || glwSpotPrice <= 0) return "$— / GLW";
    return `$${glwSpotPrice.toFixed(glwSpotPrice < 1 ? 4 : 2)} / GLW`;
  }, [glwSpotPrice]);

  return (
    <Card className="flex h-full flex-col overflow-hidden bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
      <CardHeader className="pb-2">
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
        <div className="grid h-full grid-cols-2 grid-rows-2 gap-3">
          <ActionTile
            title="Liquidity"
            subtitle="Add Liquidity"
            icon={Droplets}
            onClick={() => setIsAddLiquidityOpen(true)}
            meta={
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                GLW / USDG Pool
              </div>
            }
          />

          <ActionTile
            title="Launchpad"
            subtitle={isDelegationsLive ? "Delegate GLW" : "Buy Miners"}
            icon={Zap}
            onClick={() => setIsLaunchpadOpen(true)}
            className={cn(
              highlightedAction === "launchpad" &&
                "border-[#C084FC]/50 bg-[#C084FC]/5 shadow-[0_0_0_1px_rgba(192,132,252,0.22)] hover:border-[#C084FC]/70 hover:bg-[#C084FC]/10 hover:shadow-[0_0_0_1px_rgba(192,132,252,0.32)]"
            )}
            meta={
              isDelegationsLive ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C084FC]/60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C084FC]" />
                    </span>
                    <Badge className="h-5 rounded-full border border-[#C084FC]/25 bg-[#C084FC]/10 px-2 font-mono text-[10px] uppercase tracking-wider text-[#C084FC]">
                      Live
                    </Badge>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {activeLaunchpadFarmsCount} farm
                      {activeLaunchpadFarmsCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#C084FC]/85">
                    Click to see Launchpad
                  </div>
                </div>
              ) : isMinersSoldOut ? (
                <div className="flex flex-col gap-1">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Next batch Tuesday 1pm ET
                  </div>
                  <div className="quick-actions-launchpad-next-batch-countdown">
                    <AnimatedCountdown
                      remainingMs={minersRemainingMs}
                      size="sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-miner-yellow-contrast)]/80">
                  {activeMinersListingsCount} Active Farms
                </div>
              )
            }
          />

          <ActionTile
            title="Top Up Wallet"
            subtitle="Buy GLW"
            icon={CreditCard}
            onClick={() => setIsBuyGlwOpen(true)}
            className={cn(
              highlightedAction === "buy-glw" &&
                "border-[#C084FC]/50 bg-[#C084FC]/5 shadow-[0_0_0_1px_rgba(192,132,252,0.22)] hover:border-[#C084FC]/70 hover:bg-[#C084FC]/10 hover:shadow-[0_0_0_1px_rgba(192,132,252,0.32)]"
            )}
            meta={
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {glwPriceLabel}
              </div>
            }
          />

          <ActionTile
            title="Amplify"
            subtitle="Mint & Stake GCTL"
            icon={Wind}
            onClick={onMintAndStakeClick}
            className="hover:border-[#22D3EE]/60 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
            meta={
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#22D3EE]/80">
                Boost Region
              </div>
            }
          />
        </div>

        <BuyGlowDialog
          key={isBuyGlwOpen ? "buy-glow-open" : "buy-glow-closed"}
          open={isBuyGlwOpen}
          onOpenChange={setIsBuyGlwOpen}
          usdcBalance={usdcBalance}
          glowSpotPrice={glwSpotPrice}
          defaultUsdcAmount="20"
        />

        <AddLiquidityQuickDialog
          key={
            isAddLiquidityOpen ? "add-liquidity-open" : "add-liquidity-closed"
          }
          open={isAddLiquidityOpen}
          onOpenChange={setIsAddLiquidityOpen}
        />

        <LaunchpadDialog
          key={isLaunchpadOpen ? "launchpad-open" : "launchpad-closed"}
          open={isLaunchpadOpen}
          onOpenChange={setIsLaunchpadOpen}
        />
      </CardContent>
    </Card>
  );
}
