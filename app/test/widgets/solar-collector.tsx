"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";
import {
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Info,
  Leaf,
  Zap,
  PieChart as PieChartIcon,
  TrendingUp,
  Activity,
  Globe,
  Lock,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectButton } from "@/components/connect-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";
import {
  useSolarCollectorQuery,
  formatWhenLabel,
  calculateImpact,
} from "@/hooks/hub-solar-collector";
import { useRegions } from "@/hooks/control-regions";
import { hubGet } from "@/lib/api/hub-client";
import { useLang, getBcp47, type Strings } from "@/lib/i18n";
import { WalletImpactDialog } from "@/app/stats/rewards/wallet-impact-dialog";
import { useV2ImpactWallet } from "@/hooks/v2-impact";
import {
  useGctlSteering,
  formatCompact,
  type GctlSteeringStake,
} from "@/hooks/use-gctl-steering";
import { SteeringIcon } from "@/components/impact-icons";

const SOLAR_ORANGE = "#ffb472";
const SOLAR_YELLOW = "#ffd37a";
const WATTS_PER_PANEL = 400;

const GENESIS_TIMESTAMP = 1700352000;

function weekToDate(week: number) {
  // Add 1 to the week to get the timestamp for the end of that protocol week
  return new Date((GENESIS_TIMESTAMP + (week + 1) * 604800) * 1000);
}

function formatEnergyValue(kwh: number): string {
  if (!Number.isFinite(kwh) || kwh === 0) return "0";
  if (kwh < 1000) return Math.round(kwh).toLocaleString();
  const mwh = kwh / 1000;
  if (mwh >= 1000) return `${(mwh / 1000).toFixed(1)}`;
  if (mwh >= 100) return mwh.toFixed(0);
  if (mwh >= 10) return mwh.toFixed(1);
  return mwh.toFixed(2);
}

function getEnergyUnit(kwh: number): string {
  if (!Number.isFinite(kwh) || kwh === 0) return "MWh";
  if (kwh < 1000) return "kWh";
  const mwh = kwh / 1000;
  if (mwh >= 1000) return "GWh";
  return "MWh";
}

function formatCaptureValue(watts: number): string {
  if (watts < 1000) return Math.round(watts).toLocaleString();
  return (watts / 1000).toFixed(2);
}

function getCaptureUnit(watts: number): string {
  return watts < 1000 ? "Watts" : "kW";
}

function getShareWattsLabel(watts: number): { value: string; unit: string } {
  if (watts >= 1_000_000) {
    return { value: (watts / 1_000_000).toFixed(2), unit: "MW" };
  }
  if (watts >= 1000) return { value: (watts / 1000).toFixed(2), unit: "kW" };
  return { value: Math.round(watts).toLocaleString(), unit: "W" };
}

function getShareHomesLabel(homesPowered: number): {
  value: string;
  unit: string;
  count: number;
} {
  if (homesPowered < 1) {
    const bulbCount = homesPowered * 40;
    return {
      value: bulbCount.toLocaleString(undefined, {
        maximumFractionDigits: 1,
      }),
      unit: "bulbs",
      count: bulbCount,
    };
  }
  return {
    value: homesPowered.toLocaleString(),
    unit: "homes",
    count: homesPowered,
  };
}

const REGION_COLORS: Record<number, string> = {
  1: "#6b7280", // Clean Grid Project, grey
  2: "#3b82f6", // Utah, blue
  3: "#10b981", // Missouri, green
  4: "#f59e0b", // Colorado, amber
  5: "#eab308", // Rajasthan, yellow
  6: "#ec4899", // Florida, pink
  7: "#06b6d4", // Lebanon, cyan
  8: "#a855f7", // Oklahoma, purple
  9: "#14b8a6", // Idaho, teal
  10: "#0ea5e9", // U.S. Virgin Islands (USVI), sky
  11: "#f43f5e", // Michigan, rose
};
const REGION_FALLBACK_PALETTE = [
  "#84cc16",
  "#d946ef",
  "#f97316",
  "#22d3ee",
  "#facc15",
];
const REGION_DEFAULT_COLOR = "#94a3b8";

function getRegionColor(regionId: number): string {
  if (REGION_COLORS[regionId]) return REGION_COLORS[regionId];
  if (regionId > 0) {
    return REGION_FALLBACK_PALETTE[
      (regionId - 1) % REGION_FALLBACK_PALETTE.length
    ];
  }
  return REGION_DEFAULT_COLOR;
}

function buildRegionChartLabel(region: {
  name: string;
  code: string;
}): string {
  // Legend shows the short region code only (e.g. "UT", "RJ") so the chart
  // stays compact with many regions; full names wrap and crowd the pie.
  const code = region.code;
  if (!code || code === "*") return region.name;
  return code.startsWith("US-") ? code.slice(3) : code;
}

function getRegionLabel(
  regionId: number | null,
  regions: Array<{ id: number; code: string }> | undefined,
  cleanGridLabel: string,
): string {
  if (!regionId) return "";
  const region = regions?.find((r) => r.id === regionId);
  if (!region) return "";
  const code = region.code;
  if (code === "*") return cleanGridLabel;
  if (code.startsWith("US-")) return code.slice(3);
  return code;
}

function getRegionCode(
  regionId: number | null,
  regions: Array<{ id: number; code: string }> | undefined,
  cleanGridCode: string,
): string {
  if (!regionId) return "";
  const region = regions?.find((r) => r.id === regionId);
  if (!region) return "";
  const code = region.code;
  if (code === "*") return cleanGridCode;
  if (code.startsWith("US-")) return code.slice(3);
  return code;
}

function getRegionCodeFromName(
  name: string | number | undefined,
  regions: Array<{ id: number; code: string }> | undefined,
  cleanGridCode: string,
): string {
  if (!name || typeof name !== "string") return "";
  const match = name.match(/region(\d+)/);
  if (!match) return "";
  return getRegionCode(Number(match[1]), regions, cleanGridCode);
}

interface SolarFootprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SolarFootprintDialog({
  open,
  onOpenChange,
}: SolarFootprintDialogProps) {
  const { t } = useLang();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card rounded-2xl p-0 sm:max-w-md w-full border border-border/40 overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border/60">
          <DialogTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            {t.widgets.solarCollector.dialogTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-border bg-muted/10 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg border border-border bg-background flex items-center justify-center">
                <Leaf className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-base font-semibold">
                  {t.widgets.solarCollector.cardHeading}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.widgets.solarCollector.cardSubheading}
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {t.widgets.solarCollector.mainDescription}
            </div>
            <div className="pt-1">
              <div className="p-3 bg-glow-orange/5 border border-glow-orange/10 rounded-lg">
                <div className="text-[10px] font-bold text-glow-orange flex items-center gap-1.5 uppercase tracking-wider">
                  {t.widgets.solarCollector.impactPowerLabel}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {t.widgets.solarCollector.impactPowerDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-1 pb-1">
              {t.widgets.solarCollector.whatToExpect}
            </div>
            <div className="rounded-xl border border-border bg-muted/5 divide-y divide-border/40">
              <div className="p-3.5 flex items-start gap-3">
                <Zap className="h-4 w-4 text-amber-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">
                    {t.widgets.solarCollector.expectItem1Title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.widgets.solarCollector.expectItem1Body}
                  </div>
                </div>
              </div>
              <div className="p-3.5 flex items-start gap-3">
                <PieChartIcon className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">
                    {t.widgets.solarCollector.expectItem2Title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.widgets.solarCollector.expectItem2Body}
                  </div>
                </div>
              </div>
              <div className="p-3.5 flex items-start gap-3">
                <TrendingUp className="h-4 w-4 text-sky-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">
                    {t.widgets.solarCollector.expectItem3Title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.widgets.solarCollector.expectItem3Body}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button
            type="button"
            className="w-full h-11"
            onClick={() => onOpenChange(false)}
          >
            {t.widgets.solarCollector.gotIt}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SolarCollectorWidgetProps {
  walletAddress?: string | null;
  onViewGridClick?: () => void;
  onHowItWorksClick?: () => void;
  onShareClick?: () => void;
  onFarmClick?: (farmId: string) => void;
  onMintAndStakeClick?: () => void;
  readOnly?: boolean;
}

function ImpactSummarySkeleton() {
  return (
    <Card className="overflow-hidden w-full py-0 bg-card dark:bg-card border-border/20 mb-6">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border/50 flex flex-col md:flex-row gap-4">
          <Skeleton className="h-16 flex-1 rounded-xl" />
          <Skeleton className="h-16 w-full md:w-64 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

// A single region the wallet is steering toward (moved from the GCTL widget).
// Shows region name, GCTL staked (+ locked), and the GLW it directs per week,
// with a normalized background fill for the share of region controlled.
function RegionSteeringRow({
  regionName,
  userStakedGctl,
  lockedGctl,
  totalRegionStakedGctl,
  regionWeeklyEmissions,
  isMax,
  normalizedWidth,
  labels,
}: {
  regionName: string;
  userStakedGctl: number;
  lockedGctl: number;
  totalRegionStakedGctl: number;
  regionWeeklyEmissions: number;
  isMax: boolean;
  normalizedWidth: number;
  labels: Strings["widgets"]["gctlHeatmap"];
}) {
  const shareOfRegion =
    totalRegionStakedGctl > 0 ? userStakedGctl / totalRegionStakedGctl : 0;
  const glwDirected = regionWeeklyEmissions * shareOfRegion;

  const lockedFraction =
    userStakedGctl > 0
      ? Math.min(Math.max(lockedGctl / userStakedGctl, 0), 1)
      : 0;
  const availableWidth = normalizedWidth * (1 - lockedFraction);
  const lockedWidth = normalizedWidth * lockedFraction;
  const hasLocked = lockedGctl > 0;

  return (
    <div className="group relative overflow-hidden rounded-xl bg-muted/30 border border-border/20 transition-all hover:bg-muted/40 hover:border-border/40">
      <div
        className="absolute inset-y-0 left-0 bg-[#22D3EE]/15 transition-all duration-700 ease-out"
        style={{ width: `${availableWidth}%` }}
      />
      <div
        className="absolute inset-y-0 bg-amber-400/25 transition-all duration-700 ease-out"
        style={{ left: `${availableWidth}%`, width: `${lockedWidth}%` }}
      />

      <div className="relative flex items-center justify-between p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors",
              isMax
                ? "bg-[#22D3EE]/10 text-[#22D3EE]"
                : "bg-muted/50 text-muted-foreground"
            )}
          >
            <Globe className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm text-foreground leading-none truncate">
              {regionName}
            </div>
            <div className="text-[10px] text-muted-foreground/60 font-mono mt-1 flex items-center gap-1.5">
              <span>
                {labels.rowGctlStakedSuffix(formatCompact(userStakedGctl))}
              </span>
              {hasLocked && (
                <>
                  <span aria-hidden>•</span>
                  <span
                    className="inline-flex items-center gap-1 text-amber-500"
                    title={labels.lockedTooltip}
                  >
                    <Lock className="h-2.5 w-2.5" />
                    {formatCompact(lockedGctl)} {labels.lockedSuffix}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-mono font-semibold text-foreground flex items-center justify-end gap-1">
            {formatCompact(glwDirected)}{" "}
            <span className="text-[10px] text-muted-foreground/60 font-normal">
              {labels.rowGlwPerWeek}
            </span>
          </div>
          <div className="text-[10px] text-[#22D3EE] font-medium">
            {totalRegionStakedGctl > 0
              ? labels.rowDirectingPct((shareOfRegion * 100).toFixed(2))
              : labels.rowDirectingEmissions}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SolarCollectorWidget({
  walletAddress,
  onViewGridClick,
  onHowItWorksClick,
  onShareClick,
  onFarmClick,
  onMintAndStakeClick,
  readOnly = false,
}: SolarCollectorWidgetProps) {
  const { t, lang } = useLang();
  const chainId = useChainId();
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "impact_summary_widget";
  const [isLearnMoreOpen, setIsLearnMoreOpen] = React.useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = React.useState(false);
  const [showAllStakes, setShowAllStakes] = React.useState(false);

  // GCTL / steering position, folded into the My Impact section.
  const gctl = useGctlSteering({
    walletAddress: normalizedWalletAddress,
    enabled: true,
  });
  const MAX_VISIBLE_STAKES = 3;
  const hasMoreStakes = gctl.stakes.length > MAX_VISIBLE_STAKES;
  const visibleStakes =
    hasMoreStakes && showAllStakes
      ? gctl.stakes
      : gctl.stakes.slice(0, MAX_VISIBLE_STAKES);
  const hiddenStakesCount = Math.max(
    gctl.stakes.length - MAX_VISIBLE_STAKES,
    0
  );
  const handleMintAndStake = () => {
    trackEvent("dashboard_gctl_mint_stake_open_click", {
      source,
      wallet_connected: Boolean(normalizedWalletAddress),
      wallet_address: normalizedWalletAddress,
    });
    onMintAndStakeClick?.();
  };

  // The headline watts count, sourced from the same V2 aggregate the watts
  // leaderboard uses so the number matches exactly.
  const v2ImpactQuery = useV2ImpactWallet(normalizedWalletAddress);
  const v2TotalWatts = v2ImpactQuery.data?.totalWatts;

  const { model } = useSolarCollectorQuery({
    walletAddress: normalizedWalletAddress,
    enabled: true,
    includeCurrentWeekPower: true,
  });

  // Real-world impact (energy / homes / trees) is derived from the same V2
  // watts shown in the headline so the metrics stay consistent with it; falls
  // back to the solar-collector model only while the V2 watts are unavailable.
  const impact = React.useMemo(() => {
    const v2Watts = Number(v2TotalWatts);
    if (Number.isFinite(v2Watts) && v2Watts > 0) {
      return calculateImpact(v2Watts);
    }
    return model.impact;
  }, [v2TotalWatts, model.impact]);

  const { regions } = useRegions();

  const chartConfig = React.useMemo<ChartConfig>(() => {
    const config: ChartConfig = {
      region1: {
        label: t.widgets.solarCollector.chartCleanGridProject,
        color: getRegionColor(1),
      },
      region2: {
        label: t.widgets.solarCollector.chartUtah,
        color: getRegionColor(2),
      },
      region3: {
        label: t.widgets.solarCollector.chartMissouri,
        color: getRegionColor(3),
      },
      region4: {
        label: t.widgets.solarCollector.chartColorado,
        color: getRegionColor(4),
      },
      total: {
        label: t.widgets.solarCollector.chartTotalWatts,
        color: "#f59e0b",
      },
      share: {
        label: t.widgets.solarCollector.chartNetworkShare,
        color: "#10b981",
      },
    };
    if (regions) {
      for (const region of regions) {
        const key = `region${region.id}`;
        // region1 (Clean Grid Project) keeps its dedicated label; every other
        // region — including the hardcoded Utah/Missouri/Colorado fallbacks —
        // is overwritten with its short code so the legend stays compact.
        if (key === "region1") continue;
        config[key] = {
          label: buildRegionChartLabel(region),
          color: getRegionColor(region.id),
        };
      }
    }
    return config;
  }, [t.widgets.solarCollector, regions]);

  const distributionData = React.useMemo(() => {
    const cgpLabel = t.widgets.solarCollector.chartCleanGridProject;
    return Object.entries(model.wattsByRegion)
      .map(([rid, watts]) => {
        const id = Number(rid);
        const region = regions?.find((r) => r.id === id);
        const fullName = region
          ? region.code === "*"
            ? cgpLabel
            : region.name
          : `Region ${id}`;
        return {
          regionId: id,
          name: `region${rid}`,
          fullName,
          value: watts,
          fill: getRegionColor(id),
        };
      })
      .filter((d) => d.value > 0);
  }, [model.wattsByRegion, regions, t.widgets.solarCollector]);

  const trendRegionIds = React.useMemo(() => {
    const ids = new Set<number>();
    for (const item of model.weeklyPowerHistory) {
      ids.add(item.regionId);
    }
    return Array.from(ids).sort((a, b) => a - b);
  }, [model.weeklyPowerHistory]);

  const growthData = React.useMemo(() => {
    return model.weeklyHistory.map((item) => ({
      week: item.weekNumber,
      date: weekToDate(item.weekNumber),
      watts: item.cumulativeWatts,
      panels: (item.cumulativeWatts / WATTS_PER_PANEL).toFixed(1),
    }));
  }, [model.weeklyHistory]);

  const impactPowerTrendData = React.useMemo(() => {
    const allRids = new Set<number>();
    interface WeekRow {
      week: number;
      date: Date;
      rolloverMultiplier: number;
      hasCashMinerBonus: boolean;
      streakBonusMultiplier: number;
      impactStreakWeeks: number;
      [key: string]: number | Date | boolean;
    }
    const rowsByWeek = new Map<number, WeekRow>();

    model.weeklyPowerHistory.forEach((item) => {
      allRids.add(item.regionId);
      if (!rowsByWeek.has(item.weekNumber)) {
        rowsByWeek.set(item.weekNumber, {
          week: item.weekNumber,
          date: weekToDate(item.weekNumber),
          rolloverMultiplier: item.rolloverMultiplier ?? 1,
          hasCashMinerBonus: item.hasCashMinerBonus ?? false,
          streakBonusMultiplier: item.streakBonusMultiplier ?? 0,
          impactStreakWeeks: item.impactStreakWeeks ?? 0,
        });
      }
      // Points from backend are already post-multiplier (stored in power_by_region_by_week with multipliers applied)
      const points = item.directPoints + item.glowWorthPoints;
      rowsByWeek.get(item.weekNumber)![`region${item.regionId}`] = points;
    });

    const sortedWeeks = Array.from(rowsByWeek.keys()).sort((a, b) => a - b);
    const regionIds = Array.from(allRids);

    // Track cumulative totals per region
    const cumulativeByRegion = new Map<number, number>();
    regionIds.forEach((rid) => cumulativeByRegion.set(rid, 0));

    return sortedWeeks.map((week) => {
      const row = rowsByWeek.get(week)!;
      // Add this week's points to cumulative totals and store cumulative values
      regionIds.forEach((rid) => {
        const weeklyPoints = Number(row[`region${rid}`] ?? 0);
        const prevCumulative = cumulativeByRegion.get(rid) || 0;
        const newCumulative = prevCumulative + weeklyPoints;
        cumulativeByRegion.set(rid, newCumulative);
        row[`region${rid}`] = newCumulative;
      });
      return row;
    });
  }, [model.weeklyPowerHistory]);

  const maxGrowthWatts = React.useMemo(() => {
    if (!growthData.length) return 0;
    return Math.max(...growthData.map((d) => d.watts));
  }, [growthData]);

  const maxImpactPower = React.useMemo(() => {
    if (!impactPowerTrendData.length) return 0;
    return Math.max(
      ...impactPowerTrendData.flatMap((row) =>
        Object.keys(row)
          .filter((key) => key.startsWith("region"))
          .map((key) => Number(row[key] ?? 0))
      )
    );
  }, [impactPowerTrendData]);

  const growthYAxisFormatter = React.useCallback(
    (value: number) => {
      if (value === 0) return "0";
      if (maxGrowthWatts >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (maxGrowthWatts >= 1000) return `${(value / 1000).toFixed(1)}k`;
      return `${value}W`;
    },
    [maxGrowthWatts]
  );

  const impactPowerYAxisFormatter = React.useCallback(
    (value: number) => {
      if (value === 0) return "0";
      if (maxImpactPower >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (maxImpactPower >= 1000) return `${(value / 1000).toFixed(1)}k`;
      return value.toFixed(0);
    },
    [maxImpactPower]
  );

  const recentDropRegionLabel = model.recentDrop
    ? getRegionLabel(model.recentDrop.regionId, regions, t.widgets.solarCollector.cleanGridRegion)
    : "";

  const hasSignificantInfluence = React.useMemo(() => {
    if (!impactPowerTrendData.length) return false;
    return impactPowerTrendData.some((row) =>
      Object.keys(row).some((key) => {
        if (key.startsWith("region")) {
          return (row[key] as number) > 0;
        }
        return false;
      })
    );
  }, [impactPowerTrendData]);

  const handleShare = async () => {
    const APP_DOMAIN_PLAIN_TEXT = "app.\u200Bglow.\u200Borg";
    try {
      const shareTitle = "My Solar Footprint on Glow";
      const shareWatts = getShareWattsLabel(model.totalWatts);
      const shareHomes = getShareHomesLabel(impact.homesPowered);
      const shareText = [
        `My network contributions have captured ${shareWatts.value}${shareWatts.unit} of verified solar on @GlowFND ☀️`,
        "",
        shareHomes.count > 0
          ? `That's enough to power ${shareHomes.value} ${
              shareHomes.unit
            } and is equivalent to ${impact.treesEquivalent.toLocaleString()} adult trees.`
          : `That's equivalent to ${impact.treesEquivalent.toLocaleString()} adult trees.`,
        "",
        `Make an impact and start earning GLW today at ${APP_DOMAIN_PLAIN_TEXT}`,
      ].join("\n");

      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        shareText
      )}`;

      const isSmallScreen =
        typeof window !== "undefined" &&
        window.matchMedia?.("(max-width: 768px)")?.matches;

      const canNativeShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";

      if (isSmallScreen && canNativeShare) {
        trackEvent("impact_summary_share_native_click", {
          source,
          wallet_address: normalizedWalletAddress,
          total_watts: model.totalWatts,
        });

        await navigator.share({
          title: shareTitle,
          text: shareText,
        });
        return;
      }

      trackEvent("impact_summary_share_x_click", {
        source,
        wallet_address: normalizedWalletAddress,
        total_watts: model.totalWatts,
      });

      if (typeof window !== "undefined") {
        window.open(shareUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      console.error("Share failed", e);
    }
  };

  const handleLearnMore = React.useCallback(() => {
    trackEvent("solar_collector_learn_more_open", {
      source,
      wallet_address: normalizedWalletAddress,
    });
    onHowItWorksClick?.();
    setIsLearnMoreOpen(true);
  }, [normalizedWalletAddress, onHowItWorksClick, source]);

  const learnMoreDialog = (
    <SolarFootprintDialog
      open={isLearnMoreOpen}
      onOpenChange={setIsLearnMoreOpen}
    />
  );

  if (model.shouldShowSkeleton) return <ImpactSummarySkeleton />;

  // Don't show widget if no wallet or empty state
  if (!model.hasWallet || model.showEmptyState) {
    return null;
  }

  // If user has no watts captured yet, show minimal prompt
  if (model.totalWatts === 0) {
    return (
      <>
        {learnMoreDialog}
        <Card className="overflow-hidden w-full py-0 bg-card dark:bg-card border-border/20 mb-6">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {t.widgets.solarCollector.emptyFootprintTitle}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t.widgets.solarCollector.emptyFootprintBody}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 h-8 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium border border-border hover:bg-muted/50 transition-colors"
                onClick={handleLearnMore}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {t.widgets.solarCollector.learnMore}
              </button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {learnMoreDialog}
      <Card className="overflow-hidden w-full py-0 bg-card dark:bg-card border-border/20 mb-6">
        <CardContent className="p-4 md:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                {t.widgets.solarCollector.sectionTitle}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-xs text-xs leading-relaxed"
                  >
                    <p>{t.widgets.solarCollector.sectionTitleTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <button
              type="button"
              className="shrink-0 h-8 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium border border-border hover:bg-muted/50 transition-colors"
              onClick={handleLearnMore}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              {t.widgets.solarCollector.learnMore}
            </button>
          </div>

          {/* Main Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {/* Watts — headline metric, matches the watts leaderboard */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                {t.widgets.solarCollector.wattsUnit}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-foreground tabular-nums">
                  {v2TotalWatts != null && Number.isFinite(Number(v2TotalWatts))
                    ? Number(v2TotalWatts).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })
                    : "—"}
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  W
                </span>
              </div>
            </div>

            {/* GCTL Holdings (steering) */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                {t.widgets.gctlHeatmap.myHoldings}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-xl md:text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatCompact(gctl.totalBalanceGctl)}
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  GCTL
                </span>
              </div>
            </div>

            {/* Homes Powered */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-xs text-xs leading-relaxed"
                    >
                      <p>
                        {impact.homesPowered < 1
                          ? t.widgets.solarCollector.lightbulbsTooltip
                          : t.widgets.solarCollector.homesTooltip}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {impact.homesPowered < 1
                  ? t.widgets.solarCollector.lightbulbs
                  : t.widgets.solarCollector.homesPowered}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-xl md:text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {impact.homesPowered < 1
                    ? (impact.homesPowered * 40).toLocaleString(
                        undefined,
                        {
                          maximumFractionDigits: 1,
                        }
                      )
                    : impact.homesPowered.toLocaleString()}
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  {impact.homesPowered < 1
                    ? t.widgets.solarCollector.bulbsUnit
                    : t.widgets.solarCollector.homesUnit}
                </span>
              </div>
            </div>

            {/* Energy Generated Per Year */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-xs text-xs leading-relaxed"
                    >
                      <p>{t.widgets.solarCollector.energyPerYearTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {t.widgets.solarCollector.energyPerYear}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-xl md:text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatEnergyValue(impact.annualEnergyKwh)}
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  {getEnergyUnit(impact.annualEnergyKwh)}
                </span>
              </div>
            </div>

            {/* Trees Equivalent */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-xs text-xs leading-relaxed"
                    >
                      <p>{t.widgets.solarCollector.treesEquivalentTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {t.widgets.solarCollector.treesEquivalent}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-xl md:text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {impact.treesEquivalent.toLocaleString()}
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  {t.widgets.solarCollector.treesUnit}
                </span>
              </div>
            </div>

          </div>

          {/* Bottom Section: Latest Addition + Actions */}
          <div className="mt-4 pt-4 border-t border-border/50 flex flex-col md:flex-row gap-4">
            {/* Latest Verified Addition */}
            {model.recentDrop ? (
              <button
                type="button"
                className="flex-1 rounded-xl border border-border bg-muted/10 hover:bg-muted/20 transition-colors p-3 text-left group"
                onClick={() => {
                  trackEvent("impact_summary_recent_farm_click", {
                    source,
                    wallet_address: normalizedWalletAddress,
                    chain_id: chainId,
                    farm_id: model.recentDrop?.farmId,
                  });
                  if (model.recentDrop?.farmId) {
                    onFarmClick?.(model.recentDrop.farmId);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                      {t.widgets.solarCollector.latestVerifiedAddition}
                    </div>
                    <div className="font-medium text-sm text-foreground truncate">
                      {model.recentDrop.farmName}
                      {recentDropRegionLabel && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({recentDropRegionLabel})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatWhenLabel(
                        model.recentDrop.timestamp,
                        {
                          whenToday: t.widgets.solarCollector.whenToday,
                          whenYesterday: t.widgets.solarCollector.whenYesterday,
                          whenDaysAgo: t.widgets.solarCollector.whenDaysAgo,
                          whenLastWeek: t.widgets.solarCollector.whenLastWeek,
                          whenWeeksAgo: t.widgets.solarCollector.whenWeeksAgo,
                        },
                        getBcp47(lang),
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-8 px-6 border-x border-border/50 h-10">
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                        {t.widgets.solarCollector.farmSize}
                      </div>
                      <div className="text-xs font-mono font-medium text-foreground tabular-nums">
                        {(model.recentDrop.farmSizeWatts / 1000).toFixed(1)} kW
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                        {t.widgets.solarCollector.yourShare}
                      </div>
                      <div className="text-xs font-mono font-medium text-foreground tabular-nums">
                        {(
                          (model.recentDrop.wattsCaptured /
                            model.recentDrop.farmSizeWatts) *
                          100
                        ).toFixed(2)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                        {t.widgets.solarCollector.captureLabel}
                      </div>
                      <div className="text-xs font-mono font-medium text-[color:var(--color-glow-orange)] tabular-nums">
                        +{formatCaptureValue(model.recentDrop.wattsCaptured)}{" "}
                        {getCaptureUnit(model.recentDrop.wattsCaptured)}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>
              </button>
            ) : (
              <div className="flex-1 rounded-xl border border-border bg-muted/10 p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  {t.widgets.solarCollector.latestAddition}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t.widgets.solarCollector.noRecentAdditions}
                </div>
              </div>
            )}

            {/* Action Button - matches height of Latest Verified Addition */}
            {!readOnly && normalizedWalletAddress && (
              <button
                type="button"
                className="shrink-0 min-h-12 rounded-xl px-6 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 md:min-w-[100px]"
                onClick={() => {
                  trackEvent("impact_summary_breakdown_click", {
                    source,
                    wallet_address: normalizedWalletAddress,
                  });
                  setIsBreakdownOpen(true);
                }}
              >
                <PieChartIcon className="h-4 w-4" />
                {t.widgets.rankWidget.breakdown}
              </button>
            )}
          </div>

          {/* Impact Charts Section */}
          <div className="mt-8 pt-6 border-t border-border/50">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* 1. Regional Distribution (Pie) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                    {t.widgets.solarCollector.regionalDistribution}
                  </div>
                </div>
                <ChartContainer
                  config={chartConfig}
                  className="h-[200px] w-full aspect-auto"
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value, _name, item) => {
                            const fullName =
                              (
                                item?.payload as
                                  | { fullName?: string }
                                  | undefined
                              )?.fullName ?? "";
                            return (
                              <div className="flex w-full items-center justify-between gap-3">
                                <span className="text-foreground">
                                  {fullName}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="font-mono font-medium tabular-nums text-foreground">
                                    {Number(value).toLocaleString()}
                                  </span>
                                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                    {t.widgets.solarCollector.wattsUnit}
                                  </span>
                                </span>
                              </div>
                            );
                          }}
                        />
                      }
                    />
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      strokeWidth={5}
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend
                      content={<ChartLegendContent nameKey="name" />}
                      className="-translate-y-2 flex-wrap justify-center gap-x-4 gap-y-1.5"
                    />
                  </PieChart>
                </ChartContainer>
              </div>

              {/* 2. Cumulative Growth (Area) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                    {t.widgets.solarCollector.footprintGrowth}
                  </div>
                </div>
                <ChartContainer
                  config={chartConfig}
                  className="h-[200px] w-full aspect-auto"
                >
                  <AreaChart
                    data={growthData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      tickFormatter={(value) =>
                        value.toLocaleDateString("en-US", {
                          month: "short",
                        })
                      }
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={growthYAxisFormatter}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium tabular-nums text-foreground">
                                {Number(value).toLocaleString()}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                {t.widgets.solarCollector.wattsUnit}
                              </span>
                            </div>
                          )}
                          labelFormatter={(value, payload) => {
                            const date = payload?.[0]?.payload?.date;
                            if (date instanceof Date) {
                              return date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              });
                            }
                            return t.widgets.solarCollector.weekFallback(value);
                          }}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="watts"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>

              {/* 3. Glow Control / Steering */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SteeringIcon className="h-4 w-4 text-muted-foreground" />
                    <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                      {t.widgets.gctlHeatmap.activeStakes}
                    </div>
                  </div>
                  {!readOnly && onMintAndStakeClick ? (
                    <button
                      type="button"
                      onClick={handleMintAndStake}
                      className="h-7 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium border border-border/40 text-muted-foreground hover:text-[#22D3EE] hover:border-[#22D3EE] transition-colors"
                    >
                      <TrendingUp className="h-3 w-3" />
                      {t.widgets.gctlHeatmap.mintGctl}
                    </button>
                  ) : null}
                </div>

                {gctl.stakes.length > 0 ? (
                  <div className="space-y-2">
                    {visibleStakes.map((stake: GctlSteeringStake, i: number) => (
                      <RegionSteeringRow
                        key={stake.regionId}
                        regionName={stake.regionName}
                        userStakedGctl={stake.amountGctl}
                        lockedGctl={stake.lockedAmount}
                        totalRegionStakedGctl={stake.totalRegionStaked}
                        regionWeeklyEmissions={stake.weeklyEmissions}
                        isMax={i === 0}
                        normalizedWidth={stake.normalizedWidth}
                        labels={t.widgets.gctlHeatmap}
                      />
                    ))}
                    {hasMoreStakes ? (
                      <button
                        type="button"
                        onClick={() => setShowAllStakes((v) => !v)}
                        className="w-full rounded-lg border border-border/30 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:border-[#22D3EE]/50 hover:text-[#22D3EE] flex items-center justify-center gap-1"
                      >
                        {showAllStakes ? (
                          <>
                            {t.widgets.gctlHeatmap.showLess}
                            <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            {t.widgets.gctlHeatmap.showMore(hiddenStakesCount)}
                            <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center text-center border border-dashed border-border/40 rounded-xl p-6 h-[200px] transition-all group",
                      !readOnly &&
                        onMintAndStakeClick &&
                        "cursor-pointer hover:bg-muted/30 hover:border-border/60"
                    )}
                    onClick={
                      !readOnly && onMintAndStakeClick
                        ? handleMintAndStake
                        : undefined
                    }
                  >
                    <div
                      className={cn(
                        "h-12 w-12 rounded-lg bg-muted/50 flex items-center justify-center mb-2 transition-colors",
                        !readOnly &&
                          onMintAndStakeClick &&
                          "group-hover:bg-[#22D3EE]/10"
                      )}
                    >
                      <SteeringIcon className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {t.widgets.gctlHeatmap.noActiveSteering}
                    </span>
                    {!readOnly && onMintAndStakeClick ? (
                      <span className="text-[10px] text-[#22D3EE] mt-1">
                        {t.widgets.gctlHeatmap.stakeToDirect}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <WalletImpactDialog
        wallet={isBreakdownOpen ? normalizedWalletAddress : null}
        open={isBreakdownOpen}
        onOpenChange={setIsBreakdownOpen}
      />
    </>
  );
}
