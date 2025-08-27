"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddLiquidityReviewDialog } from "./add-liquidity-dialog";
import { RemoveLiquidityDialog } from "./remove-liquidity-dialog";

import { LiquidityIncentiveDialog } from "./liquidity-incentive-dialog";
import { useLiquidityPositions } from "@/hooks/useLiquidityPositions";

export function PositionsView() {
  const {
    positions,
    now,
    animatedRewardsDisplay,
    totalRatePerSec,
    positionFinalizedMap,
    positionPendingMap,
    positionFeesMap,
    priceRatio,
    poolReserves,
    getLoyaltyMultiplier,
    addLiquidity,
    removeLiquidity,
    showIncentiveDialog,
    acknowledgeIncentiveDialog,
    onIncentiveDialogOpenChange,
  } = useLiquidityPositions();
  const [removeDialogOpen, setRemoveDialogOpen] = React.useState(false);

  const totalFeeRewardsUSDG = React.useMemo(
    () => Object.values(positionFeesMap).reduce((a, b) => a + b, 0),
    [positionFeesMap]
  );
  async function onAddLiquidity({ glw, usdg }: { glw: number; usdg: number }) {
    try {
      await addLiquidity({ glw, usdg });
    } catch (error) {
      toast.error("Failed to add liquidity");
      throw error;
    }
  }

  async function onRemoveLiquidity(percentage: number) {
    try {
      await removeLiquidity(percentage);
      setRemoveDialogOpen(false);
      toast.success(`Removed ${percentage}% of liquidity (mock)`);
    } catch (error) {
      toast.error("Failed to remove liquidity");
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Main Content with Sidebar Layout */}
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_500px] gap-4">
          {/* Main Content Area */}
          <div className="space-y-4">
            {/* Add Liquidity Card */}
            <AddLiquidityPanel
              onConfirm={onAddLiquidity}
              priceRatio={priceRatio}
              poolReserves={poolReserves}
            />
          </div>

          {/* Right Sidebar */}
          <aside className="xl:sticky h-fit space-y-4">
            <RewardsSummaryCard
              animatedRewardsDisplay={animatedRewardsDisplay}
              totalRatePerSec={totalRatePerSec}
              totalFeeRewardsUSDG={totalFeeRewardsUSDG}
            />
            <PositionsList
              positions={positions}
              now={now}
              positionFinalizedMap={positionFinalizedMap}
              positionPendingMap={positionPendingMap}
              positionFeesMap={positionFeesMap}
              getLoyaltyMultiplier={getLoyaltyMultiplier}
              onOpenRemove={() => setRemoveDialogOpen(true)}
            />
          </aside>
        </div>

        {/* Remove Liquidity Dialog */}
        <RemoveLiquidityDialog
          open={removeDialogOpen}
          onOpenChange={setRemoveDialogOpen}
          positions={positions}
          priceRatio={priceRatio}
          onConfirm={onRemoveLiquidity}
        />

        {/* Liquidity Incentive Dialog (first-visit) */}
        <LiquidityIncentiveDialog
          open={showIncentiveDialog}
          onOpenChange={onIncentiveDialogOpenChange}
          onAcknowledge={acknowledgeIncentiveDialog}
        />
      </div>
    </div>
  );
}

export default PositionsView;

// ---- Subcomponents ----

interface AddLiquidityPanelProps {
  onConfirm: (params: { glw: number; usdg: number }) => Promise<void>;
  priceRatio: number;
  poolReserves: { glw: number; usdg: number };
}

function AddLiquidityPanel({
  onConfirm,
  priceRatio,
  poolReserves,
}: AddLiquidityPanelProps) {
  const [glw, setGlw] = React.useState<string>("");
  const [usdg, setUsdg] = React.useState<string>("");
  const [matchRatio] = React.useState<boolean>(true);
  const [reviewOpen, setReviewOpen] = React.useState(false);

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
    setReviewOpen(true);
  }

  async function confirmAfterReview() {
    const glwNum = Number(glw);
    const usdgNum = Number(usdg);
    try {
      await onConfirm({ glw: glwNum, usdg: usdgNum });
      setGlw("");
      setUsdg("");
      setReviewOpen(false);
      toast.success("Liquidity added (mock)");
    } catch {
      toast.error("Failed to add liquidity");
    }
  }

  return (
    <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden">
      <div className="p-6 ">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-xl font-semibold">Add Liquidity</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add liquidity to the GLW/USDG pool and start earning rewards
            </p>
          </div>
        </div>
      </div>
      <div className="p-6 pt-0 space-y-6">
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

        <Button
          onClick={handleAdd}
          isLoading={false}
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
        isSubmitting={false}
      />
    </div>
  );
}

interface RewardsSummaryCardProps {
  animatedRewardsDisplay: number;
  totalRatePerSec: number;
  totalFeeRewardsUSDG: number;
}

function RewardsSummaryCard({
  animatedRewardsDisplay,
  totalRatePerSec,
  totalFeeRewardsUSDG,
}: RewardsSummaryCardProps) {
  return (
    <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-semibold">Rewards Summary</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-muted/30 rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground mb-2">
              GLW Incentives
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold tabular-nums">
                {animatedRewardsDisplay.toLocaleString(undefined, {
                  minimumFractionDigits: 6,
                  maximumFractionDigits: 6,
                })}
              </span>
              <span className="text-muted-foreground font-medium text-sm">
                GLW
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              +{(totalRatePerSec * 3600).toFixed(6)} GLW/hr
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground mb-2">
              Exchange Fee Rewards
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold tabular-nums">
                {totalFeeRewardsUSDG.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-muted-foreground font-medium text-sm">
                USDG
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PositionsListProps {
  positions: Array<{
    id: string;
    pair: "GLW/USDG";
    glwAmount: number;
    usdgAmount: number;
    apy: number;
    createdAt: number;
  }>;
  now: number;
  positionFinalizedMap: Record<string, number>;
  positionPendingMap: Record<string, number>;
  positionFeesMap: Record<string, number>;
  getLoyaltyMultiplier: (createdAt: number) => number;
  onOpenRemove: () => void;
}

function PositionsList({
  positions,
  now,
  positionFinalizedMap,
  positionPendingMap,
  positionFeesMap,
  getLoyaltyMultiplier,
  onOpenRemove,
}: PositionsListProps) {
  return (
    <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Your Positions</h3>
          </div>
          <Button
            variant="outline"
            onClick={onOpenRemove}
            disabled={positions.length === 0}
            className="h-9 sm:h-10"
          >
            <Minus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Remove Liquidity</span>
            <span className="sm:hidden">Remove</span>
          </Button>
        </div>

        {positions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">
              No active positions yet
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Add liquidity to start earning rewards
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {positions
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((position) => (
                <PositionCard
                  key={position.id}
                  position={position}
                  now={now}
                  finalized={positionFinalizedMap[position.id] ?? 0}
                  pending={positionPendingMap[position.id] ?? 0}
                  feesUSDG={positionFeesMap[position.id] ?? 0}
                  getLoyaltyMultiplier={getLoyaltyMultiplier}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PositionCardProps {
  position: {
    id: string;
    pair: "GLW/USDG";
    glwAmount: number;
    usdgAmount: number;
    apy: number;
    createdAt: number;
  };
  now: number;
  finalized: number;
  pending: number;
  feesUSDG: number;
  getLoyaltyMultiplier: (createdAt: number) => number;
}

function PositionCard({
  position,
  now,
  finalized,
  pending,
  feesUSDG,
  getLoyaltyMultiplier,
}: PositionCardProps) {
  const days = Math.max(0, (now - position.createdAt) / (1000 * 60 * 60 * 24));
  const liveMultiplier = getLoyaltyMultiplier(position.createdAt);
  const currentGlwWithRewards = position.glwAmount + finalized + pending;
  return (
    <div className="bg-muted/30 rounded-xl border border-border overflow-hidden hover:border-foreground/20 transition-all duration-200">
      <div className="p-4">
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

        <CompositionBar
          glwAmount={currentGlwWithRewards}
          usdgAmount={position.usdgAmount}
        />

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">GLW rewards</div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="text-xs text-muted-foreground">
                    ?
                  </TooltipTrigger>
                  <TooltipContent className="text-xs max-w-xs">
                    GLW incentives are distributed after the v2 launch when
                    epochs finalize. Amounts shown accrue in real time but are
                    not immediately claimable. The v2 launch date is not yet
                    defined.
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
              {feesUSDG.toFixed(2)} USDG
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-md border p-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Loyalty bonus</div>
          <div className="font-mono text-sm">{liveMultiplier.toFixed(12)}×</div>
        </div>
      </div>
    </div>
  );
}

interface CompositionBarProps {
  glwAmount: number;
  usdgAmount: number;
}

function CompositionBar({ glwAmount, usdgAmount }: CompositionBarProps) {
  const pctGLW = 0.5;
  const pctUSDG = 0.5;
  return (
    <div className="mt-3 rounded-md border p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>Current pool value</span>
        <span>
          {(pctGLW * 100).toFixed(2)}% GLW · {(pctUSDG * 100).toFixed(2)}% USDG
        </span>
      </div>
      <div className="h-2 w-full rounded-full overflow-hidden flex border border-border">
        <div
          className="bg-foreground"
          style={{ width: `${(pctGLW * 100).toFixed(2)}%` }}
        />
        <div
          className="bg-muted-foreground"
          style={{ width: `${(pctUSDG * 100).toFixed(2)}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span>
          {glwAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
          GLW
        </span>
        <span>
          {usdgAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
          USDG
        </span>
      </div>
    </div>
  );
}
