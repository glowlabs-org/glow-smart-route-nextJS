"use client";

import * as React from "react";
import Link from "next/link";
import { Droplets, ArrowRight } from "lucide-react";
import { formatUnits } from "viem";
import Decimal from "decimal.js";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddLiquidityReviewDialog } from "@/app/liquidity/add-liquidity-dialog";
import { RemoveLiquidityDialog } from "@/app/liquidity/remove-liquidity-dialog";
import {
  GLW_INCENTIVES_END_TIME,
  useLiquidityPositions,
} from "@/hooks/useLiquidityPositionsOptimized";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { ConnectButton } from "@/components/connect-button";
import { trackEvent } from "@/lib/telemetry";
import { bucketToken, bucketUsd } from "@/lib/telemetry-buckets";

export interface AddLiquidityQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isValidDecimalInput(value: string) {
  return value === "" || /^\d*\.?\d*$/.test(value);
}

function formatTokenAmount(
  amount: number,
  options?: { maximumFractionDigits?: number }
) {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 6,
  });
}

function formatRatio(priceRatio: number) {
  if (!Number.isFinite(priceRatio) || priceRatio <= 0) return "—";
  const maximumFractionDigits = priceRatio < 1 ? 6 : 4;
  return priceRatio.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatRelativeTime(params: { now: number; createdAt: number }) {
  const { now, createdAt } = params;
  const totalMs = Math.max(0, now - createdAt);
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);

  if (days > 0) return `${days}d ${hours}h ago`;
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export function AddLiquidityQuickDialog({
  open,
  onOpenChange,
}: AddLiquidityQuickDialogProps) {
  const { address, isConnected } = useAccount();
  const walletAddress = address?.toLowerCase() ?? null;
  const source = "add_liquidity_quick_dialog";
  const {
    positions,
    now,
    isPositionsLoading,
    priceRatio,
    quoteOtherAmount,
    wouldAddLiquidityLikelyFail,
  } = useLiquidityPositions();

  const [glw, setGlw] = React.useState<string>("");
  const [usdg, setUsdg] = React.useState<string>("");
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [lastEdited, setLastEdited] = React.useState<"GLW" | "USDG">("GLW");

  const { signer } = useEthersSigner();
  const { usdgBalance, glowBalance, usdcBalance } = useER20Balances({ signer });

  const glwNum = React.useMemo(() => toNumber(glw), [glw]);
  const usdgNum = React.useMemo(() => toNumber(usdg), [usdg]);
  const isMissing =
    glw.trim() === "" || usdg.trim() === "" || glwNum <= 0 || usdgNum <= 0;

  const glwBalanceNumber = React.useMemo(() => {
    if (!glowBalance) return 0;
    try {
      return new Decimal(
        formatUnits(BigInt(glowBalance), DECIMALS_BY_TOKEN.GLW)
      ).toNumber();
    } catch {
      return 0;
    }
  }, [glowBalance]);

  const usdgBalanceNumber = React.useMemo(() => {
    if (!usdgBalance) return 0;
    try {
      return new Decimal(
        formatUnits(BigInt(usdgBalance), DECIMALS_BY_TOKEN.USDG)
      ).toNumber();
    } catch {
      return 0;
    }
  }, [usdgBalance]);

  const usdcBalanceNumber = React.useMemo(() => {
    if (!usdcBalance) return 0;
    try {
      return new Decimal(
        formatUnits(BigInt(usdcBalance), DECIMALS_BY_TOKEN.USDC)
      ).toNumber();
    } catch {
      return 0;
    }
  }, [usdcBalance]);

  const isGlwOverBalance = glwNum > glwBalanceNumber;
  const isUsdgOverBalance = usdgNum > usdgBalanceNumber;

  const wouldLikelyFail =
    glwNum > 0 && usdgNum > 0
      ? wouldAddLiquidityLikelyFail({ glw: glwNum, usdg: usdgNum })
      : false;

  const isActionDisabled =
    isMissing || isGlwOverBalance || isUsdgOverBalance || wouldLikelyFail;

  const actionLabel =
    isGlwOverBalance && isUsdgOverBalance
      ? "Insufficient funds"
      : isGlwOverBalance
      ? "Insufficient GLW balance"
      : isUsdgOverBalance
      ? "Insufficient USDG balance"
      : isMissing
      ? "Enter amounts"
      : wouldLikelyFail
      ? "Adjust amounts"
      : "Review";

  const handleGlwChange = (value: string) => {
    setGlw(value);
    setLastEdited("GLW");
    const n = toNumber(value);
    if (!priceRatio || n <= 0) {
      setUsdg("");
      return;
    }
    const q = quoteOtherAmount({ fromToken: "GLW", amount: n });
    setUsdg(q > 0 ? q.toFixed(2) : (n * priceRatio).toFixed(2));
  };

  const handleUsdgChange = (value: string) => {
    setUsdg(value);
    setLastEdited("USDG");
    const n = toNumber(value);
    if (!priceRatio || n <= 0) {
      setGlw("");
      return;
    }
    const q = quoteOtherAmount({ fromToken: "USDG", amount: n });
    setGlw(q > 0 ? q.toFixed(4) : (n / priceRatio).toFixed(4));
  };

  function handleUpdateToPoolRatio() {
    if (!priceRatio || priceRatio <= 0) return;
    trackEvent("dashboard_add_liquidity_update_ratio_click", {
      source,
      wallet_connected: isConnected,
      wallet_address: walletAddress,
      amount_token_bucket: bucketToken(glwNum),
      amount_usd_bucket: bucketUsd(usdgNum),
    });
    if (lastEdited === "GLW") {
      if (!isValidDecimalInput(glw)) return;
      handleGlwChange(glw);
      return;
    }
    if (!isValidDecimalInput(usdg)) return;
    handleUsdgChange(usdg);
  }

  const handleReview = () => {
    if (isActionDisabled) return;
    trackEvent("dashboard_add_liquidity_review_click", {
      source,
      wallet_connected: isConnected,
      wallet_address: walletAddress,
      amount_token_bucket: bucketToken(glwNum),
      amount_usd_bucket: bucketUsd(usdgNum),
    });
    setReviewOpen(true);
  };

  const handleReviewOpenChange = (next: boolean) => {
    setReviewOpen(next);
    if (!next) return;
    // keep outer dialog open while reviewing
  };

  const isAfterCutoff = Date.now() > GLW_INCENTIVES_END_TIME;

  const sortedPositions = React.useMemo(() => {
    return positions.slice().sort((a, b) => b.createdAt - a.createdAt);
  }, [positions]);

  const positionTotals = React.useMemo(() => {
    return positions.reduce(
      (acc, p) => ({
        glw: acc.glw + p.glwAmount,
        usdg: acc.usdg + p.usdgAmount,
      }),
      { glw: 0, usdg: 0 }
    );
  }, [positions]);

  function handleOuterOpenChange(next: boolean) {
    if (!next) {
      setReviewOpen(false);
      setRemoveOpen(false);
    }
    onOpenChange(next);
  }

  return (
    <>
      <Dialog
        open={open && !reviewOpen && !removeOpen}
        onOpenChange={handleOuterOpenChange}
      >
        <DialogContent className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-sm w-full border-border shadow-2xl overflow-hidden">
          <DialogHeader className="p-6 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-muted-foreground" />
              Liquidity
            </DialogTitle>
            <DialogDescription className="flex flex-col gap-1">
              <span>Add liquidity to the GLW/USDG pool.</span>
              <span className="text-xs text-muted-foreground">
                1 GLW ≈ {formatRatio(priceRatio)} USDG
              </span>
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="add" className="px-6 pb-6 pt-0">
            <TabsList className="grid h-9 w-full grid-cols-2 rounded-full bg-muted/30 p-1">
              <TabsTrigger
                value="add"
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
              >
                Add
              </TabsTrigger>
              <TabsTrigger
                value="manage"
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
              >
                Manage
              </TabsTrigger>
            </TabsList>

            <TabsContent value="add" className="mt-3 space-y-4">
              {/* GLW input card */}
              <div className="group relative bg-muted/30 rounded-3xl p-4 border border-border hover:border-border/60 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Input
                  </span>
                  {signer ? (
                    <span
                      className={`text-xs flex items-center gap-1 ${
                        isGlwOverBalance
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      Balance: {formatTokenAmount(glwBalanceNumber)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Connect wallet
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className={`text-lg sm:text-2xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full ${
                        isGlwOverBalance ? "text-destructive" : ""
                      }`}
                      value={glw}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!isValidDecimalInput(v)) return;
                        handleGlwChange(v);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-center px-4 py-2 bg-background rounded-xl border border-border">
                    <span className="font-medium">GLW</span>
                  </div>
                </div>
              </div>

              {/* USDG input card */}
              <div className="group relative bg-muted/30 rounded-3xl p-4 border border-border hover:border-border/60 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Input
                  </span>
                  {signer ? (
                    <span
                      className={`text-xs flex items-center gap-1 ${
                        isUsdgOverBalance
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      Balance: {formatTokenAmount(usdgBalanceNumber)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Connect wallet
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className={`text-lg sm:text-2xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full ${
                        isUsdgOverBalance ? "text-destructive" : ""
                      }`}
                      value={usdg}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!isValidDecimalInput(v)) return;
                        handleUsdgChange(v);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-center px-4 py-2 bg-background rounded-xl border border-border">
                    <span className="font-medium">USDG</span>
                  </div>
                </div>
              </div>

              {/* USDC to USDG swap suggestion banner */}
              {signer &&
              isUsdgOverBalance &&
              usdcBalanceNumber >= usdgNum &&
              usdgNum > 0 ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Need more USDG?</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        You have {usdcBalanceNumber.toFixed(2)} USDC available.
                        Swap USDC to USDG to continue.
                      </p>
                    </div>
                    <Link
                      href="/glow-swap"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                      onClick={() => {
                        trackEvent("dashboard_add_liquidity_go_to_swap_click", {
                          source,
                          wallet_connected: isConnected,
                          wallet_address: walletAddress,
                          reason: "need_usdg",
                        });
                      }}
                    >
                      Go to Swap
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ) : null}

              {/* Preflight slippage warning */}
              {signer && wouldLikelyFail ? (
                <div className="rounded-xl border border-destructive bg-destructive/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-destructive">
                        Action would likely fail
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pool reserves changed. Update amounts to match the pool
                        ratio to avoid slippage failure.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl"
                      onClick={handleUpdateToPoolRatio}
                    >
                      Update ratio
                    </Button>
                  </div>
                </div>
              ) : null}

              {signer ? (
                <Button
                  className="w-full h-12 rounded-2xl font-mono font-bold"
                  disabled={isActionDisabled}
                  onClick={handleReview}
                >
                  {actionLabel}
                </Button>
              ) : (
                <ConnectButton variant="default" />
              )}
            </TabsContent>

            <TabsContent value="manage" className="mt-3 space-y-3">
              {!signer ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="text-sm font-medium">
                      Manage your position
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Connect your wallet to view and remove liquidity.
                    </div>
                  </div>
                  <ConnectButton variant="default" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Your positions</div>
                      <div className="text-xs text-muted-foreground">
                        {positions.length === 0
                          ? "No active positions"
                          : `${positions.length} position${
                              positions.length === 1 ? "" : "s"
                            } • Total ${formatTokenAmount(positionTotals.glw, {
                              maximumFractionDigits: 4,
                            })} GLW + ${formatTokenAmount(positionTotals.usdg, {
                              maximumFractionDigits: 2,
                            })} USDG`}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-xl px-3 text-xs"
                      disabled={positions.length === 0}
                      onClick={() => {
                        trackEvent("dashboard_remove_liquidity_open_click", {
                          source,
                          wallet_connected: isConnected,
                          wallet_address: walletAddress,
                          positions_count: positions.length,
                        });
                        setRemoveOpen(true);
                      }}
                    >
                      Remove
                    </Button>
                  </div>

                  {isAfterCutoff ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <div className="text-xs text-muted-foreground">
                        Incentive program ended. Liquidity still earns exchange
                        fees.
                      </div>
                    </div>
                  ) : null}

                  {isPositionsLoading ? (
                    <div className="space-y-3">
                      <div className="h-16 rounded-2xl bg-muted animate-pulse" />
                      <div className="h-16 rounded-2xl bg-muted animate-pulse" />
                    </div>
                  ) : positions.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <div className="text-sm font-medium">
                        No positions yet
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Add liquidity in the Add tab to start earning.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                      {sortedPositions.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-2xl border border-border bg-muted/30 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">
                                {p.pair}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Opened{" "}
                                {formatRelativeTime({
                                  now,
                                  createdAt: p.createdAt,
                                })}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-muted-foreground tracking-wider">
                                Est. APY
                              </div>
                              <div className="text-sm font-mono tabular-nums">
                                {Number.isFinite(p.combinedApy)
                                  ? p.combinedApy.toLocaleString("en-US", {
                                      maximumFractionDigits: 2,
                                    })
                                  : "0"}
                                %
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
                              <div className="text-[10px] text-muted-foreground tracking-wider">
                                GLW
                              </div>
                              <div className="text-sm font-mono tabular-nums">
                                {formatTokenAmount(p.glwAmount, {
                                  maximumFractionDigits: 4,
                                })}
                              </div>
                            </div>
                            <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
                              <div className="text-[10px] text-muted-foreground tracking-wider">
                                USDG
                              </div>
                              <div className="text-sm font-mono tabular-nums">
                                {formatTokenAmount(p.usdgAmount, {
                                  maximumFractionDigits: 2,
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AddLiquidityReviewDialog
        open={reviewOpen}
        onOpenChange={handleReviewOpenChange}
        glwAmount={glwNum}
        usdgAmount={usdgNum}
        onSuccess={() => {
          setGlw("");
          setUsdg("");
          setReviewOpen(false);
          onOpenChange(false);
        }}
      />

      <RemoveLiquidityDialog open={removeOpen} onOpenChange={setRemoveOpen} />
    </>
  );
}
