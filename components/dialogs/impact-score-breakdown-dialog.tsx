"use client";

import * as React from "react";
import { formatUnits } from "viem";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useAccount } from "wagmi";
import {
  CashMinerIcon,
  ImpactStreakIcon,
  SteeringIcon,
  EmissionsIcon,
  VaultIcon,
  GlwWorthIcon,
} from "@/components/impact-icons";

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
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { MintAndStakeGctlDialog } from "@/components/dialogs/mint-and-stake-gctl-dialog";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import {
  useImpactScoreQuery,
  type ImpactGlowScoreResponse,
  type ImpactWeekRange,
} from "@/hooks";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";

interface ImpactScoreBreakdownDialogContentProps {
  impactScore: ImpactGlowScoreResponse;
  title?: string;
  description?: string;
  showCurrentWeekProjection?: boolean;
}

interface ImpactScoreBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string | null;
  weekRange?: ImpactWeekRange | null;
  title?: string;
  description?: string;
  showCurrentWeekProjection?: boolean;
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

function safePointsNumber(value?: string): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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

function formatMultiplier(value: number | undefined) {
  if (value == null) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    num
  );
}

const GLW_DECIMALS = BigInt(1_000_000_000_000_000_000);
const POINTS_SCALE_SCALED6 = BigInt(1_000_000);

const INFLATION_POINTS_PER_GLW_SCALED6 = BigInt(1_000_000); // +1.0 per GLW
const STEERING_POINTS_PER_GLW_SCALED6 = BigInt(3_000_000); // +3.0 per GLW
const VAULT_BONUS_POINTS_PER_GLW_SCALED6 = BigInt(5_000); // +0.005 per GLW per week
const GLOW_WORTH_POINTS_PER_GLW_SCALED6 = BigInt(1_000); // +0.001 per GLW per week

function safeBigInt(value?: string) {
  if (!value) return BigInt(0);
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

function formatPointsScaled6(valueScaled6: bigint) {
  const isNegative = valueScaled6 < BigInt(0);
  const abs = isNegative ? -valueScaled6 : valueScaled6;
  const whole = abs / POINTS_SCALE_SCALED6;
  const frac = abs % POINTS_SCALE_SCALED6;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  const sign = isNegative ? "-" : "";
  return `${sign}${whole.toString()}${fracStr ? `.${fracStr}` : ""}`;
}

function glwWeiToPointsScaled6(params: {
  glwWei: bigint;
  pointsPerGlwScaled6: bigint;
}) {
  const { glwWei, pointsPerGlwScaled6 } = params;
  if (glwWei <= BigInt(0) || pointsPerGlwScaled6 <= BigInt(0)) return BigInt(0);
  return (glwWei * pointsPerGlwScaled6) / GLW_DECIMALS;
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
    iconWrap:
      "bg-delegation-purple/10 border-delegation-purple/20 text-delegation-purple",
    label: "text-delegation-purple",
    value: "text-delegation-purple",
  } as const;
}

function BreakdownRow({
  icon: Icon,
  label,
  sublabel,
  value,
  ctaText,
  ctaHref,
  onCtaClick,
  tone,
  isPassive = false,
  isDisabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  value: string;
  ctaText?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  tone: BreakdownTone;
  isPassive?: boolean;
  isDisabled?: boolean;
}) {
  const toneClasses = getToneClasses(tone);
  const disabledClasses = isDisabled
    ? ({
        row: "border-border/60 hover:border-border dark:border-white/5 dark:hover:border-white/10 opacity-60",
        iconWrap: "bg-muted/10 border-border text-muted-foreground",
        label: "text-muted-foreground",
        value: "text-muted-foreground",
      } as const)
    : null;
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border transition-all",
        isPassive
          ? "bg-muted/20 dark:bg-zinc-900/20"
          : "bg-muted/30 dark:bg-zinc-900/40",
        disabledClasses?.row ?? toneClasses.row
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-xl border",
            disabledClasses?.iconWrap ?? toneClasses.iconWrap
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-wide text-foreground dark:text-zinc-200",
              disabledClasses?.label ?? toneClasses.label
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
            disabledClasses?.value ?? toneClasses.value
          )}
        >
          {value}
        </span>
        {ctaText && (ctaHref || onCtaClick) ? (
          <button
            type="button"
            onClick={onCtaClick}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors dark:text-zinc-500 dark:hover:text-white"
          >
            {ctaText} <ArrowRight className="w-3 h-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ImpactScoreBreakdownDialogContent(
  props: ImpactScoreBreakdownDialogContentProps
) {
  const {
    impactScore,
    title = "Score Breakdown",
    description,
    showCurrentWeekProjection = true,
  } = props;

  const { address } = useAccount();
  const { usdcBalance, usdgBalance } = useWalletTokenBalances(address);
  const { spotPrice: glowSpotPrice } = useGlowSpotPrice();

  const [isLaunchpadOpen, setIsLaunchpadOpen] = React.useState(false);
  const [isMintAndStakeOpen, setIsMintAndStakeOpen] = React.useState(false);
  const [isBuyGlowOpen, setIsBuyGlowOpen] = React.useState(false);

  const latestWeek = React.useMemo(() => {
    const weekly = impactScore?.weekly ?? [];
    if (weekly.length === 0) return null;
    return weekly[weekly.length - 1] ?? null;
  }, [impactScore?.weekly]);

  const lastRolloverWeekNumber = latestWeek?.weekNumber ?? null;

  const totalsPoints = impactScore?.totals?.totalPoints ?? undefined;
  const projection = impactScore?.currentWeekProjection ?? null;
  const projectedPoints = projection?.projectedPoints ?? null;
  const hasProjection =
    showCurrentWeekProjection && Boolean(projection && projectedPoints);
  const projectedThisWeek = React.useMemo(() => {
    const totalProjectedScore = projectedPoints?.totalProjectedScore;
    const projectedPointsNumber = Number(totalProjectedScore ?? "0");
    if (!Number.isFinite(projectedPointsNumber) || projectedPointsNumber <= 0)
      return null;
    return {
      weekNumber: projection?.weekNumber ?? null,
      projectedPoints: totalProjectedScore,
    };
  }, [projectedPoints?.totalProjectedScore, projection?.weekNumber]);

  const displayedWeekNumber = hasProjection
    ? projection?.weekNumber ?? null
    : latestWeek?.weekNumber ?? null;

  const displayedSteeringGlwWei = hasProjection
    ? projectedPoints?.steeringGlwWei
    : latestWeek?.steeringGlwWei;
  const displayedInflationGlwWei = hasProjection
    ? projectedPoints?.inflationGlwWei
    : latestWeek?.inflationGlwWei;
  const displayedDelegatedGlwWei = hasProjection
    ? projectedPoints?.delegatedGlwWei
    : latestWeek?.delegatedActiveGlwWei;
  const displayedGlowWorthWei = hasProjection
    ? projectedPoints?.glowWorthWei
    : impactScore?.glowWorth?.glowWorthWei;

  const totalSteeringGlw = safeGlwFromWei(
    impactScore?.totals?.totalSteeringGlwWei
  );
  const totalInflationGlw = safeGlwFromWei(
    impactScore?.totals?.totalInflationGlwWei
  );
  const delegatedActiveGlw = safeGlwFromWei(
    impactScore?.glowWorth?.delegatedActiveGlwWei
  );
  const glowWorthGlw = safeGlwFromWei(impactScore?.glowWorth?.glowWorthWei);

  const hasSteeringMultiplier =
    safePointsNumber(impactScore?.totals?.steeringPoints) > 0;
  const hasEmissionsEarned =
    safePointsNumber(impactScore?.totals?.inflationPoints) > 0;
  const hasVaultBonus =
    safePointsNumber(impactScore?.totals?.vaultBonusPoints) > 0;
  const hasGlowWorth = safeBigInt(displayedGlowWorthWei) > 0n;

  const steeringPts = safePointsNumber(impactScore?.totals?.steeringPoints);
  const inflationPts = safePointsNumber(impactScore?.totals?.inflationPoints);
  const vaultPts = safePointsNumber(impactScore?.totals?.vaultBonusPoints);
  const rolloverPts = safePointsNumber(impactScore?.totals?.rolloverPoints);

  // The difference between the Total Rollover and the sum of base components
  // represents the points added by the Multiplier (Base 1x/3x + Streak)
  const multiplierBonusPts = Math.max(
    0,
    rolloverPts - (steeringPts + inflationPts + vaultPts)
  );

  const impactStreakWeeksLastRollover = latestWeek?.impactStreakWeeks ?? 0;
  const streakBonusMultiplierLastRollover =
    latestWeek?.streakBonusMultiplier ?? 0;
  const hasCashMinerBonusLastRollover = Boolean(latestWeek?.hasCashMinerBonus);
  const baseMultiplierLastRollover =
    latestWeek?.baseMultiplier ?? (hasCashMinerBonusLastRollover ? 3 : 1);
  const rolloverMultiplierLastRollover =
    latestWeek?.rolloverMultiplier ??
    baseMultiplierLastRollover + streakBonusMultiplierLastRollover;
  const hasStreakBonusLastRollover =
    impactStreakWeeksLastRollover > 0 && streakBonusMultiplierLastRollover > 0;

  const impactStreakWeeksThisWeek = hasProjection
    ? projection?.impactStreakWeeks ?? 0
    : 0;
  const streakBonusMultiplierThisWeek = hasProjection
    ? projection?.streakBonusMultiplier ?? 0
    : 0;
  const hasCashMinerBonusThisWeek = hasProjection
    ? Boolean(projection?.hasMinerMultiplier)
    : false;
  const baseMultiplierThisWeek = hasProjection
    ? projection?.baseMultiplier ?? (hasCashMinerBonusThisWeek ? 3 : 1)
    : baseMultiplierLastRollover;
  const rolloverMultiplierThisWeek = hasProjection
    ? projection?.totalMultiplier ??
      baseMultiplierThisWeek + streakBonusMultiplierThisWeek
    : rolloverMultiplierLastRollover;
  const hasStreakBonusThisWeek =
    hasProjection &&
    impactStreakWeeksThisWeek > 0 &&
    streakBonusMultiplierThisWeek > 0;

  const hasCashMinerBonus = hasProjection
    ? hasCashMinerBonusThisWeek
    : hasCashMinerBonusLastRollover;
  const cashMinerStatusLabel = hasProjection
    ? hasCashMinerBonusThisWeek
      ? "ACTIVE (this week)"
      : "MISSING"
    : hasCashMinerBonusLastRollover
    ? "ACTIVE (last rollover)"
    : "MISSING";
  const isCashMinerActive = hasProjection
    ? hasCashMinerBonusThisWeek
    : hasCashMinerBonusLastRollover;

  const streakStatusLabel = hasProjection
    ? hasStreakBonusThisWeek
      ? "ACTIVE (this week)"
      : "MISSING"
    : hasStreakBonusLastRollover
    ? "ACTIVE (last rollover)"
    : "MISSING";
  const isStreakActive = hasProjection
    ? hasStreakBonusThisWeek
    : hasStreakBonusLastRollover;

  const displayedImpactStreakWeeks = hasProjection
    ? impactStreakWeeksThisWeek
    : impactStreakWeeksLastRollover;
  const displayedStreakBonusMultiplier = hasProjection
    ? streakBonusMultiplierThisWeek
    : streakBonusMultiplierLastRollover;
  const displayedRolloverMultiplier = hasProjection
    ? rolloverMultiplierThisWeek
    : rolloverMultiplierLastRollover;
  const rolloverMultiplier = hasProjection
    ? rolloverMultiplierThisWeek
    : rolloverMultiplierLastRollover;

  const projectedBreakdown = React.useMemo(() => {
    if (!hasProjection) return null;

    const steeringGlwWei = safeBigInt(projectedPoints?.steeringGlwWei);
    const inflationGlwWei = safeBigInt(projectedPoints?.inflationGlwWei);
    const delegatedGlwWei = safeBigInt(projectedPoints?.delegatedGlwWei);
    const glowWorthWei = safeBigInt(projectedPoints?.glowWorthWei);

    const steeringPtsScaled6 = glwWeiToPointsScaled6({
      glwWei: steeringGlwWei,
      pointsPerGlwScaled6: STEERING_POINTS_PER_GLW_SCALED6,
    });
    const inflationPtsScaled6 = glwWeiToPointsScaled6({
      glwWei: inflationGlwWei,
      pointsPerGlwScaled6: INFLATION_POINTS_PER_GLW_SCALED6,
    });
    const vaultPtsScaled6 = glwWeiToPointsScaled6({
      glwWei: delegatedGlwWei,
      pointsPerGlwScaled6: VAULT_BONUS_POINTS_PER_GLW_SCALED6,
    });
    const continuousPtsScaled6 = glwWeiToPointsScaled6({
      glwWei: glowWorthWei,
      pointsPerGlwScaled6: GLOW_WORTH_POINTS_PER_GLW_SCALED6,
    });

    const rolloverPreScaled6 =
      steeringPtsScaled6 + inflationPtsScaled6 + vaultPtsScaled6;
    const multiplierScaled6 = BigInt(
      Math.max(
        0,
        Math.round(
          Number(rolloverMultiplier || 0) * Number(POINTS_SCALE_SCALED6)
        )
      )
    );
    const rolloverScaled6 =
      multiplierScaled6 > BigInt(0)
        ? (rolloverPreScaled6 * multiplierScaled6) / POINTS_SCALE_SCALED6
        : BigInt(0);

    return {
      steeringPoints: formatPointsScaled6(steeringPtsScaled6),
      inflationPoints: formatPointsScaled6(inflationPtsScaled6),
      vaultBonusPoints: formatPointsScaled6(vaultPtsScaled6),
      continuousPoints: formatPointsScaled6(continuousPtsScaled6),
      rolloverPoints: formatPointsScaled6(rolloverScaled6),
    };
  }, [hasProjection, projectedPoints, rolloverMultiplier]);

  return (
    <>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl bg-card border-foreground/10 dark:bg-[#09090b] dark:border-zinc-800">
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
                  Bonuses
                </h4>
                <span className="text-[10px] text-muted-foreground/80 font-mono dark:text-zinc-600">
                  Week {displayedWeekNumber ?? "—"}
                </span>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-muted/10 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                {isCashMinerActive ? (
                  <div className="flex items-center justify-between p-3 bg-[color:var(--color-miner-yellow)]/10 border border-[color:var(--color-miner-yellow)]/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--color-miner-yellow)] text-black font-bold font-mono text-sm">
                        <CashMinerIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[color:var(--color-miner-yellow-contrast)] uppercase">
                          Cash Miner Bonus
                        </div>
                        <div className="text-[10px] text-[color:var(--color-miner-yellow-contrast)]/60">
                          3× multiplier • {cashMinerStatusLabel}
                        </div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-[color:var(--color-miner-yellow-contrast)]" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-xl opacity-60 dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold font-mono text-sm dark:bg-zinc-800 dark:text-zinc-500">
                        <CashMinerIcon className="w-5 h-5 opacity-50" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground/80 uppercase dark:text-zinc-400">
                          Cash Miner Bonus
                        </div>
                        <div className="text-[10px] text-muted-foreground dark:text-zinc-600">
                          Buy a miner to triple points • {cashMinerStatusLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isStreakActive ? (
                  <div className="flex items-center justify-between p-3 bg-delegation-purple/10 border border-delegation-purple/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-delegation-purple text-black font-bold font-mono text-xs">
                        <ImpactStreakIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-delegation-purple uppercase">
                          Impact streak
                        </div>
                        <div className="text-[10px] text-delegation-purple/70 font-mono">
                          Week {Math.min(displayedImpactStreakWeeks, 4)}/4 • +
                          {formatMultiplier(displayedStreakBonusMultiplier)}×
                          bonus • {streakStatusLabel}
                        </div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-delegation-purple" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-xl opacity-60 dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold font-mono text-xs dark:bg-zinc-800 dark:text-zinc-500">
                        <ImpactStreakIcon className="w-5 h-5 opacity-50" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground/80 uppercase dark:text-zinc-400">
                          Impact streak
                        </div>
                        <div className="text-[10px] text-muted-foreground dark:text-zinc-600">
                          Increase delegation weekly for +0.25× (max +1.0×) •{" "}
                          {streakStatusLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider dark:text-zinc-500">
                  Rollover Points
                </h4>
                <span className="text-[10px] text-muted-foreground/80 font-mono dark:text-zinc-600">
                  Range {impactScore?.weekRange?.startWeek ?? "—"}–
                  {impactScore?.weekRange?.endWeek ?? "—"}
                </span>
              </div>

              <div className="space-y-2">
                <BreakdownRow
                  icon={SteeringIcon}
                  label="Steering GLW (sGCTL)"
                  sublabel={`3.0x • Total • ${formatGlwCompact(
                    totalSteeringGlw
                  )} GLW`}
                  value={`+${formatPoints(impactScore?.totals?.steeringPoints, {
                    maximumFractionDigits: 2,
                  })}`}
                  ctaText="Stake GCTL"
                  onCtaClick={() => setIsMintAndStakeOpen(true)}
                  tone="cyan"
                  isDisabled={!hasSteeringMultiplier}
                />

                <BreakdownRow
                  icon={EmissionsIcon}
                  label="Emissions Earned"
                  sublabel={`1.0x • Total • ${formatGlwCompact(
                    totalInflationGlw
                  )} GLW`}
                  value={`+${formatPoints(
                    impactScore?.totals?.inflationPoints,
                    {
                      maximumFractionDigits: 2,
                    }
                  )}`}
                  ctaText="Buy Miner"
                  onCtaClick={() => setIsLaunchpadOpen(true)}
                  tone="yellow"
                  isDisabled={!hasEmissionsEarned}
                />

                <BreakdownRow
                  icon={VaultIcon}
                  label="Vault Bonus"
                  sublabel={`0.005x • Total • ${formatGlwCompact(
                    delegatedActiveGlw
                  )} GLW delegated`}
                  value={`+${formatPoints(
                    impactScore?.totals?.vaultBonusPoints,
                    {
                      maximumFractionDigits: 2,
                    }
                  )}`}
                  ctaText="Delegate"
                  onCtaClick={() => setIsLaunchpadOpen(true)}
                  tone="purple"
                  isDisabled={!hasVaultBonus}
                />

                <BreakdownRow
                  icon={CashMinerIcon}
                  label="Multiplier Bonus"
                  sublabel="Points from Miner & Streak multipliers"
                  value={`+${formatPoints(String(multiplierBonusPts), {
                    maximumFractionDigits: 2,
                  })}`}
                  tone="yellow"
                  isDisabled={multiplierBonusPts <= 0.01}
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-dashed border-border dark:border-zinc-800">
                <div className="text-right">
                  <span className="text-[10px] uppercase text-muted-foreground mr-3 dark:text-zinc-500">
                    Rollover Total
                  </span>
                  <span className="font-mono text-xl font-bold text-foreground dark:text-white">
                    {formatPoints(impactScore?.totals?.rolloverPoints, {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  {/* {latestWeek ? (
                    <div className="mt-1 text-[10px] text-muted-foreground/80 font-mono dark:text-zinc-600">
                      Last rollover week {lastRolloverWeekNumber ?? "—"}:{" "}
                      <span className="tabular-nums">
                        +
                        {formatPoints(latestWeek.inflationPoints, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        emissions • +
                        {formatPoints(latestWeek.steeringPoints, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        steering • +
                        {formatPoints(latestWeek.vaultBonusPoints, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        vault •{" "}
                        {formatMultiplier(latestWeek.rolloverMultiplier)}×
                      </span>
                    </div>
                  ) : null} */}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider dark:text-zinc-500">
                Passive
              </h4>

              <BreakdownRow
                icon={GlwWorthIcon}
                label="GLW Worth"
                sublabel={`${formatGlwCompact(
                  glowWorthGlw
                )} GLW • Total continuous points over range`}
                value={`+${formatPoints(impactScore?.totals?.continuousPoints, {
                  maximumFractionDigits: 2,
                })}`}
                ctaText="Buy GLW"
                onCtaClick={() => setIsBuyGlowOpen(true)}
                tone="emerald"
                isPassive
              />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>

      <LaunchpadDialog
        key={isLaunchpadOpen ? "launchpad-open" : "launchpad-closed"}
        open={isLaunchpadOpen}
        onOpenChange={setIsLaunchpadOpen}
      />

      <MintAndStakeGctlDialog
        key={
          isMintAndStakeOpen ? "mint-and-stake-open" : "mint-and-stake-closed"
        }
        open={isMintAndStakeOpen}
        onOpenChange={setIsMintAndStakeOpen}
        usdcBalance={usdcBalance}
        usdgBalance={usdgBalance}
      />

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

export function ImpactScoreBreakdownDialog(
  props: ImpactScoreBreakdownDialogProps
) {
  const {
    open,
    onOpenChange,
    walletAddress,
    weekRange,
    title,
    description,
    showCurrentWeekProjection = true,
  } = props;

  const query = useImpactScoreQuery({
    walletAddress,
    weekRange,
    enabled: open,
    toastTitle: "Failed to load Impact breakdown",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {query.isLoading ? (
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl bg-card border-foreground/10 dark:bg-[#09090b] dark:border-zinc-800">
          <div className="px-6 pr-14 py-6 border-b border-border bg-muted/20 dark:border-zinc-800 dark:bg-zinc-900/50">
            <DialogHeader className="sr-only">
              <DialogTitle>{title ?? "Score Breakdown"}</DialogTitle>
              <DialogDescription>
                {description ?? "Loading breakdown."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48 rounded-xl" />
                <Skeleton className="h-4 w-64 rounded-xl" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="h-3 w-24 rounded-xl ml-auto" />
                <Skeleton className="h-7 w-20 rounded-xl ml-auto" />
              </div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            <Skeleton className="h-6 w-40 rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </DialogContent>
      ) : query.isError ? (
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl bg-card border-foreground/10 dark:bg-[#09090b] dark:border-zinc-800">
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
          impactScore={query.data}
          title={title}
          description={description}
          showCurrentWeekProjection={showCurrentWeekProjection}
        />
      ) : null}
    </Dialog>
  );
}
