"use client";

import * as React from "react";
import { Droplets } from "lucide-react";

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
import { useLiquidityPositions } from "@/hooks/useLiquidityPositionsOptimized";

export interface AddLiquidityQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
  const [preflightError, setPreflightError] = React.useState<string | null>(
    null
  );

  const glwNum = React.useMemo(() => toNumber(glw), [glw]);
  const usdgNum = React.useMemo(() => toNumber(usdg), [usdg]);
  const isMissing = glwNum <= 0 || usdgNum <= 0;

  const handleGlwChange = (value: string) => {
    setGlw(value);
    setPreflightError(null);
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
    setPreflightError(null);
    const n = toNumber(value);
    if (!priceRatio || n <= 0) {
      setGlw("");
      return;
    }
    const q = quoteOtherAmount({ fromToken: "USDG", amount: n });
    setGlw(q > 0 ? q.toFixed(4) : (n / priceRatio).toFixed(4));
  };

  const handleReview = () => {
    if (isMissing) return;
    if (wouldAddLiquidityLikelyFail({ glw: glwNum, usdg: usdgNum })) {
      setPreflightError(
        "Pool reserves changed. Your amounts likely fail slippage. Adjust amounts to match the pool ratio."
      );
      return;
    }
    setPreflightError(null);
    setReviewOpen(true);
  };

  const handleReviewOpenChange = (next: boolean) => {
    setReviewOpen(next);
    if (!next) return;
    // keep outer dialog open while reviewing
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-muted-foreground" />
              Add Liquidity
            </DialogTitle>
            <DialogDescription>
              Add liquidity to the GLW/USDG pool.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  GLW
                </div>
                <Input
                  inputMode="decimal"
                  value={glw}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) handleGlwChange(v);
                  }}
                  className="h-12 rounded-xl font-mono"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  USDG
                </div>
                <Input
                  inputMode="decimal"
                  value={usdg}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) handleUsdgChange(v);
                  }}
                  className="h-12 rounded-xl font-mono"
                  placeholder="0.00"
                />
              </div>
            </div>

            {preflightError ? (
              <div className="rounded-xl border border-destructive bg-destructive/10 text-destructive p-3 text-sm">
                {preflightError}
              </div>
            ) : null}

            <Button
              className="w-full h-12 rounded-xl font-mono font-bold"
              disabled={isMissing}
              onClick={handleReview}
            >
              Review
            </Button>
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


