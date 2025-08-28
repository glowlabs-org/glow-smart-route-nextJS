"use client";

import * as React from "react";
import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useLiquidityPositions } from "@/hooks/useLiquidityPositions";
import { toast } from "sonner";

interface RemoveLiquidityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveLiquidityDialog({
  open,
  onOpenChange,
}: RemoveLiquidityDialogProps) {
  const [percentage, setPercentage] = React.useState(0);

  // Transaction states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [removedAmounts, setRemovedAmounts] = React.useState<{
    glw: number;
    usdg: number;
  }>({ glw: 0, usdg: 0 });

  const {
    positions,
    quoteRemoveLiquidityForPercentage,
    removeLiquidityMutation,
    estimateRemoveLiquidityNetworkCostUSD,
  } = useLiquidityPositions();

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

  // Quote expected amounts out using Uniswap V2 math: amountToken = reserve * (liquidityToBurn / totalSupply)
  const [quotedOut, setQuotedOut] = React.useState<{
    glw: number;
    usdg: number;
  }>({ glw: 0, usdg: 0 });
  const [isQuoting, setIsQuoting] = React.useState(false);

  const [networkCostUSD, setNetworkCostUSD] = React.useState<string>("");
  const [isNetworkCostLoading, setIsNetworkCostLoading] = React.useState(false);

  React.useEffect(() => {
    async function run() {
      try {
        setIsQuoting(true);
        setQuotedOut({ glw: 0, usdg: 0 });
        if (!open || percentage <= 0) return;
        const q = await quoteRemoveLiquidityForPercentage(percentage);
        if (q) setQuotedOut(q);
      } finally {
        setIsQuoting(false);
      }
    }
    run();
  }, [open, percentage]);

  // Estimate network fee when dialog opens or percentage changes
  React.useEffect(() => {
    async function estimateFee() {
      if (!open || percentage <= 0) return;
      try {
        setIsNetworkCostLoading(true);
        const res = await estimateRemoveLiquidityNetworkCostUSD({
          percentage,
        });
        if (res && res > 0) {
          setNetworkCostUSD(
            res.toLocaleString(undefined, {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 2,
            })
          );
        } else {
          setNetworkCostUSD("$0.00");
        }
      } catch {
        setNetworkCostUSD("$0.00");
      } finally {
        setIsNetworkCostLoading(false);
      }
    }
    estimateFee();
  }, [open, percentage]);

  // Reset states when dialog closes
  React.useEffect(() => {
    if (!open) {
      setPercentage(0);
      setIsSubmitting(false);
      setIsSuccess(false);
      setIsError(false);
      setErrorMessage(null);
      setTxHash(null);
      setRemovedAmounts({ glw: 0, usdg: 0 });
      setNetworkCostUSD("");
      setIsNetworkCostLoading(false);
    }
  }, [open]);

  // Preset percentage buttons
  const handlePresetClick = (preset: number) => {
    setPercentage(preset);
  };

  async function handleConfirm() {
    if (percentage <= 0) return;

    try {
      setIsSubmitting(true);
      setIsError(false);
      setErrorMessage(null);

      // Calculate removed amounts based on current positions
      const removedGlw = totals.glw * (percentage / 100);
      const removedUsdg = totals.usdg * (percentage / 100);

      // Execute the remove liquidity transaction
      const hash = await removeLiquidityMutation.mutateAsync(percentage);

      // Set the removed amounts for display in success state
      setRemovedAmounts({
        glw: removedGlw,
        usdg: removedUsdg,
      });

      setTxHash(hash);

      setIsSubmitting(false);
      setIsSuccess(true);
    } catch (error) {
      setIsSubmitting(false);
      setIsError(true);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to remove liquidity"
      );
      setTxHash(null);
      toast.error("Failed to remove liquidity");
    }
  }

  // Network fee
  const networkFeeText = networkCostUSD || "$0.00";

  // Transaction details for review state
  const transactionDetails: TransactionDetail[] = [
    {
      label: "Withdrawal Percentage",
      value: `${percentage}%`,
    },
    {
      label: "USDG to Receive",
      value: isQuoting
        ? "..."
        : quotedOut.usdg.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      unit: "USDG",
    },
    {
      label: "GLW to Receive",
      value: isQuoting
        ? "..."
        : quotedOut.glw.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      unit: "GLW",
    },
  ];

  // Success state details
  const successDetails: TransactionDetail[] = [
    {
      label: "USDG Removed",
      value: removedAmounts.usdg.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      }),
    },
    {
      label: "GLW Removed",
      value: removedAmounts.glw.toLocaleString("en-US", {
        maximumFractionDigits: 6,
      }),
    },
  ];

  // Custom review content with percentage selector
  const customReviewContent = (
    <div className="space-y-6 mb-8 text-left">
      {/* Withdrawal Amount Section */}
      {isSubmitting ? null : (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Select withdrawal amount
          </h3>

          {/* Large Percentage Display */}
          <div className="text-center py-4">
            <div className="text-5xl font-bold tabular-nums">{percentage}%</div>
          </div>

          {/* Slider */}
          <div className="px-2">
            <Slider
              value={[percentage]}
              onValueChange={(value) => setPercentage(value[0])}
              max={100}
              step={1}
              className="w-full"
              disabled={isSubmitting}
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(25)}
              className="px-4"
              disabled={isSubmitting}
            >
              25%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(50)}
              className="px-4"
              disabled={isSubmitting}
            >
              50%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(75)}
              className="px-4"
              disabled={isSubmitting}
            >
              75%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(100)}
              className="px-4"
              disabled={isSubmitting}
            >
              Max
            </Button>
          </div>
        </div>
      )}

      {/* You will receive */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          You will receive
        </h3>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">USDG</span>
            <div className="text-right">
              <span className="text-sm font-mono">
                {isQuoting
                  ? "..."
                  : quotedOut.usdg.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
              </span>
              <span className="text-xs text-muted-foreground ml-2">USDG</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">GLW</span>
            <div className="text-right">
              <span className="text-sm font-mono">
                {isQuoting
                  ? "..."
                  : quotedOut.glw.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
              </span>
              <span className="text-xs text-muted-foreground ml-2">GLW</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <TransactionDialog
      open={open}
      onOpenChange={onOpenChange}
      isSubmitting={isSubmitting || removeLiquidityMutation.isPending}
      isSuccess={isSuccess}
      isError={isError}
      title="Remove Liquidity"
      successTitle="Liquidity Removed"
      errorTitle="Transaction Failed"
      processingTitle="Processing Withdrawal"
      description="Select the percentage of liquidity to remove"
      processingDescription="Please wait while we remove your liquidity from the pool"
      errorDescription={
        errorMessage ||
        "We were unable to process your withdrawal. Please try again."
      }
      transactionDetails={transactionDetails}
      successDetails={successDetails}
      txHash={txHash}
      networkFee={networkFeeText}
      isNetworkFeeLoading={isNetworkCostLoading}
      reviewContent={customReviewContent}
      onConfirm={handleConfirm}
      confirmDisabled={percentage <= 0 || isQuoting}
      confirmLabel="Confirm"
      cancelLabel="Cancel"
    />
  );
}
