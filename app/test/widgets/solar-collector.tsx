"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";
import {
  ArrowUpRight,
  ChevronRight,
  HelpCircle,
  Info,
  Leaf,
  Zap,
  PieChart as PieChartIcon,
  TrendingUp,
  Activity,
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
import { useSolarCollectorQuery } from "@/hooks/hub-solar-collector";
import { useRegions } from "@/hooks/control-regions";
import { hubGet } from "@/lib/api/hub-client";

const SOLAR_ORANGE = "#ffb472";
const SOLAR_YELLOW = "#ffd37a";
const WATTS_PER_PANEL = 400;

const GENESIS_TIMESTAMP = 1700352000;

function weekToDate(week: number) {
  // Add 1 to the week to get the timestamp for the end of that protocol week
  return new Date((GENESIS_TIMESTAMP + (week + 1) * 604800) * 1000);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function getRegionLabel(
  regionId: number | null,
  regions: Array<{ id: number; code: string }> | undefined
): string {
  if (!regionId) return "";
  const region = regions?.find((r) => r.id === regionId);
  if (!region) return "";
  const code = region.code;
  if (code === "*") return "Clean Grid";
  if (code.startsWith("US-")) return code.slice(3);
  return code;
}

function getRegionCode(
  regionId: number | null,
  regions: Array<{ id: number; code: string }> | undefined
): string {
  if (!regionId) return "";
  const region = regions?.find((r) => r.id === regionId);
  if (!region) return "";
  const code = region.code;
  if (code === "*") return "CGP";
  if (code.startsWith("US-")) return code.slice(3);
  return code;
}

function getRegionCodeFromName(
  name: string | number | undefined,
  regions: Array<{ id: number; code: string }> | undefined
): string {
  if (!name || typeof name !== "string") return "";
  const match = name.match(/region(\d+)/);
  if (!match) return "";
  return getRegionCode(Number(match[1]), regions);
}

function getGhostState(totalWatts: number) {
  const safe = Number.isFinite(totalWatts) ? totalWatts : 0;
  const completedPanels = Math.floor(safe / WATTS_PER_PANEL);
  const currentGhostWatts = safe % WATTS_PER_PANEL;
  const fillPercentage = (currentGhostWatts / WATTS_PER_PANEL) * 100;
  return { completedPanels, currentGhostWatts, fillPercentage };
}

interface SolarFootprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SolarFootprintDialog({
  open,
  onOpenChange,
}: SolarFootprintDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background backdrop-blur-sm rounded-2xl p-0 sm:max-w-md w-full border-border overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border/60">
          <DialogTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            How Solar Footprint Works
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
                  Verified Solar Footprint
                </div>
                <div className="text-xs text-muted-foreground">
                  Real farms • real capacity
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Each time a farm is funded, its physical capacity is distributed
              across the network. Your share is based on your Impact Power in
              that farm’s region for the given week.
            </div>
            <div className="pt-1">
              <div className="p-3 bg-glow-orange/5 border border-glow-orange/10 rounded-lg">
                <div className="text-[10px] font-bold text-glow-orange flex items-center gap-1.5 uppercase tracking-wider">
                  Impact Power
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Direct Points + Glow Worth Points. Direct points come from
                  emissions rewards, steering, and vault participation. Glow
                  Worth is distributed by each region’s emission share.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-1 pb-1">
              What to Expect
            </div>
            <div className="rounded-xl border border-border bg-muted/5 divide-y divide-border/40">
              <div className="p-3.5 flex items-start gap-3">
                <Zap className="h-4 w-4 text-amber-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">
                    Panels grow with new farms
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Every 400W captured becomes one completed panel.
                  </div>
                </div>
              </div>
              <div className="p-3.5 flex items-start gap-3">
                <PieChartIcon className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">
                    Regional share matters
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Your influence is measured per region based on the week the
                    farm is funded.
                  </div>
                </div>
              </div>
              <div className="p-3.5 flex items-start gap-3">
                <TrendingUp className="h-4 w-4 text-sky-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">
                    Completed weeks only
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    New farms appear once the protocol week is completed.
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
            Got it
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
}

function ImpactSummarySkeleton() {
  return (
    <Card className="overflow-hidden w-full py-0 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border mb-6">
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

export default function SolarCollectorWidget({
  walletAddress,
  onViewGridClick,
  onHowItWorksClick,
  onShareClick,
  onFarmClick,
}: SolarCollectorWidgetProps) {
  const chainId = useChainId();
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "impact_summary_widget";
  const [isLearnMoreOpen, setIsLearnMoreOpen] = React.useState(false);

  const { model } = useSolarCollectorQuery({
    walletAddress: normalizedWalletAddress,
    enabled: true,
    includeCurrentWeekPower: true,
  });

  const { regions } = useRegions();

  const ghost = React.useMemo(
    () => getGhostState(model.totalWatts),
    [model.totalWatts]
  );

  const fill = clamp(ghost.fillPercentage, 0, 100);

  const regionColors: Record<number, string> = {
    1: "#6b7280", // Grey - CGP
    2: "#3b82f6", // Blue - UT
    3: "#10b981", // Green - MO
    4: "#f59e0b", // Amber - CO
  };

  const chartConfig = {
    region1: { label: "Clean Grid Project (CGP)", color: "#6b7280" },
    region2: { label: "Utah (UT)", color: "#3b82f6" },
    region3: { label: "Missouri (MO)", color: "#10b981" },
    region4: { label: "Colorado (CO)", color: "#f59e0b" },
    total: { label: "Total Watts", color: "#f59e0b" },
    share: { label: "Network Share", color: "#10b981" },
  } satisfies ChartConfig;

  const distributionData = React.useMemo(() => {
    return Object.entries(model.wattsByRegion)
      .map(([rid, watts]) => ({
        regionId: Number(rid),
        name: `region${rid}`,
        value: watts,
        fill: regionColors[Number(rid)] || "#6b7280",
      }))
      .filter((d) => d.value > 0);
  }, [model.wattsByRegion]);

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
    ? getRegionLabel(model.recentDrop.regionId, regions)
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
      const shareHomes = getShareHomesLabel(model.impact.homesPowered);
      const shareText = [
        `My network contributions have captured ${shareWatts.value}${shareWatts.unit} of verified solar on @GlowFND ☀️`,
        "",
        shareHomes.count > 0
          ? `That's enough to power ${shareHomes.value} ${
              shareHomes.unit
            } and is equivalent to ${model.impact.treesEquivalent.toLocaleString()} adult trees.`
          : `That's equivalent to ${model.impact.treesEquivalent.toLocaleString()} adult trees.`,
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
        <Card className="overflow-hidden w-full py-0 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border mb-6">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  Your solar footprint will appear here
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  When new farms onboard, your share of clean energy production
                  will be tracked.
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 h-8 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium border border-border hover:bg-muted/50 transition-colors"
                onClick={handleLearnMore}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Learn more
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
      <Card className="overflow-hidden w-full py-0 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border mb-6">
        <CardContent className="p-4 md:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                Verified Solar Footprint
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
                    <p>
                      Your verified connection to physical solar infrastructure.
                      Based on your participation in completed V2 farms across
                      the network.
                    </p>
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
              Learn more
            </button>
          </div>

          {/* Main Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
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
                        {model.impact.homesPowered < 1
                          ? "Estimated number of LED lightbulbs (9W) that could be continuously powered by your solar capacity."
                          : "Estimated number of U.S. homes that could be continuously powered by your solar capacity, assuming an 18% capacity factor and 1.17 kW average load per home."}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {model.impact.homesPowered < 1 ? "Lightbulbs" : "Homes Powered"}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-foreground tabular-nums">
                  {model.impact.homesPowered < 1
                    ? (model.impact.homesPowered * 40).toLocaleString(
                        undefined,
                        {
                          maximumFractionDigits: 1,
                        }
                      )
                    : model.impact.homesPowered.toLocaleString()}
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  {model.impact.homesPowered < 1 ? "bulbs" : "homes"}
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
                      <p>
                        Estimated annual clean energy production based on the
                        physical capacity of your captured panels and an
                        estimated 18% average capacity factor.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                Energy / Year
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatEnergyValue(model.impact.annualEnergyKwh)}
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  {getEnergyUnit(model.impact.annualEnergyKwh)}
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
                      <p>
                        The number of mature trees required to sequester the
                        same amount of CO₂ offset by your clean energy
                        production (based on 1,000 lb CO₂/MWh and 0.022
                        tonnes/year per tree).
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                Trees Equivalent
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-foreground tabular-nums">
                  {model.impact.treesEquivalent.toLocaleString()}
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  trees
                </span>
              </div>
            </div>

            {/* Panel Progress */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Panel #{model.currentPanelIndex}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 rounded-full bg-muted/50 border border-border/50 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${fill}%`,
                      background: `linear-gradient(90deg, ${SOLAR_ORANGE} 0%, ${SOLAR_YELLOW} 100%)`,
                    }}
                  />
                </div>
                <span className="font-mono text-sm font-bold tabular-nums text-foreground w-10 text-right">
                  {Math.round(fill)}%
                </span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {model.totalPanels} panel{model.totalPanels !== 1 ? "s" : ""}{" "}
                completed
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
                      Latest Verified Addition
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
                      {model.recentDrop.whenLabel}
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-8 px-6 border-x border-border/50 h-10">
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                        Farm Size
                      </div>
                      <div className="text-xs font-mono font-medium text-foreground tabular-nums">
                        {(model.recentDrop.farmSizeWatts / 1000).toFixed(1)} kW
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                        Your Share
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
                        Capture
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
                  Latest Addition
                </div>
                <div className="text-sm text-muted-foreground">
                  No recent farm additions yet
                </div>
              </div>
            )}

            {/* Action Button - matches height of Latest Verified Addition */}
            <button
              type="button"
              className="shrink-0 min-h-12 rounded-xl px-6 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 md:min-w-[100px]"
              onClick={handleShare}
            >
              <ArrowUpRight className="h-4 w-4" />
              Share
            </button>
          </div>

          {/* Impact Charts Section */}
          <div className="mt-8 pt-6 border-t border-border/50">
            <div
              className={cn(
                "grid grid-cols-1 gap-8",
                hasSignificantInfluence ? "lg:grid-cols-3" : "lg:grid-cols-2"
              )}
            >
              {/* 1. Regional Distribution (Pie) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                    Regional Energy Distribution
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
                          formatter={(value) => (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium tabular-nums text-foreground">
                                {Number(value).toLocaleString()}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                Watts
                              </span>
                            </div>
                          )}
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
                      className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                    />
                  </PieChart>
                </ChartContainer>
              </div>

              {/* 2. Cumulative Growth (Area) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                    Footprint Growth
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
                                Watts
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
                            return `Week ${value}`;
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

              {/* 3. Regional Impact Power (Line) - Cumulative */}
              {hasSignificantInfluence && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                      Cumulative Regional Impact
                    </div>
                  </div>
                  <ChartContainer
                    config={chartConfig}
                    className="h-[200px] w-full aspect-auto"
                  >
                    <LineChart
                      data={impactPowerTrendData}
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
                        tickFormatter={impactPowerYAxisFormatter}
                      />
                      <ChartTooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0)
                            return null;
                          const data = payload[0]?.payload;
                          const date = data?.date;
                          const rolloverMultiplier =
                            data?.rolloverMultiplier ?? 1;
                          const hasCashMinerBonus =
                            data?.hasCashMinerBonus ?? false;
                          const streakBonusMultiplier =
                            data?.streakBonusMultiplier ?? 0;
                          const impactStreakWeeks =
                            data?.impactStreakWeeks ?? 0;

                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-md min-w-[180px]">
                              <div className="text-xs font-medium text-muted-foreground mb-2">
                                {date instanceof Date
                                  ? date.toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : `Week ${label}`}
                              </div>
                              <div className="space-y-1">
                                {payload.map((entry, idx: number) => {
                                  const regionCode = getRegionCodeFromName(
                                    String(entry.name ?? ""),
                                    regions
                                  );
                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between gap-3"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <div
                                          className="h-2 w-2 rounded-full"
                                          style={{
                                            backgroundColor: entry.color,
                                          }}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                          {regionCode ||
                                            String(entry.name ?? "")}
                                        </span>
                                      </div>
                                      <span className="font-mono text-xs font-medium tabular-nums">
                                        {Number(
                                          entry.value ?? 0
                                        ).toLocaleString(undefined, {
                                          maximumFractionDigits: 0,
                                        })}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              {rolloverMultiplier > 1 && (
                                <div className="mt-2 pt-2 border-t border-border/50">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground">
                                      Multiplier
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-[color:var(--color-miner)]">
                                      {rolloverMultiplier.toFixed(2)}×
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {hasCashMinerBonus && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]">
                                        Miner 3×
                                      </span>
                                    )}
                                    {streakBonusMultiplier > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[color:var(--delegation-purple)]/10 text-[color:var(--delegation-purple)]">
                                        Streak +
                                        {streakBonusMultiplier.toFixed(2)}× (
                                        {impactStreakWeeks}w)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                      {Object.keys(regionColors).map((rid) => (
                        <Line
                          key={rid}
                          type="monotone"
                          dataKey={`region${rid}`}
                          name={`region${rid}`}
                          stroke={regionColors[Number(rid)]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ChartContainer>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
