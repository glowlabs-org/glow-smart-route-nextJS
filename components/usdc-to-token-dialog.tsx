import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { ArrowLeftRight, Check, Loader2, Info, ArrowDown } from "lucide-react";
import { waitingToSuccessVariants } from "@/animations/variants";
import { motion } from "framer-motion";
import React, { FC, useEffect } from "react";
import {
  SmartBalancingAmounts,
  purchaseGlowStateMessages,
  usePurchaseGlow,
} from "@/hooks/usePurchaseGlow";

import { formatPrice } from "@/utils/formatPrice";
import clsx from "clsx";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { SwapError, useSwap } from "@/hooks/useSwap";
import { Result } from "ts-results";
import { SwapUSDCToUSDGError } from "@/hooks/useSwapUSDCToUSDG";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import { Token } from "@/app/buy/constants";

import { formatUnits, parseUnits } from "viem";
import { addresses } from "@/web3/constants/addresses";
import { useChainId } from "wagmi";

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

const ethToUsdcPendingState: PendingState = {
  code: "SWAP_ETH_TO_USDC",
  message: "Swapping ETH for USDC on Uniswap",
  validated: false,
  pending: false,
};

function getInitialPendingStates(
  selectedTokenSell: Token,
  selectedTokenBuy: Token
) {
  if (selectedTokenSell.label === "ETH" && selectedTokenBuy.label === "GLOW")
    return [ethToUsdcPendingState, ...usdcDefaultPendingStates];
  if (selectedTokenSell.label === "USDC" && selectedTokenBuy.label === "USDG")
    return usdcDefaultPendingStates;
  if (selectedTokenSell.label === "USDC" && selectedTokenBuy.label === "GLOW")
    return usdcDefaultPendingStates;
  return [];
}

const defaultPendingStates = (
  buyingFrom: "early_liquidity" | "uniswap",
  tokenToSellLabel: "USDC" | "USDG" | "GLOW" | "GCTL" | "ETH"
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
  slippagePointsTenThousandths: bigint;
  swapUSDCToUSDG: (
    amount: bigint
  ) => Promise<Result<boolean, SwapUSDCToUSDGError | string>>;
  onOpenChange: (open: boolean) => void;
}> = ({
  isOpen,
  onOpenChange,
  amount,
  amountToSell,
  selectedTokenBuy,
  smartBalancingAmounts,
  swapUSDCToUSDG,
  selectedTokenSell,
  slippagePointsTenThousandths,
}) => {
  const chainId = useChainId();
  const [isPending, setIsPending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [networkCostUSD, setNetworkCostUSD] = React.useState<string>("");
  const [isNetworkCostLoading, setIsNetworkCostLoading] = React.useState(false);
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
    getSmartBalancingAmounts,
    lastTxHashRef: glowLastTxHashRef,
  } = usePurchaseGlow();

  const { swapEthToUsdc } = useSwapETHToUSDC();

  const {
    swap,
    uniswapPurchaseState,
    resetUniswapPurchaseState,
    lastTxHashRef: uniswapLastTxHashRef,
  } = useSwap({
    tokenA_address:
      selectedTokenSell.label === "ETH"
        ? addresses.usdg
        : selectedTokenSell.address,
    tokenB_address: addresses.glow,
  });

  const handlePurchaseGlow = async () => {
    setIsPending(true);
    setIsError(false);
    setIsSuccess(false);
    setErrorMessage(null);

    try {
      const isEthFlow =
        selectedTokenSell.label === "ETH" && selectedTokenBuy.label === "GLOW";
      const usdgStepOffset = isEthFlow ? 1 : 0;
      let effectiveSmartBalancingAmounts: SmartBalancingAmounts | undefined =
        smartBalancingAmounts;

      // If we're swapping USDC to USDG only (not continuing to GLOW)
      if (
        selectedTokenSell.label === "USDC" &&
        selectedTokenBuy.label === "USDG"
      ) {
        setSwapUSDCToUSDGState("PURCHASING_USDG");
        updatePendingStates(0);

        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          parseUnits(amountToSell, 6)
        );
        console.log("swapUSDCtoUSDGRes", swapUSDCtoUSDGRes);

        if (!swapUSDCtoUSDGRes.ok) {
          setErrorStates();
          setSwapUSDCToUSDGState(undefined);
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(swapUSDCtoUSDGRes.val));
          toast.error(swapUSDCtoUSDGRes.val);
          return;
        }

        setSwapUSDCToUSDGState("SUCCESSFULLY_OBTAINED_USDG");
        updatePendingStates(1);

        // Mark as success since we're only swapping to USDG
        setPendingStates((prev) =>
          prev.map((state) => ({ ...state, pending: false, validated: true }))
        );
        setIsPending(false);
        setIsSuccess(true);
        return;
      }

      // If we're swapping USDC to GLOW (via USDG)
      if (
        selectedTokenSell.label === "USDC" &&
        selectedTokenBuy.label === "GLOW"
      ) {
        setSwapUSDCToUSDGState("PURCHASING_USDG");
        updatePendingStates(0);

        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          parseUnits(amountToSell, 6)
        );
        console.log("swapUSDCtoUSDGRes", swapUSDCtoUSDGRes);

        if (!swapUSDCtoUSDGRes.ok) {
          setErrorStates();
          setSwapUSDCToUSDGState(undefined);
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(swapUSDCtoUSDGRes.val));
          toast.error(swapUSDCtoUSDGRes.val);
          return;
        }

        setSwapUSDCToUSDGState("SUCCESSFULLY_OBTAINED_USDG");
        updatePendingStates(1);
      } else if (isEthFlow) {
        // ETH -> USDC -> USDG -> GLOW
        updatePendingStates(0);

        let ethWei: bigint;
        try {
          ethWei = parseUnits(amountToSell, 18);
        } catch {
          setErrorStates();
          setIsPending(false);
          setIsError(true);
          setErrorMessage("Invalid ETH amount");
          toast.error("Invalid ETH amount");
          return;
        }

        const swapEthRes = await swapEthToUsdc({
          amountInWei: ethWei,
          slippageBps: BigInt(100),
        });
        if (!swapEthRes.ok) {
          setErrorStates();
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(swapEthRes.val));
          toast.error(String(swapEthRes.val));
          return;
        }
        setTxHash(swapEthRes.val.txHash);

        setSwapUSDCToUSDGState("PURCHASING_USDG");
        updatePendingStates(usdgStepOffset);

        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          swapEthRes.val.usdcReceived
        );
        if (!swapUSDCtoUSDGRes.ok) {
          setErrorStates();
          setSwapUSDCToUSDGState(undefined);
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(swapUSDCtoUSDGRes.val));
          toast.error(String(swapUSDCtoUSDGRes.val));
          return;
        }

        setSwapUSDCToUSDGState("SUCCESSFULLY_OBTAINED_USDG");
        updatePendingStates(usdgStepOffset + 1);

        // Recompute smart balancing amounts based on actual USDC received (USDG is 1:1),
        // so we avoid stale quotes drift.
        const priceCandidate = Number(
          effectiveSmartBalancingAmounts?.earlyLiquidityCurrentPrice ?? 0
        );
        if (priceCandidate > 0) {
          const usdgEquivalent = formatUnits(swapEthRes.val.usdcReceived, 6);
          const recomputeRes = await getSmartBalancingAmounts({
            amountUsdgIn: usdgEquivalent,
            earlyLiquidityCurrentPrice: priceCandidate,
          });
          if (recomputeRes.ok)
            effectiveSmartBalancingAmounts = recomputeRes.val;
        }
      } else {
        updatePendingStates(0);
      }

      const approvalTokenLabel =
        selectedTokenSell.label === "ETH"
          ? ("USDG" as const)
          : selectedTokenSell.label;

      const isUniswapElligible =
        effectiveSmartBalancingAmounts &&
        Number(
          formatUnits(
            effectiveSmartBalancingAmounts?.amount_in_uni as bigint,
            6
          )
        ) > 0;
      const isBondingCurveElligible =
        effectiveSmartBalancingAmounts &&
        Number(effectiveSmartBalancingAmounts?.amount_out_glow) > 0;

      // buy glow with uniswap
      if (isUniswapElligible) {
        setPendingStates(defaultPendingStates("uniswap", approvalTokenLabel));
        const purchaseGlowFromUniswap = await swap({
          amount: effectiveSmartBalancingAmounts!.amount_in_uni as any,
          slippagePercentTenThousandDenominator: slippagePointsTenThousandths,
        });
        if (!purchaseGlowFromUniswap.ok) {
          setErrorStates();
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(purchaseGlowFromUniswap.val));
          toast.error(purchaseGlowFromUniswap.val);
          return;
        }
        if (uniswapLastTxHashRef.current)
          setTxHash(uniswapLastTxHashRef.current);
      }

      // buy glow with bonding curve
      if (isBondingCurveElligible) {
        setPendingStates(
          defaultPendingStates("early_liquidity", approvalTokenLabel)
        );
        const incrementsToPurchase = Math.floor(
          Number(effectiveSmartBalancingAmounts?.amount_out_glow) * 100
        );

        const purchaseGlowEarlyLiquidityRes = await purchaseGlowEarlyLiquidity({
          incrementsToPurchase,
          slippagePointsTenThousandths: slippagePointsTenThousandths,
        });

        if (!purchaseGlowEarlyLiquidityRes.ok) {
          setErrorStates();
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(purchaseGlowEarlyLiquidityRes.val));
          toast.error(purchaseGlowEarlyLiquidityRes.val);
          return;
        }
        if (glowLastTxHashRef.current) setTxHash(glowLastTxHashRef.current);
      }

      // Prefer the final GLW-producing tx hash (bonding curve last, otherwise uniswap).
      const finalGlwTxHash =
        glowLastTxHashRef.current ?? uniswapLastTxHashRef.current ?? txHash;
      if (finalGlwTxHash) setTxHash(finalGlwTxHash);

      setPendingStates((prev) =>
        prev.map((state) => {
          return { ...state, pending: false, validated: true };
        })
      );

      setIsPending(false);
      setIsSuccess(true);
    } catch (error: any) {
      console.error("Error in handlePurchaseGlow:", error);
      setIsPending(false);
      setIsError(true);
      setErrorMessage(error?.message || "Transaction failed");
      setTxHash(error?.txHash ?? null);
    }
  };

  // Estimate network fee when dialog opens
  useEffect(() => {
    async function estimateFee() {
      if (!isOpen || !amount || Number(amount) <= 0) return;
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
  }, [isOpen, amount]);

  useEffect(() => {
    if (!isOpen) {
      // Reset all states when dialog closes
      resetGlowPurchaseState();
      resetUniswapPurchaseState();
      setSwapUSDCToUSDGState(undefined);
      setIsPending(false);
      setIsSuccess(false);
      setIsError(false);
      setErrorMessage(null);
      setTxHash(null);
      setNetworkCostUSD("");
      setIsNetworkCostLoading(false);
      setIsImpactPowerPointsBuySuccess(false);
      setPendingStates([]);
    } else {
      setPendingStates(
        getInitialPendingStates(selectedTokenSell, selectedTokenBuy)
      );
    }
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
    handlePurchaseGlow();
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

    // Handle error states
    if (glowPurchaseState === "ERROR" || uniswapPurchaseState === "ERROR") {
      setIsError(true);
      setIsPending(false);
      if (!errorMessage) {
        setErrorMessage("Transaction failed. Please try again.");
      }
    }

    // Mark all as validated when either flow is done
    if (glowPurchaseState === "DONE" || uniswapPurchaseState === "DONE") {
      setPendingStates((prev) =>
        prev.map((state) => ({ ...state, pending: false, validated: true }))
      );
      setIsSuccess(true);
      setIsPending(false);
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

  // Calculate if transaction is successful
  const isTransactionSuccessful =
    isSuccess ||
    isImpactPowerPointsBuySuccess ||
    glowPurchaseState === "DONE" ||
    uniswapPurchaseState === "DONE";

  // Transaction details for review
  const transactionDetails: TransactionDetail[] = [
    {
      label: "You Pay",
      value: Number(amountToSell).toLocaleString("en-US", {
        maximumFractionDigits: 6,
      }),
      unit: selectedTokenSell.label,
    },
    {
      label: "You Receive",
      value: Number(amount) ? formatPrice(amount, 4) : "0.00",
      unit: selectedTokenBuy.label,
    },
  ];

  // Success details
  const successDetails: TransactionDetail[] = [
    {
      label: "Sent",
      value: Number(amountToSell).toLocaleString("en-US", {
        maximumFractionDigits: 6,
      }),
      unit: selectedTokenSell.label,
    },
    {
      label: "Received",
      value: (
        <span className="text-accent font-mono">
          {Number(amount).toLocaleString("en-US", {
            maximumFractionDigits: 4,
          })}
        </span>
      ),
      unit: selectedTokenBuy.label,
    },
  ];

  // Custom review content with pending states
  const reviewContent = (
    <div className="space-y-6 mb-8">
      {/* Token swap visualization */}
      <div className="relative space-y-4">
        <div className="bg-secondary/50 backdrop-blur-sm border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between text-left">
            <div>
              <div className="text-xs text-muted-foreground mb-1">You pay</div>
              <div className="text-2xl font-bold">
                {Number(amountToSell).toLocaleString("en-US", {
                  maximumFractionDigits: 6,
                })}{" "}
                <span className="text-lg font-medium text-muted-foreground">
                  {selectedTokenSell.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Absolutely positioned arrow */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-background rounded-full p-2 border border-border shadow-sm">
            <ArrowDown className="size-6 text-muted-foreground" />
          </div>
        </div>

        <div className="text-left bg-secondary/50 backdrop-blur-sm border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                You receive
              </div>
              <div className="text-2xl font-bold">
                {Number(amount) ? formatPrice(amount, 4) : "0.00"}{" "}
                <span className="text-lg font-medium text-muted-foreground">
                  {selectedTokenBuy.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending states display */}
      {(glowPurchaseState !== "NONE" ||
        uniswapPurchaseState !== "NONE" ||
        swapUSDCToUSDGState ||
        isPending) && (
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
                animate={state.validated || state.pending ? "show" : "hidden"}
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
            {isImpactPowerPointsBuySuccess && (
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0.5 }}
                animate="show"
                variants={waitingToSuccessVariants}
              >
                <div className="bg-background/80 backdrop-blur-sm rounded-lg p-2 flex items-center justify-center h-8 w-8 shrink-0 border border-border/50">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Successfully swapped Impact Power Points
                  </h3>
                </div>
              </motion.div>
            )}
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
          let initialPendingStates: PendingState[] = [];

          if (
            selectedTokenSell.label === "USDC" &&
            selectedTokenBuy.label === "USDG"
          ) {
            // For USDC to USDG direct swap
            initialPendingStates = usdcDefaultPendingStates;
          } else if (
            selectedTokenSell.label === "USDC" &&
            selectedTokenBuy.label === "GLOW"
          ) {
            // For USDC to GLOW (via USDG)
            initialPendingStates = usdcDefaultPendingStates;
          }

          resetGlowPurchaseState();
          resetUniswapPurchaseState();
          setSwapUSDCToUSDGState(undefined);
          setPendingStates(initialPendingStates);
          setIsImpactPowerPointsBuySuccess(false);
          setIsError(false);
          setErrorMessage(null);
          handleDispatchBuy();
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
      <Button onClick={handleDispatchBuy} className="flex-1">
        Approve and Buy
      </Button>
    </div>
  ) : undefined;

  const etherscanBase =
    chainId === 11155111
      ? "https://sepolia.etherscan.io"
      : "https://etherscan.io";
  const etherscanTxUrl = txHash ? `${etherscanBase}/tx/${txHash}` : null;

  return (
    <TransactionDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      isSubmitting={isPending}
      isSuccess={isTransactionSuccessful}
      isError={isError}
      contentClassName="sm:max-w-[520px]"
      bodyClassName="px-6 py-8 sm:px-7 sm:py-9"
      title="Review Swap"
      successTitle={`+${Number(amount).toLocaleString("en-US", {
        maximumFractionDigits: 4,
      })} ${selectedTokenBuy.label}`}
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
      successFooter={
        etherscanTxUrl ? (
          <Button variant="ghost" className="flex-1" asChild>
            <a href={etherscanTxUrl} target="_blank" rel="noopener noreferrer">
              View on Etherscan
            </a>
          </Button>
        ) : null
      }
      confirmLabel="Approve and Buy"
    />
  );
};
