"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";
import { Info, X, Users, Trophy } from "lucide-react";
import Link from "next/link";
import { isAddress } from "viem";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImpactScoreBreakdownDialog } from "@/components/dialogs/impact-score-breakdown-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { MintAndStakeGctlDialog } from "@/components/dialogs/mint-and-stake-gctl-dialog";
import { ReferralNetworkDialog } from "@/components/dialogs/referral-network-dialog";
import {
  ImpactIndicatorsRow,
  type ImpactIndicatorsState,
} from "@/components/impact-score/impact-indicators";
import { hubGet } from "@/lib/api/hub-client";
import { trackEvent } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import {
  useImpactLeaderboardQuery,
  type ImpactGlowScoreResponse,
  type ImpactGlowScoreLeaderboardRow,
} from "@/hooks";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
import { formatTopPercentile } from "@/utils/impact";
import { getCurrentEpoch } from "@/utils/getCurrentEpoch";
import { ArrowTopRightIcon } from "@radix-ui/react-icons";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

function formatPoints(
  value?: string,
  opts: { maximumFractionDigits: number } = { maximumFractionDigits: 0 },
) {
  if (!value) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: opts.maximumFractionDigits,
  }).format(num);
}

function safeBigInt(value?: string) {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function safeNumber(value?: string) {
  if (!value) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getIndicatorsStateFromImpactScore(
  impactScore: ImpactGlowScoreResponse,
): ImpactIndicatorsState {
  // Use currentWeekProjection for "what's active NOW" (current ongoing week)
  const projection = impactScore?.currentWeekProjection;

  // Fallback to last completed week if projection not available
  const weeklyArray = impactScore?.weekly;
  const latestWeek = weeklyArray?.length
    ? weeklyArray[weeklyArray.length - 1]
    : null;

  // Prefer projection data (current week) over historical data
  const streakBonusMultiplier =
    projection?.streakBonusMultiplier ?? latestWeek?.streakBonusMultiplier ?? 0;
  const hasMiner =
    projection?.hasMinerMultiplier ?? latestWeek?.hasCashMinerBonus ?? false;

  return {
    hasMinerMultiplier: Boolean(hasMiner),
    hasImpactStreak: streakBonusMultiplier > 0,
    streakBonusMultiplier,
    hasSteeringStake:
      projection?.hasSteeringStake ??
      safeNumber(impactScore.totals?.steeringPoints) > 0,
    hasEmissionsEarned: safeNumber(impactScore.totals?.inflationPoints) > 0,
    hasVaultBonus:
      safeBigInt(impactScore.glowWorth?.delegatedActiveGlwWei) > 0n,
    hasGlwWorth: safeBigInt(impactScore.glowWorth?.glowWorthWei) > 0n,
    hasReferralPoints: safeNumber(impactScore.composition?.referralPoints) > 0,
  };
}

interface RankWidgetProps {
  walletAddress?: string | null;
  onMintAndStakeClick?: (forceStep1?: boolean) => void;
  variant?: "default" | "hero";
}

function RankWidgetSkeleton({
  variant = "default",
}: {
  variant?: "default" | "hero";
}) {
  const isHero = variant === "hero";

  return (
    <Card
      className={cn(
        "flex flex-col w-full overflow-hidden",
        isHero
          ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl h-full gap-4 pt-6 pb-0"
          : "bg-card dark:bg-card border-border/20 h-full gap-4 pt-6 pb-0",
      )}
    >
      <CardHeader className="py-0 px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
            Impact Score
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </CardHeader>

      <CardContent
        className="flex flex-col flex-1 gap-4 px-6 pb-6"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center justify-center text-center px-2">
            <Skeleton className="h-4 w-24 rounded-xl" />
            <Skeleton
              className={cn(
                "mt-2 rounded-xl",
                isHero ? "h-16 w-48" : "h-14 w-40",
              )}
            />

            <div className="mt-3 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-12 rounded-xl" />
                <Skeleton className="h-3 w-16 rounded-xl" />
              </div>
              <div
                className={cn(
                  "w-px bg-border/40 dark:bg-border/60",
                  isHero ? "h-4" : "h-3",
                )}
              />
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-20 rounded-xl" />
                <Skeleton className="h-3 w-16 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Impact indicators skeleton */}
          <div
            className={cn(
              "rounded-full border bg-card/50 dark:bg-card/80 max-w-full mx-auto",
              isHero
                ? "px-3 py-2 border-border/30 dark:border-border/40"
                : "px-3 py-2.5 border-border/20 dark:border-border/40",
            )}
          >
            <div className="flex items-center justify-center gap-1.5">
              {/* Sources */}
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-8 rounded-full" />
              ))}
              {/* Separator */}
              <div className="h-5 w-px bg-border/40 mx-0.5" />
              {/* Multipliers */}
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>

          {/* Buttons skeleton */}
          <div className="grid gap-2 grid-cols-2 mt-auto">
            <Skeleton className={cn("rounded-xl", isHero ? "h-10" : "h-12")} />
            <Skeleton className={cn("rounded-xl", isHero ? "h-10" : "h-12")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RankWidget({
  walletAddress,
  onMintAndStakeClick,
  variant = "default",
}: RankWidgetProps) {
  const hasWallet = Boolean(walletAddress);
  const isHero = variant === "hero";

  const source = "rank_widget";
  const [isBreakdownOpen, setIsBreakdownOpen] = React.useState(false);
  const [isLaunchpadOpen, setIsLaunchpadOpen] = React.useState(false);
  const [isBuyGlowOpen, setIsBuyGlowOpen] = React.useState(false);
  const [isMintAndStakeOpen, setIsMintAndStakeOpen] = React.useState(false);
  const [isReferralNetworkOpen, setIsReferralNetworkOpen] =
    React.useState(false);

  const isValidWalletAddress =
    Boolean(walletAddress) && isAddress(walletAddress as string);

  const leaderboardQuery = useImpactLeaderboardQuery({
    enabled: Boolean(HUB_URL && hasWallet && isValidWalletAddress),
  });
  const leaderboardRows = React.useMemo(() => {
    const rawWallets = leaderboardQuery.data?.wallets ?? [];
    return rawWallets.filter(
      (row): row is ImpactGlowScoreLeaderboardRow =>
        "walletAddress" in row && !("isSystemRow" in row),
    );
  }, [leaderboardQuery.data?.wallets]);
  const totalWalletCount = leaderboardQuery.data?.totalWalletCount ?? 0;
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? "";

  const currentWeek = getCurrentEpoch();

  const impactScoreQuery = useQuery({
    queryKey: ["impact-glow-score", walletAddress, currentWeek, "no-weekly"],
    enabled: Boolean(HUB_URL && hasWallet && isValidWalletAddress),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
    queryFn: async (): Promise<ImpactGlowScoreResponse> => {
      try {
        if (!HUB_URL) throw new Error("NEXT_PUBLIC_HUB_URL is not set");
        if (!walletAddress) throw new Error("Missing wallet address");
        return await hubGet<ImpactGlowScoreResponse>("/impact/glow-score", {
          params: {
            walletAddress,
            endWeek: currentWeek,
            includeWeekly: "0",
          },
        });
      } catch (error) {
        toast.error("Failed to load Impact Score", {
          description: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  });

  const impactScore = impactScoreQuery.data ?? null;

  const totalsPoints = impactScore?.totals?.totalPoints ?? undefined;

  const totalPointsNumber = React.useMemo(() => {
    const num = Number(totalsPoints ?? "0");
    if (!Number.isFinite(num)) return 0;
    return num;
  }, [totalsPoints]);

  const referralPointsThisWeek = React.useMemo(() => {
    return safeNumber(impactScore?.referral?.asReferrer?.thisWeekPointsScaled6);
  }, [impactScore]);

  const isMillionPlusScore = totalPointsNumber >= 1_000_000;

  const hasPositiveScore = React.useMemo(() => {
    return Math.round(totalPointsNumber) > 0;
  }, [totalPointsNumber]);

  const shouldShowMintAndStakeCta =
    Boolean(impactScore) && !impactScoreQuery.isLoading && !hasPositiveScore;

  const shouldShowBreakdownButton =
    Boolean(impactScore) && !impactScoreQuery.isLoading && hasPositiveScore;

  const pointsHeroText = React.useMemo(() => {
    if (impactScoreQuery.isLoading) return "— pts";
    const formatted = formatPoints(totalsPoints, { maximumFractionDigits: 0 });
    if (formatted === "—") return "— pts";
    return `${formatted} pts`;
  }, [impactScoreQuery.isLoading, totalsPoints]);

  const selfGlobalRank = React.useMemo(() => {
    if (!normalizedWalletAddress) return null;
    const idx = leaderboardRows.findIndex(
      (row) => row.walletAddress.toLowerCase() === normalizedWalletAddress,
    );
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboardRows, normalizedWalletAddress]);

  const listThresholdPercentile = React.useMemo(() => {
    if (totalWalletCount <= 0) return NaN;
    return (
      (Math.min(leaderboardRows.length, totalWalletCount) / totalWalletCount) *
      100
    );
  }, [leaderboardRows.length, totalWalletCount]);

  const rankText = React.useMemo(() => {
    if (impactScoreQuery.isLoading || leaderboardQuery.isLoading) return "—";
    if (!selfGlobalRank) return "—";
    return `#${selfGlobalRank.toLocaleString("en-US")}`;
  }, [impactScoreQuery.isLoading, leaderboardQuery.isLoading, selfGlobalRank]);

  const percentileText = React.useMemo(() => {
    if (impactScoreQuery.isLoading || leaderboardQuery.isLoading) return "—";

    if (selfGlobalRank && totalWalletCount > 0) {
      const percentile = (selfGlobalRank / totalWalletCount) * 100;
      return `Top ${formatTopPercentile(percentile)}`;
    }

    if (
      normalizedWalletAddress &&
      leaderboardRows.length > 0 &&
      totalWalletCount > 0
    )
      return `Below Top ${formatTopPercentile(listThresholdPercentile)}`;

    return "—";
  }, [
    impactScoreQuery.isLoading,
    leaderboardQuery.isLoading,
    selfGlobalRank,
    totalWalletCount,
    normalizedWalletAddress,
    leaderboardRows.length,
    listThresholdPercentile,
  ]);

  const shouldFetchBalances = isBuyGlowOpen || isMintAndStakeOpen;
  const { usdcBalance, usdgBalance } = useWalletTokenBalances(walletAddress, {
    enabled: shouldFetchBalances,
  });
  const { spotPrice: glowSpotPrice } = useGlowSpotPrice({
    query: { enabled: isBuyGlowOpen },
  });
  const { isLive: isReferralLive } = useReferralLaunch();

  const handleIndicatorClick = React.useCallback(
    (
      key:
        | "miner"
        | "streak"
        | "steering"
        | "vault"
        | "emissions"
        | "worth"
        | "referral",
    ) => {
      trackEvent("dashboard_impact_indicator_click", {
        source,
        wallet_connected: hasWallet,
        wallet_address: normalizedWalletAddress,
        indicator: key,
      });

      if (key === "referral") {
        if (!isReferralLive) return;
        setIsReferralNetworkOpen(true);
        return;
      }

      if (key === "steering") {
        if (onMintAndStakeClick) return onMintAndStakeClick(!hasPositiveScore);
        setIsMintAndStakeOpen(true);
        return;
      }

      if (key === "worth") {
        setIsBuyGlowOpen(true);
        return;
      }

      setIsLaunchpadOpen(true);
    },
    [
      hasWallet,
      hasPositiveScore,
      normalizedWalletAddress,
      onMintAndStakeClick,
      source,
    ],
  );

  const isLoading =
    hasWallet && (impactScoreQuery.isLoading || leaderboardQuery.isLoading);

  if (isLoading) {
    return <RankWidgetSkeleton variant={variant} />;
  }

  return (
    <>
      {/* --- DASHBOARD CARD --- */}
      <Card
        className={cn(
          "flex flex-col w-full overflow-hidden",
          isHero
            ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl h-full gap-4 pt-6 pb-0"
            : "bg-card dark:bg-card border-border/20 h-full gap-4 pt-6 pb-0",
        )}
      >
        <CardHeader className="py-0 px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
              Impact Score
            </div>
            {hasWallet && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                asChild
              >
                <Link
                  href="/stats/rewards"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackEvent("dashboard_leaderboard_open_click", {
                      source,
                      wallet_connected: hasWallet,
                      wallet_address: normalizedWalletAddress,
                    });
                  }}
                >
                  <ArrowTopRightIcon className="w-5 h-5" />
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent
          className="flex flex-col flex-1 gap-4 px-6 pb-6"
        >
          {!hasWallet ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-center justify-center text-center px-1 select-none">
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground blur-[1px] opacity-60">
                  Total points
                </div>
                <div className="mt-2 font-mono text-5xl md:text-6xl font-bold tracking-tighter text-foreground tabular-nums blur-[2px] opacity-60">
                  — pts
                </div>

                <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground blur-[1px] opacity-60">
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Rank
                    </span>
                    <span className="tabular-nums">—</span>
                  </div>
                  <div className="h-3 w-px bg-border/60" />
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Percentile
                    </span>
                    <span className="tabular-nums">—</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Connect your wallet
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Connect your wallet to see your points and rank.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center text-center px-2">
                <div
                  className={cn(
                    "font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80",
                    isHero ? "text-xs" : "text-[10px]",
                  )}
                >
                  Total points
                </div>
                <div
                  className={cn(
                    "mt-1 font-mono font-semibold tracking-tighter text-foreground tabular-nums",
                    isHero
                      ? isMillionPlusScore
                        ? "text-4xl md:text-5xl"
                        : "text-4xl md:text-5xl"
                      : isMillionPlusScore
                        ? "text-4xl md:text-5xl"
                        : "text-4xl md:text-5xl",
                  )}
                >
                  {pointsHeroText}
                </div>

                <div
                  className={cn(
                    "mt-3 flex items-center justify-center gap-4 text-muted-foreground",
                    isHero ? "text-sm" : "text-xs",
                  )}
                >
                  <div className="flex items-baseline gap-2 font-mono">
                    <span
                      className={cn(
                        "uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80",
                        isHero ? "text-[10px]" : "text-[9px]",
                      )}
                    >
                      Rank
                    </span>
                    <span className="tabular-nums font-medium">{rankText}</span>
                  </div>
                  <div
                    className={cn(
                      "w-px bg-border/40 dark:bg-border/60",
                      isHero ? "h-4" : "h-3",
                    )}
                  />
                  <div className="flex items-baseline gap-2 font-mono">
                    <span
                      className={cn(
                        "uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80",
                        isHero ? "text-[10px]" : "text-[9px]",
                      )}
                    >
                      Percentile
                    </span>
                    <span className="tabular-nums font-medium">
                      {percentileText}
                    </span>
                  </div>
                </div>
              </div>
              {impactScore ? (
                <div
                  className={cn(
                    "rounded-full border bg-card/50 dark:bg-card/80 max-w-full mx-auto",
                    isHero
                      ? "px-3 py-2 border-border/30 dark:border-border/40"
                      : "px-3 py-2.5 border-border/20 dark:border-border/40",
                  )}
                >
                  <ImpactIndicatorsRow
                    state={getIndicatorsStateFromImpactScore(impactScore)}
                    onIndicatorClick={handleIndicatorClick}
                  />
                </div>
              ) : null}

              <div className={cn("grid gap-2 grid-cols-2 mt-auto", isHero && "pt-1")}>
                {shouldShowMintAndStakeCta ? (
                  onMintAndStakeClick ? (
                    <Button
                      className={cn(
                        "font-mono font-bold",
                        isHero ? "h-11 text-xs" : "h-12 text-xs",
                      )}
                      type="button"
                      onClick={() => {
                        trackEvent("dashboard_gctl_mint_stake_open_click", {
                          source,
                          wallet_connected: hasWallet,
                          wallet_address: normalizedWalletAddress,
                        });
                        onMintAndStakeClick(true);
                      }}
                    >
                      Rank Up
                    </Button>
                  ) : (
                    <Button
                      className={cn(
                        "font-mono font-bold",
                        isHero ? "h-11 text-xs" : "h-12 text-xs",
                      )}
                      asChild
                    >
                      <Link
                        href="/buy"
                        onClick={() => {
                          trackEvent("dashboard_gctl_mint_stake_open_click", {
                            source,
                            wallet_connected: hasWallet,
                            wallet_address: normalizedWalletAddress,
                            cta: "link",
                          });
                        }}
                      >
                        Mint &amp; stake GCTL
                      </Link>
                    </Button>
                  )
                ) : null}

                {shouldShowBreakdownButton ? (
                  <Button
                    variant="outline"
                    className={cn(
                      "font-mono font-bold w-full text-xs",
                      isHero ? "h-11" : "h-12",
                    )}
                    type="button"
                    onClick={() => {
                      trackEvent("dashboard_impact_breakdown_open_click", {
                        source,
                        wallet_connected: hasWallet,
                        wallet_address: normalizedWalletAddress,
                      });
                      setIsBreakdownOpen(true);
                    }}
                    disabled={impactScoreQuery.isError || !impactScore}
                  >
                    Breakdown
                  </Button>
                ) : null}

                {isReferralLive ? (
                  <Button
                    variant={
                      shouldShowMintAndStakeCta && onMintAndStakeClick
                        ? "outline"
                        : "default"
                    }
                    className={cn(
                      "font-mono font-bold w-full text-xs gap-1.5 px-2",
                      isHero ? "h-11" : "h-12",
                    )}
                    type="button"
                    onClick={() => setIsReferralNetworkOpen(true)}
                  >
                    <Users className="w-3.5 h-3.5" />
                    {referralPointsThisWeek > 0
                      ? `Invites (+${formatPoints(
                          String(referralPointsThisWeek),
                        )})`
                      : "Invite Friends"}
                  </Button>
                ) : (
                  <Button
                    variant={
                      shouldShowMintAndStakeCta && onMintAndStakeClick
                        ? "outline"
                        : "default"
                    }
                    className={cn(
                      "font-mono font-bold w-full text-xs gap-1.5 px-2",
                      isHero ? "h-11" : "h-12",
                    )}
                    asChild
                  >
                    <Link
                      href="/stats/rewards"
                      onClick={() => {
                        trackEvent("dashboard_leaderboard_open_click", {
                          source,
                          wallet_connected: hasWallet,
                          wallet_address: normalizedWalletAddress,
                        });
                      }}
                    >
                      Leaderboard
                    </Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ImpactScoreBreakdownDialog
        open={isBreakdownOpen}
        onOpenChange={setIsBreakdownOpen}
        walletAddress={normalizedWalletAddress}
        weekRange={impactScore?.weekRange ?? null}
        showCurrentWeekProjection
      />

      <LaunchpadDialog
        key={isLaunchpadOpen ? "launchpad-open" : "launchpad-closed"}
        open={isLaunchpadOpen}
        onOpenChange={setIsLaunchpadOpen}
      />

      {!onMintAndStakeClick ? (
        <MintAndStakeGctlDialog
          key={
            isMintAndStakeOpen ? "mint-and-stake-open" : "mint-and-stake-closed"
          }
          open={isMintAndStakeOpen}
          onOpenChange={setIsMintAndStakeOpen}
          usdcBalance={usdcBalance}
          usdgBalance={usdgBalance}
          forceStep1={!hasPositiveScore}
        />
      ) : null}

      <BuyGlowDialog
        key={isBuyGlowOpen ? "buy-glow-open" : "buy-glow-closed"}
        open={isBuyGlowOpen}
        onOpenChange={setIsBuyGlowOpen}
        usdcBalance={usdcBalance}
        glowSpotPrice={glowSpotPrice || 0}
        source="rank_widget"
        defaultUsdcAmount="20"
      />

      {isReferralLive ? (
        <ReferralNetworkDialog
          open={isReferralNetworkOpen}
          onOpenChange={setIsReferralNetworkOpen}
          walletAddress={normalizedWalletAddress}
        />
      ) : null}
    </>
  );
}

export default RankWidget;
