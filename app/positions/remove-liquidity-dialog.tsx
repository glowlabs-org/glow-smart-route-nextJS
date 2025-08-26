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
import { Slider } from "@/components/ui/slider";

interface RemoveLiquidityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: Array<{
    id: string;
    glwAmount: number;
    usdgAmount: number;
    createdAt: number;
  }>;
  priceRatio?: number | null;
  networkCostUSD?: number | string;
  isSubmitting?: boolean;
  onConfirm: (percentage: number) => void | Promise<void>;
}

export function RemoveLiquidityDialog({
  open,
  onOpenChange,
  positions = [],
  priceRatio,
  networkCostUSD = "$0.69",
  isSubmitting,
  onConfirm,
}: RemoveLiquidityDialogProps) {
  const [percentage, setPercentage] = React.useState(0);

  // Calculate total amounts across all positions
  const totals = React.useMemo(() => {
    return positions.reduce(
      (acc, pos) => ({
        glw: acc.glw + pos.glwAmount,
        usdg: acc.usdg + pos.usdgAmount,
      }),
      { glw: 0, usdg: 0 }
    );
  }, [positions]);

  // Calculate amounts to remove based on percentage
  const removeAmounts = React.useMemo(() => {
    return {
      glw: (totals.glw * percentage) / 100,
      usdg: (totals.usdg * percentage) / 100,
    };
  }, [totals, percentage]);

  const totalValueUSD = priceRatio
    ? (removeAmounts.glw * priceRatio + removeAmounts.usdg).toFixed(2)
    : "0.00";

  // Preset percentage buttons
  const handlePresetClick = (preset: number) => {
    setPercentage(preset);
  };

  async function handleConfirm() {
    if (percentage <= 0) return;
    await onConfirm(percentage);
    setPercentage(0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Remove liquidity</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Withdrawal Amount Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Select withdrawal amount
            </h3>

            {/* Large Percentage Display */}
            <div className="text-center py-4">
              <div className="text-5xl font-bold tabular-nums">
                {percentage}%
              </div>
            </div>

            {/* Slider */}
            <div className="px-2">
              <Slider
                value={[percentage]}
                onValueChange={(value) => setPercentage(value[0])}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* Preset Buttons */}
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(25)}
                className="px-4"
              >
                25%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(50)}
                className="px-4"
              >
                50%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(75)}
                className="px-4"
              >
                75%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(100)}
                className="px-4"
              >
                Max
              </Button>
            </div>
          </div>

          {/* You will receive */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              You will receive
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">USDG-GLOW</span>
                <div className="text-right">
                  <span className="text-sm font-mono">
                    {removeAmounts.usdg.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    USD
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">GLW-BETA</span>
                <div className="text-right">
                  <span className="text-sm font-mono">
                    {removeAmounts.glw.toFixed(6)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    GLW
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Total value
                </span>
                <div className="text-right">
                  <span className="text-sm font-mono">{totalValueUSD}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    USD
                  </span>
                </div>
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
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            isLoading={isSubmitting}
            disabled={percentage <= 0}
            className="flex-1"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
