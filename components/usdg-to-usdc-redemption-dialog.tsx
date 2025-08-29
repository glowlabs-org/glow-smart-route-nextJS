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
        className="bg-card/90 backdrop-blur-sm rounded-3xl p-0 md:max-w-sm w-full border-border shadow-2xl overflow-hidden"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Redeem USDG</DialogTitle>
        </DialogHeader>
        <div className="px-8 py-12 text-center">
          {isTransactionSuccessful ? (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                {/* Amount Display */}
                <div className="mb-6">
                  <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                    + {toFixedTruncate(Number(amountToRedeem), 2)} USDC
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Redeemed from USDG
                  </div>
                </div>

                {/* Status Badge */}
                <div className="inline-flex items-center px-4 py-2 bg-secondary/50 backdrop-blur-sm border border-border rounded-full mb-8">
                  <span className="text-zinc-900 dark:text-zinc-100 text-sm font-medium">
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
              </div>

              {/* Transaction Details */}
              <div className="space-y-4 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">From</span>
                  <span className="text-zinc-900 dark:text-zinc-100 text-sm font-medium">
                    USDG Balance
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">To</span>
                  <span className="text-zinc-900 dark:text-zinc-100 text-sm font-medium">
                    USDC Wallet
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Amount Redeemed
                  </span>
                  <span className="text-zinc-900 dark:text-zinc-100 text-sm font-medium">
                    {toFixedTruncate(Number(amountToRedeem), 2)} USDG
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Amount Received
                  </span>
                  <span className="text-zinc-900 dark:text-zinc-100 text-sm font-medium">
                    {toFixedTruncate(Number(amountToRedeem), 2)} USDC
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Exchange Rate
                  </span>
                  <span className="text-zinc-900 dark:text-zinc-100 text-sm font-medium">
                    1:1
                  </span>
                </div>
              </div>

              <Button
                variant="default"
                onClick={() => onOpenChange(false)}
                className="w-full h-12 text-base font-medium rounded-xl"
              >
                Close
              </Button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  Redeem USDG
                </h2>
                <p className="text-muted-foreground text-sm">
                  Exchange your USDG for USDC at a 1:1 rate
                </p>
              </div>

              <div className="space-y-4 text-left">
                {/* USDG TO REDEEM */}
                <div className="space-y-2">
                  <div className="bg-secondary/50 backdrop-blur-sm border border-border rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        You redeem
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        placeholder="0.00"
                        className="text-2xl md:text-3xl font-bold bg-transparent dark:bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        pattern="[0-9]*"
                        value={amountToRedeem}
                        readOnly
                      />
                      <span className="text-2xl font-medium text-zinc-900 dark:text-zinc-100">
                        USDG
                      </span>
                    </div>
                  </div>
                </div>

                {/* USDC TO RECEIVE */}
                <div className="space-y-2">
                  <div className="bg-secondary/50 backdrop-blur-sm border border-border rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        You receive
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        placeholder="0.00"
                        className="text-2xl md:text-3xl font-bold bg-transparent dark:bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={amountToRedeem}
                        readOnly
                      />
                      <span className="text-2xl font-medium text-zinc-900 dark:text-zinc-100">
                        USDC
                      </span>
                    </div>
                  </div>
                </div>

                {/* Exchange Rate Info */}
                <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Exchange Rate
                  </span>
                  <span className="text-sm font-medium">1 USDG = 1 USDC</span>
                </div>
              </div>

              {currentState !== "NONE" && currentState !== "ERROR" ? (
                <div className="mt-8">
                  {/* Status Badge */}
                  <div className="inline-flex items-center px-4 py-2 bg-secondary/50 backdrop-blur-sm border border-border rounded-full mb-6">
                    <span className="text-zinc-900 dark:text-zinc-100 text-sm font-medium">
                      Processing redemption...
                    </span>
                  </div>

                  {/* Transaction Status */}
                  <div className="bg-secondary/30 backdrop-blur-sm border border-border/50 rounded-2xl p-6 space-y-4 text-left">
                    <div className="space-y-3">
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
                          <div className="bg-background/50 rounded-xl p-2 flex items-center justify-center h-8 w-8 shrink-0">
                            {state.validated ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : state.pending ? (
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            ) : (
                              <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
                            )}
                          </div>
                          <div>
                            <h3
                              className={clsx(
                                "text-sm",
                                state.validated && !state.pending
                                  ? "text-zinc-900 dark:text-zinc-100"
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
              ) : currentState === "NONE" ? (
                <div className="mt-8">
                  <Button
                    variant="default"
                    onClick={handleRedeemUSDG}
                    className="w-full h-12 text-base font-medium rounded-xl"
                  >
                    {isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Approve and Redeem
                  </Button>
                </div>
              ) : null}

              {currentState === "ERROR" ? (
                <div className="mt-8">
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
                    className="w-full h-12 text-base font-medium rounded-xl"
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
