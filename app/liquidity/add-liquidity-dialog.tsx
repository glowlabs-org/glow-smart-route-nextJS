"use client";

import * as React from "react";
import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLiquidityPositions } from "@/hooks/useLiquidityPositions";
import { GLW_INCENTIVES_END_TIME } from "@/hooks/useLiquidityPositionsOptimized";
import { useLang } from "@/lib/i18n";

interface AddLiquidityReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glwAmount: number;
  usdgAmount: number;
  onSuccess?: () => void; // Optional callback when transaction succeeds
}

export function AddLiquidityReviewDialog({
  open,
  onOpenChange,
  glwAmount,
  usdgAmount,
  onSuccess,
}: AddLiquidityReviewDialogProps) {
  const { t } = useLang();
  const ld = t.routes.liquidityDialogs;
  // Transaction states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [networkCostUSD, setNetworkCostUSD] = React.useState<string>("");
  const [isNetworkCostLoading, setIsNetworkCostLoading] = React.useState(false);
  const [submittedGlwText, setSubmittedGlwText] = React.useState<string | null>(
    null
  );
  const [submittedUsdgText, setSubmittedUsdgText] = React.useState<
    string | null
  >(null);

  const {
    poolReserves,
    addLiquidityMutation,
    estimateAddLiquidityNetworkCostUSD,
    wouldAddLiquidityLikelyFail,
  } = useLiquidityPositions();

  // Calculate pool share percentage
  const poolSharePct = React.useMemo(() => {
    if (!poolReserves) return 0;
    if (glwAmount <= 0 || usdgAmount <= 0) return 0;

    const reserveGLW = Number(poolReserves.glw);
    const reserveUSDG = Number(poolReserves.usdg);
    if (!Number.isFinite(reserveGLW) || !Number.isFinite(reserveUSDG)) return 0;
    if (reserveGLW <= 0 || reserveUSDG <= 0) return 0;

    const ratioA = glwAmount / reserveGLW;
    const ratioB = usdgAmount / reserveUSDG;
    const x = Math.min(ratioA, ratioB);
    const share = (x / (1 + x)) * 100;
    if (!Number.isFinite(share) || share < 0) return 0;
    return Math.min(100, share);
  }, [glwAmount, usdgAmount, poolReserves]);

  // Estimate network fee when dialog opens
  React.useEffect(() => {
    async function estimateFee() {
      if (!open || glwAmount <= 0 || usdgAmount <= 0) return;
      try {
        setIsNetworkCostLoading(true);
        const res = await estimateAddLiquidityNetworkCostUSD({
          glw: glwAmount,
          usdg: usdgAmount,
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
  }, [open, glwAmount, usdgAmount]);

  // Reset states when dialog closes
  React.useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setIsSuccess(false);
      setIsError(false);
      setErrorMessage(null);
      setTxHash(null);
      setNetworkCostUSD("");
      setSubmittedGlwText(null);
      setSubmittedUsdgText(null);
    }
  }, [open]);

  const wouldLikelyFail = wouldAddLiquidityLikelyFail({
    glw: glwAmount,
    usdg: usdgAmount,
  });

  async function handleConfirm() {
    try {
      setIsSubmitting(true);
      setIsError(false);
      setErrorMessage(null);

      // Check slippage one more time before submitting
      if (wouldAddLiquidityLikelyFail({ glw: glwAmount, usdg: usdgAmount })) {
        setIsSubmitting(false);
        setIsError(true);
        setErrorMessage(
          ld.addPoolChangedError
        );
        return;
      }

      // Capture amounts for success screen before parent props potentially reset
      const nextGlwText = Number.isFinite(glwAmount)
        ? glwAmount.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
          })
        : "0";
      const nextUsdgText = Number.isFinite(usdgAmount)
        ? usdgAmount.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })
        : "0";
      setSubmittedGlwText(nextGlwText);
      setSubmittedUsdgText(nextUsdgText);

      const txHash = await addLiquidityMutation.mutateAsync({
        glw: glwAmount,
        usdg: usdgAmount,
      });

      setTxHash(txHash);
      setIsSuccess(true);
      setIsSubmitting(false);

      // Call optional success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setIsError(true);
      const message =
        err?.shortMessage || err?.message || ld.addToastFailed;
      setErrorMessage(message);
      setTxHash(err?.txHash ?? null);
      toast.error(ld.addToastFailed);
    }
  }
  const glwText = Number.isFinite(glwAmount)
    ? glwAmount.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
      })
    : "0";
  const usdgText = Number.isFinite(usdgAmount)
    ? usdgAmount.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : "0";
  const successGlwText = submittedGlwText ?? glwText;
  const successUsdgText = submittedUsdgText ?? usdgText;

  const shareOfPoolText =
    poolSharePct < 0.001 && poolSharePct > 0
      ? "<0.001%"
      : `${poolSharePct.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 5,
        })}%`;

  const networkFeeText = networkCostUSD || "$0.00";

  const [acknowledged, setAcknowledged] = React.useState(false);

  const isAfterCutoff = Date.now() > GLW_INCENTIVES_END_TIME;

  // Transaction details for review state
  const transactionDetails: TransactionDetail[] = [
    { label: ld.detailUsdgAmount, value: usdgText, unit: "USDG" },
    { label: ld.detailGlwAmount, value: glwText, unit: "GLW" },
    { label: ld.detailShareOfPool, value: shareOfPoolText },
  ];

  // Success state details
  const successDetails: TransactionDetail[] = [
    { label: ld.detailUsdgAdded, value: successUsdgText },
    { label: ld.detailGlwAdded, value: successGlwText },
    { label: ld.detailShareOfPool, value: shareOfPoolText },
  ];

  // Custom footer with acknowledgement checkbox
  const customFooter = !(isSubmitting || addLiquidityMutation.isPending) ? (
    <>
      <div className="mb-8 p-4 bg-muted border border-border rounded-xl">
        <label
          htmlFor="ack-lp"
          className="flex items-start gap-3 text-sm cursor-pointer"
        >
          <Checkbox
            id="ack-lp"
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(Boolean(v))}
            className="mt-0.5 border-accent size-6"
          />
          <span className="text-foreground">
            {isAfterCutoff
              ? ld.addIncentiveEndedAck
              : ld.addIncentivePendingAck}
          </span>
        </label>
      </div>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="flex-1"
        >
          {ld.cancel}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!acknowledged || Boolean(wouldLikelyFail)}
          className="flex-1"
        >
          {ld.confirm}
        </Button>
      </div>
    </>
  ) : (
    <Button
      variant="secondary"
      onClick={() => onOpenChange(false)}
      className="w-full"
      disabled
    >
      {ld.processing}
    </Button>
  );

  return (
    <TransactionDialog
      open={open}
      onOpenChange={onOpenChange}
      isSubmitting={isSubmitting || addLiquidityMutation.isPending}
      isSuccess={isSuccess}
      isError={isError || wouldLikelyFail}
      title={ld.addReviewTitle}
      successTitle={ld.addSuccessTitle}
      errorTitle={
        wouldLikelyFail ? ld.actionWouldLikelyFail : ld.transactionFailed
      }
      processingTitle={ld.processingTransaction}
      description={ld.addReviewDescription}
      processingDescription={ld.addProcessingDescription}
      errorDescription={
        wouldLikelyFail
          ? ld.addPoolChangedError
          : errorMessage || ld.addGenericError
      }
      transactionDetails={transactionDetails}
      successDetails={successDetails}
      txHash={txHash}
      networkFee={networkFeeText}
      isNetworkFeeLoading={isNetworkCostLoading}
      footer={customFooter}
      confirmDisabled={!acknowledged || Boolean(wouldLikelyFail)}
    />
  );
}
