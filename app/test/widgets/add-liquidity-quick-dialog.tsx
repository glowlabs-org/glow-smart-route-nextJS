"use client";

import * as React from "react";
import Link from "next/link";
import { Droplets, ArrowRight } from "lucide-react";
import { formatUnits } from "viem";
import Decimal from "decimal.js";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddLiquidityReviewDialog } from "@/app/liquidity/add-liquidity-dialog";
import {
  GLW_INCENTIVES_END_TIME,
  useLiquidityPositions,
} from "@/hooks/useLiquidityPositionsOptimized";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { ConnectButton } from "@/components/connect-button";

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

export function AddLiquidityQuickDialog({
  open,
  onOpenChange,
}: AddLiquidityQuickDialogProps) {
  const { priceRatio, quoteOtherAmount, wouldAddLiquidityLikelyFail } =
    useLiquidityPositions();

  const [glw, setGlw] = React.useState<string>("");
  const [usdg, setUsdg] = React.useState<string>("");
  const [reviewOpen, setReviewOpen] = React.useState(false);
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
    setReviewOpen(true);
  };

  const handleReviewOpenChange = (next: boolean) => {
    setReviewOpen(next);
    if (!next) return;
    // keep outer dialog open while reviewing
  };

  const isAfterCutoff = Date.now() > GLW_INCENTIVES_END_TIME;

  return (
    <>
      <Dialog open={open && !reviewOpen} onOpenChange={onOpenChange}>
        <DialogContent className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-sm w-full border-border shadow-2xl overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-muted-foreground" />
              Add Liquidity
            </DialogTitle>
            <DialogDescription className="flex flex-col gap-1">
              <span>Add liquidity to the GLW/USDG pool.</span>
              <span className="text-xs text-muted-foreground">
                1 GLW ≈ {formatRatio(priceRatio)} USDG
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-2 space-y-4">
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
          </div>
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
    </>
  );
}
