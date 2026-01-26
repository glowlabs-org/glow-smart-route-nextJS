import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { ArrowLeftRight, Check, Loader2, Info, ArrowDown } from "lucide-react";
import { waitingToSuccessVariants } from "@/animations/variants";
import { motion } from "framer-motion";
import React, { FC, useEffect } from "react";
import { formatPrice } from "@/utils/formatPrice";
import clsx from "clsx";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useSwap } from "@/hooks/useSwap";

import { toFixedTruncate } from "@/utils/toFixedTruncate";

import { useUSDGRedemption } from "@/hooks/useUSDGRedemption";
import { addresses } from "@/web3/constants/addresses";
import { formatUnits, parseUnits } from "viem";

type PendingState = {
  code: string;
  message: string;
  validated: boolean;
  pending: boolean;
};

type GlowToUsdcState =
  | "NONE"
  | "REQUESTING_GLOW_APPROVAL"
  | "APPROVING_GLOW"
  | "SWAPPING_GLOW_TO_USDG"
  | "REQUESTING_USDG_APPROVAL"
  | "APPROVING_USDG"
  | "REDEEMING_USDG_FOR_USDC"
  | "DONE"
  | "ERROR";

const getDefaultPendingStates = (
  targetToken: "USDC" | "USDG"
): PendingState[] => {
  if (targetToken === "USDG") {
    return [
      {
        code: "REQUESTING_GLOW_APPROVAL",
        message: "Requesting GLOW approval",
        validated: false,
        pending: false,
      },
      {
        code: "APPROVING_GLOW",
        message: "Approving GLOW",
        validated: false,
        pending: false,
      },
      {
        code: "SWAPPING_GLOW_TO_USDG",
        message: "Swapping GLOW to USDG",
        validated: false,
        pending: false,
      },
      {
        code: "DONE",
        message: "Successfully swapped GLOW to USDG",
        validated: false,
        pending: false,
      },
    ];
  }

  return [
    {
      code: "REQUESTING_GLOW_APPROVAL",
      message: "Requesting GLOW approval",
      validated: false,
      pending: false,
    },
    {
      code: "APPROVING_GLOW",
      message: "Approving GLOW",
      validated: false,
      pending: false,
    },
    {
      code: "SWAPPING_GLOW_TO_USDG",
      message: "Swapping GLOW to USDG",
      validated: false,
      pending: false,
    },
    {
      code: "REQUESTING_USDG_APPROVAL",
      message: "Requesting USDG approval",
      validated: false,
      pending: false,
    },
    {
      code: "APPROVING_USDG",
      message: "Approving USDG",
      validated: false,
      pending: false,
    },
    {
      code: "REDEEMING_USDG_FOR_USDC",
      message: "Redeeming USDG for USDC",
      validated: false,
      pending: false,
    },
    {
      code: "DONE",
      message: "Successfully converted GLOW to USDC",
      validated: false,
      pending: false,
    },
  ];
};

export const GlowToUsdcDialog: FC<{
  isOpen: boolean;
  amountToSell: string;
  estimatedOutputAmount: string;
  slippageTolerance: string;
  targetToken?: "USDC" | "USDG";
  onOpenChange: (open: boolean) => void;
}> = ({
  isOpen,
  onOpenChange,
  amountToSell,
  estimatedOutputAmount,
  slippageTolerance,
  targetToken = "USDC",
}) => {
  const [isPending, setIsPending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [networkCostUSD, setNetworkCostUSD] = React.useState<string>("");
  const [isNetworkCostLoading, setIsNetworkCostLoading] = React.useState(false);
  const [pendingStates, setPendingStates] = React.useState<PendingState[]>(
    getDefaultPendingStates(targetToken)
  );
  const [currentState, setCurrentState] =
    React.useState<GlowToUsdcState>("NONE");
  const [intermediateUsdgAmount, setIntermediateUsdgAmount] =
    React.useState<string>("");

  const {
    swapGlowToUSDG,
    uniswapPurchaseState,
    resetUniswapPurchaseState,
    estimateGlowToUSDG,
  } = useSwap({
    tokenA_address: addresses.glow,
    tokenB_address: addresses.usdg,
  });

  const { redeemUSDGForUSDC } = useUSDGRedemption();

  const handleSwapGlowToTarget = async () => {
    setIsPending(true);
    setIsError(false);
    setIsSuccess(false);
    setErrorMessage(null);
    setCurrentState("NONE");

    try {
      const amountIn = parseUnits(amountToSell, 18); // GLOW has 18 decimals

      // First, estimate the USDG output
      const estimateRes = await estimateGlowToUSDG({ amountIn });
      if (!estimateRes.ok) {
        setCurrentState("ERROR");
        setIsError(true);
        setErrorMessage("Failed to estimate USDG output");
        toast.error("Failed to estimate USDG output");
        setIsPending(false);
        return;
      }

      const estimatedUsdgAmount = formatUnits(estimateRes.val, 6);
      setIntermediateUsdgAmount(estimatedUsdgAmount);

      // Step 1: Swap GLOW to USDG
      const swapRes = await swapGlowToUSDG({
        amount: amountIn,
        slippagePercentTenThousandDenominator: BigInt(
          Number(slippageTolerance) * 100
        ),
      });

      if (!swapRes.ok) {
        setCurrentState("ERROR");
        setIsError(true);
        setErrorMessage(swapRes.val);
        toast.error(swapRes.val);
        setIsPending(false);
        return;
      }

      // If target is USDG, we're done
      if (targetToken === "USDG") {
        setCurrentState("DONE");
        updatePendingStates("DONE");
        setIsPending(false);
        setIsSuccess(true);
        return;
      }

      // If target is USDC, continue with redemption
      // Update state for USDG approval/redemption
      setCurrentState("REQUESTING_USDG_APPROVAL");
      updatePendingStates("REQUESTING_USDG_APPROVAL");

      // Step 2: Redeem USDG for USDC
      const usdgAmount = parseUnits(estimatedUsdgAmount, 6);

      // The approval is handled inside redeemUSDGForUSDC
      setCurrentState("APPROVING_USDG");
      updatePendingStates("APPROVING_USDG");

      setCurrentState("REDEEMING_USDG_FOR_USDC");
      updatePendingStates("REDEEMING_USDG_FOR_USDC");

      const redeemRes = await redeemUSDGForUSDC(usdgAmount);

      if (redeemRes.ok) {
        setCurrentState("DONE");
        updatePendingStates("DONE");
        setIsSuccess(true);
      } else {
        setCurrentState("ERROR");
        setIsError(true);
        setErrorMessage(redeemRes.val);
        toast.error(redeemRes.val);
      }

      setIsPending(false);
    } catch (error: any) {
      setCurrentState("ERROR");
      setIsPending(false);
      setIsError(true);
      setErrorMessage(error?.message || "Transaction failed");
      setTxHash(error?.txHash ?? null);
      toast.error(error?.message || "Transaction failed");
    }
  };

  const updatePendingStates = (currentStateCode: string) => {
    setPendingStates((prev) => {
      const stateIndex = prev.findIndex(
        (state) => state.code === currentStateCode
      );
      return prev.map((state, index) => {
        if (index < stateIndex) {
          return { ...state, validated: true, pending: false };
        } else if (index === stateIndex) {
          return { ...state, pending: true };
        }
        return state;
      });
    });
  };

  useEffect(() => {
    // Update pending states based on uniswapPurchaseState
    if (uniswapPurchaseState === "REQUESTING_TOKEN_APPROVAL") {
      setCurrentState("REQUESTING_GLOW_APPROVAL");
      updatePendingStates("REQUESTING_GLOW_APPROVAL");
    } else if (uniswapPurchaseState === "APPROVING_TOKEN") {
      setCurrentState("APPROVING_GLOW");
      updatePendingStates("APPROVING_GLOW");
    } else if (uniswapPurchaseState === "PURCHASING_TOKEN") {
      setCurrentState("SWAPPING_GLOW_TO_USDG");
      updatePendingStates("SWAPPING_GLOW_TO_USDG");
    }
  }, [uniswapPurchaseState]);

  // Estimate network fee when dialog opens
  useEffect(() => {
    async function estimateFee() {
      if (
        !isOpen ||
        !estimatedOutputAmount ||
        Number(estimatedOutputAmount) <= 0
      )
        return;
      try {
        setIsNetworkCostLoading(true);
        // Estimate based on typical gas costs for swap operations
        // You may want to implement actual gas estimation here
        const estimatedCost = "$2.50"; // Placeholder - implement actual estimation
        setNetworkCostUSD(estimatedCost);
      } catch {
        setNetworkCostUSD("$0.00");
      } finally {
        setIsNetworkCostLoading(false);
      }
    }

    if (isOpen) {
      estimateFee();
    }
  }, [isOpen, estimatedOutputAmount]);

  // Reset once when the dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPendingStates(getDefaultPendingStates(targetToken));
      setCurrentState("NONE");
      setIntermediateUsdgAmount("");
      resetUniswapPurchaseState();
      setIsPending(false);
      setIsSuccess(false);
      setIsError(false);
      setErrorMessage(null);
      setTxHash(null);
      setNetworkCostUSD("");
      setIsNetworkCostLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Update pending states only when open and the target token changes
  useEffect(() => {
    if (isOpen) {
      setPendingStates(getDefaultPendingStates(targetToken));
    }
  }, [isOpen, targetToken]);

  const visibleStates = pendingStates.filter((state) => {
    const stateIndex = pendingStates.findIndex((s) => s.code === state.code);
    const currentStateIndex = pendingStates.findIndex((s) => s.pending);

    // Show validated states and current pending state
    if (state.validated || state.pending) return true;

    // Show next state after current pending
    if (currentStateIndex !== -1 && stateIndex === currentStateIndex + 1)
      return true;

    // If no current pending state, show first two states
    if (currentStateIndex === -1 && stateIndex < 2) return true;

    return false;
  });

  // Calculate if transaction is successful
  const isTransactionSuccessful = isSuccess || currentState === "DONE";

  // Transaction details for review
  const transactionDetails: TransactionDetail[] = [
    {
      label: "You Pay",
      value: Number(amountToSell).toLocaleString("en-US", {
        maximumFractionDigits: 6,
      }),
      unit: "GLOW",
    },
    {
      label: "You Receive",
      value: Number(estimatedOutputAmount)
        ? formatPrice(estimatedOutputAmount, 6)
        : "0.00",
      unit: targetToken,
    },
  ];

  // Success details
  const successDetails: TransactionDetail[] = [
    {
      label: "Sent",
      value: Number(amountToSell).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      }),
      unit: "GLOW",
    },
    ...(intermediateUsdgAmount && targetToken === "USDC"
      ? [
          {
            label: "Via",
            value: Number(intermediateUsdgAmount).toLocaleString("en-US", {
              maximumFractionDigits: 6,
            }),
            unit: "USDG",
          },
        ]
      : []),
    {
      label: "Received",
      value: (
        <span className="text-[#4ADE80] font-mono font-medium">
          {formatPrice(estimatedOutputAmount, 6)}
        </span>
      ),
      unit: targetToken,
    },
  ];

  // Custom review content with pending states
  const reviewContent = (
    <div className="space-y-6 mb-6">
      {/* Token swap visualization */}
      <div className="relative space-y-4">
        <div className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-4">
          <div className="flex items-center justify-between text-left">
            <div>
              <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest mb-1">You pay</div>
              <div className="text-2xl font-semibold">
                {Number(amountToSell).toLocaleString("en-US", {
                  maximumFractionDigits: 6,
                })}{" "}
                <span className="text-lg font-medium text-muted-foreground">
                  GLOW
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Absolutely positioned arrow */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-card rounded-full p-2 border border-border/40">
            <ArrowDown className="size-5 text-muted-foreground" />
          </div>
        </div>

        <div className="text-left bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest mb-1">
                You receive
              </div>
              <div className="text-2xl font-semibold">
                {Number(estimatedOutputAmount)
                  ? formatPrice(estimatedOutputAmount, 6)
                  : "0.00"}{" "}
                <span className="text-lg font-medium text-muted-foreground">
                  {targetToken}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending states display */}
      {(uniswapPurchaseState !== "NONE" || currentState !== "NONE") && (
        <div className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
              Transaction Progress
            </span>
          </div>
          <div className="space-y-2">
            {visibleStates.map((state, index) => (
              <motion.div
                key={state.code}
                className="flex items-center gap-3"
                initial={{ opacity: 0.5 }}
                animate={state.validated || state.pending ? "show" : "hidden"}
                variants={waitingToSuccessVariants}
              >
                <div className={clsx(
                  "rounded-lg p-2 flex items-center justify-center h-8 w-8 shrink-0",
                  state.validated && !state.pending ? "bg-[#4ADE80]/10" : "bg-muted/50"
                )}>
                  {state.validated && !state.pending ? (
                    <Check className="w-4 h-4 text-[#4ADE80]" />
                  ) : state.pending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                  ) : (
                    <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3
                    className={clsx(
                      "text-sm",
                      state.validated && !state.pending
                        ? "text-foreground font-medium"
                        : state.pending
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {state.message}
                  </h3>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Custom footer with retry button for errors
  const customFooter = isError ? (
    <div className="flex gap-3">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        className="flex-1"
      >
        Cancel
      </Button>
      <Button
        onClick={() => {
          setPendingStates(getDefaultPendingStates(targetToken));
          setCurrentState("NONE");
          resetUniswapPurchaseState();
          setIsError(false);
          setErrorMessage(null);
          handleSwapGlowToTarget();
        }}
        className="flex-1"
      >
        Try Again
      </Button>
    </div>
  ) : !isPending && !isTransactionSuccessful ? (
    <div className="flex gap-3">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        className="flex-1"
      >
        Cancel
      </Button>
      <Button onClick={handleSwapGlowToTarget} className="flex-1">
        Approve and Swap
      </Button>
    </div>
  ) : undefined;

  return (
    <TransactionDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      isSubmitting={isPending}
      isSuccess={isTransactionSuccessful}
      isError={isError}
      title="Review Swap"
      successTitle={`+${Number(estimatedOutputAmount).toLocaleString("en-US", {
        maximumFractionDigits: 6,
      })} ${targetToken}`}
      errorTitle="Swap Failed"
      processingTitle="Processing Swap"
      description="Review your transaction details before confirming"
      processingDescription="Please wait while we process your swap"
      errorDescription={
        errorMessage ||
        "We were unable to complete your swap. Please try again."
      }
      transactionDetails={transactionDetails}
      successDetails={successDetails}
      txHash={txHash}
      networkFee={networkCostUSD}
      isNetworkFeeLoading={isNetworkCostLoading}
      reviewContent={reviewContent}
      footer={customFooter}
      confirmLabel="Approve and Swap"
    />
  );
};
