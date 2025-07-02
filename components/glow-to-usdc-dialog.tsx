import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeftRight, Check, Loader2 } from "lucide-react";
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
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>Review Swap</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {/* TOKEN TO SELL */}
          <div className="grid gap-2 md:gap-4">
            <div className="border border-[#E2E2E2] bg-[#FFFFFF] p-6 py-4 w-full">
              <div className="flex items-center justify-between">
                <h3 className="text-secondary text-lg mb-2">You Pay</h3>
              </div>
              <div className="flex items-center text-xl md:text-4xl">
                <Input
                  type="number"
                  placeholder="0"
                  className="px-0 text-xl md:text-4xl text-secondary caret-secondary border-transparent focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  pattern="[0-9]*"
                  value={amountToSell}
                  readOnly
                />
                GLOW
              </div>
            </div>
          </div>

          {/* TOKEN TO RECEIVE */}
          <div className="grid gap-4 mt-2 md:mt-4">
            <div className="border border-[#E2E2E2] bg-[#FFFFFF] p-6 py-4 w-full">
              <h3 className="text-secondary text-lg mb-2">You Receive</h3>
              <div className="flex items-center text-xl md:text-4xl">
                <Input
                  placeholder="0"
                  className="px-0 text-xl md:text-4xl text-secondary caret-secondary border-transparent focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={
                    Number(estimatedOutputAmount)
                      ? formatPrice(estimatedOutputAmount, 6)
                      : "0"
                  }
                  readOnly
                />
                USDC
              </div>
            </div>
          </div>
        </div>

        {currentState === "DONE" ? (
          <div className="grid gap-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="bg-green-100 rounded-full p-3">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-secondary">
                Swap Successful!
              </h3>
              <p className="text-sm text-gray-600 text-center">
                Your GLOW has been successfully swapped to USDC
              </p>
            </div>

            <div className="grid gap-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Sent</span>
                <span className="font-mono font-medium">
                  {toFixedTruncate(Number(amountToSell), 2)} GLOW
                </span>
              </div>

              {intermediateUsdgAmount && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Via</span>
                  <span className="font-mono font-medium">
                    {toFixedTruncate(Number(intermediateUsdgAmount), 6)} USDG
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Received</span>
                <span className="font-mono font-medium text-green-600">
                  {formatPrice(estimatedOutputAmount, 6)} USDC
                </span>
              </div>
            </div>

            <Button
              variant="default"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        ) : currentState !== "NONE" ? (
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <h3 className="text-secondary text-lg mb-2">
                  Transaction Status
                </h3>
              </div>
              <div className="grid gap-2">
                {visibleStates.map((state, index) => (
                  <motion.div
                    key={state.code}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0.5 }}
                    animate={
                      state.validated || state.pending ? "show" : "hidden"
                    }
                    variants={waitingToSuccessVariants}
                  >
                    <div className="flex items-center gap-2">
                      <div className="bg-[#FFFFFF40] p-2 flex items-center justify-center h-10 w-10 flex-shrink-0">
                        {state.validated && !state.pending ? (
                          <Check
                            className={clsx("w-4 h-4", "text-secondary")}
                          />
                        ) : state.pending ? (
                          <Loader2
                            className={clsx(
                              "w-4 h-4 animate-spin",
                              "text-secondary"
                            )}
                          />
                        ) : (
                          <ArrowLeftRight
                            className={clsx("w-4 h-4", "text-secondary")}
                          />
                        )}
                      </div>
                      <div>
                        <h3 className={clsx("text-secondary text-sm")}>
                          {state.message}
                        </h3>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <Button
            variant={"glass-outline"}
            onClick={handleSwapGlowToUsdc}
            disabled={isPending}
          >
            Approve and Swap
          </Button>
        )}

        {currentState === "ERROR" && (
          <Button
            variant={"glass-outline"}
            onClick={() => {
              setPendingStates(defaultPendingStates);
              setCurrentState("NONE");
              resetUniswapPurchaseState();
              handleSwapGlowToUsdc();
            }}
          >
            Try Again
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
