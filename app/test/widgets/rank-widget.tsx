"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, isAddress } from "viem";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImpactScoreBreakdownDialogContent } from "@/components/dialogs/impact-score-breakdown-dialog";
import { ImpactView } from "@/app/stats/rewards/impact-view";
import { hubGet } from "@/lib/api/hub-client";
import type { ImpactGlowScoreResponse } from "@/hooks";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

function safeGlwFromWei(wei?: string) {
  if (!wei) return "0";
  try {
    return formatUnits(BigInt(wei), 18);
  } catch {
    return "0";
  }
}

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

function formatGlwCompact(value?: string) {
  if (!value) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: num >= 1_000 ? 0 : 2,
  }).format(num);
}

interface RankWidgetProps {
  walletAddress?: string | null;
}

export function RankWidget({ walletAddress }: RankWidgetProps) {
  const hasWallet = Boolean(walletAddress);
  const [isBreakdownOpen, setIsBreakdownOpen] = React.useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = React.useState(false);

  const isValidWalletAddress =
    Boolean(walletAddress) && isAddress(walletAddress as string);

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

  const totalPointsNumber = React.useMemo(() => {
    const num = Number(totalsPoints ?? "0");
    if (!Number.isFinite(num)) return 0;
    return num;
  }, [totalsPoints]);

  const shouldShowBreakdownButton =
    Boolean(impactScore) &&
    !impactScoreQuery.isLoading &&
    totalPointsNumber > 0;

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
    const points = Number(weeklyPoints ?? "0");
    if (Number.isFinite(points) && points > 0)
      return `${formatPoints(weeklyPoints)} points this week`;
    return "Ramp impact with GCTL + vaults";
  }, [weeklyPoints]);

  return (
    <>
      {/* --- DASHBOARD CARD --- */}
      <Card className="h-full overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
        <CardHeader className="pb-3 space-y-3">
          <CardTitle className="text-center">Impact Score</CardTitle>
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
                <Badge
                  variant="outline"
                  className="mt-2 font-mono text-[10px] font-bold rounded-full bg-[#C084FC]/10 border-[#C084FC]/30 text-[#C084FC] blur-[1px] opacity-60"
                >
                  {tier}
                </Badge>
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
                <div className="mt-3 font-mono text-xs text-muted-foreground">
                  {subtitle}
                </div>
                <Badge
                  variant="outline"
                  className="mt-2 font-mono text-[10px] font-bold rounded-full bg-[#C084FC]/10 border-[#C084FC]/30 text-[#C084FC]"
                >
                  {tier}
                </Badge>
              </div>
              <div
                className={
                  shouldShowBreakdownButton
                    ? "grid grid-cols-2 gap-3"
                    : "grid grid-cols-1 gap-3"
                }
              >
                <Button
                  variant="outline"
                  className="h-12 font-mono font-bold text-base"
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                >
                  Leaderboard
                </Button>
                {shouldShowBreakdownButton ? (
                  <Button
                    className="h-12 font-mono font-bold text-base"
                    type="button"
                    onClick={() => setIsBreakdownOpen(true)}
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

      {/* --- LEADERBOARD MODAL --- */}
      <Dialog
        key={isLeaderboardOpen ? "leaderboard-open" : "leaderboard-closed"}
        open={isLeaderboardOpen}
        onOpenChange={setIsLeaderboardOpen}
      >
        <DialogContent className="bg-background rounded-3xl p-0 sm:max-w-[1100px] w-full border-border shadow-2xl overflow-hidden">
          <div className="max-h-[85vh] overflow-y-auto p-6">
            <ImpactView
              key={
                isLeaderboardOpen
                  ? "impact-leaderboard-open"
                  : "impact-leaderboard-closed"
              }
            />
          </div>
        </DialogContent>
      </Dialog>

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
