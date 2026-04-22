import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { ArrowDown } from "lucide-react";
import React, { FC, useEffect } from "react";
import {
  SmartBalancingAmounts,
  usePurchaseGlow,
} from "@/hooks/usePurchaseGlow";

import { formatPrice } from "@/utils/formatPrice";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useSwap } from "@/hooks/useSwap";
import { Result } from "ts-results";
import { SwapUSDCToUSDGError } from "@/hooks/useSwapUSDCToUSDG";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { Token } from "@/app/buy/constants";

import { formatUnits, parseUnits } from "viem";
import { addresses } from "@/web3/constants/addresses";
import { useChainId } from "wagmi";
import {
  TransactionStepper,
  type TransactionStep,
  type StepStatus,
} from "@/components/transaction-stepper";
import { useEthGasPreflight } from "@/hooks/useEthGasPreflight";
import { useSmartAccountCheck } from "@/hooks/useSmartAccountCheck";

// Upper-bound per-leg gas so the preflight budgets the FULL flow, not just
// the first step. Users often have enough ETH to approve + swap USDC -> USDG
// but nothing for USDG -> GLW, so they get stranded mid-flow.
const USDC_APPROVE_GAS = 60_000n;
const USDG_APPROVE_GAS = 60_000n;
const UNISWAP_SWAP_GAS = 200_000n;
const ETH_TO_USDC_SWAP_GAS = 200_000n;
const USDG_TO_GLOW_GAS = 250_000n; // Uniswap or bonding curve (upper bound)

function estimateTotalGasUnits(
  selectedTokenSell: Token,
  selectedTokenBuy: Token,
): bigint {
  const sell = selectedTokenSell.label;
  const buy = selectedTokenBuy.label;
  if (sell === "ETH" && buy === "GLOW") {
    return (
      ETH_TO_USDC_SWAP_GAS +
      USDC_APPROVE_GAS +
      UNISWAP_SWAP_GAS +
      USDG_APPROVE_GAS +
      USDG_TO_GLOW_GAS
    );
  }
  if (sell === "USDC" && buy === "USDG") {
    return USDC_APPROVE_GAS + UNISWAP_SWAP_GAS;
  }
  if (sell === "USDC" && buy === "GLOW") {
    return (
      USDC_APPROVE_GAS +
      UNISWAP_SWAP_GAS +
      USDG_APPROVE_GAS +
      USDG_TO_GLOW_GAS
    );
  }
  if (sell === "USDG" && buy === "GLOW") {
    return USDG_APPROVE_GAS + USDG_TO_GLOW_GAS;
  }
  return 500_000n; // conservative fallback
}

function buildInitialSteps(
  selectedTokenSell: Token,
  selectedTokenBuy: Token,
  smartBalancingAmounts: SmartBalancingAmounts | undefined
): TransactionStep[] {
  const steps: TransactionStep[] = [];

  const isEthFlow =
    selectedTokenSell.label === "ETH" && selectedTokenBuy.label === "GLOW";
  const isUsdcToUsdg =
    selectedTokenSell.label === "USDC" && selectedTokenBuy.label === "USDG";
  const isUsdcToGlow =
    selectedTokenSell.label === "USDC" && selectedTokenBuy.label === "GLOW";
  const isUsdgToGlow =
    selectedTokenSell.label === "USDG" && selectedTokenBuy.label === "GLOW";

  // ETH -> USDC step (ETH flow only)
  if (isEthFlow) {
    steps.push({
      id: "SWAP_ETH_TO_USDC",
      title: "Swap ETH → USDC",
      description: "Converting ETH to USDC via Uniswap",
      tokenFrom: "ETH",
      tokenTo: "USDC",
      status: "idle",
    });
  }

  // USDC -> USDG step (ETH flow or USDC flows)
  if (isEthFlow || isUsdcToUsdg || isUsdcToGlow) {
    steps.push({
      id: "SWAP_USDC_TO_USDG",
      title: "Swap USDC → USDG",
      description: "Converting USDC to USDG",
      tokenFrom: "USDC",
      tokenTo: "USDG",
      status: "idle",
    });
  }

  // If buying GLOW, check if we need Uniswap and/or Bonding Curve steps
  if (
    selectedTokenBuy.label === "GLOW" &&
    (isEthFlow || isUsdcToGlow || isUsdgToGlow)
  ) {
    const hasUniswapAllocation =
      smartBalancingAmounts &&
      Number(
        formatUnits(smartBalancingAmounts.amount_in_uni as bigint, 6)
      ) > 0;

    const hasBondingCurveAllocation =
      smartBalancingAmounts &&
      Number(smartBalancingAmounts.amount_out_glow) > 0;

    if (hasUniswapAllocation) {
      steps.push({
        id: "SWAP_USDG_TO_GLOW_UNISWAP",
        title: "Swap USDG → GLW (Uniswap)",
        description: "Converting USDG to GLW via Uniswap",
        tokenFrom: "USDG",
        tokenTo: "GLW",
        status: "idle",
      });
    }

    if (hasBondingCurveAllocation) {
      steps.push({
        id: "PURCHASE_GLOW_BONDING",
        title: "Purchase GLW (Bonding Curve)",
        description: "Purchasing GLW from bonding curve",
        tokenFrom: "USDG",
        tokenTo: "GLW",
        status: "idle",
      });
    }

    // Fallback if no smart balancing amounts yet - show both as possibilities
    if (!hasUniswapAllocation && !hasBondingCurveAllocation) {
      steps.push({
        id: "SWAP_USDG_TO_GLOW_UNISWAP",
        title: "Swap USDG → GLW",
        description: "Converting USDG to GLW",
        tokenFrom: "USDG",
        tokenTo: "GLW",
        status: "idle",
      });
    }
  }

  return steps;
}

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

  // Transaction stepper state
  const [transactionSteps, setTransactionSteps] = React.useState<
    TransactionStep[]
  >([]);
  const stepsRef = React.useRef<TransactionStep[]>([]);

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

  // Pre-flight: enough ETH for the FULL multi-leg flow + not a smart account.
  // Prevents users from paying for leg 1 (USDC approve + swap) and then
  // getting stranded on leg 2 (USDG approve + USDG->GLW). Smart-account
  // detection catches MetaMask's "pay gas with USDC" feature that silently
  // converts EOAs to contract accounts, which can't interact with our
  // contracts.
  const totalGasUnits = React.useMemo(
    () => estimateTotalGasUnits(selectedTokenSell, selectedTokenBuy),
    [selectedTokenSell, selectedTokenBuy],
  );
  const gasPreflight = useEthGasPreflight({
    estimatedGasUnits: totalGasUnits,
    enabled: isOpen && !isPending && !isSuccess,
  });
  const smartAccountCheck = useSmartAccountCheck({
    enabled: isOpen && !isPending && !isSuccess,
  });
  const hasInsufficientGas = gasPreflight.sufficient === false;
  const isSmartAccount = smartAccountCheck.isBlocked;
  const gasShortfallEth =
    gasPreflight.shortfallWei != null
      ? formatUnits(gasPreflight.shortfallWei, 18)
      : null;
  const isPreflightBlocked = hasInsufficientGas || isSmartAccount;
  const isPreflightChecking =
    gasPreflight.isChecking || smartAccountCheck.isChecking;

  const updateStepStatus = React.useCallback(
    (
      stepId: string,
      status: StepStatus,
      extras?: { txHash?: string; errorMessage?: string }
    ) => {
      setTransactionSteps((prev) => {
        const updated = prev.map((s) => {
          if (s.id === stepId) {
            return {
              ...s,
              status,
              startedAt:
                status === "waiting_signature" || status === "confirming"
                  ? s.startedAt ?? Date.now()
                  : s.startedAt,
              txHash: extras?.txHash ?? s.txHash,
              errorMessage: extras?.errorMessage ?? s.errorMessage,
            };
          }
          return s;
        });
        stepsRef.current = updated;
        return updated;
      });
    },
    []
  );

  const handlePurchaseGlow = async () => {
    setIsPending(true);
    setIsError(false);
    setIsSuccess(false);
    setErrorMessage(null);

    // Build initial steps
    const initialSteps = buildInitialSteps(
      selectedTokenSell,
      selectedTokenBuy,
      smartBalancingAmounts
    );
    stepsRef.current = initialSteps;
    setTransactionSteps(initialSteps);

    try {
      const isEthFlow =
        selectedTokenSell.label === "ETH" && selectedTokenBuy.label === "GLOW";
      let effectiveSmartBalancingAmounts: SmartBalancingAmounts | undefined =
        smartBalancingAmounts;

      // If we're swapping USDC to USDG only (not continuing to GLOW)
      if (
        selectedTokenSell.label === "USDC" &&
        selectedTokenBuy.label === "USDG"
      ) {
        updateStepStatus("SWAP_USDC_TO_USDG", "waiting_signature");
        updateStepStatus("SWAP_USDC_TO_USDG", "confirming");

        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          parseUnits(amountToSell, 6)
        );

        if (!swapUSDCtoUSDGRes.ok) {
          updateStepStatus("SWAP_USDC_TO_USDG", "error", {
            errorMessage: String(swapUSDCtoUSDGRes.val),
          });
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(swapUSDCtoUSDGRes.val));
          toast.error(swapUSDCtoUSDGRes.val);
          return;
        }

        updateStepStatus("SWAP_USDC_TO_USDG", "completed");
        setIsPending(false);
        setIsSuccess(true);
        return;
      }

      // If we're swapping USDC to GLOW (via USDG)
      if (
        selectedTokenSell.label === "USDC" &&
        selectedTokenBuy.label === "GLOW"
      ) {
        updateStepStatus("SWAP_USDC_TO_USDG", "waiting_signature");
        updateStepStatus("SWAP_USDC_TO_USDG", "confirming");

        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          parseUnits(amountToSell, 6)
        );

        if (!swapUSDCtoUSDGRes.ok) {
          updateStepStatus("SWAP_USDC_TO_USDG", "error", {
            errorMessage: String(swapUSDCtoUSDGRes.val),
          });
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(swapUSDCtoUSDGRes.val));
          toast.error(swapUSDCtoUSDGRes.val);
          return;
        }

        updateStepStatus("SWAP_USDC_TO_USDG", "completed");
      } else if (isEthFlow) {
        // ETH -> USDC -> USDG -> GLOW
        updateStepStatus("SWAP_ETH_TO_USDC", "waiting_signature");
        updateStepStatus("SWAP_ETH_TO_USDC", "confirming");

        let ethWei: bigint;
        try {
          ethWei = parseUnits(amountToSell, 18);
        } catch {
          updateStepStatus("SWAP_ETH_TO_USDC", "error", {
            errorMessage: "Invalid ETH amount",
          });
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
          updateStepStatus("SWAP_ETH_TO_USDC", "error", {
            errorMessage: String(swapEthRes.val),
          });
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(swapEthRes.val));
          toast.error(String(swapEthRes.val));
          return;
        }
        setTxHash(swapEthRes.val.txHash);
        updateStepStatus("SWAP_ETH_TO_USDC", "completed", {
          txHash: swapEthRes.val.txHash,
        });

        // USDC -> USDG
        updateStepStatus("SWAP_USDC_TO_USDG", "waiting_signature");
        updateStepStatus("SWAP_USDC_TO_USDG", "confirming");

        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          swapEthRes.val.usdcReceived
        );
        if (!swapUSDCtoUSDGRes.ok) {
          updateStepStatus("SWAP_USDC_TO_USDG", "error", {
            errorMessage: String(swapUSDCtoUSDGRes.val),
          });
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(swapUSDCtoUSDGRes.val));
          toast.error(String(swapUSDCtoUSDGRes.val));
          return;
        }

        updateStepStatus("SWAP_USDC_TO_USDG", "completed");

        // Recompute smart balancing amounts based on actual USDC received
        const priceCandidate = Number(
          effectiveSmartBalancingAmounts?.earlyLiquidityCurrentPrice ?? 0
        );
        if (priceCandidate > 0) {
          const usdgEquivalent = formatUnits(swapEthRes.val.usdcReceived, 6);
          const recomputeRes = await getSmartBalancingAmounts({
            amountUsdgIn: usdgEquivalent,
            earlyLiquidityCurrentPrice: priceCandidate,
            useEarlyLiquidity: false,
          });
          if (recomputeRes.ok) {
            effectiveSmartBalancingAmounts = recomputeRes.val;

            // Update steps based on new smart balancing amounts
            const hasUniswap =
              Number(
                formatUnits(recomputeRes.val.amount_in_uni as bigint, 6)
              ) > 0;
            const hasBonding = Number(recomputeRes.val.amount_out_glow) > 0;

            setTransactionSteps((prev) => {
              let updated = [...prev];
              const hasUniswapStep = updated.some(
                (s) => s.id === "SWAP_USDG_TO_GLOW_UNISWAP"
              );
              const hasBondingStep = updated.some(
                (s) => s.id === "PURCHASE_GLOW_BONDING"
              );

              if (hasUniswap && !hasUniswapStep) {
                const insertIndex = updated.findIndex(
                  (s) => s.id === "PURCHASE_GLOW_BONDING"
                );
                updated.splice(insertIndex === -1 ? updated.length : insertIndex, 0, {
                  id: "SWAP_USDG_TO_GLOW_UNISWAP",
                  title: "Swap USDG → GLW (Uniswap)",
                  description: "Converting USDG to GLW via Uniswap",
                  tokenFrom: "USDG",
                  tokenTo: "GLW",
                  status: "idle",
                });
              }

              if (hasBonding && !hasBondingStep) {
                updated.push({
                  id: "PURCHASE_GLOW_BONDING",
                  title: "Purchase GLW (Bonding Curve)",
                  description: "Purchasing GLW from bonding curve",
                  tokenFrom: "USDG",
                  tokenTo: "GLW",
                  status: "idle",
                });
              }

              stepsRef.current = updated;
              return updated;
            });
          }
        }
      }

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

      // Buy GLOW with Uniswap
      if (isUniswapElligible) {
        updateStepStatus("SWAP_USDG_TO_GLOW_UNISWAP", "waiting_signature");
        updateStepStatus("SWAP_USDG_TO_GLOW_UNISWAP", "confirming");

        const purchaseGlowFromUniswap = await swap({
          amount: effectiveSmartBalancingAmounts!.amount_in_uni as any,
          slippagePercentTenThousandDenominator: slippagePointsTenThousandths,
        });
        if (!purchaseGlowFromUniswap.ok) {
          updateStepStatus("SWAP_USDG_TO_GLOW_UNISWAP", "error", {
            errorMessage: String(purchaseGlowFromUniswap.val),
          });
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(purchaseGlowFromUniswap.val));
          toast.error(purchaseGlowFromUniswap.val);
          return;
        }
        if (uniswapLastTxHashRef.current) {
          setTxHash(uniswapLastTxHashRef.current);
          updateStepStatus("SWAP_USDG_TO_GLOW_UNISWAP", "completed", {
            txHash: uniswapLastTxHashRef.current,
          });
        } else {
          updateStepStatus("SWAP_USDG_TO_GLOW_UNISWAP", "completed");
        }
      }

      // Buy GLOW with bonding curve
      if (isBondingCurveElligible) {
        updateStepStatus("PURCHASE_GLOW_BONDING", "waiting_signature");
        updateStepStatus("PURCHASE_GLOW_BONDING", "confirming");

        const incrementsToPurchase = Math.floor(
          Number(effectiveSmartBalancingAmounts?.amount_out_glow) * 100
        );

        const purchaseGlowEarlyLiquidityRes = await purchaseGlowEarlyLiquidity({
          incrementsToPurchase,
          slippagePointsTenThousandths: slippagePointsTenThousandths,
        });

        if (!purchaseGlowEarlyLiquidityRes.ok) {
          updateStepStatus("PURCHASE_GLOW_BONDING", "error", {
            errorMessage: String(purchaseGlowEarlyLiquidityRes.val),
          });
          setIsPending(false);
          setIsError(true);
          setErrorMessage(String(purchaseGlowEarlyLiquidityRes.val));
          toast.error(purchaseGlowEarlyLiquidityRes.val);
          return;
        }
        if (glowLastTxHashRef.current) {
          setTxHash(glowLastTxHashRef.current);
          updateStepStatus("PURCHASE_GLOW_BONDING", "completed", {
            txHash: glowLastTxHashRef.current,
          });
        } else {
          updateStepStatus("PURCHASE_GLOW_BONDING", "completed");
        }
      }

      // Prefer the final GLW-producing tx hash
      const finalGlwTxHash =
        glowLastTxHashRef.current ?? uniswapLastTxHashRef.current ?? txHash;
      if (finalGlwTxHash) setTxHash(finalGlwTxHash);

      // Mark all steps as completed
      setTransactionSteps((prev) =>
        prev.map((state) => ({ ...state, pending: false, status: "completed" as StepStatus }))
      );

      setIsPending(false);
      setIsSuccess(true);
    } catch (error: any) {
      console.error("Error in handlePurchaseGlow:", error);

      // Find the active step and mark it as error
      const currentSteps = stepsRef.current;
      const activeStep = currentSteps.find(
        (s) => s.status === "waiting_signature" || s.status === "confirming"
      );
      if (activeStep) {
        updateStepStatus(activeStep.id, "error", {
          errorMessage: error?.message || "Transaction failed",
        });
      }

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
      setIsPending(false);
      setIsSuccess(false);
      setIsError(false);
      setErrorMessage(null);
      setTxHash(null);
      setNetworkCostUSD("");
      setIsNetworkCostLoading(false);
      setIsImpactPowerPointsBuySuccess(false);
      setTransactionSteps([]);
      stepsRef.current = [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleDispatchBuy = () => {
    if (isSmartAccount) {
      const msg = smartAccountCheck.reason ?? "Smart account not supported.";
      setIsError(true);
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (hasInsufficientGas) {
      const msg =
        "Insufficient ETH for gas to cover the full swap. Add more ETH and try again.";
      setIsError(true);
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    handlePurchaseGlow();
  };

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
        <span className="text-[#4ADE80] font-mono font-medium">
          {Number(amount).toLocaleString("en-US", {
            maximumFractionDigits: 4,
          })}
        </span>
      ),
      unit: selectedTokenBuy.label,
    },
  ];

  // Custom review content with transaction stepper
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
                  {selectedTokenSell.label}
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
                {Number(amount) ? formatPrice(amount, 4) : "0.00"}{" "}
                <span className="text-lg font-medium text-muted-foreground">
                  {selectedTokenBuy.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction stepper - shown during processing */}
      {isPending && transactionSteps.length > 0 && (
        <div className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-4">
          <TransactionStepper steps={transactionSteps} chainId={chainId} />
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
          resetGlowPurchaseState();
          resetUniswapPurchaseState();
          setTransactionSteps([]);
          stepsRef.current = [];
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
    <div className="flex flex-col gap-2">
      {isSmartAccount && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-900 text-xs px-3 py-2">
          {smartAccountCheck.reason}
        </div>
      )}
      {!isSmartAccount && hasInsufficientGas && (
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2">
          Not enough ETH to cover the full{" "}
          {selectedTokenBuy.label === "GLOW" ? "swap + purchase" : "swap"}. Add{" "}
          {gasShortfallEth
            ? `~${Number(gasShortfallEth).toFixed(5)} ETH`
            : "more ETH"}{" "}
          to this wallet and try again.
        </div>
      )}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleDispatchBuy}
          className="flex-1"
          disabled={isPreflightBlocked || isPreflightChecking}
        >
          {isPreflightChecking ? "Checking…" : "Approve and Buy"}
        </Button>
      </div>
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
      showImpactScoreBoost={selectedTokenBuy.label === "GLOW"}
      impactScoreBoostMessage={
        selectedTokenBuy.label === "GLOW"
          ? "You've increased your Glow Worth. You are now earning passive Impact Points on this balance."
          : undefined
      }
      impactScoreBoostIconType={
        selectedTokenBuy.label === "GLOW" ? "glw" : "default"
      }
    />
  );
};
