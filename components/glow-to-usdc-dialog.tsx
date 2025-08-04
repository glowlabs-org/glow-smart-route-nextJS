import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeftRight, Check, Loader2, Info } from "lucide-react";
import { waitingToSuccessVariants } from "@/animations/variants";
import { motion } from "framer-motion";
import React, { FC, useEffect } from "react";
import { Card } from "./ui/card";
import { BigNumber, ethers } from "ethers";
import { Input } from "./ui/input";
import { formatPrice } from "@/utils/formatPrice";
import clsx from "clsx";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { SwapError, useSwap } from "@/hooks/useSwap";
import { Result } from "ts-results";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import { Token } from "@/app/buy/view";
import { addresses } from "@glowlabs-org/guarded-launch-ethers-sdk";
import {
  USDGRedemptionError,
  useUSDGRedemption,
} from "@/hooks/useUSDGRedemption";

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

const defaultPendingStates: PendingState[] = [
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

export const GlowToUsdcDialog: FC<{
  isOpen: boolean;
  amountToSell: string;
  estimatedOutputAmount: string;
  slippageTolerance: string;
  onOpenChange: (open: boolean) => void;
}> = ({
  isOpen,
  onOpenChange,
  amountToSell,
  estimatedOutputAmount,
  slippageTolerance,
}) => {
  const [isPending, setIsPending] = React.useState(false);
  const [pendingStates, setPendingStates] =
    React.useState<PendingState[]>(defaultPendingStates);
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

  const handleSwapGlowToUsdc = async () => {
    setIsPending(true);
    setCurrentState("NONE");

    try {
      const amountIn = ethers.utils.parseUnits(amountToSell, 18); // GLOW has 18 decimals

      // First, estimate the USDG output
      const estimateRes = await estimateGlowToUSDG({ amountIn });
      if (!estimateRes.ok) {
        setCurrentState("ERROR");
        toast.error("Failed to estimate USDG output");
        setIsPending(false);
        return;
      }

      const estimatedUsdgAmount = ethers.utils.formatUnits(estimateRes.val, 6);
      setIntermediateUsdgAmount(estimatedUsdgAmount);

      // Step 1: Swap GLOW to USDG
      const swapRes = await swapGlowToUSDG({
        amount: amountIn,
        slippagePercentTenThousandDenominator: BigNumber.from(
          Number(slippageTolerance) * 100
        ),
      });

      if (!swapRes.ok) {
        setCurrentState("ERROR");
        toast.error(swapRes.val);
        setIsPending(false);
        return;
      }

      // Update state for USDG approval/redemption
      setCurrentState("REQUESTING_USDG_APPROVAL");
      updatePendingStates("REQUESTING_USDG_APPROVAL");

      // Step 2: Redeem USDG for USDC
      const usdgAmount = ethers.utils.parseUnits(estimatedUsdgAmount, 6);

      // The approval is handled inside redeemUSDGForUSDC
      setCurrentState("APPROVING_USDG");
      updatePendingStates("APPROVING_USDG");

      setCurrentState("REDEEMING_USDG_FOR_USDC");
      updatePendingStates("REDEEMING_USDG_FOR_USDC");

      const redeemRes = await redeemUSDGForUSDC(usdgAmount);

      if (redeemRes.ok) {
        setCurrentState("DONE");
        updatePendingStates("DONE");
        toast.success(
          `GLOW successfully swapped for ${toFixedTruncate(
            Number(estimatedOutputAmount),
            6
          )} USDC`
        );
      } else {
        setCurrentState("ERROR");
        toast.error(redeemRes.val);
      }

      setIsPending(false);
    } catch (error: any) {
      setCurrentState("ERROR");
      setIsPending(false);
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

  useEffect(() => {
    if (!isOpen) {
      // Reset states when dialog closes
      setPendingStates(defaultPendingStates);
      setCurrentState("NONE");
      setIntermediateUsdgAmount("");
      resetUniswapPurchaseState();
    }
  }, [isOpen, resetUniswapPurchaseState]);

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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => {
          if (isPending) e.preventDefault();
        }}
        className="sm:max-w-[480px]"
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl lg:text-2xl font-semibold">
            Review Swap
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {/* TOKEN TO SELL */}
          <div className="grid gap-2">
            <div className="group relative bg-gradient-to-r from-glow-medium-grey/50 to-glow-medium-grey/40 rounded-md p-4 lg:p-6 border border-border/30 hover:border-border/60 transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                  You pay
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={amountToSell}
                    readOnly
                  />
                  <span className="text-lg sm:text-xl lg:text-2xl font-medium text-foreground">
                    GLOW
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TOKEN TO RECEIVE */}
          <div className="grid gap-2">
            <div className="group relative bg-gradient-to-r from-glow-medium-grey/50 to-glow-medium-grey/40 rounded-md p-4 lg:p-6 border border-border/30 hover:border-border/60 transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                  You receive
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <Input
                    placeholder="0.00"
                    className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={
                      Number(estimatedOutputAmount)
                        ? formatPrice(estimatedOutputAmount, 6)
                        : "0.00"
                    }
                    readOnly
                  />
                  <span className="text-lg sm:text-xl lg:text-2xl font-medium text-foreground">
                    USDC
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {currentState === "DONE" ? (
          <div className="grid gap-4">
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="bg-green-100 rounded-full p-4">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl lg:text-2xl font-semibold text-foreground">
                Swap Successful!
              </h3>
              <p className="text-sm lg:text-base text-muted-foreground text-center">
                Your GLOW has been successfully swapped to USDC
              </p>
            </div>

            <div className="grid gap-3">
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-muted/10 to-muted/5 rounded-md border border-border/20">
                <span className="text-sm lg:text-base text-muted-foreground">
                  Sent
                </span>
                <span className="font-mono font-medium text-sm lg:text-base">
                  {toFixedTruncate(Number(amountToSell), 2)} GLOW
                </span>
              </div>

              {intermediateUsdgAmount && (
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-muted/10 to-muted/5 rounded-md border border-border/20">
                  <span className="text-sm lg:text-base text-muted-foreground">
                    Via
                  </span>
                  <span className="font-mono font-medium text-sm lg:text-base">
                    {toFixedTruncate(Number(intermediateUsdgAmount), 6)} USDG
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-muted/10 to-muted/5 rounded-md border border-border/20">
                <span className="text-sm lg:text-base text-muted-foreground">
                  Received
                </span>
                <span className="font-mono font-medium text-green-600 text-sm lg:text-base">
                  {formatPrice(estimatedOutputAmount, 6)} USDC
                </span>
              </div>
            </div>

            <Button
              variant="default"
              onClick={() => onOpenChange(false)}
              className="w-full h-12 lg:h-14 rounded-md text-base lg:text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Close
            </Button>
          </div>
        ) : currentState !== "NONE" ? (
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gradient-to-r from-muted/10 to-muted/5 rounded-md p-4 lg:p-5 space-y-4 border border-border/20">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm lg:text-base font-medium text-muted-foreground">
                  Transaction Status
                </span>
              </div>
              <div className="grid gap-3">
                {visibleStates.map((state, index) => (
                  <motion.div
                    key={state.code}
                    className="flex items-center gap-3"
                    initial={{ opacity: 0.5 }}
                    animate={
                      state.validated || state.pending ? "show" : "hidden"
                    }
                    variants={waitingToSuccessVariants}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-background/80 backdrop-blur-sm dark:bg-muted/50 rounded-md p-2.5 flex items-center justify-center h-10 w-10 shrink-0 border border-border/20">
                        {state.validated && !state.pending ? (
                          <Check
                            className={clsx("w-5 h-5", "text-green-600")}
                          />
                        ) : state.pending ? (
                          <Loader2
                            className={clsx(
                              "w-5 h-5 animate-spin",
                              "text-primary"
                            )}
                          />
                        ) : (
                          <ArrowLeftRight
                            className={clsx("w-5 h-5", "text-muted-foreground")}
                          />
                        )}
                      </div>
                      <div>
                        <h3
                          className={clsx(
                            "text-sm lg:text-base font-medium",
                            state.validated && !state.pending
                              ? "text-foreground"
                              : state.pending
                              ? "text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {state.message}
                        </h3>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Button
            variant="default"
            onClick={handleSwapGlowToUsdc}
            disabled={isPending}
            className="w-full h-12 lg:h-14 rounded-md text-base lg:text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
          >
            {isPending && (
              <div className="mr-3">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
            Approve and Swap
          </Button>
        )}

        {currentState === "ERROR" && (
          <Button
            variant="outline"
            onClick={() => {
              setPendingStates(defaultPendingStates);
              setCurrentState("NONE");
              resetUniswapPurchaseState();
              handleSwapGlowToUsdc();
            }}
            className="w-full h-12 lg:h-14 rounded-md text-base lg:text-lg font-semibold transition-all duration-300"
          >
            Try Again
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
