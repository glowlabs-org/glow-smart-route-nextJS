"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowDown,
  Copy,
  ExternalLink,
  Check,
  Loader2,
  ArrowLeftRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import {
  usePurchaseGlow,
  SmartBalancingAmounts,
} from "@/hooks/usePurchaseGlow";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";
import { formatUnits, parseUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/utils/formatPrice";
import { motion } from "framer-motion";
import { waitingToSuccessVariants } from "@/animations/variants";
import clsx from "clsx";

interface BuyGlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usdcBalance: bigint | null;
  glowSpotPrice: number;
  onSuccess?: () => void;
}

type Phase = "input" | "processing" | "success" | "error";

interface PendingState {
  code: string;
  message: string;
  validated: boolean;
  pending: boolean;
}

const usdcToUsdgStates: PendingState[] = [
  {
    code: "PURCHASING_USDG",
    message: "Converting USDC to USDG",
    validated: false,
    pending: false,
  },
  {
    code: "SUCCESSFULLY_OBTAINED_USDG",
    message: "Successfully obtained USDG",
    validated: false,
    pending: false,
  },
];

const glowPurchaseStates: PendingState[] = [
  {
    code: "REQUESTING_APPROVAL",
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
    code: "PURCHASING_GLOW",
    message: "Purchasing GLW",
    validated: false,
    pending: false,
  },
  {
    code: "DONE",
    message: "Successfully purchased GLW",
    validated: false,
    pending: false,
  },
];

export function BuyGlowDialog({
  open,
  onOpenChange,
  usdcBalance,
  glowSpotPrice,
  onSuccess,
}: BuyGlowDialogProps) {
  const [phase, setPhase] = React.useState<Phase>("input");
  const [inputAmount, setInputAmount] = React.useState<string>("");
  const [smartAmounts, setSmartAmounts] =
    React.useState<SmartBalancingAmounts>();
  const [estimatedGlw, setEstimatedGlw] = React.useState<string>("");
  const [pendingStates, setPendingStates] = React.useState<PendingState[]>([]);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const { getSmartBalancingAmounts, purchaseGlowEarlyLiquidity } =
    usePurchaseGlow();
  const { swapUSDCToUSDG } = useSwapUSDCToUSDG();

  const usdcBalanceFormatted = React.useMemo(
    () =>
      usdcBalance ? formatUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC) : "0",
    [usdcBalance]
  );

  // Debounced estimate calculation using callback pattern
  const estimateRunner = React.useCallback(
    async (amount: string, signal: AbortSignal) => {
      if (!amount || Number(amount) <= 0) {
        return { estimatedGlw: "", smartAmounts: undefined };
      }

      const result = await getSmartBalancingAmounts({
        amountUsdgIn: Number(amount),
        earlyLiquidityCurrentPrice: glowSpotPrice || 0,
      });

      if (signal.aborted) return { estimatedGlw: "", smartAmounts: undefined };

      if (result.ok) {
        const amounts = result.val;
        const uniswapOut = Number(amounts.amount_out_uni || "0");
        const bondingOut = Number(amounts.amount_out_glow || "0");
        const totalOut = uniswapOut + bondingOut;

        return { estimatedGlw: totalOut.toString(), smartAmounts: amounts };
      }

      return { estimatedGlw: "", smartAmounts: undefined };
    },
    [getSmartBalancingAmounts, glowSpotPrice]
  );

  const handleEstimateResult = React.useCallback(
    (result: {
      estimatedGlw: string;
      smartAmounts: SmartBalancingAmounts | undefined;
    }) => {
      setEstimatedGlw(result.estimatedGlw);
      setSmartAmounts(result.smartAmounts);
    },
    []
  );

  const handleEstimateError = React.useCallback(() => {
    console.error("Failed to estimate");
    setEstimatedGlw("");
    setSmartAmounts(undefined);
  }, []);

  const { run: runEstimate, isRunning: isEstimating } = useDebouncedAsync(
    estimateRunner,
    {
      delayMs: 300,
      onResult: handleEstimateResult,
      onError: handleEstimateError,
    }
  );

  const handleInputChange = React.useCallback(
    (value: string) => {
      setInputAmount(value);

      if (!value || Number(value) <= 0) {
        setEstimatedGlw("");
        setSmartAmounts(undefined);
        return;
      }

      runEstimate(value);
    },
    [runEstimate]
  );

  const pricePerGlw = React.useMemo(() => {
    if (!inputAmount || !estimatedGlw || Number(estimatedGlw) === 0)
      return null;
    return Number(inputAmount) / Number(estimatedGlw);
  }, [inputAmount, estimatedGlw]);

  const updatePendingState = React.useCallback((stateIndex: number) => {
    setPendingStates((prev) =>
      prev.map((state, index) => {
        if (index === stateIndex) {
          return { ...state, pending: true };
        }
        if (index < stateIndex) {
          return { ...state, pending: false, validated: true };
        }
        return state;
      })
    );
  }, []);

  const handleBuyGlow = React.useCallback(async () => {
    if (!inputAmount || Number(inputAmount) <= 0 || !smartAmounts) {
      toast.error("Please enter a valid amount");
      return;
    }

    setPhase("processing");
    setPendingStates([...usdcToUsdgStates, ...glowPurchaseStates]);

    try {
      // Step 1: Convert USDC to USDG
      updatePendingState(0);
      const swapResult = await swapUSDCToUSDG(parseUnits(inputAmount, 6));

      if (!swapResult.ok) {
        throw new Error(String(swapResult.val));
      }

      updatePendingState(1);
      setPendingStates((prev) =>
        prev.map((state, index) =>
          index <= 1 ? { ...state, pending: false, validated: true } : state
        )
      );

      // Step 2: Buy GLW with smart balancing
      const hasUniswapAmount =
        smartAmounts.amount_in_uni &&
        Number(formatUnits(smartAmounts.amount_in_uni as bigint, 6)) > 0;
      const hasBondingAmount =
        smartAmounts.amount_out_glow &&
        Number(smartAmounts.amount_out_glow) > 0;

      if (hasBondingAmount) {
        updatePendingState(2); // Requesting approval
        updatePendingState(3); // Approving
        updatePendingState(4); // Purchasing

        const incrementsToPurchase = Math.floor(
          Number(smartAmounts.amount_out_glow) * 100
        );

        const purchaseResult = await purchaseGlowEarlyLiquidity({
          incrementsToPurchase,
          slippagePointsTenThousandths: BigInt(100), // 1% slippage
        });

        if (!purchaseResult.ok) {
          throw new Error(String(purchaseResult.val));
        }
      }

      // Mark all as complete
      setPendingStates((prev) =>
        prev.map((state) => ({ ...state, pending: false, validated: true }))
      );

      setPhase("success");
      toast.success("Successfully purchased GLW!");

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Purchase failed:", error);
      setPhase("error");
      setErrorMessage(error?.message || "Transaction failed");
      setPendingStates((prev) =>
        prev.map((state) => ({ ...state, pending: false }))
      );
      toast.error(error?.message || "Failed to purchase GLW");
    }
  }, [
    inputAmount,
    smartAmounts,
    swapUSDCToUSDG,
    updatePendingState,
    purchaseGlowEarlyLiquidity,
    onSuccess,
  ]);

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
    // setTimeout needed for dialog close animation to complete before resetting state
    setTimeout(() => {
      setPhase("input");
      setInputAmount("");
      setEstimatedGlw("");
      setSmartAmounts(undefined);
      setPendingStates([]);
      setTxHash(null);
      setErrorMessage(null);
    }, 300);
  }, [onOpenChange]);

  const copyTxHash = React.useCallback(() => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      toast.success("Transaction ID copied to clipboard");
    }
  }, [txHash]);

  const handleRetry = React.useCallback(() => {
    setPhase("input");
    setErrorMessage(null);
    setPendingStates([]);
  }, []);

  const lastTwoRelevantStates = React.useMemo(
    () =>
      pendingStates.length > 5
        ? pendingStates
            .reduce((acc: PendingState[], state, index, array) => {
              if (
                state.validated &&
                index < array.length - 1 &&
                !array[index + 1].validated
              ) {
                acc.push(state, array[index + 1]);
              } else if (state.validated && index === array.length - 1) {
                acc.push(state);
              }
              return acc;
            }, [])
            .slice(-2)
        : pendingStates,
    [pendingStates]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-md w-full border-border shadow-2xl overflow-hidden"
        onInteractOutside={(e) => phase === "processing" && e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {phase === "success"
              ? "Purchase Successful"
              : phase === "error"
              ? "Purchase Failed"
              : phase === "processing"
              ? "Processing Purchase"
              : "Buy GLW"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-8 py-12 max-h-[80vh] overflow-y-auto">
          {phase === "input" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="text-2xl font-bold text-foreground mb-2">
                  Buy GLW
                </div>
                <div className="text-muted-foreground text-sm">
                  Enter the amount of USDC you want to spend
                </div>
              </div>

              <div className="space-y-6 mb-8 text-left">
                {/* You Pay Section */}
                <div className="bg-secondary/50 backdrop-blur-sm border border-border rounded-2xl p-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="buy-amount"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        You pay
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleInputChange(usdcBalanceFormatted)}
                        className="h-auto p-0 text-xs font-medium hover:bg-transparent"
                      >
                        MAX
                      </Button>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <Input
                        id="buy-amount"
                        type="number"
                        placeholder="0.00"
                        value={inputAmount}
                        onChange={(e) => handleInputChange(e.target.value)}
                        min="0"
                        step="0.000001"
                        className="text-3xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <span className="text-xl font-medium text-muted-foreground">
                        USDC
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Available:{" "}
                      {Number(usdcBalanceFormatted).toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      USDC
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="bg-background rounded-full p-2 border border-border shadow-sm">
                    <ArrowDown className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>

                {/* You Receive Section */}
                <div className="bg-secondary/50 backdrop-blur-sm border border-border rounded-2xl p-6">
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-muted-foreground">
                      You receive (estimated)
                    </div>
                    <div className="flex items-baseline gap-2">
                      {isEstimating ? (
                        <Skeleton className="h-10 w-32" />
                      ) : (
                        <>
                          <div className="text-3xl font-bold">
                            {estimatedGlw && Number(estimatedGlw) > 0
                              ? formatPrice(estimatedGlw, 4)
                              : "0.00"}
                          </div>
                          <span className="text-xl font-medium text-muted-foreground">
                            GLW
                          </span>
                        </>
                      )}
                    </div>
                    {pricePerGlw && (
                      <div className="text-sm text-muted-foreground">
                        ${pricePerGlw.toFixed(6)} per GLW
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBuyGlow}
                  disabled={
                    !inputAmount ||
                    Number(inputAmount) <= 0 ||
                    Number(inputAmount) > Number(usdcBalanceFormatted) ||
                    !estimatedGlw ||
                    isEstimating
                  }
                  className="flex-1"
                >
                  Buy GLW
                </Button>
              </div>
            </div>
          )}

          {phase === "processing" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="flex items-center justify-center mx-auto mb-4">
                  <GlowSymbolAnimated className="size-14" />
                </div>
                <div className="text-2xl font-bold text-foreground mb-2">
                  Processing Purchase
                </div>
                <div className="text-muted-foreground text-sm">
                  Please wait while we process your transaction
                </div>
              </div>

              <div className="inline-flex items-center px-4 py-2 bg-secondary/50 backdrop-blur-sm border border-border rounded-full mb-8">
                <span className="text-foreground text-sm font-medium animate-pulse">
                  Submitting transaction...
                </span>
              </div>

              {/* Transaction Progress */}
              <div className="space-y-6 mb-8 text-left">
                <div className="bg-secondary/30 backdrop-blur-sm border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Transaction Progress
                    </span>
                  </div>
                  <div className="space-y-2">
                    {lastTwoRelevantStates.map((state, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0.5 }}
                        animate={
                          state.validated || state.pending ? "show" : "hidden"
                        }
                        variants={waitingToSuccessVariants}
                      >
                        <div className="bg-background/80 backdrop-blur-sm rounded-lg p-2 flex items-center justify-center h-8 w-8 shrink-0 border border-border/50">
                          {state.validated && !state.pending ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : state.pending ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          ) : (
                            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <h3
                            className={clsx(
                              "text-sm",
                              state.validated && !state.pending
                                ? "text-zinc-900 dark:text-zinc-100 font-medium"
                                : state.pending
                                ? "text-zinc-900 dark:text-zinc-100"
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
              </div>

              <div className="text-xs text-muted-foreground mt-4">
                Please do not close this window or refresh the page
              </div>
            </div>
          )}

          {phase === "success" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="text-4xl font-bold text-foreground mb-2">
                  +
                  {Number(estimatedGlw).toLocaleString("en-US", {
                    maximumFractionDigits: 4,
                  })}{" "}
                  GLW
                </div>
              </div>

              <div className="inline-flex items-center px-4 py-2 bg-secondary/50 backdrop-blur-sm border border-border rounded-full mb-8">
                <span className="text-foreground text-sm font-medium">
                  Completed •{" "}
                  {new Date().toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  })}
                  ,{" "}
                  {new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
              </div>

              <div className="space-y-4 mb-8 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Sent</span>
                  <div className="text-right">
                    <span className="text-foreground text-sm font-mono">
                      {Number(inputAmount).toLocaleString("en-US", {
                        maximumFractionDigits: 6,
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      USDC
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Received
                  </span>
                  <div className="text-right">
                    <span className="text-accent text-sm font-mono">
                      {Number(estimatedGlw).toLocaleString("en-US", {
                        maximumFractionDigits: 4,
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      GLW
                    </span>
                  </div>
                </div>

                {txHash && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">
                        Transaction ID
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-foreground text-sm font-mono">
                          {`${txHash.slice(0, 6)}...${txHash.slice(-6)}`}
                        </span>
                        <button
                          onClick={copyTxHash}
                          className="p-1 hover:bg-muted rounded transition-colors"
                        >
                          <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">
                        Explorer
                      </span>
                      <a
                        href={`https://etherscan.io/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        <span>View on Etherscan</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </>
                )}
              </div>

              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          )}

          {phase === "error" && (
            <div className="text-center space-y-8">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-10 h-10 text-destructive" />
                </div>
                <div className="text-2xl font-bold text-destructive mb-2">
                  Purchase Failed
                </div>
                <div className="text-muted-foreground text-sm max-w-sm break-all whitespace-pre-wrap mx-auto">
                  {errorMessage ||
                    "We were unable to complete your purchase. Please try again."}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleRetry} className="flex-1">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
