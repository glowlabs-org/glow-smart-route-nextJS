"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Minus, Sparkles } from "lucide-react";
import { formatUnits } from "viem";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { AddLiquidityReviewDialog } from "./add-liquidity-dialog";
import { RemoveLiquidityDialog } from "./remove-liquidity-dialog";

import { LiquidityIncentiveDialog } from "./liquidity-incentive-dialog";
import { useLiquidityPositions } from "@/hooks/useLiquidityPositions";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { useMemo } from "react";
import Decimal from "decimal.js";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { useWalletClient } from "wagmi";
import { ConnectButton } from "@/components/connect-button";

export function PositionsView() {
  const {
    positions,
    now,
    totalAccumulatedGlw,
    isPositionsLoading,
    isPositionsFetching,
    isPositionsPending,
    positionFinalizedMap,

    positionFeesMap,
    priceRatio,
    poolReserves,
    getLoyaltyMultiplier,
    showIncentiveDialog,
    acknowledgeIncentiveDialog,
    onIncentiveDialogOpenChange,
    quoteOtherAmount,
    wouldAddLiquidityLikelyFail,
  } = useLiquidityPositions();
  const [removeDialogOpen, setRemoveDialogOpen] = React.useState(false);

  const totalFeeRewardsUSDG = React.useMemo(
    () => Object.values(positionFeesMap).reduce((a, b) => a + b, 0),
    [positionFeesMap]
  );

  console.log("isPositionsLoading", isPositionsLoading);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Main Content with Sidebar Layout */}
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl lg:px-8 py-2">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_500px] gap-4">
          {/* Main Content Area */}
          <div className="space-y-4">
            {/* Add Liquidity Card */}
            <AddLiquidityPanel
              priceRatio={priceRatio}
              poolReserves={poolReserves}
              quoteOtherAmount={quoteOtherAmount}
              wouldAddLiquidityLikelyFail={wouldAddLiquidityLikelyFail}
            />
          </div>

          {/* Right Sidebar */}
          <aside className="xl:sticky h-fit space-y-4">
            <RewardsSummaryCard
              totalAccumulatedGlw={totalAccumulatedGlw}
              totalFeeRewardsUSDG={totalFeeRewardsUSDG}
              isLoading={isPositionsLoading || isPositionsFetching}
            />
            <PositionsList
              positions={positions}
              now={now}
              positionFinalizedMap={positionFinalizedMap}
              positionFeesMap={positionFeesMap}
              getLoyaltyMultiplier={getLoyaltyMultiplier}
              isLoading={isPositionsLoading}
              onOpenRemove={() => setRemoveDialogOpen(true)}
            />
          </aside>
        </div>

        {/* Remove Liquidity Dialog */}
        <RemoveLiquidityDialog
          open={removeDialogOpen}
          onOpenChange={setRemoveDialogOpen}
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
  priceRatio: number;
  poolReserves: { glw: number; usdg: number };
  quoteOtherAmount: (params: {
    fromToken: "GLW" | "USDG";
    amount: number;
  }) => number;
  wouldAddLiquidityLikelyFail: (params: {
    glw: number;
    usdg: number;
  }) => boolean;
}

function AddLiquidityPanel({
  priceRatio,
  quoteOtherAmount,
  wouldAddLiquidityLikelyFail,
}: AddLiquidityPanelProps) {
  const [glw, setGlw] = React.useState<string>("");
  const [usdg, setUsdg] = React.useState<string>("");
  const [matchRatio] = React.useState<boolean>(true);
  const [reviewOpen, setReviewOpen] = React.useState(false);

  const { signer } = useEthersSigner();
  const { usdgBalance, glowBalance, refreshBalances } = useER20Balances({
    signer,
  });
  const [preflightError, setPreflightError] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    refreshBalances();
  }, [signer]);

  const glwBalanceNumber = useMemo(() => {
    if (!glowBalance) return 0;
    try {
      return new Decimal(
        formatUnits(BigInt(glowBalance), DECIMALS_BY_TOKEN.GLW)
      ).toNumber();
    } catch {
      return 0;
    }
  }, [glowBalance]);

  const usdgBalanceNumber = useMemo(() => {
    if (!usdgBalance) return 0;
    try {
      return new Decimal(
        formatUnits(BigInt(usdgBalance), DECIMALS_BY_TOKEN.USDG)
      ).toNumber();
    } catch {
      return 0;
    }
  }, [usdgBalance]);

  function handleGlwChange(v: string) {
    setGlw(v);
    setPreflightError(null);
    if (matchRatio && priceRatio) {
      const n = Number(v);
      if (!Number.isNaN(n)) {
        const q = quoteOtherAmount({ fromToken: "GLW", amount: n });
        if (n > 0 && q > 0) setUsdg(q.toFixed(2));
        else
          setUsdg(n > 0 && priceRatio > 0 ? (n * priceRatio).toFixed(2) : "");
      }
    }
  }

  function handleUsdgChange(v: string) {
    setUsdg(v);
    setPreflightError(null);
    if (matchRatio && priceRatio) {
      const n = Number(v);
      if (!Number.isNaN(n)) {
        const q = quoteOtherAmount({ fromToken: "USDG", amount: n });
        if (n > 0 && q > 0) setGlw(q.toFixed(4));
        else if (priceRatio > 0)
          setGlw(n > 0 ? (n / priceRatio).toFixed(4) : "");
      }
    }
  }

  const glwNum = React.useMemo(() => {
    const n = Number(glw);
    return Number.isFinite(n) ? n : 0;
  }, [glw]);
  const usdgNum = React.useMemo(() => {
    const n = Number(usdg);
    return Number.isFinite(n) ? n : 0;
  }, [usdg]);

  const isGlwOverBalance = glwNum > glwBalanceNumber;
  const isUsdgOverBalance = usdgNum > usdgBalanceNumber;
  const isAmountMissing =
    glw.trim() === "" || usdg.trim() === "" || glwNum <= 0 || usdgNum <= 0;
  const isActionDisabled =
    isAmountMissing || isGlwOverBalance || isUsdgOverBalance;
  const actionLabel =
    isGlwOverBalance && isUsdgOverBalance
      ? "Insufficient funds"
      : isGlwOverBalance
      ? "Insufficient GLW balance"
      : isUsdgOverBalance
      ? "Insufficient USDG balance"
      : isAmountMissing
      ? "Enter amounts"
      : "Review";

  function handleAdd() {
    if (isActionDisabled) return;
    if (
      !Number.isFinite(glwNum) ||
      !Number.isFinite(usdgNum) ||
      glwNum <= 0 ||
      usdgNum <= 0
    ) {
      toast.error("Enter valid GLW and USDG amounts");
      return;
    }
    if (wouldAddLiquidityLikelyFail({ glw: glwNum, usdg: usdgNum })) {
      setPreflightError(
        "Pool reserves changed. Your amounts likely fail slippage. Adjust amounts to match pool ratio."
      );
      return;
    }
    setPreflightError(null);
    setReviewOpen(true);
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
            <span
              className={`text-xs lg:text-sm flex items-center gap-1 ${
                isGlwOverBalance ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              Balance:{" "}
              <NumberTicker
                value={glwBalanceNumber}
                decimalPlaces={0}
                className="text-xs lg:text-sm"
              />
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className={`text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full ${
                  isGlwOverBalance ? "text-destructive" : ""
                }`}
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
            <span
              className={`text-xs lg:text-sm flex items-center gap-1 ${
                isUsdgOverBalance ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              Balance:{" "}
              <NumberTicker
                value={usdgBalanceNumber}
                decimalPlaces={0}
                className="text-xs lg:text-sm"
              />
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className={`text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full ${
                  isUsdgOverBalance ? "text-destructive" : ""
                }`}
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

        {preflightError && (
          <div className="rounded-xl border border-destructive bg-destructive/10 text-destructive p-3 text-sm">
            {preflightError}
          </div>
        )}

        {signer ? (
          <Button
            onClick={handleAdd}
            disabled={isActionDisabled}
            className="w-full h-12 lg:h-14"
          >
            {actionLabel}
          </Button>
        ) : (
          <ConnectButton variant="default" />
        )}
      </div>

      <AddLiquidityReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        glwAmount={Number(glw || 0)}
        usdgAmount={Number(usdg || 0)}
        onSuccess={() => {
          // Reset the input fields after successful transaction
          setGlw("");
          setUsdg("");
        }}
      />
    </div>
  );
}

interface RewardsSummaryCardProps {
  totalAccumulatedGlw: number;
  totalFeeRewardsUSDG: number;
  isLoading?: boolean;
}

function RewardsSummaryCard({
  totalAccumulatedGlw,
  totalFeeRewardsUSDG,
  isLoading,
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
              {isLoading ? (
                <span className="inline-block h-6 w-32 rounded bg-muted animate-pulse" />
              ) : (
                <>
                  <span className="text-xl font-extrabold tabular-nums">
                    {totalAccumulatedGlw.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-muted-foreground font-medium text-sm">
                    GLW
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground mb-2">
              Exchange Fee Rewards
            </div>
            <div className="flex items-baseline gap-2">
              {isLoading ? (
                <span className="inline-block h-6 w-24 rounded bg-muted animate-pulse" />
              ) : (
                <>
                  <span className="text-xl font-extrabold tabular-nums">
                    {totalFeeRewardsUSDG.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-muted-foreground font-medium text-sm">
                    Liquidity
                  </span>
                </>
              )}
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
  positionFeesMap: Record<string, number>;
  getLoyaltyMultiplier: (createdAt: number) => number;
  isLoading?: boolean;
  onOpenRemove: () => void;
}

function PositionsList({
  positions,
  now,
  positionFinalizedMap,
  positionFeesMap,
  getLoyaltyMultiplier,
  isLoading,
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
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-16 rounded-xl bg-muted animate-pulse" />
            <div className="h-16 rounded-xl bg-muted animate-pulse" />
            <div className="h-16 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : positions.length === 0 ? (
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
  feesUSDG: number;
  getLoyaltyMultiplier: (createdAt: number) => number;
}

function PositionCard({
  position,
  now,
  finalized,
  feesUSDG,
  getLoyaltyMultiplier,
}: PositionCardProps) {
  // Calculate time components more accurately
  const totalMs = Math.max(0, now - position.createdAt);
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);

  // Format time display based on duration
  const getTimeDisplay = () => {
    if (days > 0) {
      return `${days}d ${hours}h ago`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return "Just now";
    }
  };

  const liveMultiplier = getLoyaltyMultiplier(position.createdAt);
  const currentGlw = position.glwAmount;
  const incentiveApy = Number.isFinite((position as any).liquidityIncentiveApy)
    ? ((position as any).liquidityIncentiveApy as number)
    : position.apy;
  const rawFeesApy = Number.isFinite((position as any).feesApy)
    ? ((position as any).feesApy as number)
    : 0;
  const feesApy = rawFeesApy <= 1 ? rawFeesApy * 100 : rawFeesApy;
  const performanceFeePct = 0; // currently 0%
  const netApy = Math.max(0, incentiveApy + feesApy - performanceFeePct);
  return (
    <div className="bg-muted/30 rounded-xl border border-border overflow-hidden hover:border-foreground/20 transition-all duration-200">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-medium">{position.pair}</div>
            <div className="text-xs text-muted-foreground">
              Opened {getTimeDisplay()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              APY
            </div>
            <HoverCard>
              <HoverCardTrigger asChild>
                <div className="text-lg font-bold tabular-nums flex items-center justify-end cursor-help">
                  <NumberTicker
                    value={netApy}
                    decimalPlaces={0}
                    className="text-lg font-bold"
                    suffix="%"
                  />
                  <Sparkles className="ml-2 size-5" aria-hidden="true" />
                </div>
              </HoverCardTrigger>
              <HoverCardContent
                align="end"
                className="rounded-2xl border border-border bg-background text-foreground shadow-xl"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Incentive APY</span>
                    <span className="font-medium">
                      {incentiveApy.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}
                      %
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fees APY</span>
                    <span className="font-medium">
                      {feesApy >= 0 ? "+" : ""}
                      {feesApy.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}
                      %
                    </span>
                  </div>

                  <div className="border-t pt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Combined APY</span>
                      <span className="text-primary font-semibold">
                        =
                        {netApy.toLocaleString("en-US", {
                          maximumFractionDigits: 4,
                        })}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </div>

        <CompositionBar
          glwAmount={currentGlw}
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
            <div className="font-medium tabular-nums flex items-baseline gap-1">
              <NumberTicker
                value={finalized}
                decimalPlaces={4}
                className="font-medium"
              />
              <span>GLW</span>
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">
              Exchange fee rewards
            </div>
            <div className="font-medium tabular-nums flex items-baseline gap-1">
              <NumberTicker
                value={feesUSDG}
                decimalPlaces={2}
                className="font-medium"
              />
              <span>Liquidity</span>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-md border p-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Loyalty bonus</div>
          <div className="font-mono text-sm flex items-center">
            <NumberTicker
              value={liveMultiplier}
              decimalPlaces={12}
              className="font-mono text-sm"
              suffix="×"
            />
          </div>
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
        {/* <span>
          {(pctGLW * 100).toFixed(2)}% GLW · {(pctUSDG * 100).toFixed(2)}% USDG
        </span> */}
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
