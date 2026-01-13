"use client";

import * as React from "react";
import { useChainId } from "wagmi";
import { ArrowUpRight, Flame, Globe, Info, Zap } from "lucide-react";
import { motion, useSpring, useTransform } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ConnectButton } from "@/components/connect-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";

/**
 * Solar Collector Widget
 * - Designed to slot as a full-width section (Proposal 1)
 * - Uses the same layout principles as NetWorthWidget:
 *   - Card -> Header actions -> big mono numbers -> “juicy” visual area
 *   - Minimal/Default variants
 *   - Wallet connect blur overlay
 *   - Skeleton state
 *
 * NOTE: Data here is mocked; replace `useSolarCollectorMock` with your real hook.
 */

const SOLAR_ORANGE = "#ffb472";
const SOLAR_YELLOW = "#ffd37a";

const WATTS_PER_PANEL = 400;

function LiquidWave({ color }: { color: string }) {
  return (
    <motion.svg
      className="absolute top-0 left-0 w-[200%] h-10 -translate-y-[80%]"
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      style={{ filter: "drop-shadow(0 -4px 10px rgba(255,180,114,0.35))" }}
      animate={{
        x: ["-25%", "0%", "-25%"],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <motion.path
        fill={color}
        animate={{
          d: [
            "M0,40 C100,70 200,20 400,50 C600,80 800,20 1000,50 C1100,65 1150,35 1200,50 L1200,120 L0,120 Z",
            "M0,50 C100,20 200,70 400,40 C600,10 800,70 1000,40 C1100,25 1150,55 1200,40 L1200,120 L0,120 Z",
            "M0,40 C100,70 200,20 400,50 C600,80 800,20 1000,50 C1100,65 1150,35 1200,50 L1200,120 L0,120 Z",
          ],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* second wave layer for depth */}
      <motion.path
        fill={color}
        opacity={0.6}
        animate={{
          d: [
            "M0,55 C150,30 300,70 500,45 C700,20 900,65 1200,55 L1200,120 L0,120 Z",
            "M0,45 C150,70 300,30 500,55 C700,80 900,35 1200,45 L1200,120 L0,120 Z",
            "M0,55 C150,30 300,70 500,45 C700,20 900,65 1200,55 L1200,120 L0,120 Z",
          ],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.3,
        }}
      />
    </motion.svg>
  );
}

function Bubble({
  delay,
  left,
  size,
  drift,
}: {
  delay: number;
  left: string;
  size: number;
  drift: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full bg-white/30"
      style={{
        width: size,
        height: size,
        left,
        bottom: 0,
      }}
      animate={{
        y: [0, -80, -120],
        x: [0, drift, drift * 1.5],
        opacity: [0.6, 0.4, 0],
        scale: [0.5, 1, 0.8],
      }}
      transition={{
        duration: 2.5 + delay * 0.3,
        repeat: Infinity,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

function useLiquidFill(targetPercent: number) {
  const springValue = useSpring(0, {
    stiffness: 60,
    damping: 20,
    mass: 1,
  });

  React.useEffect(() => {
    springValue.set(targetPercent);
  }, [targetPercent, springValue]);

  return springValue;
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatWattsWithUnit(watts: number): { value: string; unit: string } {
  if (!Number.isFinite(watts) || watts === 0) return { value: "0", unit: "W" };
  if (watts >= 1_000_000) {
    return { value: (watts / 1_000_000).toFixed(2), unit: "MW" };
  }
  if (watts >= 1_000) {
    return { value: (watts / 1_000).toFixed(1), unit: "kW" };
  }
  return {
    value: watts.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    unit: "W",
  };
}

function formatEnergyWithUnit(kwh: number): { value: string; unit: string } {
  if (!Number.isFinite(kwh) || kwh === 0) return { value: "0", unit: "kWh" };
  if (kwh >= 1_000_000) {
    return { value: (kwh / 1_000_000).toFixed(2), unit: "GWh" };
  }
  if (kwh >= 1_000) {
    return { value: (kwh / 1_000).toFixed(1), unit: "MWh" };
  }
  return {
    value: kwh.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    unit: "kWh",
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getGhostState(totalWatts: number) {
  const safe = Number.isFinite(totalWatts) ? totalWatts : 0;
  const completedPanels = Math.floor(safe / WATTS_PER_PANEL);
  const currentGhostWatts = safe % WATTS_PER_PANEL;
  const fillPercentage = (currentGhostWatts / WATTS_PER_PANEL) * 100;
  return { completedPanels, currentGhostWatts, fillPercentage };
}

type SolarCollectorVariant = "default" | "minimal";

interface SolarCollectorWidgetProps {
  walletAddress?: string | null;
  variant?: SolarCollectorVariant;
  onViewGridClick?: () => void;
  onHowItWorksClick?: () => void;
  onShareClick?: () => void;
}

type RegionKey = "CO" | "UT" | "IN";

type SolarCollectorModel = {
  hasWallet: boolean;
  shouldShowSkeleton: boolean;
  showEmptyState: boolean;

  totalWatts: number;
  totalPanels: number; // derived or backend-provided
  currentPanelIndex: number; // 1-based “Panel #12”
  wattsToNextPanel: number;

  capturePower: number;
  powerPercentile: number; // 0..100 where 90 => “Top 10%”
  streakWeeks: number;
  multiplier: number;

  strongholdRegion: RegionKey;
  recentDrop: {
    farmName: string;
    region: RegionKey;
    wattsCaptured: number;
    whenLabel: string; // "Yesterday", "Jan 10"
    farmSizeWatts: number;
  };

  // Meaningful impact stats
  impact: {
    annualEnergyKwh: number; // Total energy generated per year
    treesEquivalent: number; // CO2 offset equivalent in trees
  };
};

/**
 * Mock data following the Solar Collector API spec:
 * - 1 Panel = 400 Watts
 * - ghostProgress = (totalWatts % 400) / 400 * 100
 * - Capture Power = directPoints + glowWorthPoints (user's share of network)
 * - WattsReceived = FarmCapacity × (UserPower / TotalNetworkPower)
 * - Multiplier based on streak weeks (e.g., 4 weeks = 3.0x)
 */
function useSolarCollectorMock(
  walletAddress?: string | null
): SolarCollectorModel {
  const hasWallet = Boolean(walletAddress);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setReady(true), 350);
    return () => clearTimeout(t);
  }, []);

  const emptyModel: SolarCollectorModel = {
    hasWallet,
    shouldShowSkeleton: false,
    showEmptyState: false,
    totalWatts: 0,
    totalPanels: 0,
    currentPanelIndex: 1,
    wattsToNextPanel: WATTS_PER_PANEL,
    capturePower: 0,
    powerPercentile: 0,
    streakWeeks: 0,
    multiplier: 1,
    strongholdRegion: "CO",
    recentDrop: {
      farmName: "",
      region: "CO",
      wattsCaptured: 0,
      whenLabel: "—",
      farmSizeWatts: 0,
    },
    impact: { annualEnergyKwh: 0, treesEquivalent: 0 },
  };

  if (!ready) {
    return { ...emptyModel, shouldShowSkeleton: true };
  }

  if (!hasWallet) {
    return { ...emptyModel, showEmptyState: true };
  }

  // User's capture power in their stronghold region (directPoints + glowWorthPoints)
  const capturePower = 45_000;
  // Total network power in the region (sum of all users' power)
  const networkTotalPower = 2_100_000;
  // User's share of network power
  const userPowerShare = capturePower / networkTotalPower; // ~2.14%

  // Recent farm drop: 100kW farm finalized last week
  const recentFarmCapacityWatts = 100_000;
  // Watts captured = farmCapacity × (userPower / networkPower)
  const recentWattsCaptured = Math.round(
    recentFarmCapacityWatts * userPowerShare
  ); // ~214W

  // Total watts accumulated from all past farm drops
  // This represents ~12 farm drops averaging 10kW each over the user's history
  const totalWatts = 4_860;

  const ghost = getGhostState(totalWatts);
  const totalPanels = ghost.completedPanels; // 12 panels
  const currentPanelIndex = totalPanels + 1; // Working on Panel #13
  const wattsToNextPanel = WATTS_PER_PANEL - ghost.currentGhostWatts; // 340W to go

  // Streak: 4 consecutive weeks of impact actions (increased delegation or miner purchase)
  // Multiplier scales with streak: base 1.0x + 0.5x per week, capped
  const streakWeeks = 4;
  const multiplier = 1 + streakWeeks * 0.25; // 2.0x

  // Percentile: user is in top 10% of power holders in their region
  const powerPercentile = 90;

  // Impact: environmental estimates based on total watts
  // Solar capacity running for a year at ~18% capacity factor (US avg for solar)
  const annualEnergyKwh = Math.round((totalWatts * 8760 * 0.18) / 1000);
  // Each kWh of solar offsets ~0.42 kg CO2 (US grid avg)
  // A mature tree absorbs ~22 kg CO2/year
  const treesEquivalent = Math.round((annualEnergyKwh * 0.42) / 22);
  const impact = { annualEnergyKwh, treesEquivalent };

  return {
    hasWallet,
    shouldShowSkeleton: false,
    showEmptyState: false,

    totalWatts,
    totalPanels,
    currentPanelIndex,
    wattsToNextPanel,

    capturePower,
    powerPercentile,
    streakWeeks,
    multiplier,

    strongholdRegion: "CO",
    recentDrop: {
      farmName: "Effervescent Hollow",
      region: "CO",
      wattsCaptured: recentWattsCaptured,
      whenLabel: "Last Week",
      farmSizeWatts: recentFarmCapacityWatts,
    },

    impact,
  };
}

function RingGauge({
  value,
  labelTop,
  labelBottom,
}: {
  value: number; // 0..100
  labelTop: React.ReactNode;
  labelBottom: React.ReactNode;
}) {
  const v = clamp(value, 0, 100);
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;

  return (
    <div className="flex items-center gap-2">
      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeOpacity="0.35"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={SOLAR_ORANGE}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 22 22)"
          style={{
            filter: "drop-shadow(0 0 10px rgba(255,180,114,0.35))",
            transition: "stroke-dasharray 700ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
      </svg>
      <div className="leading-tight">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {labelTop}
        </div>
        <div className="font-mono text-xs text-foreground">{labelBottom}</div>
      </div>
    </div>
  );
}

function SolarCollectorSkeleton({ isMinimal }: { isMinimal: boolean }) {
  return (
    <Card
      className={cn(
        "overflow-hidden flex flex-col w-full py-0",
        isMinimal
          ? "bg-transparent border-transparent h-full"
          : "h-full bg-card dark:bg-muted/30 border-foreground/10 dark:border-border"
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 md:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,1fr)_minmax(320px,1.5fr)_minmax(200px,1fr)] gap-4">
          {/* Column 1 skeleton */}
          <div className="rounded-2xl border border-border bg-muted/20 p-5">
            <Skeleton className="h-3 w-24" />
            <div className="mt-3 flex items-baseline gap-2">
              <Skeleton className="h-14 w-32 rounded-xl" />
              <Skeleton className="h-5 w-8 rounded" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Skeleton className="h-7 w-20 rounded-xl" />
              <Skeleton className="h-7 w-24 rounded-xl" />
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50">
              <Skeleton className="h-3 w-28" />
              <div className="mt-2 flex gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>

          {/* Column 2 skeleton */}
          <div className="rounded-2xl border border-border bg-muted/20 p-5">
            <div className="flex items-start justify-between">
              <div>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-8 w-40" />
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-36 w-full rounded-2xl" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Skeleton className="h-7 w-28 rounded-xl" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>

          {/* Column 3 skeleton */}
          <div className="rounded-2xl border border-border bg-muted/20 p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-14 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-5 w-full" />
            <Skeleton className="mt-1 h-3 w-28" />
            <div className="mt-4 rounded-xl border border-border bg-muted/10 p-4">
              <Skeleton className="h-3 w-20" />
              <div className="mt-2 flex items-baseline gap-2">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-4 w-6" />
              </div>
              <Skeleton className="mt-2 h-3 w-32" />
            </div>
            <Skeleton className="mt-3 h-10 w-full rounded-xl" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SolarCollectorWidget({
  walletAddress,
  variant = "default",
  onViewGridClick,
  onHowItWorksClick,
  onShareClick,
}: SolarCollectorWidgetProps) {
  const chainId = useChainId();
  const isMinimal = variant === "minimal";
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "solar_collector_widget";

  const model = useSolarCollectorMock(walletAddress);
  const ghost = React.useMemo(
    () => getGhostState(model.totalWatts),
    [model.totalWatts]
  );

  // “Juice”: animate the fill surge on change
  const [displayWatts, setDisplayWatts] = React.useState(model.totalWatts);
  const [surgeKey, setSurgeKey] = React.useState(0);

  React.useEffect(() => {
    if (!Number.isFinite(model.totalWatts)) return;
    if (model.totalWatts === displayWatts) return;
    setDisplayWatts(model.totalWatts);
    setSurgeKey((k) => k + 1);
  }, [model.totalWatts, displayWatts]);

  // All hooks must be called before any conditional returns
  const fill = clamp(ghost.fillPercentage, 0, 100);
  const liquidFill = useLiquidFill(fill);
  const liquidHeight = useTransform(liquidFill, (v) => `${v}%`);

  const topPercent = clamp(model.powerPercentile, 0, 100);
  const topLabel =
    topPercent >= 50 ? `Top ${100 - topPercent}%` : `Top ${100 - topPercent}%`;

  if (model.shouldShowSkeleton)
    return <SolarCollectorSkeleton isMinimal={isMinimal} />;

  const showConnectOverlay = !model.hasWallet && !model.showEmptyState;

  if (model.showEmptyState) {
    return (
      <Card
        className={cn(
          "overflow-hidden flex flex-col w-full py-0",
          isMinimal
            ? "bg-transparent border-transparent h-full"
            : "h-full bg-card dark:bg-muted/30 border-foreground/10 dark:border-border"
        )}
      >
        <CardContent className="p-4 md:p-5 flex items-center justify-center min-h-[280px]">
          <div className="rounded-2xl border border-border bg-muted/10 p-6 text-center max-w-md relative overflow-hidden">
            {/* subtle grid */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, currentColor 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                opacity: 0.04,
              }}
            />

            <div className="relative">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-4">
                <Zap className="h-6 w-6 text-orange-400" />
              </div>

              <div className="text-base font-semibold text-foreground">
                Build your first panel
              </div>
              <div className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
                Connect your wallet to start capturing watts from new solar farm
                drops.
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <ConnectButton
                  className="w-full"
                  variant="default"
                  size="large"
                />
                <button
                  type="button"
                  className="h-9 inline-flex items-center justify-center gap-2 rounded-xl px-3 text-xs font-mono tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => onHowItWorksClick?.()}
                >
                  <Info className="h-3.5 w-3.5" />
                  How it works
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden flex flex-col w-full py-0",
        isMinimal
          ? "bg-transparent border-transparent h-full"
          : "h-full bg-card dark:bg-muted/30 border-foreground/10 dark:border-border"
      )}
    >
      <CardContent className="flex flex-col flex-1 min-h-0 p-0">
        <div
          aria-hidden={showConnectOverlay}
          className={cn(
            "p-4 md:p-5",
            showConnectOverlay &&
              cn(
                "pointer-events-none select-none blur-[5px] opacity-60",
                isMinimal ? "bg-transparent" : ""
              )
          )}
        >
          {/* 3-COLUMN BENTO LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,1fr)_minmax(320px,1.5fr)_minmax(200px,1fr)] gap-4">
            {/* COLUMN 1: Total Output + Stats */}
            <div className="rounded-2xl border border-border bg-muted/10 p-5 relative overflow-hidden flex flex-col">
              {/* subtle grid dots */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, currentColor 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  opacity: 0.05,
                }}
              />

              <div className="relative flex-1 flex flex-col">
                {/* Hero Stats: 2-column grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Total Output */}
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      Total Output
                    </div>
                    {(() => {
                      const formatted = formatWattsWithUnit(model.totalWatts);
                      return (
                        <div className="mt-2 flex items-baseline gap-1">
                          <div className="font-mono text-4xl md:text-5xl font-bold tracking-tighter text-foreground tabular-nums leading-none">
                            {formatted.value}
                          </div>
                          <span className="text-base md:text-lg font-mono font-medium text-zinc-500">
                            {formatted.unit}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Panels Unlocked */}
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      Panels Unlocked
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <div className="font-mono text-4xl md:text-5xl font-bold tracking-tighter text-foreground tabular-nums leading-none">
                        {model.totalPanels}
                      </div>
                      <span className="text-base md:text-lg font-mono font-medium text-zinc-500">
                        {model.totalPanels === 1 ? "panel" : "panels"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Influence Ring */}
                <div className="pt-4 border-t border-border/50">
                  <RingGauge
                    value={model.powerPercentile}
                    labelTop="Influence"
                    labelBottom={
                      <span className="text-foreground">
                        {topLabel} ·{" "}
                        <span className="text-muted-foreground">region</span>
                      </span>
                    }
                  />
                </div>

                {/* Meaningful Impact */}
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Environmental Impact
                  </div>
                  <div className="mt-3 space-y-2">
                    {/* Annual Energy Generated */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        Energy generated / year
                      </span>
                      {(() => {
                        const energy = formatEnergyWithUnit(
                          model.impact.annualEnergyKwh
                        );
                        return (
                          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                            {energy.value} {energy.unit}
                          </span>
                        );
                      })()}
                    </div>
                    {/* Trees Equivalent */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        Trees equivalent
                      </span>
                      <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                        {model.impact.treesEquivalent.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 2: Ghost Panel (Central Hero) */}
            <div className="rounded-2xl border border-border bg-muted/10 p-5 overflow-hidden relative flex flex-col">
              {/* sunbeam glow */}
              <div
                className="absolute -top-32 -right-32 h-80 w-80 rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(255,180,114,0.18), rgba(255,180,114,0.00) 70%)",
                }}
              />

              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Current Goal
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <div className="font-mono text-2xl md:text-3xl font-bold text-foreground">
                      Panel #{model.currentPanelIndex}
                    </div>
                    <div className="text-sm font-mono text-muted-foreground">
                      ({formatCompact(ghost.currentGhostWatts)} /{" "}
                      {WATTS_PER_PANEL}W)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-mono tracking-wider border border-border hover:bg-muted/50 transition-colors shrink-0"
                  onClick={() => {
                    trackEvent("solar_collector_share_click", {
                      source,
                      wallet_connected: Boolean(normalizedWalletAddress),
                      wallet_address: normalizedWalletAddress,
                      chain_id: chainId,
                    });
                    onShareClick?.();
                  }}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Share
                </button>
              </div>

              {/* Ghost Panel Liquid */}
              <div className="mt-4 flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-mono text-muted-foreground">
                    Ghost Panel Charge
                  </div>
                  <div className="font-mono text-sm font-semibold text-foreground tabular-nums">
                    {Math.round(fill)}%
                  </div>
                </div>

                <div className="flex-1 min-h-[140px] rounded-2xl border border-foreground/10 dark:border-zinc-800 bg-muted/20 overflow-hidden relative">
                  {/* wireframe grid */}
                  <div
                    className="absolute inset-0 opacity-[0.08] pointer-events-none"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />

                  {/* liquid fill with wave animation */}
                  <motion.div
                    key={surgeKey}
                    className="absolute left-0 right-0 bottom-0 will-change-transform overflow-visible"
                    style={{
                      height: liquidHeight,
                      background: `linear-gradient(180deg, ${SOLAR_YELLOW} 0%, ${SOLAR_ORANGE} 55%, rgba(255,180,114,0.55) 100%)`,
                      filter: "drop-shadow(0 0 18px rgba(255,180,114,0.4))",
                    }}
                  >
                    {/* animated wave at top */}
                    <LiquidWave color={SOLAR_YELLOW} />

                    {/* floating bubbles */}
                    <Bubble delay={0} left="15%" size={6} drift={-8} />
                    <Bubble delay={0.5} left="35%" size={8} drift={5} />
                    <Bubble delay={1} left="55%" size={5} drift={-6} />
                    <Bubble delay={1.5} left="75%" size={7} drift={10} />
                    <Bubble delay={0.8} left="25%" size={4} drift={-4} />
                    <Bubble delay={1.2} left="65%" size={9} drift={7} />
                    <Bubble delay={0.3} left="85%" size={5} drift={-10} />

                    {/* shimmer sweep */}
                    <motion.div
                      className="absolute inset-0 opacity-40"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.4) 50%, rgba(255,255,255,0) 100%)",
                      }}
                      animate={{
                        x: ["-100%", "100%"],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />

                    {/* subtle internal glow */}
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        background:
                          "radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.5), transparent 60%)",
                      }}
                    />
                  </motion.div>

                  {/* center label */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full border border-foreground/10 bg-background/70 backdrop-blur-sm px-4 py-1.5 text-sm font-mono font-medium text-foreground shadow-sm">
                      {formatCompact(model.wattsToNextPanel)}W to unlock
                    </div>
                  </div>
                </div>

                {/* Bottom row */}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Badge
                    className="h-7 px-2.5 rounded-xl font-mono text-xs font-bold border"
                    style={{
                      backgroundColor: "rgba(32,129,226,0.10)",
                      borderColor: "rgba(32,129,226,0.22)",
                      color: "rgba(130,190,255,1)",
                    }}
                  >
                    Stronghold: {model.strongholdRegion}
                  </Badge>

                  <div className="text-xs font-mono text-muted-foreground">
                    Power:{" "}
                    <span className="text-foreground tabular-nums">
                      {formatCompact(model.capturePower)}
                    </span>{" "}
                    · Multiplier:{" "}
                    <span className="text-foreground tabular-nums">
                      {model.multiplier.toFixed(1)}x
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 3: Recent Drop */}
            <div className="rounded-2xl border border-border bg-muted/10 p-5 flex flex-col relative overflow-hidden">
              {/* Live pulse glow */}
              <div
                className="absolute top-4 right-4 h-16 w-16 rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(255,180,114,0.25), transparent 70%)",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              />

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-mono text-muted-foreground">
                  Recent Drop
                </div>
                <Badge className="h-6 px-2 rounded-lg font-mono text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Live
                </Badge>
              </div>

              <div className="mt-3 font-mono text-base font-bold text-foreground leading-tight">
                {model.recentDrop.farmName} ({model.recentDrop.region})
              </div>
              <div className="mt-1 text-xs font-mono text-muted-foreground">
                {model.recentDrop.whenLabel} · Farm size{" "}
                <span className="text-foreground tabular-nums">
                  {(model.recentDrop.farmSizeWatts / 1000).toFixed(1)}kW
                </span>
              </div>

              {/* Spacer */}
              <div className="flex-1 min-h-3" />

              {/* You Captured Section */}
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  You captured
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="font-mono text-4xl font-bold tabular-nums text-foreground leading-none">
                    <NumberTicker
                      value={model.recentDrop.wattsCaptured}
                      decimalPlaces={0}
                    />
                  </div>
                  <span className="text-base font-mono font-medium text-zinc-500">
                    W
                  </span>
                </div>

                <div className="mt-2 text-xs font-mono text-muted-foreground">
                  That's{" "}
                  <span className="text-foreground font-semibold tabular-nums">
                    {Math.round(
                      (model.recentDrop.wattsCaptured / WATTS_PER_PANEL) * 100
                    )}
                    %
                  </span>{" "}
                  of a panel.
                </div>
              </div>

              <button
                type="button"
                className="mt-3 w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl px-3 text-xs font-mono font-medium tracking-wider border border-border hover:bg-muted/50 transition-colors"
                onClick={() => {
                  trackEvent("solar_collector_recent_drop_view_grid_click", {
                    source,
                    wallet_connected: Boolean(normalizedWalletAddress),
                    wallet_address: normalizedWalletAddress,
                    chain_id: chainId,
                  });
                  onViewGridClick?.();
                }}
              >
                <Globe className="h-4 w-4" />
                View Solar Grid
              </button>

              <style jsx>{`
                @keyframes pulse {
                  0%,
                  100% {
                    opacity: 0.4;
                    transform: scale(1);
                  }
                  50% {
                    opacity: 0.7;
                    transform: scale(1.1);
                  }
                }
              `}</style>
            </div>
          </div>
        </div>

        {/* Connect overlay */}
        {showConnectOverlay ? (
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-center max-w-sm mx-auto">
              <div className="text-sm text-muted-foreground">
                Connect your wallet to begin capturing watts.
              </div>
              <div className="mt-3">
                <ConnectButton
                  className="w-full"
                  variant="default"
                  size="large"
                />
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
