import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2 } from "lucide-react";
import { waitingToSuccessVariants } from "@/animations/variants";
import { motion } from "framer-motion";
import React, { FC, useEffect } from "react";
import { Input } from "./ui/input";
import clsx from "clsx";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useUSDGRedemption } from "@/hooks/useUSDGRedemption";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import { parseUnits } from "viem";

type PendingState = {
  code: string;
  message: string;
  validated: boolean;
  pending: boolean;
};

const defaultPendingStates: PendingState[] = [
  {
    code: "REQUESTING_USDG_APPROVAL",
    message: "Requesting USDG approval",
    validated: false,
    pending: false,
  },
  {
    code: "APPROVING_USDG",
    message: "Approving USDG for redemption",
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
    message: "Successfully redeemed USDC",
    validated: false,
    pending: false,
  },
];

export const UsdgToUsdcRedemptionDialog: FC<{
  isOpen: boolean;
  amountToRedeem: string;
  onOpenChange: (open: boolean) => void;
}> = ({ isOpen, onOpenChange, amountToRedeem }) => {
  const [isPending, setIsPending] = React.useState(false);
  const [pendingStates, setPendingStates] =
    React.useState<PendingState[]>(defaultPendingStates);
  const [currentState, setCurrentState] = React.useState<
    | "NONE"
    | "REQUESTING_USDG_APPROVAL"
    | "APPROVING_USDG"
    | "REDEEMING_USDG_FOR_USDC"
    | "DONE"
    | "ERROR"
  >("NONE");
  const [isTransactionSuccessful, setIsTransactionSuccessful] =
    React.useState(false);

  const { redeemUSDGForUSDC } = useUSDGRedemption();

  const handleRedeemUSDG = async () => {
    setIsPending(true);
    setCurrentState("NONE");

    try {
      const amountUSDG = parseUnits(amountToRedeem, 6);

      // Update state for approval
      setCurrentState("REQUESTING_USDG_APPROVAL");
      updatePendingStates(0);

      // The approval is handled inside redeemUSDGForUSDC
      setCurrentState("APPROVING_USDG");
      updatePendingStates(1);

      setCurrentState("REDEEMING_USDG_FOR_USDC");
      updatePendingStates(2);

      const redeemRes = await redeemUSDGForUSDC(amountUSDG);

      if (redeemRes.ok) {
        setCurrentState("DONE");
        updatePendingStates(3);
        setIsTransactionSuccessful(true);
      } else {
        setCurrentState("ERROR");
        setErrorStates();
        toast.error(redeemRes.val);
      }

      setIsPending(false);
    } catch (error: any) {
      setCurrentState("ERROR");
      setErrorStates();
      setIsPending(false);
      toast.error(error?.message || "Transaction failed");
    }
  };

  useEffect(() => {
    // Reset states when modal opens
    setCurrentState("NONE");
    setPendingStates(
      defaultPendingStates.map((state) => ({
        ...state,
        validated: false,
        pending: false,
      }))
    );
    setIsTransactionSuccessful(false);
  }, [isOpen]);

  const updatePendingStates = (updateIndex: number) => {
    setPendingStates((prev) =>
      prev.map((state, index) => {
        if (index === updateIndex) {
          return { ...state, pending: true };
        }
        if (index <= updateIndex - 1) {
          return { ...state, pending: false, validated: true };
        }
        return state;
      })
    );
  };

  const setErrorStates = () => {
    setPendingStates((prev) =>
      prev.map((state) => {
        return { ...state, pending: false, validated: false };
      })
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => {
          if (isPending) e.preventDefault();
        }}
        className="bg-card rounded-[24px] p-0 md:max-w-sm w-full border border-border/40 overflow-hidden gap-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Redeem USDG</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-8 text-center">
          {isTransactionSuccessful ? (
            <div className="space-y-6">
              {/* Success Icon */}
              <div className="w-16 h-16 bg-[#4ADE80]/10 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-[#4ADE80]" />
              </div>

              {/* Amount Display */}
              <div className="text-center">
                <div className="text-3xl font-semibold text-foreground tracking-tight mb-1">
                  +{toFixedTruncate(Number(amountToRedeem), 2)} USDC
                </div>
                <div className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
                  Redeemed from USDG
                </div>
              </div>

              {/* Transaction Details */}
              <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 text-left space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">From</span>
                  <span className="text-foreground text-sm font-mono">
                    USDG Balance
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">To</span>
                  <span className="text-foreground text-sm font-mono">
                    USDC Wallet
                  </span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-border/20 dark:border-border/40">
                  <span className="text-muted-foreground text-sm">
                    Amount Redeemed
                  </span>
                  <span className="text-foreground text-sm font-mono">
                    {toFixedTruncate(Number(amountToRedeem), 2)} USDG
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Amount Received
                  </span>
                  <span className="text-[#4ADE80] text-sm font-mono font-medium">
                    {toFixedTruncate(Number(amountToRedeem), 2)} USDC
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Exchange Rate
                  </span>
                  <span className="text-foreground text-sm font-mono">
                    1:1
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-2">
                  Redeem USDG
                </h2>
                <p className="text-sm text-muted-foreground">
                  Exchange your USDG for USDC at a 1:1 rate
                </p>
              </div>

              <div className="space-y-4 text-left">
                {/* USDG TO REDEEM */}
                <div className="space-y-2">
                  <div className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                        You redeem
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        placeholder="0.00"
                        className="text-2xl md:text-3xl font-semibold bg-transparent dark:bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        pattern="[0-9]*"
                        value={amountToRedeem}
                        readOnly
                      />
                      <span className="text-xl font-medium text-foreground">
                        USDG
                      </span>
                    </div>
                  </div>
                </div>

                {/* USDC TO RECEIVE */}
                <div className="space-y-2">
                  <div className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                        You receive
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        placeholder="0.00"
                        className="text-2xl md:text-3xl font-semibold bg-transparent dark:bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={amountToRedeem}
                        readOnly
                      />
                      <span className="text-xl font-medium text-foreground">
                        USDC
                      </span>
                    </div>
                  </div>
                </div>

                {/* Exchange Rate Info */}
                <div className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Exchange Rate
                  </span>
                  <span className="text-sm font-mono text-foreground">1 USDG = 1 USDC</span>
                </div>
              </div>

              {currentState !== "NONE" && currentState !== "ERROR" ? (
                <div className="mt-6">
                  {/* Status Badge */}
                  <div className="inline-flex items-center px-4 py-2 bg-muted/50 border border-border/40 rounded-full mb-4">
                    <span className="text-foreground text-sm font-medium animate-pulse">
                      Processing redemption...
                    </span>
                  </div>

                  {/* Transaction Status */}
                  <div className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-4 space-y-3 text-left">
                    {pendingStates.map((state, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0.5 }}
                        animate={
                          state.validated || state.pending ? "show" : "hidden"
                        }
                        variants={waitingToSuccessVariants}
                      >
                        <div className={clsx(
                          "rounded-lg p-2 flex items-center justify-center h-8 w-8 shrink-0",
                          state.validated ? "bg-[#4ADE80]/10" : "bg-muted/50"
                        )}>
                          {state.validated ? (
                            <Check className="w-4 h-4 text-[#4ADE80]" />
                          ) : state.pending ? (
                            <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                          ) : (
                            <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
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
              ) : currentState === "NONE" ? (
                <div className="mt-6">
                  <Button
                    variant="default"
                    onClick={handleRedeemUSDG}
                    className="w-full"
                  >
                    {isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Approve and Redeem
                  </Button>
                </div>
              ) : null}

              {currentState === "ERROR" ? (
                <div className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentState("NONE");
                      setPendingStates(
                        defaultPendingStates.map((state) => ({
                          ...state,
                          validated: false,
                          pending: false,
                        }))
                      );
                      setIsTransactionSuccessful(false);
                      handleRedeemUSDG();
                    }}
                    className="w-full"
                  >
                    Try Again
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
