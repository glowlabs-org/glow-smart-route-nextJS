"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowDownUp, ArrowUp, Info } from "lucide-react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { animate, useMotionValue, useMotionValueEvent } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddLiquidityReviewDialog } from "./add-liquidity-dialog";
import { RemoveLiquidityDialog } from "./remove-liquidity-dialog";
import Image from "next/image";

interface RewardPool {
  id: string;
  pair: string;
  apy: number; // as percent
  version: "v2" | "v3" | "v4";
  feeTier: string; // e.g. "0.05%"
}

interface Position {
  id: string;
  pair: "GLW/USDG";
  glwAmount: number;
  usdgAmount: number;
  apy: number; // as percent
  poolSharePct: number; // 0..100
  createdAt: number; // ms epoch
  initialGlw: number;
  initialUsdg: number;
}

// MOCKED RESERVES + PRICE (USDG per 1 GLW)
const MOCK_PRICE_RATIO = 0.635834;
const MOCK_POOL_RESERVES = { glw: 13_900_000, usdg: 8_800_000 };
const SECONDS_IN_YEAR = 365 * 24 * 60 * 60;
const MOCK_FEE_APY = 6; // mock exchange fee APY in percent

interface AddLiquidityPanelProps {
  onConfirm: (params: { glw: number; usdg: number }) => Promise<void>;
}

function AddLiquidityPanel({ onConfirm }: AddLiquidityPanelProps) {
  const [glw, setGlw] = React.useState<string>("");
  const [usdg, setUsdg] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [matchRatio, setMatchRatio] = React.useState<boolean>(true);
  const [priceRatio, setPriceRatio] = React.useState<number | null>(null); // USDG per 1 GLW
  const [poolReserves, setPoolReserves] = React.useState<{
    glw: number;
    usdg: number;
  } | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);

  React.useEffect(() => {
    // Use mocked values instead of on-chain fetch
    setPoolReserves(MOCK_POOL_RESERVES);
    setPriceRatio(MOCK_PRICE_RATIO);
  }, []);

  function handleGlwChange(v: string) {
    setGlw(v);
    if (matchRatio && priceRatio) {
      const n = Number(v);
      if (!Number.isNaN(n)) setUsdg(n > 0 ? (n * priceRatio).toFixed(2) : "");
    }
  }

  function handleUsdgChange(v: string) {
    setUsdg(v);
    if (matchRatio && priceRatio) {
      const n = Number(v);
      if (!Number.isNaN(n) && priceRatio > 0)
        setGlw(n > 0 ? (n / priceRatio).toFixed(4) : "");
    }
  }

  const poolSharePct = React.useMemo(() => {
    if (!poolReserves) return 0;
    const glwNum = Number(glw || "0");
    const usdgNum = Number(usdg || "0");
    if (glwNum <= 0 || usdgNum <= 0) return 0;
    const frac = Math.min(
      glwNum / poolReserves.glw,
      usdgNum / poolReserves.usdg
    );
    return Math.max(0, Math.min(100, frac * 100));
  }, [glw, usdg, poolReserves]);

  async function handleAdd() {
    const glwNum = Number(glw);
    const usdgNum = Number(usdg);
    if (
      !Number.isFinite(glwNum) ||
      !Number.isFinite(usdgNum) ||
      glwNum <= 0 ||
      usdgNum <= 0
    ) {
      toast.error("Enter valid GLW and USDG amounts");
      return;
    }
    // Open review dialog
    setReviewOpen(true);
  }

  async function confirmAfterReview() {
    const glwNum = Number(glw);
    const usdgNum = Number(usdg);
    await onConfirm({ glw: glwNum, usdg: usdgNum });
    setGlw("");
    setUsdg("");
    setIsSubmitting(false);
    setReviewOpen(false);
    toast.success("Liquidity added (mock)");
  }

  return (
    <div className="bg-background/80 backdrop-blur-xl rounded-3xl border border-border overflow-hidden">
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold">Add Liquidity</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add liquidity to the GLW/USDG main pool
          </p>
        </div>

        {/* GLW Input */}
        <div className="group relative bg-muted/30 rounded-3xl p-4 lg:p-6 border border-border hover:border-border/60 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs lg:text-sm font-medium text-muted-foreground">
              Input
            </span>
            <span className="text-xs lg:text-sm text-muted-foreground">
              Balance: 0
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full"
                value={glw}
                onChange={(e) => {
                  if (Number(e.target.value) < 0) {
                    handleGlwChange("0");
                    return;
                  }
                  handleGlwChange(e.target.value);
                }}
              />
            </div>
            <div className="flex items-center justify-center px-4 py-2 bg-background rounded-xl border border-border">
              <span className="font-medium">GLW</span>
            </div>
          </div>
        </div>

        {/* USDG Input */}
        <div className="group relative bg-muted/30 rounded-3xl p-4 lg:p-6 border border-border hover:border-border/60 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs lg:text-sm font-medium text-muted-foreground">
              Input
            </span>
            <span className="text-xs lg:text-sm text-muted-foreground">
              Balance: 0
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full"
                value={usdg}
                onChange={(e) => {
                  if (Number(e.target.value) < 0) {
                    handleUsdgChange("0");
                    return;
                  }
                  handleUsdgChange(e.target.value);
                }}
              />
            </div>
            <div className="flex items-center justify-center px-4 py-2 bg-background rounded-xl border border-border">
              <span className="font-medium">USDG</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleAdd}
          isLoading={isSubmitting}
          className="w-full h-12 lg:h-14"
        >
          Review
        </Button>
      </div>

      <AddLiquidityReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        glwAmount={Number(glw || 0)}
        usdgAmount={Number(usdg || 0)}
        priceRatio={priceRatio}
        poolSharePct={poolSharePct}
        onConfirm={confirmAfterReview}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

// RemoveLiquidityPanel has been removed - using dialog instead

const initialPositions: Position[] = [
  {
    id: "p1",
    pair: "GLW/USDG",
    glwAmount: 1200.5,
    usdgAmount: 820.25,
    apy: 12.1,
    poolSharePct: 0.22,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14, // 14 days ago
    initialGlw: 1200.5,
    initialUsdg: 820.25,
  },
  {
    id: "p2",
    pair: "GLW/USDG",
    glwAmount: 300.0,
    usdgAmount: 200.0,
    apy: 11.1,
    poolSharePct: 0.05,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
    initialGlw: 300,
    initialUsdg: 200,
  },
];

export function PositionsView() {
  const [positions, setPositions] =
    React.useState<Position[]>(initialPositions);
  const [removeDialogOpen, setRemoveDialogOpen] = React.useState(false);
  const [now, setNow] = React.useState<number>(Date.now());
  const [rewardsEarnedGlw, setRewardsEarnedGlw] = React.useState<number>(0);
  const animatedRewards = useMotionValue(0);
  const [animatedRewardsDisplay, setAnimatedRewardsDisplay] = React.useState(0);
  const [totalRatePerSec, setTotalRatePerSec] = React.useState(0);
  const [feesRatePerSec, setFeesRatePerSec] = React.useState(0);
  // Live, per-position reward displays
  const [positionFinalizedMap, setPositionFinalizedMap] = React.useState<
    Record<string, number>
  >({});
  const [positionPendingMap, setPositionPendingMap] = React.useState<
    Record<string, number>
  >({});
  const [positionRateMap, setPositionRateMap] = React.useState<
    Record<string, number>
  >({});
  const [positionFeesMap, setPositionFeesMap] = React.useState<
    Record<string, number>
  >({}); // USDG-denominated fees accrued
  const [positionFeeRateMap, setPositionFeeRateMap] = React.useState<
    Record<string, number>
  >({}); // USDG/sec
  const [showIncentiveBanner, setShowIncentiveBanner] = React.useState(true);
  useMotionValueEvent(animatedRewards, "change", (v) =>
    setAnimatedRewardsDisplay(v)
  );

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000); // update every minute
    return () => clearInterval(id);
  }, []);

  // Restore hidden state of the liquidity incentive banner
  React.useEffect(() => {
    try {
      const hidden = window.localStorage.getItem("lp_banner_hidden");
      if (hidden === "1") setShowIncentiveBanner(false);
    } catch {}
  }, []);

  function hideIncentiveBanner() {
    try {
      window.localStorage.setItem("lp_banner_hidden", "1");
    } catch {}
    setShowIncentiveBanner(false);
  }

  // mock: sum of finalized rewards across positions could be displayed here
  React.useEffect(() => {
    let finalizedSum = 0;
    let totalRate = 0;
    let totalNow = 0;
    const finalizedById: Record<string, number> = {};
    const pendingById: Record<string, number> = {};
    const rateById: Record<string, number> = {};
    const feesById: Record<string, number> = {};
    const feeRateById: Record<string, number> = {};
    let totalFeeRate = 0;
    for (const p of positions) {
      const r = getRewardsEstimatesGLW(p);
      finalizedSum += r.finalized;
      totalRate += r.ratePerSecond;
      totalNow += r.finalized + r.pending;
      finalizedById[p.id] = r.finalized;
      pendingById[p.id] = r.pending;
      rateById[p.id] = r.ratePerSecond;

      // Fees accrued (mock): APY on position total value (in USDG)
      const positionValueInUSDG =
        p.usdgAmount + p.glwAmount * (MOCK_PRICE_RATIO || 0);
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now - p.createdAt) / 1000)
      );
      const feeRatePerSecond =
        ((MOCK_FEE_APY / 100) * positionValueInUSDG) / SECONDS_IN_YEAR;
      const feesAccrued = feeRatePerSecond * elapsedSeconds;
      feesById[p.id] = feesAccrued;
      feeRateById[p.id] = feeRatePerSecond;
      totalFeeRate += feeRatePerSecond;
    }
    setRewardsEarnedGlw(finalizedSum);
    setTotalRatePerSec(totalRate);
    setPositionFinalizedMap(finalizedById);
    setPositionPendingMap(pendingById);
    setPositionRateMap(rateById);
    setPositionFeesMap(feesById);
    setPositionFeeRateMap(feeRateById);
    setFeesRatePerSec(totalFeeRate);

    animatedRewards.set(totalNow);
    const tick = setInterval(() => {
      const target = animatedRewards.get() + totalRate;
      animate(animatedRewards, target, { duration: 0.8, ease: "easeOut" });
    }, 1000);
    return () => clearInterval(tick);
  }, [positions, now]);

  // Per-position, second-by-second pending accrual
  React.useEffect(() => {
    const id = setInterval(() => {
      setPositionPendingMap((prev) => {
        const next: Record<string, number> = {};
        for (const key of Object.keys(prev)) {
          next[key] = prev[key] + (positionRateMap[key] || 0);
        }
        return next;
      });
      setPositionFeesMap((prev) => {
        const next: Record<string, number> = {};
        for (const key of Object.keys(positionFeeRateMap)) {
          const current = prev[key] ?? 0;
          next[key] = current + (positionFeeRateMap[key] || 0);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [positionRateMap, positionFeeRateMap]);

  const EPOCH_SECONDS = 7 * 24 * 60 * 60; // 7-day epochs (mock)

  function getLoyaltyMultiplier(createdAt: number) {
    const days = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
    return Math.pow(days, 0.176091259) || 0; // days^0.176091259
  }

  function getRewardsEstimatesGLW(p: Position) {
    // Simple estimate: rewards accrue on GLW principal only to avoid price dependency
    const apyPerSecond = p.apy / 100 / (365 * 24 * 60 * 60);
    const elapsedSeconds = Math.max(0, Math.floor((now - p.createdAt) / 1000));
    const multiplier = getLoyaltyMultiplier(p.createdAt);

    const completedEpochs = Math.floor(elapsedSeconds / EPOCH_SECONDS);
    const finalizedSeconds = completedEpochs * EPOCH_SECONDS;
    const pendingSeconds = elapsedSeconds - finalizedSeconds;

    const finalized =
      p.glwAmount * apyPerSecond * finalizedSeconds * multiplier;
    const pending = p.glwAmount * apyPerSecond * pendingSeconds * multiplier;

    const ratePerSecond = p.glwAmount * apyPerSecond * multiplier;

    return { finalized, pending, multiplier, ratePerSecond };
  }

  async function onAddLiquidity({ glw, usdg }: { glw: number; usdg: number }) {
    const newPos: Position = {
      id: `p${positions.length + 1}`,
      pair: "GLW/USDG",
      glwAmount: glw,
      usdgAmount: usdg,
      apy: 11.1,
      poolSharePct: 0.01,
      createdAt: Date.now(),
      initialGlw: glw,
      initialUsdg: usdg,
    };
    setPositions((prev) => [newPos, ...prev]);
    await Promise.resolve();
  }

  async function onRemoveLiquidity(percentage: number) {
    // Remove liquidity in FILO order (newest positions first)
    const sortedPositions = [...positions].sort(
      (a, b) => b.createdAt - a.createdAt
    );
    let remainingPct = percentage;

    const updatedPositions = sortedPositions
      .map((position) => {
        if (remainingPct <= 0) return position;

        const removeRatio = Math.min(remainingPct, 100) / 100;
        const newGlw = position.glwAmount * (1 - removeRatio);
        const newUsdg = position.usdgAmount * (1 - removeRatio);

        remainingPct = 0; // For simplicity, remove from newest position only

        return {
          ...position,
          glwAmount: Number(newGlw.toFixed(4)),
          usdgAmount: Number(newUsdg.toFixed(2)),
        };
      })
      .filter((p) => p.glwAmount > 0 && p.usdgAmount > 0);

    setPositions(updatedPositions);
    await Promise.resolve();
    setRemoveDialogOpen(false);
    toast.success(`Removed ${percentage}% of liquidity (mock)`);
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pt-12">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5" />

      <div className="max-w-screen-xl mx-auto px-2 md:px-6 lg:px-12 xl:px-16 py-8 relative z-10">
        {/* Rewards summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Live rewards card */}
          <div className="bg-background/80 backdrop-blur-xl rounded-3xl border border-border overflow-hidden">
            <div className="p-6">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Rewards earned (live)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground mb-1">
                    GLW incentives
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl md:text-3xl font-extrabold tabular-nums">
                      {animatedRewardsDisplay.toLocaleString(undefined, {
                        minimumFractionDigits: 6,
                        maximumFractionDigits: 6,
                      })}
                    </span>
                    <span className="text-muted-foreground font-medium">
                      GLW
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground mb-1">
                    Exchange fee rewards
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl md:text-3xl font-extrabold tabular-nums">
                      {Object.values(positionFeesMap)
                        .reduce((a, b) => a + b, 0)
                        .toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                    </span>
                    <span className="text-muted-foreground font-medium">
                      USDG
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Totals and info (from positions) card */}
          <div className="bg-background/80 backdrop-blur-xl rounded-3xl border border-border overflow-hidden">
            <div className="p-6">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
                My Positions Balances
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Total GLW</div>
                  <div className="text-2xl md:text-3xl font-bold tabular-nums">
                    {positions
                      .reduce((acc, p) => acc + p.glwAmount, 0)
                      .toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Total USDG
                  </div>
                  <div className="text-2xl md:text-3xl font-bold tabular-nums">
                    {positions
                      .reduce((acc, p) => acc + p.usdgAmount, 0)
                      .toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* Main Content Area */}
          <div className="space-y-4">
            {/* Action buttons */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Liquidity Management</h2>
              <Button
                variant="outline"
                onClick={() => setRemoveDialogOpen(true)}
                disabled={positions.length === 0}
                className="h-12"
              >
                Remove liquidity
              </Button>
            </div>

            {/* Liquidity incentive banner */}
            {showIncentiveBanner && (
              <div className="rounded-2xl border border-border bg-background p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className=" font-medium">
                      Liquidity incentive program
                    </div>
                    <p className="text-xs text-muted-foreground">
                      5,000 GLW per week for 12 weeks to Uniswap LPs. Rewards
                      are distributed proportionally by liquidity provided, with
                      a loyalty bonus that increases the longer liquidity stays
                      deposited.
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                      <li>1 day: no bonus</li>
                      <li>10 days: +50% bonus</li>
                      <li>100 days: +125% bonus</li>
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      Bonuses scale up over time, rewarding early and persistent
                      LPs to help deepen GLW liquidity.
                    </p>
                    <div>
                      <Link
                        href="/blog/liquidity-incentive-proposal"
                        className="text-xs underline text-primary hover:text-primary/80"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Read the full article →
                      </Link>
                    </div>
                  </div>
                  <button
                    onClick={hideIncentiveBanner}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Hide
                  </button>
                </div>
              </div>
            )}

            {/* Add Liquidity Panel - Always visible */}
            <AddLiquidityPanel onConfirm={onAddLiquidity} />
          </div>

          {/* Sidebar: Your Positions */}
          <aside className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your Positions</h3>
              <span className="text-xs text-muted-foreground">
                {positions.length} active
              </span>
            </div>

            {positions.length > 0 && (
              <div className="space-y-3">
                {positions
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt) // FILO
                  .map((position) => {
                    const finalized = positionFinalizedMap[position.id] ?? 0;
                    const pending = positionPendingMap[position.id] ?? 0;
                    const multiplier = getLoyaltyMultiplier(position.createdAt);
                    const days = Math.max(
                      0,
                      (now - position.createdAt) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div
                        key={position.id}
                        className="bg-background/80 backdrop-blur-xl rounded-2xl border border-border overflow-hidden hover:border-border/80 transition-all duration-200"
                      >
                        <div className="p-4">
                          {/* Position Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-medium">{position.pair}</div>
                              <div className="text-xs text-muted-foreground">
                                Opened {Math.floor(days)}d ago
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                                APY
                              </div>
                              <div className="text-lg font-bold tabular-nums">
                                {position.apy.toFixed(2)}%
                              </div>
                            </div>
                          </div>

                          {/* Composition progress bar */}
                          {(() => {
                            const currentGlwWithRewards =
                              position.glwAmount + finalized + pending;
                            const totalValue =
                              currentGlwWithRewards * (MOCK_PRICE_RATIO || 0) +
                              position.usdgAmount;
                            const pctGLW =
                              totalValue > 0
                                ? (currentGlwWithRewards *
                                    (MOCK_PRICE_RATIO || 0)) /
                                  totalValue
                                : 0;
                            const pctUSDG = 1 - pctGLW;
                            return (
                              <div className="mt-3 rounded-md border p-3">
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                  <span>Current pool value</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <span>
                                    {" "}
                                    {currentGlwWithRewards.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 4,
                                      }
                                    )}{" "}
                                    GLW{" "}
                                  </span>
                                  <span>
                                    {position.usdgAmount.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 2,
                                      }
                                    )}{" "}
                                    USDG
                                  </span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Rewards and loyalty */}
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div className="rounded-md border p-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  GLW rewards
                                </div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger className="text-xs text-muted-foreground">
                                      ?
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs max-w-xs">
                                      GLW incentives are distributed after the
                                      v2 launch when epochs finalize. Amounts
                                      shown accrue in real time but are not
                                      immediately claimable. The v2 launch date
                                      is not yet defined.
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="font-medium tabular-nums">
                                {(finalized + pending).toFixed(6)} GLW
                              </div>
                            </div>
                            <div className="rounded-md border p-3">
                              <div className="text-xs text-muted-foreground">
                                Exchange fee rewards
                              </div>
                              <div className="font-medium tabular-nums">
                                {positionFeesMap[position.id]?.toFixed(2) ??
                                  "0.00"}{" "}
                                USDG
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 rounded-md border p-3 flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              Loyalty bonus
                            </div>
                            <div className="font-mono text-sm">
                              {multiplier.toFixed(6)}×
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </aside>
        </div>

        {/* Remove Liquidity Dialog */}
        <RemoveLiquidityDialog
          open={removeDialogOpen}
          onOpenChange={setRemoveDialogOpen}
          positions={positions}
          priceRatio={MOCK_PRICE_RATIO}
          onConfirm={onRemoveLiquidity}
        />
      </div>
    </div>
  );
}

export default PositionsView;
