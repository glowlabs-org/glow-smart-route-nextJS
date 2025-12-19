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
import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { useSwap } from "@/hooks/useSwap";
import { useEarlyLiquidityPrice } from "@/hooks/useEarlyLiquidityPrice";
import { addresses } from "@/web3/constants/addresses";
import { formatUnits, parseUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/utils/formatPrice";
import { motion } from "framer-motion";
import { waitingToSuccessVariants } from "@/animations/variants";
import clsx from "clsx";
import { GlowSymbol } from "../glow-symbol";
import { trackEvent } from "@/lib/telemetry";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount, useBalance, useChainId } from "wagmi";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";

interface BuyGlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usdcBalance: bigint | null;
  glowSpotPrice: number;
  defaultUsdcAmount?: string;
  onSuccess?: () => void;
}

type Phase = "input" | "processing" | "success" | "error";
type PayToken = "USDC" | "USDG" | "ETH";

interface PendingState {
  code: string;
  message: string;
  validated: boolean;
  pending: boolean;
}

const getInitialPendingStates = (
  payToken: PayToken,
  includeBondingStep: boolean
): PendingState[] => {
  const states: PendingState[] = [];

  if (payToken === "ETH") {
    states.push({
      code: "SWAP_ETH_TO_USDC",
      message: "Swapping ETH for USDC on Uniswap",
      validated: false,
      pending: false,
    });
  }

  if (payToken === "USDC" || payToken === "ETH") {
    states.push({
      code: "SWAP_USDC_TO_USDG",
      message: "Swapping USDC for USDG",
      validated: false,
      pending: false,
    });
  }

  states.push({
    code: "SWAP_USDG_TO_GLOW_ON_UNISWAP",
    message: "Swapping USDG for GLW on Uniswap",
    validated: false,
    pending: false,
  });

  if (includeBondingStep) {
    states.push({
      code: "PURCHASING_GLOW",
      message: "Purchasing GLW from bonding curve",
      validated: false,
      pending: false,
    });
  }

  states.push({
    code: "DONE",
    message: "Successfully purchased GLW",
    validated: false,
    pending: false,
  });

  return states;
};

export function BuyGlowDialog({
  open,
  onOpenChange,
  usdcBalance,
  glowSpotPrice,
  defaultUsdcAmount,
  onSuccess,
}: BuyGlowDialogProps) {
  const [phase, setPhase] = React.useState<Phase>("input");
  const [payToken, setPayToken] = React.useState<PayToken>("USDC");
  const [inputAmount, setInputAmount] = React.useState<string>(
    defaultUsdcAmount ?? ""
  );
  const [smartAmounts, setSmartAmounts] =
    React.useState<SmartBalancingAmounts>();
  const [estimatedGlw, setEstimatedGlw] = React.useState<string>("");
  const [lastEstimatedAmount, setLastEstimatedAmount] =
    React.useState<string>("");
  const [pendingStates, setPendingStates] = React.useState<PendingState[]>([]);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const hasPrefilledForOpenRef = React.useRef(false);
  const wasOpenRef = React.useRef(false);
  const { address } = useAccount();
  const chainId = useChainId();

  const {
    getSmartBalancingAmounts,
    purchaseGlowEarlyLiquidity,
    getGlowQuoteEarlyLiquidity,
    resetGlowPurchaseState,
    lastTxHashRef: glowLastTxHashRef,
    resetLastTxHash: resetGlowLastTxHash,
  } = usePurchaseGlow();

  const { swapUSDCToUSDG, lastTxHashRef: usdcToUsdgLastTxHashRef, resetLastTxHash: resetUsdcToUsdgLastTxHash } =
    useSwapUSDCToUSDG();
  const { estimateEthToUsdc, estimateGasForSwapEthToUsdc, swapEthToUsdc } =
    useSwapETHToUSDC();

  const {
    swap: swapUsdGToGlow,
    resetUniswapPurchaseState,
    lastTxHashRef: uniswapLastTxHashRef,
    resetLastTxHash: resetUniswapLastTxHash,
  } = useSwap({
    tokenA_address: addresses.usdg,
    tokenB_address: addresses.glow,
  });

  const { currentPrice: earlyLiquidityCurrentPrice } = useEarlyLiquidityPrice();

  const usdcBalanceFormatted = React.useMemo(
    () =>
      usdcBalance ? formatUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC) : "0",
    [usdcBalance]
  );

  const { usdgBalance } = useWalletTokenBalances(address);

  const usdgBalanceFormatted = React.useMemo(() => {
    if (!usdgBalance) return "0";
    return formatUnits(usdgBalance, DECIMALS_BY_TOKEN.USDG);
  }, [usdgBalance]);

  const isEthPayEnabled = chainId === 1;
  const ethBalanceQuery = useBalance({
    address,
    query: {
      enabled: Boolean(open && address && payToken === "ETH" && isEthPayEnabled),
    },
  });

  const ethBalanceFormatted = React.useMemo(() => {
    if (!ethBalanceQuery.data?.value) return "0";
    // wagmi formats as 18 decimals for native ETH
    return ethBalanceQuery.data.formatted;
  }, [ethBalanceQuery.data?.formatted, ethBalanceQuery.data?.value]);

  const availablePayBalanceFormatted = React.useMemo(() => {
    if (payToken === "USDC") return usdcBalanceFormatted;
    if (payToken === "USDG") return usdgBalanceFormatted;
    return ethBalanceFormatted;
  }, [ethBalanceFormatted, payToken, usdcBalanceFormatted, usdgBalanceFormatted]);

  const payTokenLabel = payToken;

  const ethBalanceWei = ethBalanceQuery.data?.value ?? null;

  const formatEthMaxFromWei = React.useCallback((valueWei: bigint) => {
    const raw = formatUnits(valueWei, 18);
    const [i, f = ""] = raw.split(".");
    const trimmed = f.slice(0, 6);
    return trimmed ? `${i}.${trimmed}` : i;
  }, []);

  // Debounced estimate calculation using callback pattern
  const estimateRunner = React.useCallback(
    async (amount: string, signal: AbortSignal) => {
      if (!amount || Number(amount) <= 0) {
        return { estimatedGlw: "", smartAmounts: undefined, forAmount: "" };
      }

      let usdgEquivalent = amount;
      if (payToken === "ETH") {
        if (!isEthPayEnabled) {
          return { estimatedGlw: "", smartAmounts: undefined, forAmount: "" };
        }
        const amountInWei = parseUnits(amount, 18);
        const quoteRes = await estimateEthToUsdc({
          amountInWei,
          slippageBps: BigInt(100),
        });
        if (!quoteRes.ok) {
          return { estimatedGlw: "", smartAmounts: undefined, forAmount: "" };
        }
        usdgEquivalent = formatUnits(quoteRes.val.amountOutUsdc, 6);
      }

      const result = await getSmartBalancingAmounts({
        amountUsdgIn: usdgEquivalent,
        earlyLiquidityCurrentPrice,
      });

      if (signal.aborted)
        return { estimatedGlw: "", smartAmounts: undefined, forAmount: "" };

      if (result.ok) {
        const amounts = result.val;
        const uniswapOut = Number(amounts.amount_out_uni || "0");
        const bondingOut = Number(amounts.amount_out_glow || "0");
        const totalOut = uniswapOut + bondingOut;

        return {
          estimatedGlw: totalOut.toString(),
          smartAmounts: amounts,
          forAmount: amount,
        };
      }

      return { estimatedGlw: "", smartAmounts: undefined, forAmount: "" };
    },
    [
      estimateEthToUsdc,
      getSmartBalancingAmounts,
      earlyLiquidityCurrentPrice,
      isEthPayEnabled,
      payToken,
    ]
  );

  const handleEstimateResult = React.useCallback(
    (result: {
      estimatedGlw: string;
      smartAmounts: SmartBalancingAmounts | undefined;
      forAmount: string;
    }) => {
      setEstimatedGlw(result.estimatedGlw);
      setSmartAmounts(result.smartAmounts);
      setLastEstimatedAmount(result.forAmount);
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

  React.useEffect(() => {
    if (open && !wasOpenRef.current) trackEvent("buy_glw_dialog_open");
    if (!open && wasOpenRef.current) trackEvent("buy_glw_dialog_close");
    wasOpenRef.current = open;
  }, [open]);

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

  const handlePayTokenChange = React.useCallback(
    (next: PayToken) => {
      setPayToken(next);
      hasPrefilledForOpenRef.current = false;
      setInputAmount("");
      setEstimatedGlw("");
      setSmartAmounts(undefined);
      setLastEstimatedAmount("");
      setTxHash(null);
      setErrorMessage(null);
      setPendingStates([]);

      trackEvent("buy_glw_pay_token_change", { pay_token: next });

      if (next === "USDC" && defaultUsdcAmount) {
        // Don’t auto-run estimate unless dialog is open and user is on input phase.
        if (open && phase === "input") {
          hasPrefilledForOpenRef.current = true;
          handleInputChange(defaultUsdcAmount);
        }
      }
    },
    [defaultUsdcAmount, handleInputChange, open, phase]
  );

  React.useEffect(() => {
    if (!open) {
      hasPrefilledForOpenRef.current = false;
      return;
    }
    if (hasPrefilledForOpenRef.current) return;
    if (phase !== "input") return;
    if (inputAmount) return; // never overwrite manual edits

    if (!defaultUsdcAmount) return;
    if (payToken !== "USDC") return;
    hasPrefilledForOpenRef.current = true;
    handleInputChange(defaultUsdcAmount);
  }, [open, defaultUsdcAmount, phase, inputAmount, handleInputChange, payToken]);

  const pricePerGlw = React.useMemo(() => {
    if (payToken === "ETH") return null;
    if (!inputAmount || !estimatedGlw || Number(estimatedGlw) === 0)
      return null;
    return Number(inputAmount) / Number(estimatedGlw);
  }, [inputAmount, estimatedGlw, payToken]);

  const setPendingStatePending = React.useCallback((code: string) => {
    setPendingStates((prev) => {
      const index = prev.findIndex((state) => state.code === code);
      if (index === -1) return prev;

      return prev.map((state, i) => {
        if (i < index) {
          return { ...state, pending: false, validated: true };
        }
        if (i === index) {
          return { ...state, pending: true, validated: false };
        }
        return { ...state, pending: false };
      });
    });
  }, []);

  const completePendingStates = React.useCallback(
    (codes: string | string[]) => {
      const codeList = Array.isArray(codes) ? codes : [codes];
      setPendingStates((prev) =>
        prev.map((state) =>
          codeList.includes(state.code)
            ? { ...state, pending: false, validated: true }
            : state
        )
      );
    },
    []
  );

  const handleBuyGlow = React.useCallback(async () => {
    if (!inputAmount || Number(inputAmount) <= 0 || !smartAmounts) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (inputAmount !== lastEstimatedAmount) {
      toast.error("Price estimate is updating. Please wait and try again.");
      return;
    }

    try {
      let effectiveSmartAmounts: SmartBalancingAmounts = smartAmounts;

      const bondingAllocationInitial =
        effectiveSmartAmounts.amount_in_glow_bonding_curve ?? BigInt(0);
      const bondingOutputInitial = Number(effectiveSmartAmounts.amount_out_glow || "0");
      const hasBondingOutputInitial =
        bondingAllocationInitial > BigInt(0) && bondingOutputInitial > 0;

      setPhase("processing");
      setPendingStates(
        getInitialPendingStates(
          payToken,
          payToken === "ETH" ? true : hasBondingOutputInitial
        )
      );

      trackEvent("buy_glw_submit_click", {
        pay_token: payToken,
        pay_amount: inputAmount,
        usdc_amount: payToken === "USDC" ? inputAmount : undefined,
        usdc_balance: usdcBalanceFormatted,
        usdg_balance: usdgBalanceFormatted,
        has_bonding_step: hasBondingOutputInitial,
      });

      let usdcAmountToSwapToUsdg: bigint | null = null;

      if (payToken === "ETH") {
        if (!isEthPayEnabled) throw new Error("ETH pay is only supported on mainnet.");

        setPendingStatePending("SWAP_ETH_TO_USDC");
        const swapEthRes = await swapEthToUsdc({
          amountInWei: parseUnits(inputAmount, 18),
          slippageBps: BigInt(100),
        });
        if (!swapEthRes.ok) {
          trackEvent("buy_glw_step_result", {
            step: "swap_eth_to_usdc",
            ok: false,
            error_message: String(swapEthRes.val),
          });
          throw new Error(String(swapEthRes.val));
        }
        trackEvent("buy_glw_step_result", { step: "swap_eth_to_usdc", ok: true });
        completePendingStates("SWAP_ETH_TO_USDC");
        setTxHash(swapEthRes.val.txHash);

        usdcAmountToSwapToUsdg = swapEthRes.val.usdcReceived;

        // Recompute smart amounts based on actual USDC received (avoids stale quote drift)
        const usdcReceivedFormatted = formatUnits(usdcAmountToSwapToUsdg, 6);
        const recomputeRes = await getSmartBalancingAmounts({
          amountUsdgIn: usdcReceivedFormatted,
          earlyLiquidityCurrentPrice,
        });
        if (!recomputeRes.ok) throw new Error(String(recomputeRes.val));
        effectiveSmartAmounts = recomputeRes.val;

        const bondingAllocation =
          effectiveSmartAmounts.amount_in_glow_bonding_curve ?? BigInt(0);
        const bondingOutput = Number(effectiveSmartAmounts.amount_out_glow || "0");
        const hasBondingOutput = bondingAllocation > BigInt(0) && bondingOutput > 0;
        const uniswapOut = Number(effectiveSmartAmounts.amount_out_uni || "0");
        const bondingOut = Number(effectiveSmartAmounts.amount_out_glow || "0");
        setEstimatedGlw((uniswapOut + bondingOut).toString());
        setPendingStates((prev) => {
          const hasBondingState = prev.some((s) => s.code === "PURCHASING_GLOW");
          if (hasBondingOutput && !hasBondingState) {
            const doneIndex = prev.findIndex((s) => s.code === "DONE");
            const next = [...prev];
            const insertAt = doneIndex === -1 ? next.length : doneIndex;
            next.splice(insertAt, 0, {
              code: "PURCHASING_GLOW",
              message: "Purchasing GLW from bonding curve",
              validated: false,
              pending: false,
            });
            return next;
          }
          if (!hasBondingOutput && hasBondingState) {
            return prev.filter((s) => s.code !== "PURCHASING_GLOW");
          }
          return prev;
        });
      }

      if (payToken === "USDC") {
        usdcAmountToSwapToUsdg = parseUnits(inputAmount, DECIMALS_BY_TOKEN.USDC as number);
      }

      if (usdcAmountToSwapToUsdg) {
        setPendingStatePending("SWAP_USDC_TO_USDG");
        const swapUsdcResult = await swapUSDCToUSDG(usdcAmountToSwapToUsdg);
        if (!swapUsdcResult.ok) {
          trackEvent("buy_glw_step_result", {
            step: "swap_usdc_to_usdg",
            ok: false,
            error_message: String(swapUsdcResult.val),
          });
          throw new Error(String(swapUsdcResult.val));
        }
        trackEvent("buy_glw_step_result", {
          step: "swap_usdc_to_usdg",
          ok: true,
        });
        completePendingStates("SWAP_USDC_TO_USDG");
        if (usdcToUsdgLastTxHashRef.current)
          setTxHash(usdcToUsdgLastTxHashRef.current);
      }

      const bondingAllocation =
        effectiveSmartAmounts.amount_in_glow_bonding_curve ?? BigInt(0);
      const bondingOutput = Number(effectiveSmartAmounts.amount_out_glow || "0");
      const hasBondingOutput = bondingAllocation > BigInt(0) && bondingOutput > 0;
      const finalUniswapOut = Number(effectiveSmartAmounts.amount_out_uni || "0");
      const finalBondingOut = Number(effectiveSmartAmounts.amount_out_glow || "0");
      const finalEstimatedGlw = (finalUniswapOut + finalBondingOut).toString();

      const hasUniswapAllocation = effectiveSmartAmounts.amount_in_uni > BigInt(0);
      if (hasUniswapAllocation) {
        setPendingStatePending("SWAP_USDG_TO_GLOW_ON_UNISWAP");
        const uniswapResult = await swapUsdGToGlow({
          amount: effectiveSmartAmounts.amount_in_uni,
          slippagePercentTenThousandDenominator: BigInt(100),
        });
        if (!uniswapResult.ok) {
          trackEvent("buy_glw_step_result", {
            step: "swap_usdg_to_glw_uniswap",
            ok: false,
            error_message: String(uniswapResult.val),
          });
          throw new Error(String(uniswapResult.val));
        }
        trackEvent("buy_glw_step_result", {
          step: "swap_usdg_to_glw_uniswap",
          ok: true,
        });
        completePendingStates("SWAP_USDG_TO_GLOW_ON_UNISWAP");
        if (uniswapLastTxHashRef.current) setTxHash(uniswapLastTxHashRef.current);
      } else {
        completePendingStates("SWAP_USDG_TO_GLOW_ON_UNISWAP");
      }

      if (hasBondingOutput) {
        setPendingStatePending("PURCHASING_GLOW");
        const incrementsToPurchase = Math.floor(bondingOutput * 100);
        const quoteResult = await getGlowQuoteEarlyLiquidity(
          incrementsToPurchase
        );
        if (!quoteResult.ok) {
          trackEvent("buy_glw_step_result", {
            step: "purchase_glw_bonding",
            ok: false,
            error_message: String(quoteResult.val),
          });
          throw new Error(String(quoteResult.val));
        }

        if (quoteResult.val > bondingAllocation) {
          console.warn(
            "Skipping bonding curve purchase due to insufficient USDG allocation",
            {
              bondingAllocation: bondingAllocation.toString(),
              bondingQuote: quoteResult.val.toString(),
            }
          );
          completePendingStates("PURCHASING_GLOW");
          trackEvent("buy_glw_step_result", {
            step: "purchase_glw_bonding",
            ok: true,
            skipped: true,
          });
        } else {
          const purchaseResult = await purchaseGlowEarlyLiquidity({
            incrementsToPurchase,
            slippagePointsTenThousandths: BigInt(100),
          });
          if (!purchaseResult.ok) {
            trackEvent("buy_glw_step_result", {
              step: "purchase_glw_bonding",
              ok: false,
              error_message: String(purchaseResult.val),
            });
            throw new Error(String(purchaseResult.val));
          }
          completePendingStates("PURCHASING_GLOW");
          trackEvent("buy_glw_step_result", {
            step: "purchase_glw_bonding",
            ok: true,
            skipped: false,
          });
          if (glowLastTxHashRef.current) setTxHash(glowLastTxHashRef.current);
        }
      }

      setPendingStatePending("DONE");
      completePendingStates("DONE");

      setPhase("success");
      toast.success("Successfully purchased GLW!");
      trackEvent("buy_glw_success", {
        pay_token: payToken,
        pay_amount: inputAmount,
        estimated_glw: finalEstimatedGlw,
        has_bonding_step: hasBondingOutput,
      });
      onSuccess?.();
    } catch (error: any) {
      console.error("Purchase failed:", error);
      setPhase("error");
      setErrorMessage(error?.message || "Transaction failed");
      setPendingStates((prev) =>
        prev.map((state) => ({ ...state, pending: false }))
      );
      toast.error(error?.message || "Failed to purchase GLW");
      trackEvent("buy_glw_error", {
        error_message: error?.message || "Failed to purchase GLW",
      });
    }
  }, [
    earlyLiquidityCurrentPrice,
    estimateEthToUsdc,
    getSmartBalancingAmounts,
    inputAmount,
    smartAmounts,
    lastEstimatedAmount,
    payToken,
    swapUSDCToUSDG,
    swapUsdGToGlow,
    swapEthToUsdc,
    purchaseGlowEarlyLiquidity,
    getGlowQuoteEarlyLiquidity,
    setPendingStatePending,
    completePendingStates,
    onSuccess,
    estimatedGlw,
    usdcBalanceFormatted,
    usdgBalanceFormatted,
    isEthPayEnabled,
  ]);

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
    hasPrefilledForOpenRef.current = false;
    // setTimeout needed for dialog close animation to complete before resetting state
    setTimeout(() => {
      setPhase("input");
      setPayToken("USDC");
      setInputAmount("");
      setEstimatedGlw("");
      setSmartAmounts(undefined);
      setLastEstimatedAmount("");
      setPendingStates([]);
      setTxHash(null);
      setErrorMessage(null);
      resetUsdcToUsdgLastTxHash();
      resetUniswapLastTxHash();
      resetGlowLastTxHash();
      resetGlowPurchaseState();
      resetUniswapPurchaseState();
    }, 300);
  }, [
    onOpenChange,
    resetGlowLastTxHash,
    resetGlowPurchaseState,
    resetUniswapLastTxHash,
    resetUniswapPurchaseState,
    resetUsdcToUsdgLastTxHash,
  ]);

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
    resetGlowPurchaseState();
    resetUniswapPurchaseState();
  }, [resetGlowPurchaseState, resetUniswapPurchaseState]);

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
        className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-sm w-full border-border shadow-2xl overflow-hidden"
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

        <div className="px-6 py-8 max-h-[80vh] overflow-y-auto">
          {phase === "input" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="text-2xl font-bold text-foreground mb-2">
                  Buy GLW
                </div>
                <div className="text-muted-foreground text-sm">
                  {payToken === "ETH"
                    ? "Enter the amount of ETH you want to spend"
                    : `Enter the amount of ${payTokenLabel} you want to spend`}
                </div>
              </div>

              <div className="relative mb-6 text-left">
                {/* You Pay Section */}
                <div className="bg-secondary/50 backdrop-blur-sm border border-border rounded-2xl p-5 mb-2">
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
                        onClick={async () => {
                          trackEvent("buy_glw_max_click", {
                            pay_token: payToken,
                            pay_balance: availablePayBalanceFormatted,
                          });
                          if (payToken === "ETH") {
                            if (!ethBalanceWei) return;
                            try {
                              const probeWei =
                                ethBalanceWei > parseUnits("0.05", 18)
                                  ? parseUnits("0.05", 18)
                                  : ethBalanceWei;
                              const gasRes = await estimateGasForSwapEthToUsdc({
                                amountInWei: probeWei,
                                slippageBps: BigInt(100),
                              });
                              const feeWei = gasRes.ok
                                ? gasRes.val.estimatedFeeWei
                                : BigInt(0);
                              const bufferedFeeWei =
                                (feeWei * BigInt(12)) / BigInt(10); // +20%
                              const maxSpendWei =
                                ethBalanceWei > bufferedFeeWei
                                  ? ethBalanceWei - bufferedFeeWei
                                  : BigInt(0);
                              handleInputChange(formatEthMaxFromWei(maxSpendWei));
                            } catch (e: any) {
                              toast.error(
                                e?.message || "Failed to compute max ETH amount"
                              );
                            }
                            return;
                          }
                          handleInputChange(availablePayBalanceFormatted);
                        }}
                        className="h-9 px-3 text-xs font-medium hover:bg-secondary"
                      >
                        MAX
                      </Button>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <Input
                        id="buy-amount"
                        type="text"
                        placeholder="0.00"
                        value={inputAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^\d*\.?\d*$/.test(value)) {
                            handleInputChange(value);
                          }
                        }}
                        className={clsx(
                          "text-lg sm:text-xl lg:text-2xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 w-full",
                          Number(inputAmount) >
                            Number(availablePayBalanceFormatted) &&
                            "text-destructive"
                        )}
                      />
                      <div className="shrink-0">
                        <Select
                          value={payToken}
                          onValueChange={(v) =>
                            handlePayTokenChange(v as PayToken)
                          }
                        >
                          <SelectTrigger className="h-10 w-[110px] rounded-xl border-border bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USDC">USDC</SelectItem>
                            <SelectItem value="USDG">USDG</SelectItem>
                            {isEthPayEnabled && (
                              <SelectItem value="ETH">ETH</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div
                      className={clsx(
                        "text-sm",
                        Number(inputAmount) >
                          Number(availablePayBalanceFormatted)
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      Available:{" "}
                      {payToken === "ETH"
                        ? toFixedTruncate(
                            Number(availablePayBalanceFormatted || "0"),
                            4
                          )
                        : Number(availablePayBalanceFormatted).toLocaleString(
                            "en-US",
                            {
                              maximumFractionDigits: 2,
                            }
                          )}{" "}
                      {payTokenLabel}
                    </div>
                    {Number(availablePayBalanceFormatted) === 0 && (
                      <div className="text-sm text-muted-foreground">
                        You need {payTokenLabel} in this wallet to buy GLW.
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow - positioned between boxes */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 z-10">
                  <div className="bg-background rounded-full p-2 border border-border shadow-sm">
                    <ArrowDown className="w-6 h-6 text-muted-foreground" />
                  </div>
                </div>

                {/* You Receive Section */}
                <div className="bg-secondary/50 backdrop-blur-sm border border-border rounded-2xl p-5">
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-muted-foreground">
                      You receive (estimated)
                    </div>
                    <div className="flex items-baseline gap-2">
                      {isEstimating ? (
                        <Skeleton className="h-8 w-32" />
                      ) : (
                        <>
                          <div className="text-lg sm:text-xl lg:text-2xl font-bold">
                            {estimatedGlw && Number(estimatedGlw) > 0
                              ? formatPrice(estimatedGlw, 4)
                              : "0.00"}
                          </div>
                          <span className="text-lg sm:text-xl font-medium text-muted-foreground shrink-0">
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
                    Number(inputAmount) > Number(availablePayBalanceFormatted) ||
                    !estimatedGlw ||
                    isEstimating ||
                    inputAmount !== lastEstimatedAmount
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

              {/* Transaction Progress */}
              <div className="space-y-5 mb-6 text-left">
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
                <div className="flex items-center justify-center mb-4">
                  <GlowSymbol className="size-14" />
                </div>
                <div className="text-4xl font-bold text-foreground mb-2">
                  +
                  {Number(estimatedGlw).toLocaleString("en-US", {
                    maximumFractionDigits: 4,
                  })}{" "}
                  GLW
                </div>
              </div>

              <div className="inline-flex items-center px-4 py-2 bg-secondary/50 backdrop-blur-sm border border-border rounded-full mb-6">
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

              <div className="space-y-4 mb-6 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Sent</span>
                  <div className="text-right">
                    <span className="text-foreground text-sm font-mono">
                      {Number(inputAmount).toLocaleString("en-US", {
                        maximumFractionDigits: 6,
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {payTokenLabel}
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
                          className="p-2 hover:bg-muted rounded transition-colors"
                        >
                          <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
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
            <div className="text-center space-y-6">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-destructive" />
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
