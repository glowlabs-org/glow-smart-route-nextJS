"use client";

import { formatUnits } from "viem";
import {
  ArrowRight,
  Zap,
  Trophy,
  Lock,
  TrendingUp,
  Plus,
  Clock,
  Calendar,
} from "lucide-react";
import { useAccount } from "wagmi";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { MintAndStakeGctlDialog } from "@/components/dialogs/mint-and-stake-gctl-dialog";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import {
  useImpactScoreQuery,
  type ImpactGlowScoreResponse,
  type ImpactWeekRange,
  useWallets,
  useActiveRegionsSummary,
} from "@/hooks";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useMemo, useState } from "react";

// --- Types & Interfaces ---

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

// --- Formatters ---

function formatPoints(
  value?: string,
  opts: { maximumFractionDigits: number } = { maximumFractionDigits: 0 }
) {
  if (!value) return "0";
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: opts.maximumFractionDigits,
  }).format(num);
}

function safePointsNumber(value?: string): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function weiToGlw(weiValue: string | undefined): number {
  if (!weiValue) return 0;
  try {
    const glw = Number(formatUnits(BigInt(weiValue), 18));
    return Number.isFinite(glw) ? glw : 0;
  } catch {
    return 0;
  }
}

function gctlAmountFromRaw(raw: string) {
  try {
    return Number(formatUnits(BigInt(raw || "0"), DECIMALS_BY_TOKEN.GCTL));
  } catch {
    return 0;
  }
}

function formatMultiplier(value: number | undefined) {
  if (value == null) return "1.00";
  return value.toFixed(2);
}

// --- Components ---

/**
 * A "Slot" card for Multipliers.
 * Designed to look like an equipment slot in a game.
 */
function MultiplierCard({
  icon: Icon,
  title,
  multiplierValue,
  isActive,
  description,
  onClick,
  colorClass, // e.g. "text-orange-500"
  bgClass, // e.g. "bg-orange-500/10"
  borderClass, // e.g. "border-orange-500/50"
  shadowClass, // e.g. "shadow-[0_0_20px_-5px_var(--color-miner)]"
}: {
  icon: React.ElementType;
  title: string;
  multiplierValue: string;
  isActive: boolean;
  description: string;
  onClick?: () => void;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  shadowClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative flex flex-col items-start p-4 rounded-xl border transition-all w-full text-left group",
        isActive
          ? cn(bgClass, borderClass, shadowClass)
          : "bg-muted/10 border-dashed border-border/60 hover:border-border hover:bg-muted/20"
      )}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between w-full mb-3">
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg transition-all",
            isActive
              ? cn(
                  bgClass,
                  colorClass,
                  "shadow-[0_0_20px_-3px_currentColor]",
                  "dark:shadow-[0_0_25px_-5px_currentColor]"
                )
              : "bg-muted text-muted-foreground/50 grayscale"
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div
          className={cn(
            "px-2 py-1 rounded text-xs font-mono font-bold tracking-wider",
            isActive
              ? cn(bgClass, colorClass)
              : "bg-muted text-muted-foreground"
          )}
        >
          {isActive ? `${multiplierValue}x` : "INACTIVE"}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-1">
        <span
          className={cn(
            "text-sm font-bold uppercase tracking-tight",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {title}
        </span>
        <p className="text-[11px] text-muted-foreground leading-tight">
          {description}
        </p>
      </div>

      {/* Inactive Hover Prompt */}
      {!isActive && onClick && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm rounded-xl border border-dashed border-border">
          <span className="text-xs font-bold uppercase flex items-center gap-1 text-foreground">
            Activate <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}
    </button>
  );
}

/**
 * A row for a Point Source (e.g. Steering, Emissions).
 */
function SourceRow({
  icon: Icon,
  label,
  value,
  pendingValue,
  subValue,
  ctaLabel,
  onCta,
  themeColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  pendingValue?: string;
  subValue?: string;
  ctaLabel?: string;
  onCta?: () => void;
  themeColor: "cyan" | "yellow" | "purple" | "green";
}) {
  const themeStyles = {
    cyan: {
      icon: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      text: "text-cyan-700 dark:text-cyan-300",
      value: "text-cyan-600 dark:text-cyan-400",
      btn: "hover:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    },
    yellow: {
      icon: "text-[color:var(--color-miner)] bg-[color:var(--color-miner)]/10 border-[color:var(--color-miner)]/20",
      text: "text-[color:var(--color-miner)]",
      value: "text-[color:var(--color-miner)]",
      btn: "hover:bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)] border-[color:var(--color-miner)]/20",
    },
    purple: {
      icon: "text-[color:var(--delegation-purple)] bg-[color:var(--delegation-purple)]/10 border-[color:var(--delegation-purple)]/20",
      text: "text-[color:var(--delegation-purple)]",
      value: "text-[color:var(--delegation-purple)]",
      btn: "hover:bg-[color:var(--delegation-purple)]/10 !text-[color:var(--delegation-purple)] border-[color:var(--delegation-purple)]/20",
    },
    green: {
      icon: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-300",
      value: "text-emerald-600 dark:text-emerald-400",
      btn: "hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
  }[themeColor];

  const hasValue = value !== "0" && value !== "—";
  const hasPending =
    pendingValue && pendingValue !== "0" && pendingValue !== "—";

  return (
    <div className="group flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-border/50 hover:bg-muted/10 transition-all">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl border transition-colors",
            themeStyles.icon
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {subValue || "Passive income"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          {hasValue ? (
            <>
              <div
                className={cn(
                  "font-mono font-bold text-base",
                  themeStyles.value
                )}
              >
                +{value}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase font-medium">
                Finalized
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground/50 font-mono">
              0 pts
            </div>
          )}
        </div>

        {hasPending && (
          <div className="text-right border-l border-border/50 pl-3">
            <div className="font-mono font-bold text-base text-amber-500 dark:text-amber-400 flex items-center justify-end gap-1">
              <Clock className="h-3 w-3" />+{pendingValue}
            </div>
            <div className="text-[10px] text-amber-600/70 dark:text-amber-400/70 uppercase font-medium">
              Pending
            </div>
          </div>
        )}

        {ctaLabel && (
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-8 text-xs font-medium border-dashed bg-transparent transition-all",
              themeStyles.btn
            )}
            onClick={onCta}
          >
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Main Content Component ---

export function ImpactScoreBreakdownDialogContent(
  props: ImpactScoreBreakdownDialogContentProps
) {
  const { impactScore, title, showCurrentWeekProjection } = props;
  const { address } = useAccount();
  const { usdcBalance, usdgBalance } = useWalletTokenBalances(address);
  const { spotPrice: glowSpotPrice } = useGlowSpotPrice();

  // Dialog States
  const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(false);
  const [isMintAndStakeOpen, setIsMintAndStakeOpen] = useState(false);
  const [isBuyGlowOpen, setIsBuyGlowOpen] = useState(false);

  // --- Client-Side Optimistic Data (Steering) ---
  const { walletDetails } = useWallets({
    walletAddress: address ?? undefined,
    enabled: Boolean(address),
  });
  const { data: activeSummary } = useActiveRegionsSummary({
    enabled: Boolean(address),
  });

  const clientSteeringPoints = useMemo(() => {
    if (!walletDetails?.regions || !activeSummary) return 0;

    const regionDataMap = new Map(
      activeSummary.regions.map((r) => [
        r.id,
        {
          totalStaked: r.stakedGctl,
          weeklyEmissions: r.glwPerWeek,
        },
      ])
    );

    const stakes = walletDetails.regions
      .filter((r) => {
        try {
          return BigInt(r.totalStaked || "0") > BigInt(0);
        } catch {
          return false;
        }
      })
      .map((r) => {
        const regionData = regionDataMap.get(r.regionId);
        return {
          amountGctl: gctlAmountFromRaw(r.totalStaked),
          totalRegionStaked: regionData?.totalStaked ?? 0,
          weeklyEmissions: regionData?.weeklyEmissions ?? 0,
        };
      });

    const total = stakes.reduce((acc, curr) => {
      if (curr.totalRegionStaked <= 0) return acc;
      const share = curr.amountGctl / curr.totalRegionStaked;
      const glw = curr.weeklyEmissions * share;
      return acc + glw * 3;
    }, 0);

    return total;
  }, [activeSummary, walletDetails]);

  // --- Data Logic (Extracted from previous) ---
  const latestWeek = impactScore?.weekly?.[impactScore.weekly.length - 1];
  const projection = impactScore?.currentWeekProjection;
  const projectedPoints = projection?.projectedPoints;
  const hasProjection = showCurrentWeekProjection && !!projection;

  // Multiplier States
  const hasMiner = hasProjection
    ? !!projection?.hasMinerMultiplier
    : !!latestWeek?.hasCashMinerBonus;
  const streakMultiplier = hasProjection
    ? projection?.streakBonusMultiplier ?? 0
    : latestWeek?.streakBonusMultiplier ?? 0;
  const hasStreak = streakMultiplier > 0;

  // Locked Point Values (historical/finalized)
  const steeringPoints = formatPoints(impactScore?.totals?.steeringPoints, {
    maximumFractionDigits: 2,
  });
  const emissionPoints = formatPoints(impactScore?.totals?.inflationPoints, {
    maximumFractionDigits: 2,
  });
  const vaultPoints = formatPoints(impactScore?.totals?.vaultBonusPoints, {
    maximumFractionDigits: 2,
  });
  const worthPoints = formatPoints(impactScore?.totals?.continuousPoints, {
    maximumFractionDigits: 2,
  });

  // Pending Point Values (current week projection)
  // Convert wei to GLW and apply points rate:
  // - Steering: 3 pts/GLW, Emissions: 1 pt/GLW, Vault: 0.005 pts/GLW, Worth: 0.001 pts/GLW
  const pendingSteeringGlw = weiToGlw(
    projection?.projectedPoints?.steeringGlwWei
  );
  const pendingEmissionsGlw = weiToGlw(
    projection?.projectedPoints?.inflationGlwWei
  );
  const pendingDelegatedGlw = weiToGlw(
    projection?.projectedPoints?.delegatedGlwWei
  );
  const pendingWorthGlw = weiToGlw(projection?.projectedPoints?.glowWorthWei);

  // Use client-side optimistic value if available, else fall back to backend projection
  const pendingSteeringPoints = useMemo(() => {
    if (clientSteeringPoints > 0) {
      return formatPoints(String(clientSteeringPoints), {
        maximumFractionDigits: 2,
      });
    }
    return hasProjection && pendingSteeringGlw > 0
      ? formatPoints(String(pendingSteeringGlw * 3), {
          maximumFractionDigits: 2,
        })
      : undefined;
  }, [clientSteeringPoints, hasProjection, pendingSteeringGlw]);

  const pendingEmissionPoints =
    hasProjection && pendingEmissionsGlw > 0
      ? formatPoints(String(pendingEmissionsGlw * 1), {
          maximumFractionDigits: 2,
        })
      : undefined;
  const pendingVaultPoints =
    hasProjection && pendingDelegatedGlw > 0
      ? formatPoints(String(pendingDelegatedGlw * 0.005), {
          maximumFractionDigits: 2,
        })
      : undefined;
  const pendingWorthPoints =
    hasProjection && pendingWorthGlw > 0
      ? formatPoints(String(pendingWorthGlw * 0.001), {
          maximumFractionDigits: 2,
        })
      : undefined;

  // Calculate Bonus Points (The "Extra" earned from multipliers)
  const basePoints =
    safePointsNumber(impactScore?.totals?.steeringPoints) +
    safePointsNumber(impactScore?.totals?.inflationPoints) +
    safePointsNumber(impactScore?.totals?.vaultBonusPoints);
  const totalRollover = safePointsNumber(impactScore?.totals?.rolloverPoints);
  const bonusPoints = Math.max(0, totalRollover - basePoints);

  const totalScore = formatPoints(
    String(
      totalRollover + safePointsNumber(impactScore?.totals?.continuousPoints)
    ),
    { maximumFractionDigits: 0 }
  );

  return (
    <>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-background border shadow-2xl">
        {/* HERO HEADER */}
        <div className="relative overflow-hidden bg-gradient-to-br from-muted/80 via-background to-background border-b pb-6 pt-8 px-6">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center space-y-2">
            <DialogTitle className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {title || "Current Impact"}
            </DialogTitle>

            <div className="flex flex-col items-center">
              <div className="text-6xl font-mono font-bold text-foreground tracking-tighter drop-shadow-sm">
                {totalScore}
              </div>
              <div className="flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-muted border">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  Updating Weekly
                </span>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[65vh]">
          <div className="p-5 space-y-8">
            {/* SECTION 1: EQUIPMENT (MULTIPLIERS) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Active Multipliers
                </h3>
                {bonusPoints > 0 && (
                  <span className="text-[10px] font-mono text-[color:var(--color-miner)]">
                    +{formatPoints(String(bonusPoints))} pts bonus
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MultiplierCard
                  icon={CashMinerIcon}
                  title="Miner Bonus"
                  description="Buy a miner this week to activate."
                  multiplierValue="3.0"
                  isActive={hasMiner}
                  onClick={() => setIsLaunchpadOpen(true)}
                  colorClass="text-[color:var(--color-miner)]"
                  bgClass="bg-[color:var(--color-miner)]/10"
                  borderClass="border-[color:var(--color-miner)]"
                />
                <MultiplierCard
                  icon={ImpactStreakIcon}
                  title="Streak"
                  description="Grow delegation weekly to build."
                  multiplierValue={(1 + (streakMultiplier || 0)).toFixed(2)}
                  isActive={hasStreak}
                  onClick={() => setIsLaunchpadOpen(true)} // Or dedicated streak modal
                  colorClass="text-[color:var(--delegation-purple)]"
                  bgClass="bg-[color:var(--delegation-purple)]/10"
                  borderClass="border-[color:var(--delegation-purple)]"
                />
              </div>
            </div>

            <Separator />

            {/* SECTION 2: POINT SOURCES */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                Point Sources
              </h3>

              <div className="space-y-2">
                <SourceRow
                  icon={SteeringIcon}
                  label="Steering Power"
                  subValue="Staked GCTL (3x Pts)"
                  value={steeringPoints}
                  pendingValue={pendingSteeringPoints}
                  ctaLabel={steeringPoints === "0" ? "Stake" : "Boost"}
                  onCta={() => setIsMintAndStakeOpen(true)}
                  themeColor="cyan"
                />

                <SourceRow
                  icon={EmissionsIcon}
                  label="Emissions"
                  subValue="Mining Rewards (1x Pts)"
                  value={emissionPoints}
                  pendingValue={pendingEmissionPoints}
                  ctaLabel={emissionPoints === "0" ? "Earn" : "Add"}
                  onCta={() => setIsLaunchpadOpen(true)}
                  themeColor="yellow"
                />

                <SourceRow
                  icon={VaultIcon}
                  label="Delegation"
                  subValue="Vault Bonus (0.005x)"
                  value={vaultPoints}
                  pendingValue={pendingVaultPoints}
                  ctaLabel={vaultPoints === "0" ? "Delegate" : "Add"}
                  onCta={() => setIsLaunchpadOpen(true)}
                  themeColor="purple"
                />

                <SourceRow
                  icon={GlwWorthIcon}
                  label="Glow Worth"
                  subValue="Holding GLW"
                  value={worthPoints}
                  pendingValue={pendingWorthPoints}
                  ctaLabel="Buy"
                  onCta={() => setIsBuyGlowOpen(true)}
                  themeColor="green"
                />
              </div>
            </div>

            {/* SCORE EXPLAINER */}
            <div className="space-y-3">
              <Separator />

              <div className="space-y-3 px-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  How Scores Update
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="rounded-lg bg-muted/50 border p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">
                          Continuous Updates
                        </p>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          <span className="font-medium text-foreground">
                            Glow Worth
                          </span>{" "}
                          points update in real-time as you hold GLW (+0.001
                          pts/week per GLW).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 border p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">
                          Weekly Rollover (Sundays 00:00 UTC)
                        </p>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          <span className="font-medium text-foreground">
                            Emissions, Steering, and Vault Bonus
                          </span>{" "}
                          points are calculated and locked in each week.
                          Multipliers (Miner 3×, Streak up to +1×) are applied
                          to these rollover points.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>

      {/* Sub-Dialogs */}
      <LaunchpadDialog
        open={isLaunchpadOpen}
        onOpenChange={setIsLaunchpadOpen}
      />
      <MintAndStakeGctlDialog
        open={isMintAndStakeOpen}
        onOpenChange={setIsMintAndStakeOpen}
        usdcBalance={usdcBalance}
        usdgBalance={usdgBalance}
      />
      <BuyGlowDialog
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
        <DialogContent className="sm:max-w-md p-6 bg-[#09090b] border-white/10">
          <DialogTitle className="sr-only">Loading Impact Score</DialogTitle>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-xl bg-zinc-800" />
            <Skeleton className="h-32 w-full rounded-xl bg-zinc-800" />
            <Skeleton className="h-48 w-full rounded-xl bg-zinc-800" />
          </div>
        </DialogContent>
      ) : query.isError ? (
        <DialogContent className="sm:max-w-md p-6 bg-[#09090b] border-white/10">
          <DialogTitle className="sr-only">Error</DialogTitle>
          <div className="text-center text-zinc-500 py-10">
            Unable to load score data.
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
