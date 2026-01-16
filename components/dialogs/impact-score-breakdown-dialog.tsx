"use client";

import { formatUnits } from "viem";
import { ArrowRight, PieChart as PieChartIcon } from "lucide-react";
import { useAccount } from "wagmi";
import { Cell, Pie, PieChart } from "recharts";
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
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
} from "@/components/ui/chart";
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
import { trackEvent } from "@/lib/telemetry";

// --- Types & Interfaces ---

interface ImpactScoreBreakdownDialogContentProps {
  impactScore: ImpactGlowScoreResponse;
  title?: string;
  description?: string;
  showCurrentWeekProjection?: boolean;
  walletAddress: string | null;
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

interface RegionalLegendEntry {
  regionId: number;
  label: string;
  value: number;
  fill: string;
}

interface RegionalPointsLegendProps {
  entries: RegionalLegendEntry[];
}

function RegionalPointsLegend({ entries }: RegionalPointsLegendProps) {
  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-6">
      {entries.map((entry) => (
        <div key={entry.regionId} className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.fill }}
          />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-foreground leading-none mb-1">
              {entry.label}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground leading-none">
              {Math.round(entry.value).toLocaleString()} pts
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

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
              ? cn(bgClass, colorClass)
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
 * Responsive: stacks vertically on mobile, horizontal on larger screens.
 */
function SourceRow({
  icon: Icon,
  label,
  value,
  weeklyRate,
  subValue,
  ctaLabel,
  onCta,
  themeColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  weeklyRate?: string;
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

  return (
    <div className="group flex flex-col gap-3 p-3 rounded-xl border border-transparent hover:border-border/50 hover:bg-muted/10 transition-all sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {/* Left: Icon + Label */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border transition-colors shrink-0",
            themeStyles.icon
          )}
        >
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-foreground truncate">
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono truncate">
            {subValue || "Passive income"}
          </span>
        </div>
      </div>

      {/* Right: Values + CTA */}
      <div className="flex items-center justify-between gap-3 pl-12 sm:pl-0 sm:gap-4 sm:justify-end">
        {/* Values Container */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Finalized Value */}
          <div className="text-left sm:text-right">
            {hasValue ? (
              <>
                <div
                  className={cn(
                    "font-mono font-bold text-sm sm:text-base",
                    themeStyles.value
                  )}
                >
                  +{value}
                </div>
                <div className="text-[9px] sm:text-[10px] uppercase font-medium">
                  {weeklyRate ? (
                    <div className="flex flex-col items-start sm:items-end gap-0.5">
                      <span className="text-muted-foreground">Finalized</span>
                      <span className={cn("font-semibold", themeStyles.value)}>
                        +{weeklyRate}/wk
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Finalized</span>
                  )}
                </div>
              </>
            ) : weeklyRate ? (
              <>
                <div
                  className={cn(
                    "font-mono font-bold text-sm sm:text-base",
                    themeStyles.value
                  )}
                >
                  +{weeklyRate}
                </div>
                <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-medium">
                  Per Week
                </div>
              </>
            ) : (
              <div className="text-xs sm:text-sm text-muted-foreground/50 font-mono">
                0 pts
              </div>
            )}
          </div>
        </div>

        {/* CTA Button */}
        {ctaLabel && (
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-7 sm:h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs font-medium border-dashed bg-transparent transition-all shrink-0",
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
  const { impactScore, title, showCurrentWeekProjection, walletAddress } =
    props;
  const { address } = useAccount();
  const { usdcBalance, usdgBalance } = useWalletTokenBalances(address);
  const { spotPrice: glowSpotPrice } = useGlowSpotPrice();

  const isOwnWallet =
    address && walletAddress
      ? address.toLowerCase() === walletAddress.toLowerCase()
      : false;

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

  // Point values from totals (post-multiplier) - these add up to the total score
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

  // Weekly GLW amounts for point calculations
  // Use projection if available, otherwise fall back to latest week's data
  const pendingSteeringGlw = weiToGlw(
    projection?.projectedPoints?.steeringGlwWei
  );

  // Emissions: use projection, or fallback to latest week's emissions
  const pendingEmissionsGlw =
    weiToGlw(projection?.projectedPoints?.inflationGlwWei) ||
    weiToGlw(latestWeek?.inflationGlwWei);

  // Delegation: use glowWorth (current state), then projection, then fallback to latest week
  const pendingDelegatedGlw =
    weiToGlw(impactScore?.glowWorth?.delegatedActiveGlwWei) ||
    weiToGlw(projection?.projectedPoints?.delegatedGlwWei) ||
    weiToGlw(latestWeek?.delegatedActiveGlwWei);

  // Glow Worth: use projection, or fallback to glow worth data
  const pendingWorthGlw =
    weiToGlw(projection?.projectedPoints?.glowWorthWei) ||
    weiToGlw(impactScore?.glowWorth?.glowWorthWei) ||
    weiToGlw(latestWeek?.glowWorthGlwWei);

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

  // Weekly rates for each point source (calculated directly from GLW amounts)
  const emissionsWeeklyRate =
    pendingEmissionsGlw > 0
      ? formatPoints(String(pendingEmissionsGlw * 1), {
          maximumFractionDigits: 2,
        })
      : undefined;

  const delegationWeeklyRate =
    pendingDelegatedGlw > 0
      ? formatPoints(String(pendingDelegatedGlw * 0.005), {
          maximumFractionDigits: 2,
        })
      : undefined;

  const glowWorthWeeklyRate =
    pendingWorthGlw > 0
      ? formatPoints(String(pendingWorthGlw * 0.001), {
          maximumFractionDigits: 4,
        })
      : undefined;

  // Formatted GLW amounts for display
  const formattedEmissionsGlw =
    pendingEmissionsGlw > 0
      ? formatPoints(String(pendingEmissionsGlw), { maximumFractionDigits: 0 })
      : undefined;

  const formattedDelegatedGlw =
    pendingDelegatedGlw > 0
      ? formatPoints(String(pendingDelegatedGlw), { maximumFractionDigits: 0 })
      : undefined;

  const formattedGlwWorth =
    pendingWorthGlw > 0
      ? formatPoints(String(pendingWorthGlw), { maximumFractionDigits: 0 })
      : undefined;

  // Calculate Bonus Points (The "Extra" earned from multipliers)
  // We compute this from the weekly breakdown by calculating what points would be
  // without multipliers and comparing to actual post-multiplier points
  const bonusPoints = useMemo(() => {
    if (!impactScore?.weekly?.length) return 0;

    let totalBonus = 0;
    for (const week of impactScore.weekly) {
      const multiplier = week.rolloverMultiplier ?? 1;
      if (multiplier <= 1) continue;

      // Get post-multiplier points for this week (what we actually earned)
      const postMultiplierPoints =
        safePointsNumber(week.inflationPoints) +
        safePointsNumber(week.steeringPoints) +
        safePointsNumber(week.vaultBonusPoints) +
        safePointsNumber(week.continuousPoints);

      // Calculate what we would have earned without the multiplier
      const preMultiplierPoints = postMultiplierPoints / multiplier;

      // The bonus is the difference
      totalBonus += postMultiplierPoints - preMultiplierPoints;
    }

    return Math.max(0, totalBonus);
  }, [impactScore?.weekly]);

  const totalScore = formatPoints(
    String(
      safePointsNumber(impactScore?.totals?.rolloverPoints) +
        safePointsNumber(impactScore?.totals?.continuousPoints)
    ),
    { maximumFractionDigits: 0 }
  );

  const regions = activeSummary?.regions;

  const regionLabels: Record<number, string> = useMemo(() => {
    const labels: Record<number, string> = {
      1: "Clean Grid Project (CGP)",
      2: "Utah (UT)",
      3: "Missouri (MO)",
      4: "Colorado (CO)",
    };
    if (regions) {
      regions.forEach((r) => {
        if (!labels[r.id]) {
          labels[r.id] = r.name;
        }
      });
    }
    return labels;
  }, [regions]);

  const regionColors: Record<number, string> = {
    1: "#6b7280", // Grey - Global
    2: "#3b82f6", // Blue - UT
    3: "#10b981", // Green - MO
    4: "#f59e0b", // Amber - CO
  };

  const regionalChartData = useMemo(() => {
    if (!impactScore.regionBreakdown) return [];
    return impactScore.regionBreakdown
      .map((r) => {
        // Values from API already include multipliers - display as-is
        const directPoints = safePointsNumber(r.directPoints);
        const glowWorth = safePointsNumber(r.glowWorthPoints);
        const total = directPoints + glowWorth;
        return {
          regionId: r.regionId,
          name: `region${r.regionId}`,
          label: regionLabels[r.regionId] || `Region ${r.regionId}`,
          value: total,
          fill: regionColors[r.regionId] || "#6b7280",
        };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [impactScore.regionBreakdown, regionLabels]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    regionalChartData.forEach((d) => {
      config[`region${d.regionId}`] = {
        label: d.label,
        color: d.fill,
      };
    });
    return config;
  }, [regionalChartData]);

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
              </div>

              {bonusPoints > 0 && (
                <div className="rounded-lg bg-gradient-to-r from-[color:var(--color-miner)]/10 to-[color:var(--delegation-purple)]/10 border border-[color:var(--color-miner)]/30 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">
                        Bonus from Multipliers
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        Included in point sources below
                      </span>
                    </div>
                    <span className="text-lg font-mono font-bold text-[color:var(--color-miner)]">
                      +{formatPoints(String(bonusPoints))} pts
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <MultiplierCard
                  icon={CashMinerIcon}
                  title="Miner Bonus"
                  description="Buy a miner this week to activate."
                  multiplierValue="3.0"
                  isActive={hasMiner}
                  onClick={() => {
                    trackEvent("dashboard_breakdown_cta_click", {
                      source: "impact_breakdown_dialog",
                      wallet_connected: true,
                      wallet_address: walletAddress,
                      cta_type: "miner_bonus",
                    });
                    setIsLaunchpadOpen(true);
                  }}
                  colorClass="text-[color:var(--color-miner)]"
                  bgClass="bg-[color:var(--color-miner)]/10"
                  borderClass="border-[color:var(--color-miner)]"
                />
                <MultiplierCard
                  icon={ImpactStreakIcon}
                  title="Streak"
                  description="Grow delegation or buy a miner weekly to build."
                  multiplierValue={(1 + (streakMultiplier || 0)).toFixed(2)}
                  isActive={hasStreak}
                  onClick={() => {
                    trackEvent("dashboard_breakdown_cta_click", {
                      source: "impact_breakdown_dialog",
                      wallet_connected: true,
                      wallet_address: walletAddress,
                      cta_type: "streak",
                    });
                    setIsLaunchpadOpen(true);
                  }}
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
                  weeklyRate={pendingSteeringPoints}
                  ctaLabel={
                    isOwnWallet
                      ? steeringPoints === "0"
                        ? "Stake"
                        : "Boost"
                      : undefined
                  }
                  onCta={
                    isOwnWallet
                      ? () => {
                          trackEvent("dashboard_breakdown_cta_click", {
                            source: "impact_breakdown_dialog",
                            wallet_connected: true,
                            wallet_address: walletAddress,
                            cta_type: "steering",
                          });
                          setIsMintAndStakeOpen(true);
                        }
                      : undefined
                  }
                  themeColor="cyan"
                />

                <SourceRow
                  icon={EmissionsIcon}
                  label="Emissions"
                  subValue={
                    formattedEmissionsGlw
                      ? `${formattedEmissionsGlw} GLW × 1 pt/wk`
                      : "GLW Emissions Rewards"
                  }
                  value={emissionPoints}
                  weeklyRate={emissionsWeeklyRate}
                  ctaLabel={
                    isOwnWallet
                      ? emissionPoints === "0"
                        ? "Earn"
                        : "Add"
                      : undefined
                  }
                  onCta={
                    isOwnWallet
                      ? () => {
                          trackEvent("dashboard_breakdown_cta_click", {
                            source: "impact_breakdown_dialog",
                            wallet_connected: true,
                            wallet_address: walletAddress,
                            cta_type: "emissions",
                          });
                          setIsLaunchpadOpen(true);
                        }
                      : undefined
                  }
                  themeColor="yellow"
                />

                <SourceRow
                  icon={VaultIcon}
                  label="Delegation"
                  subValue={
                    formattedDelegatedGlw
                      ? `${formattedDelegatedGlw} GLW × 0.005 pts/wk`
                      : "Vault Bonus"
                  }
                  value={vaultPoints}
                  weeklyRate={delegationWeeklyRate}
                  ctaLabel={
                    isOwnWallet
                      ? vaultPoints === "0"
                        ? "Delegate"
                        : "Add"
                      : undefined
                  }
                  onCta={
                    isOwnWallet
                      ? () => {
                          trackEvent("dashboard_breakdown_cta_click", {
                            source: "impact_breakdown_dialog",
                            wallet_connected: true,
                            wallet_address: walletAddress,
                            cta_type: "delegation",
                          });
                          setIsLaunchpadOpen(true);
                        }
                      : undefined
                  }
                  themeColor="purple"
                />

                <SourceRow
                  icon={GlwWorthIcon}
                  label="Glow Worth"
                  subValue={
                    formattedGlwWorth
                      ? `${formattedGlwWorth} GLW × 0.001 pts/wk`
                      : "Holding GLW"
                  }
                  value={worthPoints}
                  weeklyRate={glowWorthWeeklyRate}
                  ctaLabel={isOwnWallet ? "Buy" : undefined}
                  onCta={
                    isOwnWallet
                      ? () => {
                          trackEvent("dashboard_breakdown_cta_click", {
                            source: "impact_breakdown_dialog",
                            wallet_connected: true,
                            wallet_address: walletAddress,
                            cta_type: "glow_worth",
                          });
                          setIsBuyGlowOpen(true);
                        }
                      : undefined
                  }
                  themeColor="green"
                />
              </div>
            </div>
            <Separator />
            {/* REGIONAL BREAKDOWN CHART */}
            {regionalChartData.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 px-1">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Regional Points Distribution
                  </h3>
                </div>
                <div className="relative">
                  <ChartContainer
                    config={chartConfig}
                    className="h-[220px] w-full aspect-auto"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            hideLabel
                            formatter={(value) => (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-medium tabular-nums text-foreground">
                                  {Number(value).toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                  Points
                                </span>
                              </div>
                            )}
                          />
                        }
                      />
                      <Pie
                        data={regionalChartData}
                        dataKey="value"
                        nameKey="name"
                        paddingAngle={2}
                        minAngle={4}
                        strokeWidth={0}
                      >
                        {regionalChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartLegend
                        content={
                          <RegionalPointsLegend entries={regionalChartData} />
                        }
                      />
                    </PieChart>
                  </ChartContainer>
                </div>
                <Separator />
              </div>
            )}

            {/* SCORE EXPLAINER */}
            <div className="space-y-3">
              <div className="space-y-3 px-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  How Scores Update
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="rounded-lg bg-muted/50 border p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">
                          Base Point Calculation
                        </p>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          All point sources (
                          <span className="font-medium text-foreground">
                            Emissions, Steering, Vault Bonus, and Glow Worth
                          </span>
                          ) are calculated based on your holdings and activity.
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
                          On weekly rollover, your{" "}
                          <span className="font-medium text-foreground">
                            Total Multiplier
                          </span>{" "}
                          (Miner 3× + Streak up to +1×) is applied to{" "}
                          <span className="font-medium text-foreground">
                            ALL point sources
                          </span>
                          , including Glow Worth. The points displayed above
                          already include these multipliers.
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
        source="impact_breakdown_dialog"
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
    includeWeekly: true,
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
          walletAddress={walletAddress}
        />
      ) : null}
    </Dialog>
  );
}
