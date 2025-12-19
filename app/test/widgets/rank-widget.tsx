"use client";

import * as React from "react";
import Link from "next/link";
import {
  Zap,
  Coins,
  Lock,
  Wallet,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, isAddress } from "viem";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// --- Types & Helpers (Unchanged) ---

interface GlowWorthResponse {
  walletAddress: string;
  liquidGlwWei: string;
  delegatedActiveGlwWei: string;
  unclaimedGlwRewardsWei: string;
  glowWorthWei: string;
  dataSources: {
    liquidGlw: string;
    delegatedActiveGlw: string;
    unclaimedGlwRewards: string;
  };
}

interface ImpactScoreTotals {
  totalPoints: string;
  rolloverPoints: string;
  continuousPoints: string;
  inflationPoints: string;
  steeringPoints: string;
  vaultBonusPoints: string;
  totalInflationGlwWei: string;
  totalSteeringGlwWei: string;
}

interface ImpactScoreWeeklyRow {
  weekNumber: number;
  inflationGlwWei: string;
  steeringGlwWei: string;
  delegatedActiveGlwWei: string;
  protocolDepositRecoveredGlwWei: string;
  inflationPoints: string;
  steeringPoints: string;
  vaultBonusPoints: string;
  rolloverPointsPreMultiplier: string;
  rolloverMultiplier: number;
  rolloverPoints: string;
  glowWorthGlwWei: string;
  continuousPoints: string;
  totalPoints: string;
  hasCashMinerBonus: boolean;
}

interface ImpactScoreResponse {
  walletAddress: string;
  weekRange: { startWeek: number; endWeek: number };
  glowWorth: GlowWorthResponse;
  totals: ImpactScoreTotals;
  weekly: ImpactScoreWeeklyRow[];
}

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

function formatPointsRate(value?: string) {
  if (!value) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: num >= 1 ? 2 : 4,
  }).format(num);
}

// --- New Sub-Components for the Modal ---

type BreakdownTone = "cyan" | "purple" | "yellow" | "emerald";

function getToneClasses(tone: BreakdownTone) {
  if (tone === "cyan")
    return {
      row: "border-border/60 hover:border-border dark:border-white/5 dark:hover:border-white/10",
      iconWrap: "bg-[#22D3EE]/10 border-[#22D3EE]/20 text-[#22D3EE]",
      label: "text-[#22D3EE]",
      value: "text-[#22D3EE]",
    } as const;
  if (tone === "yellow")
    return {
      row: "border-border/60 hover:border-border dark:border-white/5 dark:hover:border-white/10",
      iconWrap: "bg-[#D9F368]/10 border-[#D9F368]/20 text-[#D9F368]",
      label: "text-[#D9F368]",
      value: "text-[#D9F368]",
    } as const;
  if (tone === "emerald")
    return {
      row: "border-border/60 hover:border-border dark:border-white/5 dark:hover:border-white/10",
      iconWrap: "bg-[#4ADE80]/10 border-[#4ADE80]/20 text-[#4ADE80]",
      label: "text-[#4ADE80]",
      value: "text-[#4ADE80]",
    } as const;
  return {
    row: "border-border/60 hover:border-border dark:border-white/5 dark:hover:border-white/10",
    iconWrap: "bg-[#C084FC]/10 border-[#C084FC]/20 text-[#C084FC]",
    label: "text-[#C084FC]",
    value: "text-[#C084FC]",
  } as const;
}

function BreakdownRow({
  icon: Icon,
  label,
  sublabel,
  value,
  ctaText,
  ctaHref,
  tone,
  isPassive = false,
}: {
  icon: any;
  label: string;
  sublabel: string;
  value: string;
  ctaText?: string;
  ctaHref?: string;
  tone: BreakdownTone;
  isPassive?: boolean;
}) {
  const toneClasses = getToneClasses(tone);
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border transition-all",
        isPassive
          ? "bg-muted/20 dark:bg-zinc-900/20"
          : "bg-muted/30 dark:bg-zinc-900/40",
        toneClasses.row
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg border",
            toneClasses.iconWrap
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-wide text-foreground dark:text-zinc-200",
              toneClasses.label
            )}
          >
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono dark:text-zinc-500">
            {sublabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span
          className={cn(
            "font-mono font-bold text-sm text-foreground dark:text-white",
            toneClasses.value
          )}
        >
          {value}
        </span>
        {ctaText && ctaHref && (
          <Link
            href={ctaHref}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors dark:text-zinc-500 dark:hover:text-white"
          >
            {ctaText} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

interface RankWidgetProps {
  walletAddress?: string | null;
}

export function RankWidget({ walletAddress }: RankWidgetProps) {
  const hasWallet = Boolean(walletAddress);
  const [isBreakdownOpen, setIsBreakdownOpen] = React.useState(false);

  const isValidWalletAddress =
    Boolean(walletAddress) && isAddress(walletAddress as string);

  const impactScoreQuery = useQuery({
    queryKey: ["impact-glow-score", walletAddress],
    enabled: Boolean(HUB_URL && hasWallet && isValidWalletAddress),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
    queryFn: async (): Promise<ImpactScoreResponse> => {
      try {
        if (!HUB_URL) throw new Error("NEXT_PUBLIC_HUB_URL is not set");
        if (!walletAddress) throw new Error("Missing wallet address");

        const url = new URL("/impact/glow-score", HUB_URL);
        url.searchParams.set("walletAddress", walletAddress);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as ImpactScoreResponse;
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
  const weeklySteeredGlw = safeGlwFromWei(latestWeek?.steeringGlwWei);
  const weeklyInflationGlw = safeGlwFromWei(latestWeek?.inflationGlwWei);
  const delegatedActiveGlw = safeGlwFromWei(latestWeek?.delegatedActiveGlwWei);
  const glowWorthGlw = safeGlwFromWei(impactScore?.glowWorth?.glowWorthWei);
  const hasCashMinerBonus = Boolean(latestWeek?.hasCashMinerBonus);

  // Tier Logic
  const tier = React.useMemo(() => {
    const num = Number(totalsPoints ?? "0");
    if (!Number.isFinite(num)) return "SOLAR MINNOW";
    if (num >= 25_000) return "SOLAR KRAKEN";
    if (num >= 10_000) return "SOLAR WHALE";
    if (num >= 2_500) return "SOLAR DOLPHIN";
    return "SOLAR MINNOW";
  }, [totalsPoints]);

  const subtitle = React.useMemo(() => {
    const steered = Number(weeklySteeredGlw);
    if (Number.isFinite(steered) && steered > 0) {
      return `${formatGlwCompact(weeklySteeredGlw)} GLW steered`;
    }
    return "Ramp impact with sGCTL + vaults";
  }, [weeklySteeredGlw]);

  return (
    <Dialog open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
      {/* --- DASHBOARD CARD (Untouched) --- */}
      <Card className="h-[340px] overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
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
              <div className="grid grid-cols-2 gap-3">
                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-2xl font-mono font-bold text-base"
                >
                  <Link href="/stats/rewards">Leaderboard</Link>
                </Button>
                <DialogTrigger asChild>
                  <Button
                    className="h-12 rounded-2xl font-mono font-bold text-base"
                    disabled={
                      impactScoreQuery.isLoading ||
                      impactScoreQuery.isError ||
                      !impactScore
                    }
                  >
                    Breakdown
                  </Button>
                </DialogTrigger>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* --- IMPROVED DIALOG CONTENT --- */}
      {hasWallet && impactScore ? (
        <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden rounded-3xl bg-card border-foreground/10 dark:bg-[#09090b] dark:border-zinc-800">
          {/* Header */}
          <div className="px-6 py-6 border-b border-border bg-muted/20 dark:border-zinc-800 dark:bg-zinc-900/50">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="font-mono uppercase tracking-wide text-lg text-foreground dark:text-white">
                    Score Breakdown
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground mt-1 dark:text-zinc-400">
                    Updates weekly based on your onchain activity.
                  </DialogDescription>
                </div>
                {/* Mini Score Badge in Header */}
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground font-mono dark:text-zinc-500">
                    Current Score
                  </div>
                  <div className="text-xl font-bold font-mono text-foreground tracking-tight dark:text-white">
                    {formatPoints(totalsPoints)}
                  </div>
                </div>
              </div>
            </DialogHeader>
          </div>

          <ScrollArea className="max-h-[70vh]">
            <div className="p-6 space-y-8">
              {/* SECTION 1: WEEKLY ROLLOVER (The Active Math) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider dark:text-zinc-500">
                    Weekly Rollover
                  </h4>
                  <span className="text-[10px] text-muted-foreground/80 font-mono dark:text-zinc-600">
                    Week {latestWeek?.weekNumber ?? "—"}
                  </span>
                </div>

                <div className="space-y-2">
                  {/* 1. Steering (High Impact) */}
                  <BreakdownRow
                    icon={Zap}
                    label="Steering (sGCTL)"
                    sublabel={`3.0x Multiplier • ${formatGlwCompact(
                      weeklySteeredGlw
                    )} GLW`}
                    value={`+${formatPoints(latestWeek?.steeringPoints, {
                      maximumFractionDigits: 2,
                    })}`}
                    ctaText="Stake GCTL"
                    ctaHref="/glow-swap"
                    tone="cyan"
                  />

                  {/* 2. Inflation */}
                  <BreakdownRow
                    icon={Coins}
                    label="Emissions Earned"
                    sublabel={`1.0x Multiplier • ${formatGlwCompact(
                      weeklyInflationGlw
                    )} GLW`}
                    value={`+${formatPoints(latestWeek?.inflationPoints, {
                      maximumFractionDigits: 2,
                    })}`}
                    ctaText="Buy Miner"
                    ctaHref="/?tab=launchpad&type=miners"
                    tone="yellow"
                  />

                  {/* 3. Vault */}
                  <BreakdownRow
                    icon={Lock}
                    label="Vault Bonus"
                    sublabel={`0.005x Multiplier • ${formatGlwCompact(
                      delegatedActiveGlw
                    )} GLW`}
                    value={`+${formatPointsRate(latestWeek?.vaultBonusPoints)}`}
                    ctaText="Delegate"
                    ctaHref="/?tab=launchpad&type=delegations"
                    tone="purple"
                  />
                </div>

                {/* The Multiplier Connector */}
                <div className="relative py-2">
                  <div className="absolute left-6 top-0 bottom-0 w-px bg-border/60 border-l border-dashed border-border/60 dark:bg-zinc-800 dark:border-zinc-700" />
                  <div className="relative z-10 ml-12">
                    {hasCashMinerBonus ? (
                      <div className="flex items-center justify-between p-3 bg-[#D9F368]/10 border border-[#D9F368]/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#D9F368] text-black font-bold font-mono text-sm">
                            3x
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#D9F368] uppercase">
                              Cash Miner Bonus
                            </div>
                            <div className="text-[10px] text-[#D9F368]/60">
                              Weekly points tripled
                            </div>
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-[#D9F368]" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-xl opacity-60 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold font-mono text-sm dark:bg-zinc-800 dark:text-zinc-500">
                            1x
                          </div>
                          <div>
                            <div className="text-xs font-bold text-foreground/80 uppercase dark:text-zinc-400">
                              Cash Miner Bonus
                            </div>
                            <div className="text-[10px] text-muted-foreground dark:text-zinc-600">
                              Buy a miner to triple points
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Weekly Subtotal */}
                <div className="flex justify-end pt-2 border-t border-dashed border-border dark:border-zinc-800">
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-muted-foreground mr-3 dark:text-zinc-500">
                      Weekly Total
                    </span>
                    <span className="font-mono text-xl font-bold text-foreground dark:text-white">
                      {formatPoints(latestWeek?.rolloverPoints, {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PASSIVE (Continuous) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider dark:text-zinc-500">
                  Passive Growth
                </h4>

                <BreakdownRow
                  icon={Wallet}
                  label="GLW Worth"
                  sublabel={`${formatGlwCompact(
                    glowWorthGlw
                  )} GLW × 0.001 / week`}
                  value={`+${formatPointsRate(
                    latestWeek?.continuousPoints
                  )} / week`}
                  ctaText="Buy GLW"
                  ctaHref="/glow-swap"
                  tone="emerald"
                  isPassive
                />
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export default RankWidget;
