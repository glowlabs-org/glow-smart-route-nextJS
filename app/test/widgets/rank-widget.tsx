"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import Link from "next/link";
import { isAddress } from "viem";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
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
import { ImpactScoreBreakdownDialogContent } from "@/components/dialogs/impact-score-breakdown-dialog";
import { hubGet } from "@/lib/api/hub-client";
import { trackEvent } from "@/lib/telemetry";
import {
  useImpactLeaderboardQuery,
  type ImpactGlowScoreResponse,
} from "@/hooks";
import { formatTopPercentile } from "@/utils/impact";

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

function ImpactScoreHelp(props: {
  source: string;
  walletAddress: string | null;
  walletConnected: boolean;
}) {
  const label = "How Glow Impact Score works";
  const { source, walletAddress, walletConnected } = props;

  return (
    <>
      <span className="hidden md:inline-flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={label}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              type="button"
              onClick={() => {
                trackEvent("dashboard_impact_help_open_click", {
                  source,
                  wallet_connected: walletConnected,
                  wallet_address: walletAddress,
                  ui: "tooltip",
                });
              }}
            >
              <Info className="h-4 w-4 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="center"
            sideOffset={8}
            className="max-w-[360px] p-3"
          >
            <div className="space-y-2">
              <div className="text-xs font-semibold text-primary-foreground">
                Glow Impact Score
              </div>

              <div className="text-[11px] leading-snug text-primary-foreground/80">
                Points reward actions that grow onchain climate
                impact—especially steering via staked GCTL (sGCTL).
              </div>

              <div className="h-px bg-primary-foreground/15" />

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-primary-foreground">
                  Weekly rollover points
                </div>
                <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-primary-foreground/80">
                  <li>+1 / GLW earned in emissions rewards</li>
                  <li>+3 / GLW steered via staked GCTL (sGCTL)</li>
                  <li>+0.005 / week / GLW delegated (vault bonus)</li>
                </ul>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-primary-foreground">
                  Weekly multiplier
                </div>
                <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-primary-foreground/80">
                  <li>
                    Base: 1× (or 3× if you bought a miner with cash that week)
                  </li>
                  <li>
                    Streak: +0.25× per consecutive week you increase delegation
                    or buy a miner (caps +1.0×, resets on miss)
                  </li>
                </ul>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-primary-foreground">
                  Continuous
                </div>
                <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-primary-foreground/80">
                  <li>+0.001 / week / GLW in “GLW Worth”</li>
                </ul>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </span>

      <span className="md:hidden">
        <Drawer direction="bottom">
          <DrawerTrigger asChild>
            <Button
              aria-label={label}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              type="button"
              onClick={() => {
                trackEvent("dashboard_impact_help_open_click", {
                  source,
                  wallet_connected: walletConnected,
                  wallet_address: walletAddress,
                  ui: "drawer",
                });
              }}
            >
              <Info className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="md:hidden max-h-[85vh]">
            <DrawerHeader className="border-b border-border/60 text-left">
              <div className="flex items-center justify-between gap-3">
                <DrawerTitle className="text-base">
                  Glow Impact Score
                </DrawerTitle>
                <DrawerClose asChild>
                  <Button
                    aria-label="Close"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DrawerClose>
              </div>
              <DrawerDescription className="text-left">
                Points reward actions that grow onchain climate
                impact—especially steering via staked GCTL (sGCTL).
              </DrawerDescription>
            </DrawerHeader>

            <div className="overflow-y-auto p-4 text-sm">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Weekly rollover</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>
                      Emissions earned: +1 point per GLW earned in emissions
                    </li>
                    <li>
                      Steering (sGCTL): +3 points per GLW steered by staking
                      GCTL
                    </li>
                    <li>
                      Vault bonus: +0.005 points per week per GLW currently
                      delegated
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Weekly multiplier</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>
                      Base: 1× standard, or 3× if you bought a miner with cash
                      that week
                    </li>
                    <li>
                      Streak: +0.25× per consecutive week you increase delegated
                      GLW or buy a miner (caps at +1.0× after 4 weeks; resets on
                      miss)
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Continuous</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>
                      GLW Worth: +0.001 points per week per GLW in “GLW Worth”
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                  Delegated GLW intentionally counts twice: it contributes to
                  “GLW Worth” (continuous) and also earns the vault bonus on
                  rollover.
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </span>
    </>
  );
}

interface RankWidgetProps {
  walletAddress?: string | null;
  onMintAndStakeClick?: () => void;
}

export function RankWidget({
  walletAddress,
  onMintAndStakeClick,
}: RankWidgetProps) {
  const hasWallet = Boolean(walletAddress);

  const source = "rank_widget";
  const [isBreakdownOpen, setIsBreakdownOpen] = React.useState(false);

  const isValidWalletAddress =
    Boolean(walletAddress) && isAddress(walletAddress as string);

  const leaderboardQuery = useImpactLeaderboardQuery({
    enabled: Boolean(HUB_URL && hasWallet && isValidWalletAddress),
  });
  const leaderboardRows = leaderboardQuery.data?.wallets ?? [];
  const totalWalletCount = leaderboardQuery.data?.totalWalletCount ?? 0;
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? "";

  const impactScoreQuery = useQuery({
    queryKey: ["impact-glow-score", walletAddress],
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
          params: { walletAddress },
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
  const latestWeek = React.useMemo(() => {
    if (!impactScore?.weekly?.length) return null;
    return impactScore.weekly[impactScore.weekly.length - 1] ?? null;
  }, [impactScore?.weekly]);

  const totalsPoints = impactScore?.totals?.totalPoints ?? undefined;
  const weeklyPoints = latestWeek?.totalPoints ?? undefined;
  const projectedWeeklyPoints =
    impactScore?.currentWeekProjection?.projectedPoints?.totalProjectedScore ??
    undefined;

  const totalPointsNumber = React.useMemo(() => {
    const num = Number(totalsPoints ?? "0");
    if (!Number.isFinite(num)) return 0;
    return num;
  }, [totalsPoints]);

  const hasPositiveScore = totalPointsNumber > 0;
  const shouldShowMintAndStakeCta =
    Boolean(impactScore) && !impactScoreQuery.isLoading && !hasPositiveScore;

  const shouldShowBreakdownButton =
    Boolean(impactScore) && !impactScoreQuery.isLoading && hasPositiveScore;

  // Tier Logic
  const tier = React.useMemo(() => {
    const num = Number(totalsPoints ?? 0);

    if (!Number.isFinite(num)) return "PHOTON";

    if (num >= 1_000_000) return "QUASAR"; // The brightest object in the universe
    if (num >= 500_000) return "SUPERNOVA"; // The Top 3 (1.5M - 600k pts)
    if (num >= 100_000) return "SOLAR FLARE"; // The Top ~7 (300k - 100k pts)
    if (num >= 25_000) return "SUN RAY"; // The Top ~20 (99k - 25k pts)

    return "PHOTON"; // Everyone else
  }, [totalsPoints]);

  const subtitle = React.useMemo(() => {
    const projectedPoints = Number(projectedWeeklyPoints ?? "0");
    if (Number.isFinite(projectedPoints) && projectedPoints > 0)
      return `Projected ${formatPoints(
        projectedWeeklyPoints
      )} points this week`;

    const points = Number(weeklyPoints ?? "0");
    if (Number.isFinite(points) && points > 0)
      return `${formatPoints(weeklyPoints)} points last week`;
    return "Ramp impact with GCTL + vaults";
  }, [projectedWeeklyPoints, weeklyPoints]);

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

  const rankDisplay = React.useMemo(() => {
    if (impactScoreQuery.isLoading || leaderboardQuery.isLoading) return "—";

    if (selfGlobalRank && totalWalletCount > 0) {
      if (selfGlobalRank <= 3)
        return `#${selfGlobalRank.toLocaleString("en-US")}`;
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

  return (
    <>
      {/* --- DASHBOARD CARD --- */}
      <Card className="h-full overflow-hidden flex flex-col gap-4 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center justify-center gap-2 text-center">
            <span>Impact Score</span>
            <ImpactScoreHelp
              source={source}
              walletAddress={normalizedWalletAddress}
              walletConnected={hasWallet}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0 gap-4 pt-0">
          {!hasWallet ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center px-1 select-none">
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground blur-[1px] opacity-60">
                  Total
                </div>
                <div className="mt-2 font-mono text-5xl md:text-6xl font-bold tracking-tighter text-foreground tabular-nums blur-[2px] opacity-60">
                  {formatPoints(totalsPoints)}
                </div>
                <div className="mt-3 font-mono text-xs text-muted-foreground blur-[1px] opacity-60">
                  {subtitle}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] font-bold rounded-full bg-[#C084FC]/10 border-[#C084FC]/30 text-[#C084FC] blur-[1px] opacity-60"
                  >
                    {tier}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Connect your wallet
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Connect your wallet to see your Impact Score.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center px-1">
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Total
                </div>
                <div className="mt-2 font-mono text-5xl md:text-6xl font-bold tracking-tighter text-foreground tabular-nums">
                  {impactScoreQuery.isLoading
                    ? "—"
                    : formatPoints(totalsPoints)}
                </div>
                {!shouldShowMintAndStakeCta ? (
                  <div className="mt-3 font-mono text-xs text-muted-foreground">
                    {subtitle}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  {!shouldShowMintAndStakeCta ? (
                    <>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] font-bold rounded-full bg-[#C084FC]/10 border-[#C084FC]/30 text-[#C084FC]"
                      >
                        {tier}
                      </Badge>
                    </>
                  ) : null}
                </div>
              </div>
              <div className={"grid grid-cols-2 gap-3"}>
                {shouldShowMintAndStakeCta ? (
                  onMintAndStakeClick ? (
                    <Button
                      className="h-12 font-mono font-bold text-base"
                      type="button"
                      onClick={() => {
                        trackEvent("dashboard_gctl_mint_stake_open_click", {
                          source,
                          wallet_connected: hasWallet,
                          wallet_address: normalizedWalletAddress,
                        });
                        onMintAndStakeClick();
                      }}
                    >
                      Rank Up
                    </Button>
                  ) : (
                    <Button
                      className="h-12 font-mono font-bold text-base"
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
                  variant="outline"
                  className="h-12 font-mono font-bold text-base"
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
                {shouldShowBreakdownButton ? (
                  <Button
                    className="h-12 font-mono font-bold text-base"
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

      {/* --- BREAKDOWN MODAL --- */}
      <Dialog
        key={isBreakdownOpen ? "breakdown-open" : "breakdown-closed"}
        open={isBreakdownOpen}
        onOpenChange={setIsBreakdownOpen}
      >
        {hasWallet && impactScore ? (
          <ImpactScoreBreakdownDialogContent impactScore={impactScore} />
        ) : null}
      </Dialog>
    </>
  );
}

export default RankWidget;
