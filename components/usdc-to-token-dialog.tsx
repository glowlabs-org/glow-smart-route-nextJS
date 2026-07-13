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
import {
  SwapUSDCToUSDGError,
  type SwapUSDCToUSDGOptions,
  type SwapUSDCToUSDGSuccess,
} from "@/hooks/useSwapUSDCToUSDG";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { Token } from "@/app/buy/constants";

import { formatUnits, parseUnits, type Address } from "viem";
import { addresses } from "@/web3/constants/addresses";
import { useChainId } from "wagmi";
import {
  TransactionStepper,
  type TransactionStep,
  type StepStatus,
} from "@/components/transaction-stepper";
import { useEthGasPreflight } from "@/hooks/useEthGasPreflight";
import { useSmartAccountCheck } from "@/hooks/useSmartAccountCheck";
import { useLang } from "@/lib/i18n";
import { estimateSwapGasUnits } from "@/lib/transaction-gas";
import { validateSmartBalancingQuote } from "@/lib/swap-quote";
import { BONDING_CURVE_QUOTE_CHANGED_MESSAGE } from "@/lib/bonding-curve-budget";
import {
  computeAmountOutMin,
  computeGuaranteedGlowRouteMinimum,
  enforceConfirmedGlowRouteMinimum,
} from "@/lib/swap-slippage";
import { useTransactionOperationGuard } from "@/hooks/useTransactionOperationGuard";
import {
  getTransactionOperationCancellation,
  type AssertTransactionActive,
} from "@/lib/transaction-operation";
import { trackEvent } from "@/lib/telemetry";
import type { WalletRequestObserver } from "@/lib/wallet-request";
import type { SmartAccountPreflight } from "@/web3/web3/utils/detectSmartAccount";

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
  quoteExpiresAt: number;
  expectedAccount: Address;
  minimumAmountOut: bigint;
  ethToUsdcMinimum?: bigint;
  smartAccountPreflight?: SmartAccountPreflight;
  swapUSDCToUSDG: (
    amount: bigint,
    options?: SwapUSDCToUSDGOptions,
  ) => Promise<Result<SwapUSDCToUSDGSuccess, SwapUSDCToUSDGError | string>>;
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
  quoteExpiresAt,
  expectedAccount,
  minimumAmountOut,
  ethToUsdcMinimum,
  smartAccountPreflight,
}) => {
  const { t } = useLang();
  const s = t.swap;
  const chainId = useChainId();
  const [isPending, setIsPending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [confirmedAmountOut, setConfirmedAmountOut] = React.useState<
    string | null
  >(null);
  const [networkCostUSD, setNetworkCostUSD] = React.useState<string>("");
  const [isNetworkCostLoading, setIsNetworkCostLoading] = React.useState(false);
  // Transaction stepper state
  const [transactionSteps, setTransactionSteps] = React.useState<
    TransactionStep[]
  >([]);
  const stepsRef = React.useRef<TransactionStep[]>([]);
  const beginTransactionOperation = useTransactionOperationGuard(isOpen);

  const {
    purchaseGlowEarlyLiquidity,
    resetGlowPurchaseState,
    getSmartBalancingAmounts,
    getGlowQuoteEarlyLiquidity,
    lastTxHashRef: glowLastTxHashRef,
  } = usePurchaseGlow();

  const { swapEthToUsdc } = useSwapETHToUSDC();

  const {
    swap,
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
  const hasBondingAllocation = Boolean(
    (selectedTokenSell.label === "ETH" && selectedTokenBuy.label === "GLOW") ||
      (smartBalancingAmounts &&
        smartBalancingAmounts.amount_in_glow_bonding_curve > 0n),
  );
  const totalGasUnits = React.useMemo(
    () =>
      estimateSwapGasUnits({
        sellToken: selectedTokenSell.label,
        buyToken: selectedTokenBuy.label,
        hasBondingAllocation,
      }),
    [hasBondingAllocation, selectedTokenBuy.label, selectedTokenSell.label],
  );
  const ethValueWei = React.useMemo(() => {
    if (selectedTokenSell.label !== "ETH") return 0n;
    try {
      return parseUnits(amountToSell, 18);
    } catch {
      return 0n;
    }
  }, [amountToSell, selectedTokenSell.label]);
  const gasPreflight = useEthGasPreflight({
    estimatedGasUnits: totalGasUnits,
    additionalRequiredWei: ethValueWei,
    safetyBps: 1_500,
    enabled: isOpen && !isPending && !isSuccess,
  });
  const smartAccountCheck = useSmartAccountCheck({
    enabled: isOpen && !isPending && !isSuccess,
    preflight: smartAccountPreflight,
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

  const createWalletRequestObserver = React.useCallback(
    (
      stepId: string,
      assertTransactionActive: AssertTransactionActive,
    ): WalletRequestObserver => ({
      onEvent: (event) => {
        assertTransactionActive();
        if (event.phase === "dispatched") {
          updateStepStatus(stepId, "waiting_signature");
        } else if (event.phase === "resolved") {
          updateStepStatus(stepId, "confirming");
        }

        trackEvent("wallet_request_lifecycle", {
          flow: "swap_dialog",
          step: stepId,
          action: event.action ?? null,
          request_phase: event.phase,
          wallet_method: event.method,
          request_id: event.requestId,
          elapsed_ms: event.elapsedMs,
          sell_token: selectedTokenSell.label,
          buy_token: selectedTokenBuy.label,
        });
      },
    }),
    [selectedTokenBuy.label, selectedTokenSell.label, updateStepStatus],
  );

  const handlePurchaseGlow = async () => {
    const operation = beginTransactionOperation();
    if (!operation) return;
    const { assertActive: assertTransactionActive } = operation;

    setIsPending(true);
    setIsError(false);
    setIsSuccess(false);
    setErrorMessage(null);
    setConfirmedAmountOut(null);

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
      let routeBudgetAtomic: bigint | undefined;
      let prerequisiteWrapTxHash: `0x${string}` | undefined;
      let validatedBondingIncrements: number | null = null;
      let confirmedUniswapGlwReceived = 0n;
      let confirmedBondingGlwReceived = 0n;

      if (Date.now() > quoteExpiresAt) {
        throw new Error("This quote expired. Close the dialog to refresh it.");
      }

      const validateBondingPurchaseBudget = async (
        amounts: SmartBalancingAmounts | undefined,
      ) => {
        if (!amounts || amounts.amount_in_glow_bonding_curve <= 0n) return null;
        const output = Number(amounts.amount_out_glow);
        const increments = Math.floor(output * 100);
        if (!Number.isFinite(output) || output <= 0 || increments <= 0) {
          throw new Error(BONDING_CURVE_QUOTE_CHANGED_MESSAGE);
        }
        const freshQuote = await getGlowQuoteEarlyLiquidity(increments);
        assertTransactionActive();
        if (!freshQuote.ok) throw new Error(String(freshQuote.val));
        if (freshQuote.val > amounts.amount_in_glow_bonding_curve) {
          throw new Error(BONDING_CURVE_QUOTE_CHANGED_MESSAGE);
        }
        return increments;
      };

      const assertRouteGuaranteesReviewedMinimum = (
        amounts: SmartBalancingAmounts,
        bondingIncrements: number | null,
      ) => {
        const guaranteedMinimum = computeGuaranteedGlowRouteMinimum({
          uniswapQuotedAmountOut:
            amounts.amount_in_uni > 0n
              ? parseUnits(amounts.amount_out_uni, 18)
              : 0n,
          slippageBps: slippagePointsTenThousandths,
          bondingIncrements,
        });
        if (guaranteedMinimum < minimumAmountOut) {
          throw new Error(
            "This route cannot guarantee the minimum amount you reviewed.",
          );
        }
      };

      if (selectedTokenBuy.label === "GLOW") {
        if (!isEthFlow) routeBudgetAtomic = parseUnits(amountToSell, 6);
        const quoteValidation = validateSmartBalancingQuote({
          quote: effectiveSmartBalancingAmounts,
          budgetAtomic: routeBudgetAtomic,
        });
        if (!quoteValidation.ok) throw new Error(quoteValidation.error);
        validatedBondingIncrements =
          await validateBondingPurchaseBudget(effectiveSmartBalancingAmounts);
        assertRouteGuaranteesReviewedMinimum(
          effectiveSmartBalancingAmounts!,
          validatedBondingIncrements,
        );
      }

      // If we're swapping USDC to USDG only (not continuing to GLOW)
      if (
        selectedTokenSell.label === "USDC" &&
        selectedTokenBuy.label === "USDG"
      ) {
        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          parseUnits(amountToSell, 6),
          {
            expectedAccount,
            assertTransactionActive,
            smartAccountPreflight: smartAccountCheck.preflight ?? undefined,
            walletRequest: createWalletRequestObserver(
              "SWAP_USDC_TO_USDG",
              assertTransactionActive,
            ),
          },
        );
        assertTransactionActive();

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
        prerequisiteWrapTxHash = swapUSDCtoUSDGRes.val.txHash;

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
        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          parseUnits(amountToSell, 6),
          {
            expectedAccount,
            assertTransactionActive,
            smartAccountPreflight: smartAccountCheck.preflight ?? undefined,
            walletRequest: createWalletRequestObserver(
              "SWAP_USDC_TO_USDG",
              assertTransactionActive,
            ),
          },
        );
        assertTransactionActive();

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
        prerequisiteWrapTxHash = swapUSDCtoUSDGRes.val.txHash;

        updateStepStatus("SWAP_USDC_TO_USDG", "completed");
      } else if (isEthFlow) {
        // ETH -> USDC -> USDG -> GLOW
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
          slippageBps: slippagePointsTenThousandths,
          minimumAmountOutUsdc: ethToUsdcMinimum,
          expectedAccount,
          assertTransactionActive,
          walletRequest: createWalletRequestObserver(
            "SWAP_ETH_TO_USDC",
            assertTransactionActive,
          ),
        });
        assertTransactionActive();
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

        routeBudgetAtomic = swapEthRes.val.usdcReceived;

        // Recompute smart balancing amounts based on actual USDC received
        const priceCandidate = Number(
          effectiveSmartBalancingAmounts?.earlyLiquidityCurrentPrice ?? 0
        );
        if (priceCandidate <= 0) throw new Error("The route quote is unavailable.");
        const usdgEquivalent = formatUnits(swapEthRes.val.usdcReceived, 6);
        const recomputeRes = await getSmartBalancingAmounts({
          amountUsdgIn: usdgEquivalent,
          earlyLiquidityCurrentPrice: priceCandidate,
          useEarlyLiquidity: false,
        });
        assertTransactionActive();
        if (!recomputeRes.ok) throw new Error(String(recomputeRes.val));
        effectiveSmartBalancingAmounts = recomputeRes.val;
        const quoteValidation = validateSmartBalancingQuote({
          quote: effectiveSmartBalancingAmounts,
          budgetAtomic: routeBudgetAtomic,
        });
        if (!quoteValidation.ok) throw new Error(quoteValidation.error);
        const recomputedTotalGlow =
          parseUnits(effectiveSmartBalancingAmounts.amount_out_uni, 18) +
          parseUnits(effectiveSmartBalancingAmounts.amount_out_glow, 18);
        if (recomputedTotalGlow < minimumAmountOut) {
          throw new Error("The updated route is below the minimum you reviewed.");
        }
        validatedBondingIncrements =
          await validateBondingPurchaseBudget(effectiveSmartBalancingAmounts);
        assertRouteGuaranteesReviewedMinimum(
          effectiveSmartBalancingAmounts,
          validatedBondingIncrements,
        );

        // Update steps based on new smart balancing amounts
        const hasUniswap =
          Number(formatUnits(recomputeRes.val.amount_in_uni as bigint, 6)) > 0;
        const hasBonding = Number(recomputeRes.val.amount_out_glow) > 0;

        setTransactionSteps((prev) => {
          const updated = [...prev];
          const hasUniswapStep = updated.some(
            (step) => step.id === "SWAP_USDG_TO_GLOW_UNISWAP",
          );
          const hasBondingStep = updated.some(
            (step) => step.id === "PURCHASE_GLOW_BONDING",
          );

          if (hasUniswap && !hasUniswapStep) {
            const insertIndex = updated.findIndex(
              (step) => step.id === "PURCHASE_GLOW_BONDING",
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

        // Only wrap the received USDC after the replacement route is valid.
        const swapUSDCtoUSDGRes = await swapUSDCToUSDG(
          swapEthRes.val.usdcReceived,
          {
            expectedAccount,
            prerequisiteTxHashes: [swapEthRes.val.txHash],
            assertTransactionActive,
            smartAccountPreflight: smartAccountCheck.preflight ?? undefined,
            walletRequest: createWalletRequestObserver(
              "SWAP_USDC_TO_USDG",
              assertTransactionActive,
            ),
          },
        );
        assertTransactionActive();
        if (!swapUSDCtoUSDGRes.ok) {
          throw new Error(String(swapUSDCtoUSDGRes.val));
        }
        prerequisiteWrapTxHash = swapUSDCtoUSDGRes.val.txHash;
        updateStepStatus("SWAP_USDC_TO_USDG", "completed");
      }

      if (selectedTokenBuy.label === "GLOW") {
        const quoteValidation = validateSmartBalancingQuote({
          quote: effectiveSmartBalancingAmounts,
          budgetAtomic: routeBudgetAtomic,
        });
        if (!quoteValidation.ok) throw new Error(quoteValidation.error);
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
        const purchaseGlowFromUniswap = await swap({
          amount: effectiveSmartBalancingAmounts!.amount_in_uni as any,
          slippagePercentTenThousandDenominator: slippagePointsTenThousandths,
          minimumAmountOut: computeAmountOutMin(
            parseUnits(effectiveSmartBalancingAmounts!.amount_out_uni, 18),
            slippagePointsTenThousandths,
          ),
          expectedAccount,
          prerequisiteTxHashes: prerequisiteWrapTxHash
            ? [prerequisiteWrapTxHash]
            : undefined,
          assertTransactionActive,
          walletRequest: createWalletRequestObserver(
            "SWAP_USDG_TO_GLOW_UNISWAP",
            assertTransactionActive,
          ),
        });
        assertTransactionActive();
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
        confirmedUniswapGlwReceived +=
          purchaseGlowFromUniswap.val.amountReceived;
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
        const incrementsToPurchase = validatedBondingIncrements;
        if (!incrementsToPurchase) {
          throw new Error(BONDING_CURVE_QUOTE_CHANGED_MESSAGE);
        }

        const purchaseGlowEarlyLiquidityRes = await purchaseGlowEarlyLiquidity({
          incrementsToPurchase,
          slippagePointsTenThousandths: slippagePointsTenThousandths,
          maxUsdgToSpend:
            effectiveSmartBalancingAmounts!.amount_in_glow_bonding_curve,
          allowUsdcTopUp: false,
          prerequisiteTxHashes: prerequisiteWrapTxHash
            ? [prerequisiteWrapTxHash]
            : undefined,
          expectedAccount,
          assertTransactionActive,
          walletRequest: createWalletRequestObserver(
            "PURCHASE_GLOW_BONDING",
            assertTransactionActive,
          ),
        });
        assertTransactionActive();

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
        confirmedBondingGlwReceived +=
          purchaseGlowEarlyLiquidityRes.val.glowReceived;
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

      if (selectedTokenBuy.label === "GLOW") {
        const confirmedGlwReceived = enforceConfirmedGlowRouteMinimum({
          uniswapReceived: confirmedUniswapGlwReceived,
          bondingReceived: confirmedBondingGlwReceived,
          reviewedMinimum: minimumAmountOut,
        });
        setConfirmedAmountOut(formatUnits(confirmedGlwReceived, 18));
      } else {
        setConfirmedAmountOut(amount);
      }

      // Mark all steps as completed
      setTransactionSteps((prev) =>
        prev.map((state) => ({ ...state, pending: false, status: "completed" as StepStatus }))
      );

      setIsPending(false);
      setIsSuccess(true);
    } catch (error: any) {
      if (
        getTransactionOperationCancellation(error, assertTransactionActive)
      ) {
        return;
      }
      console.error("Error in handlePurchaseGlow:", error);

      // Find the active step and mark it as error
      const currentSteps = stepsRef.current;
      const activeStep = currentSteps.find(
        (s) => s.status === "waiting_signature" || s.status === "confirming"
      );
      if (activeStep) {
        updateStepStatus(activeStep.id, "error", {
          errorMessage: error?.message || s.transactionFailed,
        });
      } else {
        const firstIdleStep = currentSteps.find((step) => step.status === "idle");
        if (firstIdleStep) {
          updateStepStatus(firstIdleStep.id, "error", {
            errorMessage: error?.message || s.transactionFailed,
          });
        }
      }

      setIsPending(false);
      setIsError(true);
      setErrorMessage(error?.message || s.transactionFailed);
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
      setConfirmedAmountOut(null);
      setNetworkCostUSD("");
      setIsNetworkCostLoading(false);
      setTransactionSteps([]);
      stepsRef.current = [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleDispatchBuy = () => {
    if (isSmartAccount) {
      const msg = smartAccountCheck.reason ?? s.smartAccountNotSupported;
      setIsError(true);
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (hasInsufficientGas) {
      const msg = s.insufficientGasError;
      setIsError(true);
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    handlePurchaseGlow();
  };

  // Only the orchestrator can declare success after every required leg completes.
  const isTransactionSuccessful = isSuccess;
  const displayedAmountOut = confirmedAmountOut ?? amount;

  // Transaction details for review
  const transactionDetails: TransactionDetail[] = [
    {
      label: s.youPayLabel,
      value: Number(amountToSell).toLocaleString("en-US", {
        maximumFractionDigits: 6,
      }),
      unit: selectedTokenSell.label,
    },
    {
      label: s.youReceiveLabel,
      value: Number(displayedAmountOut) ? formatPrice(displayedAmountOut, 4) : "0.00",
      unit: selectedTokenBuy.label,
    },
  ];

  // Success details
  const successDetails: TransactionDetail[] = [
    {
      label: s.sentLabel,
      value: Number(amountToSell).toLocaleString("en-US", {
        maximumFractionDigits: 6,
      }),
      unit: selectedTokenSell.label,
    },
    {
      label: s.receivedLabel,
      value: (
        <span className="text-[#4ADE80] font-mono font-medium">
          {Number(displayedAmountOut).toLocaleString("en-US", {
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
              <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest mb-1">{s.youPay}</div>
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
                {s.youReceive}
              </div>
              <div className="text-2xl font-semibold">
                {Number(displayedAmountOut) ? formatPrice(displayedAmountOut, 4) : "0.00"}{" "}
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

  // A failed multi-leg transaction must be reviewed before a new order starts;
  // never replay the entire flow from an in-dialog retry button.
  const customFooter = isError ? (
    <Button
      variant="outline"
      onClick={() => onOpenChange(false)}
      className="w-full"
    >
      {s.close}
    </Button>
  ) : !isPending && !isTransactionSuccessful ? (
    <div className="flex flex-col gap-2">
      {isSmartAccount && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-900 text-xs px-3 py-2">
          {smartAccountCheck.reason}
        </div>
      )}
      {!isSmartAccount && hasInsufficientGas && (
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2">
          {selectedTokenBuy.label === "GLOW"
            ? s.notEnoughEthSwapPurchase(
                gasShortfallEth
                  ? `~${Number(gasShortfallEth).toFixed(5)} ETH`
                  : "ETH",
              )
            : s.notEnoughEthSwap(
                gasShortfallEth
                  ? `~${Number(gasShortfallEth).toFixed(5)} ETH`
                  : "ETH",
              )}
        </div>
      )}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="flex-1"
        >
          {s.cancel}
        </Button>
        <Button
          onClick={handleDispatchBuy}
          className="flex-1"
          disabled={isPreflightBlocked || isPreflightChecking}
        >
          {isPreflightChecking ? s.checking : s.approveAndBuy}
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
      title={s.reviewSwap}
      successTitle={`+${Number(displayedAmountOut).toLocaleString("en-US", {
        maximumFractionDigits: 4,
      })} ${selectedTokenBuy.label}`}
      errorTitle={s.swapFailed}
      processingTitle={s.processingSwap}
      description={s.reviewSwapDescription}
      processingDescription={s.processingSwapDescription}
      errorDescription={errorMessage || s.swapErrorFallback}
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
              {s.viewOnEtherscan}
            </a>
          </Button>
        ) : null
      }
      confirmLabel={s.approveAndBuy}
      showImpactScoreBoost={selectedTokenBuy.label === "GLOW"}
      impactScoreBoostMessage={
        selectedTokenBuy.label === "GLOW"
          ? s.glowWorthIncreasedMessage
          : undefined
      }
      impactScoreBoostIconType={
        selectedTokenBuy.label === "GLOW" ? "glw" : "default"
      }
    />
  );
};
