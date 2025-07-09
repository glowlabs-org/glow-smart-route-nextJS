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
import {
  SmartBalancingAmounts,
  purchaseGlowStateMessages,
  usePurchaseGlow,
} from "@/hooks/usePurchaseGlow";
import { BigNumber, ethers } from "ethers";
import { Input } from "./ui/input";
import { formatPrice } from "@/utils/formatPrice";
import clsx from "clsx";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { SwapError, useSwap } from "@/hooks/useSwap";
import { Result } from "ts-results";
import { SwapUSDCToUSDGError } from "@/hooks/useSwapUSDCToUSDG";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import { Token } from "@/app/buy/view";
import { addresses } from "@glowlabs-org/guarded-launch-ethers-sdk";
import { PurchaseImpactPointError } from "@/hooks/usePurchaseImpactPower";

type PendingState = {
  code: string;
  message: string;
  validated: boolean;
  pending: boolean;
};

const usdcDefaultPendingStates = [
  {
    code: "PURCHASING_USDG",
    message: purchaseGlowStateMessages.PURCHASING_USDG,
    validated: false,
    pending: false,
  },
  {
    code: "SUCCESSFULLY_OBTAINED_USDG",
    message: purchaseGlowStateMessages.SUCCESSFULLY_OBTAINED_USDG,
    validated: false,
    pending: false,
  },
];

const defaultPendingStates = (
  buyingFrom: "early_liquidity" | "uniswap",
  tokenToSellLabel: "USDC" | "USDG" | "GLOW" | "GCC" | "IMPACT POWER POINTS"
) => {
  // Map PurchaseGlowState to user-friendly messages
  const purchaseGlowStateMap: any = {
    NONE: { message: "Starting transaction", code: "NONE" },
    QUOTING: { message: "Quoting price", code: "QUOTING" },
    REQUESTING_USDC_APPROVAL_TO_OBTAIN_USDG: {
      message: "Requesting USDC approval for USDG",
      code: "REQUESTING_USDC_APPROVAL_TO_OBTAIN_USDG",
    },
    APPROVING_USDC_TO_OBTAIN_USDG: {
      message: "Approving USDC to obtain USDG",
      code: "APPROVING_USDC_TO_OBTAIN_USDG",
    },
    PURCHASING_USDG: { message: "Purchasing USDG", code: "PURCHASING_USDG" },
    SUCCESSFULLY_OBTAINED_USDG: {
      message: "Successfully obtained USDG",
      code: "SUCCESSFULLY_OBTAINED_USDG",
    },
    REQUESTING_USDG_APPROVAL_TO_OBTAIN_GLOW: {
      message: "Requesting USDG approval to obtain GLOW",
      code: "REQUESTING_USDG_APPROVAL_TO_OBTAIN_GLOW",
    },
    APPROVING_USDG_TO_OBTAIN_GLOW: {
      message: "Approving USDG to obtain GLOW",
      code: "APPROVING_USDG_TO_OBTAIN_GLOW",
    },
    PURCHASING_GLOW: {
      message: "Purchasing GLOW from Bonding Curve",
      code: "PURCHASING_GLOW",
    },
    DONE: {
      message: "Successfully purchased GLOW from Bonding Curve",
      code: "DONE",
    },
    ERROR: { message: "Transaction error", code: "ERROR" },
  };

  // Map UniswapPurchaseState to user-friendly messages
  const uniswapPurchaseStateMap: any = {
    NONE: { message: "Starting transaction", code: "NONE" },
    REQUESTING_TOKEN_APPROVAL: {
      message: `Requesting ${tokenToSellLabel} approval`,
      code: "REQUESTING_TOKEN_APPROVAL",
    },
    APPROVING_TOKEN: { message: "Approving USDC", code: "APPROVING_TOKEN" },
    PURCHASING_TOKEN: {
      message: "Purchasing GLOW from Uniswap",
      code: "PURCHASING_TOKEN",
    },
    DONE: { message: "Successfully purchased GLOW from Uniswap", code: "DONE" },
    ERROR: { message: "Uniswap transaction error", code: "ERROR" },
  };

  let states = [];
  switch (buyingFrom) {
    case "early_liquidity":
      states = [
        "NONE",
        "QUOTING",
        "REQUESTING_USDC_APPROVAL_TO_OBTAIN_USDG",
        "APPROVING_USDC_TO_OBTAIN_USDG",
        "PURCHASING_USDG",
        "SUCCESSFULLY_OBTAINED_USDG",
        "REQUESTING_USDG_APPROVAL_TO_OBTAIN_GLOW",
        "APPROVING_USDG_TO_OBTAIN_GLOW",
        "PURCHASING_GLOW",
        "DONE",
      ].map((code) => purchaseGlowStateMap[code]);
      break;
    case "uniswap":
      states = [
        "NONE",
        "REQUESTING_TOKEN_APPROVAL",
        "APPROVING_TOKEN",
        "PURCHASING_TOKEN",
        "DONE",
      ].map((code) => uniswapPurchaseStateMap[code]);
      break;
  }

  // Initialize states with validated and pending flags
  return states.map((state) => ({
    ...state,
    validated: false,
    pending: false,
  })) as PendingState[];
};

export const UsdcToTokenDialog: FC<{
  isOpen: boolean;
  amount: string;
  amountToSell: string;
  smartBalancingAmounts: SmartBalancingAmounts | undefined;
  selectedTokenSell: Token;
  selectedTokenBuy: Token;
  slippagePointsTenThousandths: BigNumber;
  swapUSDCToUSDG: (
    amount: BigNumber
  ) => Promise<Result<boolean, SwapUSDCToUSDGError>>;
  purchaseImpactPower: (
    amountToBuy: string,
    amountUSDGToSpend: BigNumber
  ) => Promise<Result<boolean, PurchaseImpactPointError>>;
  onOpenChange: (open: boolean) => void;
}> = ({
  isOpen,
  onOpenChange,
  amount,
  amountToSell,
  selectedTokenBuy,
  smartBalancingAmounts,
  swapUSDCToUSDG,
  purchaseImpactPower,
  selectedTokenSell,
  slippagePointsTenThousandths,
}) => {
  const [isPending, setIsPending] = React.useState(false);
  const [isImpactPowerPointsBuySuccess, setIsImpactPowerPointsBuySuccess] =
    React.useState(false);
  const [swapUSDCToUSDGState, setSwapUSDCToUSDGState] = React.useState<
    "PURCHASING_USDG" | "SUCCESSFULLY_OBTAINED_USDG"
  >();
  const [pendingStates, setPendingStates] = React.useState<PendingState[]>([]);

  const {
    purchaseGlowEarlyLiquidity,
    glowPurchaseState,
    resetGlowPurchaseState,
  } = usePurchaseGlow();

  const { swap, uniswapPurchaseState, resetUniswapPurchaseState } = useSwap({
    tokenA_address: selectedTokenSell.address,
    tokenB_address: addresses.glow,
  });

  const handlePurchaseGlow = async () => {
    setIsPending(true);
    try {
      if (selectedTokenSell.label === "USDC") {
        setSwapUSDCToUSDGState("PURCHASING_USDG");
        updatePendingStates(0);

        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          ethers.utils.parseUnits(amountToSell, "6")
        );

        if (!swapUSDCtoUSDGRes.ok) {
          setErrorStates();
          setSwapUSDCToUSDGState(undefined);
          setIsPending(false);
          toast.error(swapUSDCtoUSDGRes.val);
          return;
        }

        setSwapUSDCToUSDGState("SUCCESSFULLY_OBTAINED_USDG");

        updatePendingStates(1);
      } else {
        updatePendingStates(0);
      }
      const isUniswapElligible =
        smartBalancingAmounts &&
        Number(smartBalancingAmounts?.amount_in_uni) > 0;
      const isBondingCurveElligible =
        smartBalancingAmounts &&
        Number(smartBalancingAmounts?.amount_out_glow) > 0;

      // buy glow with uniswap
      if (isUniswapElligible) {
        setPendingStates(
          defaultPendingStates("uniswap", selectedTokenSell.label)
        );
        const purchaseGlowFromUniswap = await swap({
          amount: ethers.utils.parseUnits(
            toFixedTruncate(Number(smartBalancingAmounts.amount_in_uni), 6),
            "6"
          ),
          slippagePercentTenThousandDenominator: slippagePointsTenThousandths,
        });
        if (!purchaseGlowFromUniswap.ok) {
          setErrorStates();
          setIsPending(false);
          toast.error(purchaseGlowFromUniswap.val);
          return;
        }
      }

      // buy glow with bonding curve
      if (isBondingCurveElligible) {
        setPendingStates(
          defaultPendingStates("early_liquidity", selectedTokenSell.label)
        );
        const incrementsToPurchase = Math.floor(
          Number(smartBalancingAmounts?.amount_out_glow) * 100
        );

        const purchaseGlowEarlyLiquidityRes = await purchaseGlowEarlyLiquidity({
          incrementsToPurchase,
          slippagePointsTenThousandths: slippagePointsTenThousandths,
        });

        if (!purchaseGlowEarlyLiquidityRes.ok) {
          setErrorStates();
          setIsPending(false);
          toast.error(purchaseGlowEarlyLiquidityRes.val);
          return;
        }
      }

      setPendingStates((prev) =>
        prev.map((state) => {
          return { ...state, pending: false, validated: true };
        })
      );
      // Remove toast.success since we'll show success screen instead
      // toast.success("Transaction Successfull");

      setIsPending(false);
    } catch (error) {
      setIsPending(false);
    }
  };

  const handlePurchaseImpactPowerPoints = async () => {
    setIsPending(true);
    try {
      if (selectedTokenSell.label === "USDC") {
        setSwapUSDCToUSDGState("PURCHASING_USDG");
        updatePendingStates(0);

        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          ethers.utils.parseUnits(amountToSell, "6")
        );

        if (!swapUSDCtoUSDGRes.ok) {
          setErrorStates();
          setSwapUSDCToUSDGState(undefined);
          setIsPending(false);
          toast.error(swapUSDCtoUSDGRes.val);
          return;
        }

        setSwapUSDCToUSDGState("SUCCESSFULLY_OBTAINED_USDG");

        updatePendingStates(1);
      } else {
        updatePendingStates(0);
      }

      const amountToBuy = ethers.utils.parseUnits(amount, 12);

      const amountIn = ethers.utils.parseUnits(
        amountToSell,
        selectedTokenSell.decimals
      );

      const purchaseImpactPowerRes = await purchaseImpactPower(
        amountToBuy.toString(),
        amountIn
      );

      if (purchaseImpactPowerRes.ok) {
        setPendingStates((prev) =>
          prev.map((state) => {
            return { ...state, pending: false, validated: true };
          })
        );
        setIsImpactPowerPointsBuySuccess(true);
        // Remove toast.success since we'll show success screen instead
        // toast.success("Successfully purchased Impact Power Points");
        setIsPending(false);
      } else {
        setIsPending(false);
        toast.error(purchaseImpactPowerRes.val);
      }
    } catch (error) {
      setIsPending(false);
    }
  };

  useEffect(() => {
    resetGlowPurchaseState();
    resetUniswapPurchaseState();
    setSwapUSDCToUSDGState(undefined);
    const initialPendingStates =
      selectedTokenSell.label === "USDC" ? usdcDefaultPendingStates : [];
    setPendingStates(initialPendingStates);
    setIsImpactPowerPointsBuySuccess(false);
    // simulate setPendingStates to validated one after the other every 1 second
    // let i = 0;
    // const interval = setInterval(() => {
    //   if (i < pendingStates.length) {
    //     console.log("setting state", i);
    //     setPendingStates((prev) =>
    //       prev.map((state, index) => {
    //         if (index === i) {
    //           return { ...state, pending: true };
    //         }
    //         if (index === i - 1) {
    //           return { ...state, pending: false, validated: true };
    //         }
    //         return state;
    //       })
    //     );
    //     i++;
    //   } else {
    //     clearInterval(interval);
    //   }
    // }, 1000);

    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDispatchBuy = () => {
    if (selectedTokenBuy.label === "IMPACT POWER POINTS") {
      handlePurchaseImpactPowerPoints();
    } else {
      handlePurchaseGlow();
    }
  };

  useEffect(() => {
    // Function to update state based on the current state
    const updateStateBasedOnPurchase = (currentState: string) => {
      const index = pendingStates.findIndex(
        (state) => state.code === currentState
      );
      if (index !== -1) {
        setPendingStates((prev) =>
          prev.map((state, i) => {
            if (i < index) return { ...state, validated: true, pending: false };
            if (i === index) return { ...state, pending: true };
            return state;
          })
        );
      }
    };

    // Listen for changes in purchaseGlowState and uniswapPurchaseState
    if (glowPurchaseState !== "NONE" && glowPurchaseState !== "ERROR") {
      updateStateBasedOnPurchase(glowPurchaseState);
    }
    if (uniswapPurchaseState !== "NONE" && uniswapPurchaseState !== "ERROR") {
      updateStateBasedOnPurchase(uniswapPurchaseState);
    }

    // Mark all as validated when both are done or when only one was needed
    if (
      (glowPurchaseState === "DONE" || uniswapPurchaseState === "DONE") &&
      !pendingStates.some((state) => state.pending)
    ) {
      setPendingStates((prev) =>
        prev.map((state) => {
          return { ...state, pending: false, validated: true };
        })
      );
    }
  }, [glowPurchaseState, uniswapPurchaseState]);

  const lastTwoRelevantStates =
    pendingStates.length > 5
      ? pendingStates
          .reduce((acc: PendingState[], state, index, array) => {
            if (
              state.validated &&
              index < array.length - 1 &&
              !array[index + 1].validated
            ) {
              // If the current state is validated and the next state is not validated, add both
              acc.push(state, array[index + 1]);
            } else if (state.validated && index === array.length - 1) {
              // If this is the last state and it's validated, just add this state
              acc.push(state);
            }
            return acc;
          }, [])
          .slice(-2)
      : pendingStates;

  const isTransactionSuccessful =
    isImpactPowerPointsBuySuccess ||
    glowPurchaseState === "DONE" ||
    uniswapPurchaseState === "DONE";

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
            Review Buy
          </DialogTitle>
        </DialogHeader>

        {isTransactionSuccessful ? (
          <div className="grid gap-4">
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="bg-green-100 rounded-full p-4">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl lg:text-2xl font-semibold text-foreground">
                Purchase Successful!
              </h3>
              <p className="text-sm lg:text-base text-muted-foreground text-center">
                Your{" "}
                {selectedTokenBuy.label === "IMPACT POWER POINTS"
                  ? "Impact Power Points"
                  : selectedTokenBuy.label}{" "}
                purchase has been completed successfully
              </p>
            </div>

            <div className="grid gap-3">
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-muted/10 to-muted/5 rounded-md border border-border/20">
                <span className="text-sm lg:text-base text-muted-foreground">
                  Sent
                </span>
                <span className="font-mono font-medium text-sm lg:text-base">
                  {toFixedTruncate(Number(amountToSell), 6)}{" "}
                  {selectedTokenSell.label}
                </span>
              </div>

              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-muted/10 to-muted/5 rounded-md border border-border/20">
                <span className="text-sm lg:text-base text-muted-foreground">
                  Received
                </span>
                <span className="font-mono font-medium text-green-600 text-sm lg:text-base">
                  {formatPrice(
                    amount,
                    selectedTokenBuy.label === "IMPACT POWER POINTS" ? 4 : 4
                  )}{" "}
                  {selectedTokenBuy.label === "IMPACT POWER POINTS"
                    ? "IPP"
                    : selectedTokenBuy.label}
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
        ) : (
          <>
            <div className="grid gap-4">
              {/* TOKEN TO SELL  */}
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
                        pattern="[0-9]*"
                        value={amountToSell}
                        readOnly
                      />
                      <span className="text-lg sm:text-xl lg:text-2xl font-medium text-foreground">
                        {selectedTokenSell.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* END TOKEN TO SELL  */}

              {/* TOKEN TO BUY  */}
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
                        value={Number(amount) ? formatPrice(amount, 4) : "0.00"}
                        readOnly
                      />
                      <span className="text-lg sm:text-xl lg:text-2xl font-medium text-foreground">
                        {selectedTokenBuy.label === "IMPACT POWER POINTS"
                          ? "IPP"
                          : selectedTokenBuy.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* END TOKEN TO BUY  */}
            </div>
            {glowPurchaseState !== "NONE" ||
            uniswapPurchaseState !== "NONE" ||
            swapUSDCToUSDGState ? (
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-gradient-to-r from-muted/10 to-muted/5 rounded-md p-4 lg:p-5 space-y-4 border border-border/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm lg:text-base font-medium text-muted-foreground">
                      Transaction Status
                    </span>
                  </div>
                  <div className="grid gap-3">
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
                        <div className="flex items-center gap-3">
                          <div className="bg-white/80 dark:bg-muted/50 rounded-md p-2.5 flex items-center justify-center h-10 w-10 shrink-0 border border-border/20">
                            {state.validated ? (
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
                                className={clsx(
                                  "w-5 h-5",
                                  "text-muted-foreground"
                                )}
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
                    {isImpactPowerPointsBuySuccess ? (
                      <motion.div
                        className="flex items-center gap-3"
                        initial={{ opacity: 0.5 }}
                        animate={"show"}
                        variants={waitingToSuccessVariants}
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-white/80 dark:bg-muted/50 rounded-md p-2.5 flex items-center justify-center h-10 w-10 shrink-0 border border-border/20">
                            <Check
                              className={clsx("w-5 h-5", "text-green-600")}
                            />
                          </div>
                          <div>
                            <h3
                              className={clsx(
                                "text-sm lg:text-base font-medium text-foreground"
                              )}
                            >
                              Successfully purchased Impact Power Points
                            </h3>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <Button
                variant="default"
                onClick={handleDispatchBuy}
                className="w-full h-12 lg:h-14 rounded-md text-base lg:text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {isPending && (
                  <div className="mr-3">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                Approve and Buy
              </Button>
            )}
            {glowPurchaseState === "ERROR" ||
            uniswapPurchaseState === "ERROR" ? (
              <Button
                variant="outline"
                onClick={() => {
                  const initialPendingStates =
                    selectedTokenSell.label === "USDC"
                      ? usdcDefaultPendingStates
                      : [];
                  resetGlowPurchaseState();
                  resetUniswapPurchaseState();
                  setSwapUSDCToUSDGState(undefined);
                  setPendingStates(initialPendingStates);
                  setIsImpactPowerPointsBuySuccess(false);
                  handleDispatchBuy();
                }}
                className="w-full h-12 lg:h-14 rounded-md text-base lg:text-lg font-semibold transition-all duration-300"
              >
                Try Again
              </Button>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
