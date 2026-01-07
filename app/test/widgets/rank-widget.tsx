"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import Link from "next/link";
import { isAddress } from "viem";
import { toast } from "sonner";

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
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { MintAndStakeGctlDialog } from "@/components/dialogs/mint-and-stake-gctl-dialog";
import {
  ImpactIndicatorsRow,
  type ImpactIndicatorsState,
} from "@/components/impact-score/impact-indicators";
import { hubGet } from "@/lib/api/hub-client";
import { trackEvent } from "@/lib/telemetry";
import {
  useImpactLeaderboardQuery,
  type ImpactGlowScoreResponse,
} from "@/hooks";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
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
  const projection = impactScore.currentWeekProjection;
  const streakBonusMultiplier = projection?.streakBonusMultiplier ?? 0;

  return {
    hasMinerMultiplier: Boolean(projection?.hasMinerMultiplier),
    hasImpactStreak: streakBonusMultiplier > 0,
    streakBonusMultiplier,
    hasSteeringStake: Boolean(projection?.hasSteeringStake),
    hasEmissionsEarned: safeNumber(impactScore.totals?.inflationPoints) > 0,
    hasVaultBonus:
      safeBigInt(impactScore.glowWorth?.delegatedActiveGlwWei) > 0n,
    hasGlwWorth: safeBigInt(impactScore.glowWorth?.glowWorthWei) > 0n,
  };
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
                    (caps +1.0×, resets on miss)
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
                      GLW (caps at +1.0× after 4 weeks; resets on miss)
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
  const [isLaunchpadOpen, setIsLaunchpadOpen] = React.useState(false);
  const [isBuyGlowOpen, setIsBuyGlowOpen] = React.useState(false);
  const [isMintAndStakeOpen, setIsMintAndStakeOpen] = React.useState(false);

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

  const totalsPoints = impactScore?.totals?.totalPoints ?? undefined;

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
        if (onMintAndStakeClick) return onMintAndStakeClick();
        setIsMintAndStakeOpen(true);
        return;
      }

      if (key === "worth") {
        setIsBuyGlowOpen(true);
        return;
      }

      setIsLaunchpadOpen(true);
    },
    [hasWallet, normalizedWalletAddress, onMintAndStakeClick, source]
  );

  return (
    <>
      {/* --- DASHBOARD CARD --- */}
      <Card className="h-full overflow-hidden flex flex-col gap-3 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border pt-4">
        <CardHeader className="py-0">
          <CardTitle className="flex items-center justify-center gap-2 text-center">
            <span>Impact Score</span>
            <ImpactScoreHelp
              source={source}
              walletAddress={normalizedWalletAddress}
              walletConnected={hasWallet}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0 gap-3 py-0">
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
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Total points
                </div>
                <div className="mt-2 font-mono text-4xl md:text-5xl font-bold tracking-tighter text-foreground tabular-nums">
                  {pointsHeroText}
                </div>

                <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Rank
                    </span>
                    <span className="tabular-nums">{rankText}</span>
                  </div>
                  <div className="h-3 w-px bg-border/60" />
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Percentile
                    </span>
                    <span className="tabular-nums">{percentileText}</span>
                  </div>
                </div>
              </div>
              {impactScore ? (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <ImpactIndicatorsRow
                    state={getIndicatorsStateFromImpactScore(impactScore)}
                    onIndicatorClick={handleIndicatorClick}
                  />
                </div>
              ) : null}

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
                <Button className="h-12 font-mono font-bold text-base" asChild>
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
                    variant="outline"
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
        />
      ) : null}

      <BuyGlowDialog
        key={isBuyGlowOpen ? "buy-glow-open" : "buy-glow-closed"}
        open={isBuyGlowOpen}
        onOpenChange={setIsBuyGlowOpen}
        usdcBalance={usdcBalance}
        glowSpotPrice={glowSpotPrice || 0}
        defaultUsdcAmount="20"
      />
    </>
  );
}

export default RankWidget;
