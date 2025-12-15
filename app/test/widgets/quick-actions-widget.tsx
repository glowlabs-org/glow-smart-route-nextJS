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
import { AddLiquidityQuickDialog } from "./add-liquidity-quick-dialog";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
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
        "group relative flex h-full flex-col rounded-2xl border border-zinc-800 bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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

export default function QuickActionsWidget() {
  const { address } = useAccount();
  const { signer } = useEthersSigner();
  const { glowBalance, usdcBalance } = useER20Balances({ signer });
  const { data: rewardsData } = useRewardsBreakdown({
    walletAddress: address || null,
    enabled: Boolean(address),
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

  const hasGlwBalance = (glowBalance ?? BigInt(0)) > BigInt(0);
  const isNewUser =
    !hasGlwBalance && totalDelegatedGlw === 0 && !hasActiveMiners;

  const activeListingsCount = React.useMemo(() => {
    return (
      countActiveListings(launchpadApplications) +
      countActiveListings(minersApplications)
    );
  }, [launchpadApplications, minersApplications]);

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
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-3">
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
                href="/?tab=launchpad&type=miners"
                title="Launchpad"
                subtitle="Buy Miners"
                icon={Zap}
                meta={
                  isMinersSoldOut ? (
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
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
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
                href="/glow-swap"
                title="Amplify"
                subtitle="Mint & Stake GCTL"
                icon={Wind}
                className="hover:border-cyan-400/60 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                meta={
                  <div className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/80">
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
