"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface AddLiquidityReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glwAmount: number;
  usdgAmount: number;
  priceRatio?: number | null;
  poolSharePct?: number;
  networkCostUSD?: number | string;
  isSubmitting?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function AddLiquidityReviewDialog({
  open,
  onOpenChange,
  glwAmount,
  usdgAmount,
  priceRatio,
  poolSharePct = 0,
  networkCostUSD = "$0.69",
  isSubmitting,
  onConfirm,
}: AddLiquidityReviewDialogProps) {
  const glwText = Number.isFinite(glwAmount)
    ? glwAmount.toFixed(6)
    : "0.000000";
  const usdgText = Number.isFinite(usdgAmount) ? usdgAmount.toFixed(2) : "0.00";

  const totalValueUSD = priceRatio
    ? (glwAmount * priceRatio + usdgAmount).toFixed(2)
    : "0.00";

  const [acknowledged, setAcknowledged] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Confirm transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current position value */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Current position value
            </h3>

            {/* Your total pool tokens */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Your total pool tokens:
              </span>
              <div className="text-right">
                <span className="text-sm font-mono">{"<0.001"}</span>
                <span className="text-xs text-muted-foreground ml-2">USD</span>
              </div>
            </div>

            {/* Deposited amounts */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Deposited USDG-GLOW
                </span>
                <div className="text-right">
                  <span className="text-sm font-mono">{usdgText}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    USD
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Deposited GLW-BETA
                </span>
                <div className="text-right">
                  <span className="text-sm font-mono">{glwText}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    GLW
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Share of pool
                </span>
                <span className="text-sm font-mono">
                  {poolSharePct < 0.001 ? "<0.001" : poolSharePct.toFixed(3)}%
                </span>
              </div>
            </div>
          </div>

          {/* Network fee */}
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Network fee</span>
              <span className="text-sm font-mono">{networkCostUSD}</span>
            </div>
          </div>

          {/* Acknowledgement */}
          <div className="pt-4 border-t">
            <label htmlFor="ack-lp" className="flex items-start gap-3 text-sm">
              <Checkbox
                id="ack-lp"
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(Boolean(v))}
              />
              <span className="text-muted-foreground">
                I understand LP tokens and GLW rewards will be claimable after
                the v2 launch. The launch date is not yet defined.
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Reject
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isSubmitting}
            disabled={!acknowledged}
            className="flex-1"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
