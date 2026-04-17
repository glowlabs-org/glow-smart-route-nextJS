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
  ReferralIcon,
  ReferralBonusIcon,
  ActivationBonusIcon,
} from "@/components/impact-icons";
import { ReferralNetworkDialog } from "@/components/dialogs/referral-network-dialog";
import { ChangeReferrerDialog } from "@/components/referral/change-referrer-dialog";

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
  useWalletRegionAvailableStakeMap,
  useWallets,
  useActiveRegionsSummary,
} from "@/hooks";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useReferral } from "@/hooks/use-referral";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
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
  opts: { maximumFractionDigits: number } = { maximumFractionDigits: 0 },
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

const IMPACT_REGION_COLORS: Record<number, string> = {
  1: "#ffb472", // glow orange
  2: "#ccffd4", // glow green
  3: "#2081e2", // miner blue
  4: "#a855f7", // delegation purple
};

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
 * Only the icon gets colored when active - card and badge stay neutral.
 */
function MultiplierCard({
  icon: Icon,
  title,
  multiplierValue,
  isActive,
  description,
  onClick,
  colorClass, // e.g. "text-orange-500" - only applied to icon when active
  activeIconBg, // e.g. "bg-[color:var(--color-miner)]/10" - icon container bg when active
  bgClass, // e.g. "bg-muted/50" - card background
  borderClass, // e.g. "border-border/40"
}: {
  icon: React.ElementType;
  title: string;
  multiplierValue: string;
  isActive: boolean;
  description: string;
  onClick?: () => void;
  colorClass: string;
  activeIconBg?: string;
  bgClass: string;
  borderClass: string;
  shadowClass?: string; // kept for backwards compatibility
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative flex flex-col items-start p-4 rounded-xl border transition-all w-full text-left group",
        isActive
          ? cn(bgClass, borderClass)
          : "bg-muted/10 dark:bg-muted/20 border-dashed border-border/60 hover:border-border hover:bg-muted/20 dark:hover:bg-muted/30",
      )}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between w-full mb-3">
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg transition-all",
            isActive
              ? cn(activeIconBg || "bg-muted/80", colorClass)
              : "bg-muted text-muted-foreground/50 grayscale",
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div
          className={cn(
            "px-2 py-1 rounded text-xs font-mono font-bold tracking-wider",
            isActive
              ? "bg-muted/80 text-foreground"
              : "bg-muted text-muted-foreground",
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
            isActive ? "text-foreground" : "text-muted-foreground",
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
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-card/95 rounded-xl border border-dashed border-border/40">
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
 * Clean, neutral design with subtle color accent on icon when active.
 */
function SourceRow({
  icon: Icon,
  label,
  value,
  weeklyRate,
  subValue,
  ctaLabel,
  onCta,
  activeIconColor,
  activeIconBg,
  hoverColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  weeklyRate?: string;
  subValue?: string;
  ctaLabel?: string;
  onCta?: () => void;
  themeColor?: string; // kept for backwards compatibility, but ignored
  activeIconColor?: string; // color class for icon when source has value
  activeIconBg?: string; // bg color class for icon container when active (10% opacity)
  hoverColor?: string; // hover text + border color class for CTA button
}) {
  const hasValue = value !== "0" && value !== "—";

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/20 last:border-b-0">
      {/* Left: Icon + Label */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
            hasValue && activeIconColor
              ? cn(activeIconColor, activeIconBg || "bg-muted/50")
              : "bg-muted/50 text-muted-foreground",
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-foreground truncate">
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground truncate">
            {subValue || "Passive income"}
          </span>
        </div>
      </div>

      {/* Right: Values + CTA */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          {hasValue ? (
            <>
              <div className="font-mono font-semibold text-sm text-foreground">
                +{value}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {weeklyRate ? `+${weeklyRate}/wk` : "Finalized"}
              </div>
            </>
          ) : weeklyRate ? (
            <>
              <div className="font-mono font-semibold text-sm text-foreground">
                +{weeklyRate}
              </div>
              <div className="text-[10px] text-muted-foreground">Per week</div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground/50 font-mono">
              0 pts
            </div>
          )}
        </div>

        {/* CTA Button */}
        {ctaLabel && (
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-7 px-3 text-[11px] font-medium border-border/40 bg-transparent hover:bg-transparent transition-colors shrink-0",
              hoverColor,
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
  props: ImpactScoreBreakdownDialogContentProps,
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
  const [isReferralNetworkOpen, setIsReferralNetworkOpen] = useState(false);
  const [isChangeReferrerOpen, setIsChangeReferrerOpen] = useState(false);

  const { status: referralStatus } = useReferral();
  const { isLive: isReferralLive } = useReferralLaunch();

  // --- Client-Side Optimistic Data (Steering) ---
  const { walletDetails } = useWallets({
    walletAddress: address ?? undefined,
    enabled: Boolean(address),
    includeMintedEvents: false,
    includeStakeEvents: false,
    includeMigrationAmount: false,
  });
  const regionIds = useMemo(
    () => (walletDetails?.regions ?? []).map((region) => region.regionId),
    [walletDetails?.regions],
  );
  const { impactEligibleStakedGctlByRegion } = useWalletRegionAvailableStakeMap({
    walletAddress: address ?? undefined,
    regionIds,
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
      ]),
    );

    const stakes = walletDetails.regions
      .filter((r) => (impactEligibleStakedGctlByRegion.get(r.regionId) ?? 0n) > 0n)
      .map((r) => {
        const regionData = regionDataMap.get(r.regionId);
        return {
          amountGctl: gctlAmountFromRaw(
            (impactEligibleStakedGctlByRegion.get(r.regionId) ?? 0n).toString(),
          ),
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
  }, [activeSummary, impactEligibleStakedGctlByRegion, walletDetails]);

  // --- Data Logic (Extracted from previous) ---
  const latestWeek = impactScore?.weekly?.[impactScore.weekly.length - 1];
  const projection = impactScore?.currentWeekProjection;
  const projectedPoints = projection?.projectedPoints;
  const hasProjection = showCurrentWeekProjection && !!projection;

  // Multiplier States
  const hasActedThisWeek = projection?.hasImpactActionThisWeek ?? true;
  const streakFromPreviousWeek = projection?.streakAsOfPreviousWeek ?? 0;

  const hasMiner = hasProjection
    ? hasActedThisWeek
      ? (projection?.hasMinerMultiplier ?? latestWeek?.hasCashMinerBonus ?? false)
      : (latestWeek?.hasCashMinerBonus ?? projection?.hasMinerMultiplier ?? false)
    : (latestWeek?.hasCashMinerBonus ?? false);

  const streakMultiplier = hasProjection
    ? hasActedThisWeek
      ? (projection?.streakBonusMultiplier ?? latestWeek?.streakBonusMultiplier ?? 0)
      : streakFromPreviousWeek > 0
        ? Math.min(streakFromPreviousWeek * 0.25, 1.0)
        : 0
    : (latestWeek?.streakBonusMultiplier ?? 0);
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
  const referralPoints = formatPoints(
    impactScore?.composition?.referralPoints,
    {
      maximumFractionDigits: 2,
    },
  );
  const referralBonusPoints = formatPoints(
    impactScore?.composition?.referralBonusPoints,
    {
      maximumFractionDigits: 2,
    },
  );
  const referralBonusProjectedPoints = formatPoints(
    impactScore?.referral?.asReferee?.bonusPointsProjectedScaled6,
    {
      maximumFractionDigits: 2,
    },
  );
  const hasReferralBonusProjected =
    showCurrentWeekProjection &&
    safePointsNumber(impactScore?.referral?.asReferee?.bonusPointsProjectedScaled6) > 0;
  const referrerStats = impactScore?.referral?.asReferrer;
  const activeReferees = referrerStats?.activeRefereeCount ?? 0;
  const pendingReferees = referrerStats?.pendingRefereeCount ?? 0;
  const hasReferrals = activeReferees + pendingReferees > 0;
  const hasReferralPoints =
    safePointsNumber(impactScore?.composition?.referralPoints) > 0;
  const showReferralNetwork =
    isReferralLive && (isOwnWallet || hasReferrals || hasReferralPoints);
  const referralSubValue = isOwnWallet
    ? hasReferrals
      ? pendingReferees > 0
        ? `${activeReferees} active · ${pendingReferees} pending`
        : `${activeReferees} active referrals`
      : "No referrals yet"
    : "Private referral data";
  const referralCtaLabel = isOwnWallet
    ? hasReferrals || hasReferralPoints
      ? "Manage"
      : "Share"
    : "Manage";

  // Weekly GLW amounts for point calculations
  // Use projection if available, otherwise fall back to latest week's data
  const pendingSteeringGlw = weiToGlw(
    projection?.projectedPoints?.steeringGlwWei,
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

  const referralWeeklyRate =
    impactScore?.referral?.asReferrer?.thisWeekPointsScaled6 &&
    safePointsNumber(impactScore.referral.asReferrer.thisWeekPointsScaled6) > 0
      ? formatPoints(impactScore.referral.asReferrer.thisWeekPointsScaled6, {
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
        safePointsNumber(impactScore?.totals?.continuousPoints),
    ),
    { maximumFractionDigits: 0 },
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
          fill: IMPACT_REGION_COLORS[r.regionId] || "#6b7280",
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
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
        {/* HERO HEADER */}
        <div className="border-b border-border/40 pb-6 pt-8 px-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              {title || "Current Impact"}
            </DialogTitle>

            <div className="flex flex-col items-center">
              <div className="text-6xl font-mono font-semibold text-foreground tracking-tighter">
                {totalScore}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mt-2">
                Updated weekly
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[65vh]">
          <div className="p-5 space-y-8">
            {/* SECTION 1: EQUIPMENT (MULTIPLIERS) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
                  Active Multipliers
                </h3>
              </div>

              {bonusPoints > 0 && (
                <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        All Time Bonus from Multipliers
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Included in point sources below
                      </span>
                    </div>
                    <span className="text-xl font-mono font-semibold text-foreground">
                      +{formatPoints(String(bonusPoints))}
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
                  colorClass={
                    hasMiner
                      ? "text-[color:var(--color-miner-contrast)]"
                      : "text-foreground"
                  }
                  activeIconBg="bg-[color:var(--color-miner)]/10"
                  bgClass="bg-muted/50"
                  borderClass="border-border/40"
                />
                <MultiplierCard
                  icon={ImpactStreakIcon}
                  title="Streak"
                  description="Grow delegation or buy a miner weekly."
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
                  colorClass={
                    hasStreak
                      ? "text-[color:var(--delegation-purple)]"
                      : "text-foreground"
                  }
                  activeIconBg="bg-[color:var(--delegation-purple)]/10"
                  bgClass="bg-muted/50"
                  borderClass="border-border/40"
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
                  activeIconColor="text-[#22D3EE]"
                  activeIconBg="bg-[#22D3EE]/10"
                  hoverColor="hover:text-[#22D3EE] hover:border-[#22D3EE]"
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
                  activeIconColor="text-[color:var(--color-miner-contrast)]"
                  activeIconBg="bg-[color:var(--color-miner)]/10"
                  hoverColor="hover:text-[color:var(--color-miner-contrast)] hover:border-[color:var(--color-miner)]"
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
                  activeIconColor="text-[color:var(--delegation-purple)]"
                  activeIconBg="bg-[color:var(--delegation-purple)]/10"
                  hoverColor="hover:text-[color:var(--delegation-purple)] hover:border-[color:var(--delegation-purple)]"
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
                  activeIconColor="text-[#4ADE80]"
                  activeIconBg="bg-[#4ADE80]/10"
                  hoverColor="hover:text-[#4ADE80] hover:border-[#4ADE80]"
                />

                {showReferralNetwork && (
                  <SourceRow
                    icon={ReferralIcon}
                    label="Referral Network"
                    subValue={referralSubValue}
                    value={referralPoints}
                    weeklyRate={referralWeeklyRate}
                    ctaLabel={referralCtaLabel}
                    onCta={() => setIsReferralNetworkOpen(true)}
                    activeIconColor="text-[color:var(--color-glow-orange)]"
                    activeIconBg="bg-[color:var(--color-glow-orange)]/10"
                    hoverColor="hover:text-[color:var(--color-glow-orange)] hover:border-[color:var(--color-glow-orange)]"
                  />
                )}
              </div>
            </div>
            <Separator />
            {/* SECTION 3: BONUSES (REFEEES) */}
            {isReferralLive &&
              (impactScore?.referral?.asReferee?.bonusIsActive ||
                impactScore?.referral?.asReferee?.activationBonus?.awarded ||
                impactScore?.referral?.asReferee?.activationBonus?.pending) && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Referral Bonuses
                </h3>
                <div className="space-y-2">
                  {impactScore.referral.asReferee.bonusIsActive && (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[color:var(--color-glow-orange)]/10 text-[color:var(--color-glow-orange)]">
                          <ReferralBonusIcon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            +10% Referral Bonus
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {
                                impactScore.referral.asReferee
                                  .bonusWeeksRemaining
                              }{" "}
                              weeks remaining
                            </span>
                            {referralStatus?.referrer?.canChangeReferrer && (
                              <button
                                type="button"
                                onClick={() => setIsChangeReferrerOpen(true)}
                                className="text-[10px] font-medium text-foreground hover:underline"
                              >
                                Change
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold text-foreground">
                          +{referralBonusPoints} pts
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Total Earned
                        </div>
                        {hasReferralBonusProjected && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            +{referralBonusProjectedPoints} pts projected this week
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {impactScore.referral.asReferee.activationBonus?.awarded && (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[color:var(--color-glow-orange)]/10 text-[color:var(--color-glow-orange)]">
                          <ActivationBonusIcon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            Activation Bonus
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            One-time award (≥100 pts)
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold text-foreground">
                          +100 pts
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Awarded
                        </div>
                      </div>
                    </div>
                  )}

                  {impactScore.referral.asReferee.activationBonus?.pending && (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[color:var(--color-glow-orange)]/10 text-[color:var(--color-glow-orange)]">
                          <ActivationBonusIcon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            Activation Bonus
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Threshold met — activates at week end
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold text-foreground">
                          +100 pts
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Pending
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <Separator />
              </div>
            )}
            {/* REGIONAL BREAKDOWN CHART */}
            {regionalChartData.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 px-1">
                  <h3 className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
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
                <h3 className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
                  How Scores Update
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="rounded-lg bg-muted/30 dark:bg-muted/50 border border-border/30 dark:border-border/40 p-3 space-y-1.5">
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

                  <div className="rounded-lg bg-muted/30 dark:bg-muted/50 border border-border/30 dark:border-border/40 p-3 space-y-1.5">
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

      {isReferralLive ? (
        <>
          <ReferralNetworkDialog
            open={isReferralNetworkOpen}
            onOpenChange={setIsReferralNetworkOpen}
            walletAddress={walletAddress || ""}
          />
          <ChangeReferrerDialog
            open={isChangeReferrerOpen}
            onOpenChange={setIsChangeReferrerOpen}
            currentReferrerEns={impactScore?.referral?.asReferee?.referrerEns}
            currentReferrerWallet={
              impactScore?.referral?.asReferee?.referrerWallet
            }
          />
        </>
      ) : null}
    </>
  );
}

export function ImpactScoreBreakdownDialog(
  props: ImpactScoreBreakdownDialogProps,
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
        <DialogContent className="sm:max-w-md p-6 bg-card border border-border/40 rounded-2xl">
          <DialogTitle className="sr-only">Loading Impact Score</DialogTitle>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-xl bg-muted/50" />
            <Skeleton className="h-32 w-full rounded-xl bg-muted/50" />
            <Skeleton className="h-48 w-full rounded-xl bg-muted/50" />
          </div>
        </DialogContent>
      ) : query.isError ? (
        <DialogContent className="sm:max-w-md p-6 bg-card border border-border/40 rounded-2xl">
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
