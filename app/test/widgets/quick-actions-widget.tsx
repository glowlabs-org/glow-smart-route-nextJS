"use client";

import React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Droplets, Zap, CreditCard, Wind } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GlowSymbol } from "@/components/glow-symbol";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { AddLiquidityQuickDialog } from "./add-liquidity-quick-dialog";
import { useRewardsBreakdown } from "@/hooks/useRewardsBreakdown";
import { getGlwFromWei } from "@/lib/rewards/weekly-delegations";
import { useGlowLaunchpad } from "@/hooks/useGlowLaunchpad";
import { useMiningCenter } from "@/hooks/useMiningCenter";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";
import {
  AnimatedCountdown,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";

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

function countActiveListings(
  applications: Array<{ activeFraction: any | null }>
) {
  return applications.reduce((count, app) => {
    const fraction = app.activeFraction;
    if (!fraction) return count;
    const remainingSteps = fraction.remainingSteps ?? 0;
    const hasAvailability = !fraction.isFilled && remainingSteps > 0;
    return hasAvailability ? count + 1 : count;
  }, 0);
}

interface QuickActionsWidgetProps {
  walletAddress?: string | null;
  onMintAndStakeClick?: () => void;
}

export default function QuickActionsWidget({
  walletAddress,
  onMintAndStakeClick,
}: QuickActionsWidgetProps) {
  const { address: connectedAddress } = useAccount();
  const effectiveWalletAddress = walletAddress ?? connectedAddress ?? null;
  const { glwBalance, usdcBalance, usdgBalance } = useWalletTokenBalances(
    effectiveWalletAddress
  );
  const { data: rewardsData } = useRewardsBreakdown({
    walletAddress: effectiveWalletAddress,
    enabled: Boolean(effectiveWalletAddress),
  });
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();

  const { applications: launchpadApplications } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
  });
  const { applications: minersApplications } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
  });

  const [isBuyGlwOpen, setIsBuyGlwOpen] = React.useState(false);
  const [isAddLiquidityOpen, setIsAddLiquidityOpen] = React.useState(false);
  const [isLaunchpadOpen, setIsLaunchpadOpen] = React.useState(false);
  const [isOnboardingCtaHovered, setIsOnboardingCtaHovered] =
    React.useState(false);
  const [minersNextBatchAtMs, setMinersNextBatchAtMs] = React.useState(() =>
    getNextTuesdayAt1pmET().getTime()
  );

  const totalDelegatedGlw = React.useMemo(() => {
    if (!rewardsData) return 0;
    return (
      getGlwFromWei(rewardsData.totals.totalGlwDelegated) +
      getGlwFromWei(rewardsData.delegatedAfterWeekRange.totalGlwDelegatedAfter)
    );
  }, [rewardsData]);

  const hasActiveMiners = React.useMemo(() => {
    if (!rewardsData) return false;
    const stats = rewardsData.farmStatistics;
    const minerFarms =
      (stats?.minerOnlyFarms ?? 0) + (stats?.bothTypesFarms ?? 0);
    if (minerFarms > 0) return true;
    return rewardsData.recentPurchasesWithoutRewards.some((p) =>
      p.types.includes("mining-center")
    );
  }, [rewardsData]);

  const hasGlwBalance = (glwBalance ?? BigInt(0)) > BigInt(0);
  const isNewUser =
    !hasGlwBalance && totalDelegatedGlw === 0 && !hasActiveMiners;

  const activeListingsCount = React.useMemo(() => {
    return (
      countActiveListings(launchpadApplications) +
      countActiveListings(minersApplications)
    );
  }, [launchpadApplications, minersApplications]);

  const activeDelegationsListingsCount = React.useMemo(
    () => countActiveListings(launchpadApplications),
    [launchpadApplications]
  );
  const isDelegationsLive = activeDelegationsListingsCount > 0;

  const activeMinersListingsCount = React.useMemo(
    () => countActiveListings(minersApplications),
    [minersApplications]
  );
  const isMinersSoldOut = activeMinersListingsCount === 0;
  const handleMinersCountdownComplete = React.useCallback(() => {
    setMinersNextBatchAtMs(getNextTuesdayAt1pmET().getTime());
  }, []);
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
        {isNewUser ? (
          <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-tr from-zinc-950 to-zinc-900 p-5">
            <div className="pointer-events-none absolute -right-10 -bottom-12 opacity-20">
              <GlowSymbol className="h-48 w-48 text-white" />
            </div>

            <div className="relative flex flex-1 flex-col">
              <div
                className={cn(
                  "text-zinc-400 text-2xl leading-snug tracking-tight",
                  isOnboardingCtaHovered && "text-white"
                )}
                style={{
                  fontFamily: "Duplicate Slab, serif",
                  fontStyle: "italic",
                }}
              >
                “If everyone in the world owned $20 of GLW, we could eliminate
                fossil fuels by 2030.”
              </div>
              <div className="font-mono text-xs tabular-nums text-zinc-500">
                — David Vorick, CEO
              </div>

              <Button
                className="mt-auto h-14 w-full rounded-2xl bg-white font-mono text-base font-bold text-black hover:bg-white/95"
                onClick={() => setIsBuyGlwOpen(true)}
                onMouseEnter={() => setIsOnboardingCtaHovered(true)}
                onMouseLeave={() => setIsOnboardingCtaHovered(false)}
                onFocus={() => setIsOnboardingCtaHovered(true)}
                onBlur={() => setIsOnboardingCtaHovered(false)}
              >
                BUY $20 GLW (Start Now)
              </Button>
            </div>

            <BuyGlowDialog
              key={isBuyGlwOpen ? "buy-glow-open" : "buy-glow-closed"}
              open={isBuyGlwOpen}
              onOpenChange={setIsBuyGlwOpen}
              usdcBalance={usdcBalance}
              glowSpotPrice={glwSpotPrice}
              defaultUsdcAmount="20"
            />
          </div>
        ) : (
          <>
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
                  isDelegationsLive &&
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
                          {activeDelegationsListingsCount} farm
                          {activeDelegationsListingsCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-[#C084FC]/85">
                        Click to see Launchpad
                      </div>
                    </div>
                  ) : isMinersSoldOut ? (
                    <div className="flex flex-col gap-1">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Next batch in
                      </div>
                      <AnimatedCountdown
                        remainingMs={minersRemainingMs}
                        size="sm"
                      />
                    </div>
                  ) : (
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#D9F368]/80">
                      {activeMinersListingsCount} Active Farms
                    </div>
                  )
                }
              />

              <ActionTile
                title="Buy GLW"
                subtitle="Top Up Wallet"
                icon={CreditCard}
                onClick={() => setIsBuyGlwOpen(true)}
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
                isAddLiquidityOpen
                  ? "add-liquidity-open"
                  : "add-liquidity-closed"
              }
              open={isAddLiquidityOpen}
              onOpenChange={setIsAddLiquidityOpen}
            />

            <LaunchpadDialog
              key={isLaunchpadOpen ? "launchpad-open" : "launchpad-closed"}
              open={isLaunchpadOpen}
              onOpenChange={setIsLaunchpadOpen}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
