import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { ArrowLeftRight, Check, Loader2, ArrowDown } from "lucide-react";
import { waitingToSuccessVariants } from "@/animations/variants";
import { motion } from "framer-motion";
import React, { FC, useEffect } from "react";
import { formatPrice } from "@/utils/formatPrice";
import clsx from "clsx";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useSwap } from "@/hooks/useSwap";

import { useUSDGRedemption } from "@/hooks/useUSDGRedemption";
import { useEthGasPreflight } from "@/hooks/useEthGasPreflight";
import { useSmartAccountCheck } from "@/hooks/useSmartAccountCheck";
import { addresses } from "@/web3/constants/addresses";
import { formatUnits, parseUnits, type Address } from "viem";
import { useLang, type Strings } from "@/lib/i18n";
import { estimateSwapGasUnits } from "@/lib/transaction-gas";
import { useTransactionOperationGuard } from "@/hooks/useTransactionOperationGuard";
import { getTransactionOperationCancellation } from "@/lib/transaction-operation";
import { trackEvent } from "@/lib/telemetry";
import type { WalletRequestObserver } from "@/lib/wallet-request";
import type { SmartAccountPreflight } from "@/web3/web3/utils/detectSmartAccount";

type SwapLabels = Strings["swap"];

const buildPendingStatesUsdg = (s: SwapLabels): PendingState[] => [
  {
    code: "REQUESTING_GLOW_APPROVAL",
    message: s.stepRequestingGlowApproval,
    validated: false,
    pending: false,
  },
  {
    code: "APPROVING_GLOW",
    message: s.stepApprovingGlow,
    validated: false,
    pending: false,
  },
  {
    code: "SWAPPING_GLOW_TO_USDG",
    message: s.stepSwappingGlowToUsdg,
    validated: false,
    pending: false,
  },
  {
    code: "DONE",
    message: s.stepSwapDoneToUsdg,
    validated: false,
    pending: false,
  },
];

const buildPendingStatesUsdc = (s: SwapLabels): PendingState[] => [
  {
    code: "REQUESTING_GLOW_APPROVAL",
    message: s.stepRequestingGlowApproval,
    validated: false,
    pending: false,
  },
  {
    code: "APPROVING_GLOW",
    message: s.stepApprovingGlow,
    validated: false,
    pending: false,
  },
  {
    code: "SWAPPING_GLOW_TO_USDG",
    message: s.stepSwappingGlowToUsdg,
    validated: false,
    pending: false,
  },
  {
    code: "REQUESTING_USDG_APPROVAL",
    message: s.stepRequestingUsdgApproval,
    validated: false,
    pending: false,
  },
  {
    code: "APPROVING_USDG",
    message: s.stepApprovingUsdg,
    validated: false,
    pending: false,
  },
  {
    code: "REDEEMING_USDG_FOR_USDC",
    message: s.stepRedeemingUsdgForUsdc,
    validated: false,
    pending: false,
  },
  {
    code: "DONE",
    message: s.stepSwapDoneToUsdc,
    validated: false,
    pending: false,
  },
];

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
  targetToken: "USDC" | "USDG",
  s: SwapLabels,
): PendingState[] => {
  if (targetToken === "USDG") return buildPendingStatesUsdg(s);
  return buildPendingStatesUsdc(s);
};

export const GlowToUsdcDialog: FC<{
  isOpen: boolean;
  amountToSell: string;
  estimatedOutputAmount: string;
  minimumUsdgOut: bigint;
  slippageBps: bigint;
  quoteExpiresAt: number;
  expectedAccount: Address;
  smartAccountPreflight?: SmartAccountPreflight;
  targetToken?: "USDC" | "USDG";
  onOpenChange: (open: boolean) => void;
}> = ({
  isOpen,
  onOpenChange,
  amountToSell,
  estimatedOutputAmount,
  minimumUsdgOut,
  slippageBps,
  quoteExpiresAt,
  expectedAccount,
  smartAccountPreflight,
  targetToken = "USDC",
}) => {
  const { t } = useLang();
  const s = t.swap;
  const [isPending, setIsPending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [networkCostUSD, setNetworkCostUSD] = React.useState<string>("");
  const [isNetworkCostLoading, setIsNetworkCostLoading] = React.useState(false);
  const [pendingStates, setPendingStates] = React.useState<PendingState[]>(() =>
    getDefaultPendingStates(targetToken, s),
  );
  const [currentState, setCurrentState] =
    React.useState<GlowToUsdcState>("NONE");
  const [intermediateUsdgAmount, setIntermediateUsdgAmount] =
    React.useState<string>("");
  const [actualOutputAmount, setActualOutputAmount] =
    React.useState<string>("");
  const beginTransactionOperation = useTransactionOperationGuard(isOpen);

  const {
    swapGlowToUSDG,
    uniswapPurchaseState,
    resetUniswapPurchaseState,
  } = useSwap({
    tokenA_address: addresses.glow,
    tokenB_address: addresses.usdg,
  });

  const { redeemUSDGForUSDC } = useUSDGRedemption();

  // Pre-flight: make sure the user has enough ETH for the FULL flow BEFORE
  // they sign anything. Budgeting just the first leg strands users on the
  // second (USDG approve + redeem) when they paid enough for approve + swap
  // but nothing more.
  const totalGasUnits = estimateSwapGasUnits({
    sellToken: "GLOW",
    buyToken: targetToken,
  });
  const gasPreflight = useEthGasPreflight({
    estimatedGasUnits: totalGasUnits,
    safetyBps: 1_500,
    enabled: isOpen && !isPending && !isSuccess,
  });
  const hasInsufficientGas = gasPreflight.sufficient === false;
  const gasShortfallEth =
    gasPreflight.shortfallWei != null
      ? formatUnits(gasPreflight.shortfallWei, 18)
      : null;

  // Smart-account preflight: MetaMask's "pay gas with USDC" feature silently
  // upgrades EOAs to smart accounts via EIP-7702 delegation. Once that
  // happens, users can't interact with Glow contracts that require a plain
  // EOA signer. Detect early and show a clear fix path.
  const smartAccountCheck = useSmartAccountCheck({
    enabled: isOpen && !isPending && !isSuccess,
    preflight: smartAccountPreflight,
  });
  const isSmartAccount = smartAccountCheck.isBlocked;

  const isPreflightBlocked = hasInsufficientGas || isSmartAccount;
  const isPreflightChecking =
    gasPreflight.isChecking || smartAccountCheck.isChecking;

  const handleSwapGlowToTarget = async () => {
    if (isSmartAccount) {
      const msg = smartAccountCheck.reason ?? s.smartAccountNotSupported;
      setCurrentState("ERROR");
      setIsError(true);
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (hasInsufficientGas) {
      const msg = s.insufficientGasError;
      setCurrentState("ERROR");
      setIsError(true);
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    const operation = beginTransactionOperation();
    if (!operation) return;
    const { assertActive: assertTransactionActive } = operation;

    setIsPending(true);
    setIsError(false);
    setIsSuccess(false);
    setErrorMessage(null);
    setCurrentState("NONE");

    const walletRequest: WalletRequestObserver = {
      onEvent: (event) => {
        assertTransactionActive();
        const action = event.action ?? "";
        let nextState: GlowToUsdcState | null = null;

        if (action === "approve_glw") {
          nextState =
            event.phase === "dispatched"
              ? "REQUESTING_GLOW_APPROVAL"
              : event.phase === "resolved"
                ? "APPROVING_GLOW"
                : null;
        } else if (
          action === "swap_glw_to_usdg" &&
          (event.phase === "dispatched" || event.phase === "resolved")
        ) {
          nextState = "SWAPPING_GLOW_TO_USDG";
        } else if (action === "approve_usdg") {
          nextState =
            event.phase === "dispatched"
              ? "REQUESTING_USDG_APPROVAL"
              : event.phase === "resolved"
                ? "APPROVING_USDG"
                : null;
        } else if (
          action === "redeem_usdg_for_usdc" &&
          (event.phase === "dispatched" || event.phase === "resolved")
        ) {
          nextState = "REDEEMING_USDG_FOR_USDC";
        }

        if (nextState) {
          setCurrentState(nextState);
          updatePendingStates(nextState);
        }
        trackEvent("wallet_request_lifecycle", {
          flow: "glow_exit_dialog",
          action: event.action ?? null,
          request_phase: event.phase,
          wallet_method: event.method,
          request_id: event.requestId,
          elapsed_ms: event.elapsedMs,
          sell_token: "GLOW",
          buy_token: targetToken,
        });
      },
    };

    try {
      if (Date.now() > quoteExpiresAt) {
        throw new Error("This quote expired. Close the dialog to refresh it.");
      }
      const amountIn = parseUnits(amountToSell, 18); // GLOW has 18 decimals

      // Step 1: Swap GLOW to USDG
      const swapRes = await swapGlowToUSDG({
        amount: amountIn,
        slippagePercentTenThousandDenominator: slippageBps,
        minimumAmountOut: minimumUsdgOut,
        expectedAccount,
        assertTransactionActive,
        smartAccountPreflight: smartAccountCheck.preflight ?? undefined,
        walletRequest,
      });
      assertTransactionActive();

      if (!swapRes.ok) {
        setCurrentState("ERROR");
        setIsError(true);
        setErrorMessage(swapRes.val);
        toast.error(swapRes.val);
        setIsPending(false);
        return;
      }

      setTxHash(swapRes.val.txHash);
      const actualUsdgAmount = formatUnits(swapRes.val.usdgReceived, 6);
      setIntermediateUsdgAmount(actualUsdgAmount);

      // If target is USDG, we're done
      if (targetToken === "USDG") {
        setActualOutputAmount(actualUsdgAmount);
        setCurrentState("DONE");
        updatePendingStates("DONE");
        setIsPending(false);
        setIsSuccess(true);
        return;
      }

      // Step 2: Redeem USDG for USDC
      const usdgAmount = swapRes.val.usdgReceived;

      const redeemRes = await redeemUSDGForUSDC(usdgAmount, {
        expectedAccount,
        prerequisiteTxHashes: [swapRes.val.txHash],
        assertTransactionActive,
        smartAccountPreflight: smartAccountCheck.preflight ?? undefined,
        walletRequest,
      });
      assertTransactionActive();

      if (redeemRes.ok) {
        const actualUsdcAmount = formatUnits(redeemRes.val.usdcReceived, 6);
        setCurrentState("DONE");
        updatePendingStates("DONE");
        setActualOutputAmount(actualUsdcAmount);
        setTxHash(redeemRes.val.txHash);
        setIsSuccess(true);
      } else {
        setCurrentState("ERROR");
        setIsError(true);
        setErrorMessage(redeemRes.val);
        toast.error(redeemRes.val);
      }

      setIsPending(false);
    } catch (error: any) {
      if (
        getTransactionOperationCancellation(error, assertTransactionActive)
      ) {
        return;
      }
      setCurrentState("ERROR");
      setIsPending(false);
      setIsError(true);
      setErrorMessage(error?.message || s.transactionFailed);
      setTxHash(error?.txHash ?? null);
      toast.error(error?.message || s.transactionFailed);
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
      setPendingStates(getDefaultPendingStates(targetToken, s));
      setCurrentState("NONE");
      setIntermediateUsdgAmount("");
      setActualOutputAmount("");
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
      setPendingStates(getDefaultPendingStates(targetToken, s));
    }
  }, [isOpen, s, targetToken]);

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
  const successAmount = actualOutputAmount || estimatedOutputAmount;

  // Transaction details for review
  const transactionDetails: TransactionDetail[] = [
    {
      label: s.youPayLabel,
      value: Number(amountToSell).toLocaleString("en-US", {
        maximumFractionDigits: 6,
      }),
      unit: "GLOW",
    },
    {
      label: s.youReceiveLabel,
      value: Number(estimatedOutputAmount)
        ? formatPrice(estimatedOutputAmount, 6)
        : "0.00",
      unit: targetToken,
    },
  ];

  // Success details
  const successDetails: TransactionDetail[] = [
    {
      label: s.sentLabel,
      value: Number(amountToSell).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      }),
      unit: "GLOW",
    },
    ...(intermediateUsdgAmount && targetToken === "USDC"
      ? [
          {
            label: s.viaLabel,
            value: Number(intermediateUsdgAmount).toLocaleString("en-US", {
              maximumFractionDigits: 6,
            }),
            unit: "USDG",
          },
        ]
      : []),
    {
      label: s.receivedLabel,
      value: (
        <span className="text-[#4ADE80] font-mono font-medium">
          {formatPrice(successAmount, 6)}
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
              <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest mb-1">{s.youPay}</div>
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
                {s.youReceive}
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
              {s.transactionProgress}
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

  // A failed multi-leg flow may already have confirmed an earlier leg. Do not
  // offer a blind retry that could repeat it; closing forces a fresh quote.
  const customFooter = isError ? (
    <div className="flex">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        className="w-full"
      >
        {s.close}
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
          {targetToken === "USDG"
            ? s.notEnoughEthSwap(
                gasShortfallEth
                  ? `~${Number(gasShortfallEth).toFixed(5)} ETH`
                  : "ETH",
              )
            : s.notEnoughEthRedemption(
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
          onClick={handleSwapGlowToTarget}
          className="flex-1"
          disabled={isPreflightBlocked || isPreflightChecking}
        >
          {isPreflightChecking ? s.checking : s.approveAndSwap}
        </Button>
      </div>
    </div>
  ) : undefined;

  return (
    <TransactionDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      isSubmitting={isPending}
      isSuccess={isTransactionSuccessful}
      isError={isError}
      title={s.reviewSwap}
      successTitle={`+${Number(successAmount).toLocaleString("en-US", {
        maximumFractionDigits: 6,
      })} ${targetToken}`}
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
      confirmLabel={s.approveAndSwap}
    />
  );
};
