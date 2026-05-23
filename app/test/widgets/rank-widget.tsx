"use client";

import * as React from "react";

import { Info, X, Users, Trophy } from "lucide-react";
import Link from "next/link";
import { isAddress } from "viem";

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
import { ReferralNetworkDialog } from "@/components/dialogs/referral-network-dialog";
import { ImpactStreakIcon } from "@/components/impact-icons";
import { trackEvent } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import {
  useImpactLeaderboardQuery,
  useImpactScoreQuery,
} from "@/hooks";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
import { formatTopPercentile } from "@/utils/impact";
import {
  useV2PointsBalance,
  useV2PointsRates,
  type V2CurrentStreak,
} from "@/hooks/v2-points";
import { useV2ImpactLeaderboard } from "@/hooks/v2-impact";
import { ArrowTopRightIcon } from "@radix-ui/react-icons";
import { useLang } from "@/lib/i18n";

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

function safeNumber(value?: string) {
  if (!value) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

interface RankWidgetProps {
  walletAddress?: string | null;
  onMintAndStakeClick?: (forceStep1?: boolean) => void;
  variant?: "default" | "hero";
  readOnly?: boolean;
}

function RankWidgetSkeleton({
  variant = "default",
}: {
  variant?: "default" | "hero";
}) {
  const { t } = useLang();
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
            {t.widgets.rankWidget.title}
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

          {/* Weekly streak skeleton */}
          <div
            className={cn(
              "rounded-2xl border bg-card/50 dark:bg-card/80 max-w-full mx-auto w-full",
              isHero
                ? "px-3 py-2.5 border-border/30 dark:border-border/40"
                : "px-4 py-3 border-border/20 dark:border-border/40",
            )}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24 rounded-xl" />
                <Skeleton className="h-3 w-32 rounded-xl" />
              </div>
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

function WeeklyStreakPanel({
  streak,
  capWeek,
  capPoints,
  isHero,
  isLoading,
}: {
  streak: V2CurrentStreak | null;
  capWeek: number | null;
  capPoints: number | null;
  isHero: boolean;
  isLoading: boolean;
}) {
  const { t } = useLang();
  const r = t.widgets.rankWidget;

  const containerClass = cn(
    "flex items-center gap-3 rounded-2xl border bg-card/50 dark:bg-card/80 w-full max-w-full mx-auto",
    isHero
      ? "px-3 py-2.5 border-border/30 dark:border-border/40"
      : "px-4 py-3 border-border/20 dark:border-border/40",
  );

  if (isLoading) {
    return (
      <div className={containerClass}>
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-24 rounded-xl" />
          <Skeleton className="h-3 w-32 rounded-xl" />
        </div>
      </div>
    );
  }

  const streakWeek = streak?.streakWeek ?? 0;
  const qualified = streak?.qualified ?? false;
  const nextAward = streak?.nextAwardPoints ?? 0;
  const active = streakWeek > 0;
  const maxed = capWeek != null && streakWeek >= capWeek;

  const heading = active ? r.streakWeeks(streakWeek) : r.streakNone;
  const subtext = !active
    ? r.streakStart
    : maxed
      ? r.streakMaxed(formatPoints(String(capPoints ?? 2000)))
      : qualified
        ? r.streakLockedIn
        : r.streakKeepGoing;

  return (
    <div className={containerClass}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full shrink-0",
          active
            ? "bg-[#4ADE80]/10 text-[#4ADE80]"
            : "bg-muted/40 text-muted-foreground",
          isHero ? "h-9 w-9" : "h-10 w-10",
        )}
      >
        <ImpactStreakIcon
          className={cn(
            isHero ? "h-4 w-4" : "h-5 w-5",
            active && !maxed && "animate-pulse",
          )}
        />
      </div>

      <div className="flex flex-col min-w-0 flex-1 text-left">
        <span className="text-sm font-semibold text-foreground truncate">
          {heading}
        </span>
        <span className="text-[11px] text-muted-foreground truncate">
          {subtext}
        </span>
      </div>

      {nextAward > 0 && !maxed ? (
        <div className="text-right shrink-0">
          <div className="font-mono text-sm font-semibold text-[#4ADE80] tabular-nums">
            +{formatPoints(String(nextAward))}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
            pts
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RankWidget({
  walletAddress,
  onMintAndStakeClick,
  variant = "default",
  readOnly = false,
}: RankWidgetProps) {
  const { t } = useLang();
  const hasWallet = Boolean(walletAddress);
  const isHero = variant === "hero";

  const source = "rank_widget";
  const [isBreakdownOpen, setIsBreakdownOpen] = React.useState(false);
  const [isReferralNetworkOpen, setIsReferralNetworkOpen] =
    React.useState(false);

  const isValidWalletAddress =
    Boolean(walletAddress) && isAddress(walletAddress as string);

  // V1 leaderboard kept only for weekRange (drives the impact-score referral
  // number below); the rank itself comes from the V2 watts leaderboard.
  // limit:1 because we read nothing but `weekRange` off it — pulling the full
  // leaderboard (~112KB) here was pure waste.
  const leaderboardQuery = useImpactLeaderboardQuery({
    enabled: Boolean(hasWallet && isValidWalletAddress),
    limit: 1,
  });
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? "";

  // Watts rank: reflect the V2 watts leaderboard (the canonical one), not the
  // legacy points score. The dataset is small, so fetch the full ranked list
  // and read this wallet's rank.
  const v2RankQuery = useV2ImpactLeaderboard({
    sort: "totalWatts",
    dir: "desc",
    limit: 500,
  });
  const totalWalletCount = v2RankQuery.data?.total ?? 0;
  const selfGlobalRank = React.useMemo(() => {
    if (!normalizedWalletAddress) return null;
    const row = (v2RankQuery.data?.rows ?? []).find(
      (r) => r.wallet.toLowerCase() === normalizedWalletAddress,
    );
    return row?.rank ?? null;
  }, [v2RankQuery.data, normalizedWalletAddress]);

  const weekRange = leaderboardQuery.data?.weekRange ?? null;

  const impactScoreQuery = useImpactScoreQuery({
    walletAddress: walletAddress ?? null,
    weekRange,
    enabled: Boolean(hasWallet && isValidWalletAddress && weekRange),
    toastTitle: t.widgets.rankWidget.loadFailedToast,
    includeWeekly: false,
    includeProjection: true,
    includeReferral: true,
  });

  const impactScore = impactScoreQuery.data ?? null;

  // V2 spendable point balance — drives the hero "points" number and the
  // weekly streak panel.
  const v2PointsQuery = useV2PointsBalance(
    isValidWalletAddress ? walletAddress : null,
  );
  const ratesQuery = useV2PointsRates();

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
    const avail = v2PointsQuery.data?.availablePoints ?? 0;
    return Number.isFinite(avail) && avail > 0;
  }, [v2PointsQuery.data]);

  const shouldShowMintAndStakeCta =
    !v2PointsQuery.isLoading && !hasPositiveScore;

  const shouldShowBreakdownButton =
    !v2PointsQuery.isLoading && hasPositiveScore;

  // Hero number = the wallet's V2 spendable point balance (available
  // points), not the legacy impact-score total.
  const pointsHeroText = React.useMemo(() => {
    if (v2PointsQuery.isLoading) return t.widgets.rankWidget.emptyPoints;
    const available = v2PointsQuery.data?.availablePoints;
    if (available == null || !Number.isFinite(available))
      return t.widgets.rankWidget.emptyPoints;
    const formatted = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(available);
    return `${formatted} pts`;
  }, [
    v2PointsQuery.isLoading,
    v2PointsQuery.data,
    t.widgets.rankWidget.emptyPoints,
  ]);

  const rankText = React.useMemo(() => {
    if (v2RankQuery.isLoading) return "—";
    if (!selfGlobalRank) return "—";
    return `#${selfGlobalRank.toLocaleString("en-US")}`;
  }, [v2RankQuery.isLoading, selfGlobalRank]);

  const percentileText = React.useMemo(() => {
    if (v2RankQuery.isLoading) return "—";
    if (selfGlobalRank && totalWalletCount > 0) {
      const percentile = (selfGlobalRank / totalWalletCount) * 100;
      return t.widgets.rankWidget.topPercentile(formatTopPercentile(percentile));
    }
    return "—";
  }, [
    v2RankQuery.isLoading,
    selfGlobalRank,
    totalWalletCount,
    t.widgets.rankWidget,
  ]);

  const { isLive: isReferralLive } = useReferralLaunch();

  // Only block the skeleton on the V2 queries that drive the headline (points
  // hero + watts rank). The V1 impact-score chain (leaderboard -> weekRange ->
  // per-wallet score) is sequential and only feeds the referral button label
  // and the breakdown dialog, so it loads in the background instead of holding
  // the whole widget behind it.
  const isLoading =
    hasWallet && (v2PointsQuery.isLoading || v2RankQuery.isLoading);

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
              {t.widgets.rankWidget.title}
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
                  {t.widgets.rankWidget.availablePoints}
                </div>
                <div className="mt-2 font-mono text-5xl md:text-6xl font-bold tracking-tighter text-foreground tabular-nums blur-[2px] opacity-60">
                  {t.widgets.rankWidget.emptyPoints}
                </div>

                <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground blur-[1px] opacity-60">
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      {t.widgets.rankWidget.rank}
                    </span>
                    <span className="tabular-nums">—</span>
                  </div>
                  <div className="h-3 w-px bg-border/60" />
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      {t.widgets.rankWidget.percentile}
                    </span>
                    <span className="tabular-nums">—</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.widgets.rankWidget.connectWalletKicker}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {t.widgets.rankWidget.connectWalletBody}
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
                  {t.widgets.rankWidget.availablePoints}
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
                      {t.widgets.rankWidget.rank}
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
                      {t.widgets.rankWidget.percentile}
                    </span>
                    <span className="tabular-nums font-medium">
                      {percentileText}
                    </span>
                  </div>
                </div>
              </div>
              {hasWallet ? (
                <WeeklyStreakPanel
                  streak={v2PointsQuery.data?.currentStreak ?? null}
                  capWeek={ratesQuery.data?.rates?.streak?.capWeek ?? null}
                  capPoints={ratesQuery.data?.rates?.streak?.capPoints ?? null}
                  isHero={isHero}
                  isLoading={v2PointsQuery.isLoading}
                />
              ) : null}

              <div className={cn("grid gap-2 grid-cols-2 mt-auto", isHero && "pt-1")}>
                {!readOnly && shouldShowMintAndStakeCta ? (
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
                      {t.widgets.rankWidget.rankUp}
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
                        {t.widgets.rankWidget.mintAndStakeGctl}
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
                    {t.widgets.rankWidget.breakdown}
                  </Button>
                ) : null}

                {readOnly ? (
                  <Button
                    variant="default"
                    className={cn(
                      "font-mono font-bold w-full text-xs gap-1.5 px-2",
                      isHero ? "h-11" : "h-12",
                    )}
                    asChild
                  >
                    <Link href="/stats/rewards">
                      {t.widgets.rankWidget.leaderboard}
                    </Link>
                  </Button>
                ) : isReferralLive ? (
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
                      ? t.widgets.rankWidget.invitesWithPoints(
                          formatPoints(String(referralPointsThisWeek)),
                        )
                      : t.widgets.rankWidget.inviteFriends}
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
                      {t.widgets.rankWidget.leaderboard}
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
