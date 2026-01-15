"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
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
import { formatTopPercentile } from "@/utils/impact";
import { getCurrentEpoch } from "@/utils/getCurrentEpoch";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

function formatPoints(
  value?: string,
  opts: { maximumFractionDigits: number } = { maximumFractionDigits: 0 }
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
  impactScore: ImpactGlowScoreResponse
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
        "overflow-hidden flex flex-col w-full",
        isHero
          ? "bg-muted dark:bg-muted/30 dark:border-transparent h-full gap-2 py-4 border-border"
          : "h-full bg-card dark:bg-muted/30 border-foreground/10 dark:border-border gap-3 pt-4"
      )}
    >
      <CardHeader className="py-0 px-4">
        <div className="flex items-center justify-center gap-2">
          <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
            Impact Score
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className={cn("flex flex-col flex-1 min-h-0 gap-3", "py-0")}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center px-1">
            <Skeleton className="h-4 w-24 rounded-xl" />
            <Skeleton
              className={cn(
                "mt-2 rounded-xl",
                isHero ? "h-16 w-48" : "h-14 w-40"
              )}
            />

            <div className="mt-2 flex items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-12 rounded-xl" />
                <Skeleton className="h-3 w-16 rounded-xl" />
              </div>
              <div
                className={cn("w-px bg-border/60", isHero ? "h-4" : "h-3")}
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
              "rounded-xl border border-border bg-card",
              isHero ? "p-2 mb-2" : "p-3"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-8 rounded-full" />
              ))}
            </div>
          </div>

          {/* Buttons skeleton */}
          <div className="grid gap-2 grid-cols-2">
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

  const isValidWalletAddress =
    Boolean(walletAddress) && isAddress(walletAddress as string);

  const leaderboardQuery = useImpactLeaderboardQuery({
    enabled: Boolean(HUB_URL && hasWallet && isValidWalletAddress),
  });
  const leaderboardRows = React.useMemo(() => {
    const rawWallets = leaderboardQuery.data?.wallets ?? [];
    return rawWallets.filter(
      (row): row is ImpactGlowScoreLeaderboardRow =>
        "walletAddress" in row && !("isSystemRow" in row)
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
      (row) => row.walletAddress.toLowerCase() === normalizedWalletAddress
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

  const handleIndicatorClick = React.useCallback(
    (
      key: "miner" | "streak" | "steering" | "vault" | "emissions" | "worth"
    ) => {
      trackEvent("dashboard_impact_indicator_click", {
        source,
        wallet_connected: hasWallet,
        wallet_address: normalizedWalletAddress,
        indicator: key,
      });

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
    ]
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
          "overflow-hidden flex flex-col w-full",
          isHero
            ? "bg-muted dark:bg-muted/30 dark:border-transparent h-full gap-2 py-4 border-border"
            : "h-full bg-card dark:bg-muted/30 border-foreground/10 dark:border-border gap-3 pt-4"
        )}
      >
        <CardHeader className="py-0 px-4">
          <div className="flex items-center  justify-center gap-2 ">
            <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
              Impact Score
            </div>
          </div>
        </CardHeader>
        <CardContent
          className={cn("flex flex-col flex-1 min-h-0 gap-3", "py-0")}
        >
          {!hasWallet ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center px-1 select-none">
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
              <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center px-1">
                <div
                  className={cn(
                    "font-mono uppercase tracking-wider text-muted-foreground",
                    isHero ? "text-sm" : "text-xs"
                  )}
                >
                  Total points
                </div>
                <div
                  className={cn(
                    "mt-1 font-mono font-bold tracking-tighter text-foreground tabular-nums",
                    isHero
                      ? isMillionPlusScore
                        ? "text-4xl md:text-5xl"
                        : "text-5xl md:text-6xl"
                      : isMillionPlusScore
                      ? "text-3xl md:text-4xl"
                      : "text-4xl md:text-5xl"
                  )}
                >
                  {pointsHeroText}
                </div>

                <div
                  className={cn(
                    "mt-2 flex items-center justify-center gap-3 text-muted-foreground",
                    isHero ? "text-sm" : "text-xs"
                  )}
                >
                  <div className="flex items-baseline gap-2 font-mono">
                    <span
                      className={cn(
                        "uppercase tracking-wider text-muted-foreground/80",
                        isHero ? "text-xs" : "text-[10px]"
                      )}
                    >
                      Rank
                    </span>
                    <span className="tabular-nums">{rankText}</span>
                  </div>
                  <div
                    className={cn("w-px bg-border/60", isHero ? "h-4" : "h-3")}
                  />
                  <div className="flex items-baseline gap-2 font-mono">
                    <span
                      className={cn(
                        "uppercase tracking-wider text-muted-foreground/80",
                        isHero ? "text-xs" : "text-[10px]"
                      )}
                    >
                      Percentile
                    </span>
                    <span className="tabular-nums">{percentileText}</span>
                  </div>
                </div>
              </div>
              {impactScore ? (
                <div
                  className={cn(
                    "rounded-xl border border-border bg-card w-fit mx-auto",
                    isHero ? "p-2 mb-2" : "p-3"
                  )}
                >
                  <ImpactIndicatorsRow
                    state={getIndicatorsStateFromImpactScore(impactScore)}
                    onIndicatorClick={handleIndicatorClick}
                  />
                </div>
              ) : null}

              <div className={cn("grid gap-2", "grid-cols-2")}>
                {shouldShowMintAndStakeCta ? (
                  onMintAndStakeClick ? (
                    <Button
                      className={cn("font-mono font-bold", "h-12 text-base")}
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
                        isHero ? "h-10 text-sm" : "h-12 text-base"
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
                <Button
                  variant={
                    shouldShowMintAndStakeCta && onMintAndStakeClick
                      ? "outline"
                      : "default"
                  }
                  className={cn("font-mono font-bold")}
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
                    Leaderboard
                  </Link>
                </Button>
                {shouldShowBreakdownButton ? (
                  <Button
                    variant="outline"
                    className={cn("font-mono font-bold")}
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
    </>
  );
}

export default RankWidget;
