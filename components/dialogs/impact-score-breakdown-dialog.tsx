"use client";

import * as React from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import {
  CheckCircle2,
  Coins,
  Lock,
  Wallet,
  Zap,
  ArrowRight,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useImpactScoreQuery, type ImpactWeekRange } from "@/hooks";

interface GlowWorthResponse {
  glowWorthWei: string;
}

interface ImpactScoreTotals {
  totalPoints: string;
}

interface ImpactScoreWeeklyRow {
  weekNumber: number;
  inflationGlwWei: string;
  steeringGlwWei: string;
  delegatedActiveGlwWei: string;
  inflationPoints: string;
  steeringPoints: string;
  vaultBonusPoints: string;
  rolloverPoints: string;
  continuousPoints: string;
  hasCashMinerBonus: boolean;
}

interface ImpactScoreResponse {
  walletAddress: string;
  weekRange: ImpactWeekRange;
  glowWorth: GlowWorthResponse;
  totals: ImpactScoreTotals;
  weekly: ImpactScoreWeeklyRow[];
}

interface ImpactScoreBreakdownDialogContentProps {
  impactScore: ImpactScoreResponse;
  title?: string;
  description?: string;
}

interface ImpactScoreBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string | null;
  weekRange?: ImpactWeekRange | null;
  title?: string;
  description?: string;
}

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
      iconWrap:
        "bg-[color:var(--color-miner-yellow)]/10 border-[color:var(--color-miner-yellow)]/20 text-[color:var(--color-miner-yellow-contrast)]",
      label: "text-[color:var(--color-miner-yellow-contrast)]",
      value: "text-[color:var(--color-miner-yellow-contrast)]",
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
  icon: React.ComponentType<{ className?: string }>;
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
        {ctaText && ctaHref ? (
          <Link
            href={ctaHref}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors dark:text-zinc-500 dark:hover:text-white"
          >
            {ctaText} <ArrowRight className="w-3 h-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ImpactScoreBreakdownDialogContent(
  props: ImpactScoreBreakdownDialogContentProps
) {
  const { impactScore, title = "Score Breakdown", description } = props;

  const latestWeek = React.useMemo(() => {
    if (!impactScore?.weekly?.length) return null;
    return impactScore.weekly[impactScore.weekly.length - 1] ?? null;
  }, [impactScore.weekly]);

  const totalsPoints = impactScore?.totals?.totalPoints ?? undefined;
  const weeklySteeredGlw = safeGlwFromWei(latestWeek?.steeringGlwWei);
  const weeklyInflationGlw = safeGlwFromWei(latestWeek?.inflationGlwWei);
  const delegatedActiveGlw = safeGlwFromWei(latestWeek?.delegatedActiveGlwWei);
  const glowWorthGlw = safeGlwFromWei(impactScore?.glowWorth?.glowWorthWei);
  const hasCashMinerBonus = Boolean(latestWeek?.hasCashMinerBonus);

  return (
    <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-3xl bg-card border-foreground/10 dark:bg-[#09090b] dark:border-zinc-800">
      <div className="px-6 pr-14 py-6 border-b border-border bg-muted/20 dark:border-zinc-800 dark:bg-zinc-900/50">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-mono uppercase tracking-wide text-lg text-foreground dark:text-white">
                {title}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1 dark:text-zinc-400">
                {description ??
                  "Updates weekly based on your onchain activity."}
              </DialogDescription>
            </div>

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
              <BreakdownRow
                icon={Zap}
                label="Steering GLW (sGCTL)"
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

            <div className="relative py-2">
              <div className="absolute left-6 top-0 bottom-0 w-px bg-border/60 border-l border-dashed border-border/60 dark:bg-zinc-800 dark:border-zinc-700" />
              <div className="relative z-10 ml-12">
                {hasCashMinerBonus ? (
                  <div className="flex items-center justify-between p-3 bg-[color:var(--color-miner-yellow)]/10 border border-[color:var(--color-miner-yellow)]/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--color-miner-yellow)] text-black font-bold font-mono text-sm">
                        3x
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[color:var(--color-miner-yellow-contrast)] uppercase">
                          Cash Miner Bonus
                        </div>
                        <div className="text-[10px] text-[color:var(--color-miner-yellow-contrast)]/60">
                          Weekly points tripled
                        </div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-[color:var(--color-miner-yellow-contrast)]" />
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

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider dark:text-zinc-500">
              Passive Growth
            </h4>

            <BreakdownRow
              icon={Wallet}
              label="GLW Worth"
              sublabel={`${formatGlwCompact(glowWorthGlw)} GLW × 0.001 / week`}
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
  );
}

export function ImpactScoreBreakdownDialog(
  props: ImpactScoreBreakdownDialogProps
) {
  const { open, onOpenChange, walletAddress, weekRange, title, description } =
    props;

  const query = useImpactScoreQuery({
    walletAddress,
    weekRange,
    enabled: open,
    toastTitle: "Failed to load Impact breakdown",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {query.isLoading ? (
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-3xl bg-card border-foreground/10 dark:bg-[#09090b] dark:border-zinc-800">
          <div className="px-6 pr-14 py-6 border-b border-border bg-muted/20 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48 rounded-md" />
                <Skeleton className="h-4 w-64 rounded-md" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="h-3 w-24 rounded-md ml-auto" />
                <Skeleton className="h-7 w-20 rounded-md ml-auto" />
              </div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </DialogContent>
      ) : query.isError ? (
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-3xl bg-card border-foreground/10 dark:bg-[#09090b] dark:border-zinc-800">
          <div className="px-6 pr-14 py-6 border-b border-border bg-muted/20 dark:border-zinc-800 dark:bg-zinc-900/50">
            <DialogHeader>
              <DialogTitle className="font-mono uppercase tracking-wide text-lg text-foreground dark:text-white">
                {title ?? "Score Breakdown"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1 dark:text-zinc-400">
                {description ?? "Unable to load breakdown."}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6 text-sm text-muted-foreground">
            Unable to load.
          </div>
        </DialogContent>
      ) : query.data ? (
        <ImpactScoreBreakdownDialogContent
          impactScore={query.data as ImpactScoreResponse}
          title={title}
          description={description}
        />
      ) : null}
    </Dialog>
  );
}
