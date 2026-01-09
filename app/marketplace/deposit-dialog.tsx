"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TransactionDetail } from "@/components/dialogs/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Loader2, X, Coins, Share2 } from "lucide-react";
import { GlowSymbol } from "@/components/glow-symbol";
import { cn } from "@/lib/utils";
import { useAccount, useChainId } from "wagmi";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { SegmentedCircleProgress } from "@/components/ui/circle-progress";
import { formatNumber } from "./utils";
import { formatUnits, parseUnits } from "viem";
import {
  DECIMALS_BY_TOKEN,
  useOffchainFractions,
} from "@glowlabs-org/utils/browser";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useSponsorApplication, type AuctionApplication } from "@/hooks";
import { ConnectButton } from "@/components/connect-button";
import { trackEvent } from "@/lib/telemetry";
import { AnimatePresence, motion } from "framer-motion";
import { getSmartAccountStatus } from "@/web3/web3/utils/detectSmartAccount";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { useWalletClient } from "wagmi";
import { SmartAccountWarningDialog } from "@/components/wallet/smart-account-warning-dialog";
import { toast } from "sonner";
import { useFractionSplits } from "@/hooks";
import { addresses } from "@/web3/constants/addresses";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { useSwap } from "@/hooks/useSwap";
import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import {
  TransactionStepper,
  type TransactionStep,
  type StepStatus,
} from "@/components/transaction-stepper";

import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";

export type LaunchpadRewardScore = {
  userWeeklyGlwRewards: string;
  userWeeklyPdRewards: string;
};

export type MiningCenterScore = {
  miningScore: number;
  weeklyGlwRewards?: string;
  weeklyGlwRewardsUsd?: string;
};

type DepositDialogProps =
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      application: AuctionApplication | null;
      selectedCurrency: "GLW";
      rewardScore?: LaunchpadRewardScore | null;
      onSuccess?: () => void;
    }
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      application: AuctionApplication | null;
      selectedCurrency: "USDC";
      rewardScore?: MiningCenterScore | null;
      onSuccess?: () => void;
    };

type PaymentMethod = "GLW" | "USDC" | "ETH";

type Phase = "review" | "processing" | "success" | "error";

interface SuccessMetrics {
  totalSteps: number;
  filledBeforeSteps: number;
  userSteps: number;
}

export function DepositDialog({
  open,
  onOpenChange,
  application,
  selectedCurrency,
  rewardScore,
  onSuccess,
}: DepositDialogProps) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { signer } = useEthersSigner();
  const { data: walletClient } = useWalletClient();
  const { spotPriceUsd: glwSpotPrice } = useGlowSpotPriceSummary();
  const { ethPrice: ethSpotPrice } = useEthPrice();
  const {
    usdcBalance,
    glwBalance,
    ethBalance,
    refetch: refetchBalances,
  } = useWalletTokenBalances(address);
  const { swapEthToUsdc, estimateEthToUsdc } = useSwapETHToUSDC();
  const { swapUSDCToUSDG } = useSwapUSDCToUSDG();
  const { swap: swapUsdgToGlow } = useSwap({
    tokenA_address: addresses.usdg,
    tokenB_address: addresses.glow,
  });

  // State
  const [quantity, setQuantity] = React.useState<number>(1);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    React.useState<PaymentMethod>(selectedCurrency === "GLW" ? "GLW" : "USDC");
  const [isSmartAccountWarningOpen, setIsSmartAccountWarningOpen] =
    React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("review");
  const [transactionSteps, setTransactionSteps] = React.useState<
    TransactionStep[]
  >([]);
  const stepsRef = React.useRef<TransactionStep[]>([]);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMetrics, setSuccessMetrics] =
    React.useState<SuccessMetrics | null>(null);

  // Smart auto-selection of payment method on open/connect
  React.useEffect(() => {
    if (open && isConnected && application) {
      if (selectedCurrency === "GLW") {
        // Delegation: Prefer GLW if enough, else USDC, else ETH
        const costGLW = calculateCostInGLW(1);
        const glwBalNum = glwBalance
          ? parseFloat(formatUnits(glwBalance, 18))
          : 0;
        const usdcBalNum = usdcBalance
          ? parseFloat(formatUnits(usdcBalance, 6))
          : 0;

        if (glwBalNum >= costGLW) {
          setSelectedPaymentMethod("GLW");
        } else if (usdcBalNum > 0) {
          setSelectedPaymentMethod("USDC");
        } else {
          // Default fallback
          setSelectedPaymentMethod("GLW");
        }
      } else {
        // Miner: Prefer USDC, else ETH
        setSelectedPaymentMethod("USDC");
      }
    }
  }, [
    open,
    isConnected,
    usdcBalance,
    glwBalance,
    selectedCurrency,
    application,
  ]);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setQuantity(1);
      setIsSubmitting(false);
      setPhase("review");
      setTransactionSteps([]);
      stepsRef.current = [];
      setTxHash(null);
      setErrorMessage(null);
      setSuccessMetrics(null);
    }
  }, [open]);

  // Icon Helpers
  const TOKEN_ICON_SRC_BY_SYMBOL = {
    ETH: "/images/tokens/eth.svg",
    USDC: "/images/tokens/usdc.svg",
  } as const;

  function TokenIcon(props: { symbol: "ETH" | "GLW" | "USDC" }) {
    const { symbol } = props;

    if (symbol === "GLW") {
      return (
        <div className="h-6 w-6 rounded-full bg-muted border border-border flex items-center justify-center">
          <GlowSymbol className="h-4 w-4" />
        </div>
      );
    }

    const iconSrc =
      symbol === "ETH" || symbol === "USDC"
        ? TOKEN_ICON_SRC_BY_SYMBOL[symbol]
        : null;

    if (iconSrc) {
      return (
        <img
          src={iconSrc}
          alt={`${symbol} token`}
          className="h-6 w-6 rounded-full"
          draggable={false}
        />
      );
    }
    return <Coins className="h-6 w-6" />;
  }
  const calculateCostInGLW = (qty: number) => {
    if (!application?.activeFraction) return 0;
    const step = parseFloat(
      formatUnits(BigInt(application.activeFraction.step), 18)
    );
    return step * qty;
  };

  const calculateCostInUSDC = (qty: number) => {
    if (!application?.activeFraction) return 0;
    if (selectedCurrency === "USDC") {
      // Miner
      const stepPrice = parseFloat(
        formatUnits(BigInt(application.activeFraction.stepPrice), 6)
      );
      return stepPrice * qty;
    } else {
      // Delegation (via swap)
      const glwCost = calculateCostInGLW(qty);
      return glwCost * (glwSpotPrice || 0);
    }
  };

  const calculateCostInETH = (qty: number) => {
    const usdcCost = calculateCostInUSDC(qty);
    return ethSpotPrice > 0 ? usdcCost / ethSpotPrice : 0;
  };

  const estimatedRewards = React.useMemo(() => {
    if (!application?.activeFraction || !rewardScore) return 0;

    // Logic from original file to calculate per-share rewards
    let weeklyGlw = 0;
    const totalShares = application.activeFraction.totalSteps || 1; // avoid div 0

    if ("userWeeklyGlwRewards" in rewardScore) {
      // Launchpad
      const glw = parseFloat(
        formatUnits(BigInt(rewardScore.userWeeklyGlwRewards), 18)
      );
      const pd = parseFloat(
        formatUnits(BigInt(rewardScore.userWeeklyPdRewards), 18)
      );
      weeklyGlw = (glw + pd) / totalShares;
    } else if ("miningScore" in rewardScore) {
      // Mining
      if (rewardScore.weeklyGlwRewards) {
        weeklyGlw = parseFloat(
          formatUnits(BigInt(rewardScore.weeklyGlwRewards || "0"), 18)
        );
      }
    }

    return weeklyGlw * quantity;
  }, [quantity, application, rewardScore]);

  const maxQuantity = application?.activeFraction?.remainingSteps ?? 0;

  // Handlers
  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(maxQuantity, prev + delta)));
  };

  const handleSmartAccountCheck = async () => {
    if (!signer || !walletClient || !address) return true;
    try {
      const status = await getSmartAccountStatus({
        address: address as `0x${string}`,
        walletClient,
        getBytecode: publicClient?.getBytecode,
      });
      if (
        status &&
        (status.isContractWallet ||
          status.isEip7702Delegated ||
          status.hasWalletAABatching)
      ) {
        setIsSmartAccountWarningOpen(true);
        return false;
      }
    } catch {
      // ignore error
    }
    return true;
  };

  const fractionsHook = useOffchainFractions(
    walletClient,
    publicClient,
    chainId
  ); // Chain ID handled inside hook or env
  const sponsorMutation = useSponsorApplication();

  // Polling for splits to confirm purchase
  const { refetch: refetchSplits, summary: splitsSummary } = useFractionSplits({
    walletAddress: address || null,
    fractionId: application?.activeFraction?.id || null,
    enabled: false, // We manually refetch
  });

  const updateStepStatus = (
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
  };

  const handleConfirm = async () => {
    if (!isConnected || !application?.activeFraction) return;

    // Check smart account
    const isSafe = await handleSmartAccountCheck();
    if (!isSafe) return;

    // If Delegating with swap (selectedCurrency=GLW, method!=GLW)
    const isSwapDelegate =
      selectedCurrency === "GLW" && selectedPaymentMethod !== "GLW";

    try {
      setIsSubmitting(true);
      setPhase("processing");
      setErrorMessage(null);

      const { activeFraction } = application;
      const userAddress = address as `0x${string}`;

      // Pre-calculate costs to determine which steps are needed
      let requiredUsdc = 0n;

      if (selectedPaymentMethod === "ETH") {
        if (selectedCurrency === "USDC") {
          requiredUsdc = BigInt(activeFraction.stepPrice) * BigInt(quantity);
        } else {
          const glwNeeded = BigInt(activeFraction.step) * BigInt(quantity);
          const glwPrice = parseUnits(glwSpotPrice.toFixed(6), 6);
          const rawUsdcCost = (glwNeeded * glwPrice) / BigInt(1e18);
          requiredUsdc = (rawUsdcCost * 105n) / 100n;
        }
      }

      // Initialize transaction steps with rich metadata
      const steps: TransactionStep[] = [];

      if (selectedPaymentMethod === "ETH") {
        steps.push({
          id: "SWAP_ETH_TO_USDC",
          title: "Swap ETH → USDC",
          description: "Converting ETH to USDC via Uniswap",
          tokenFrom: "ETH",
          tokenTo: "USDC",
          status: "idle",
        });
      }
      if (isSwapDelegate) {
        steps.push({
          id: "SWAP_USDC_TO_USDG",
          title: "Swap USDC → USDG",
          description: "Converting USDC to USDG",
          tokenFrom: "USDC",
          tokenTo: "USDG",
          status: "idle",
        });
        steps.push({
          id: "SWAP_USDG_TO_GLOW",
          title: "Swap USDG → GLW",
          description: "Converting USDG to GLW via Uniswap",
          tokenFrom: "USDG",
          tokenTo: "GLW",
          status: "idle",
        });
        steps.push({
          id: "DELEGATE_GLW",
          title: "Delegate GLW",
          description: "Delegating GLW to the solar farm",
          tokenFrom: "GLW",
          status: "idle",
        });
      } else {
        steps.push({
          id: "BUY_FRACTIONS",
          title:
            selectedCurrency === "USDC" ? "Purchase Miners" : "Delegate GLW",
          description:
            selectedCurrency === "USDC"
              ? "Purchasing miner units"
              : "Delegating GLW to the solar farm",
          tokenFrom: selectedCurrency === "USDC" ? "USDC" : "GLW",
          status: "idle",
        });
      }
      steps.push({
        id: "CONFIRM_TX",
        title: "Confirm Transaction",
        description: "Waiting for blockchain confirmation",
        status: "idle",
      });

      stepsRef.current = steps;
      setTransactionSteps(steps);

      // --- 1. ETH Payment Handling (Swap to USDC) ---
      if (selectedPaymentMethod === "ETH") {
        if (requiredUsdc <= 0n) {
          throw new Error("Invalid USDC amount required for swap");
        }

        updateStepStatus("SWAP_ETH_TO_USDC", "waiting_signature");

        // Estimate ETH needed for the required USDC amount
        const probeWei = parseUnits("0.1", 18);
        const probeRes = await estimateEthToUsdc({
          amountInWei: probeWei,
          slippageBps: 100n,
        });

        if (!probeRes.ok) throw new Error("Failed to quote ETH to USDC");
        if (probeRes.val.amountOutUsdc <= 0n)
          throw new Error("Failed to quote ETH to USDC");

        // Calculate required ETH with buffer
        let amountInWei =
          (probeWei * requiredUsdc) / probeRes.val.amountOutUsdc;
        amountInWei = (amountInWei * 102n) / 100n; // +2% buffer

        // Refine estimate (simple retry loop)
        for (let i = 0; i < 3; i++) {
          const res = await estimateEthToUsdc({
            amountInWei,
            slippageBps: 100n,
          });
          if (res.ok && res.val.amountOutMinUsdc >= requiredUsdc) break;
          amountInWei = (amountInWei * 105n) / 100n; // +5% bump
        }

        updateStepStatus("SWAP_ETH_TO_USDC", "confirming");
        const swapRes = await swapEthToUsdc({
          amountInWei,
          slippageBps: 100n,
        });
        if (!swapRes.ok) throw new Error(swapRes.val);
        await refetchBalances();
        updateStepStatus("SWAP_ETH_TO_USDC", "completed");
      }

      // --- 2. Swap USDC to GLW (if delegating via swap) ---
      if (isSwapDelegate) {
        // Calculate needed GLW
        const glwNeeded = BigInt(activeFraction.step) * BigInt(quantity);
        // Estimate USDC needed: GLW * Price * 1.05 (5% buffer)
        const glwPrice = parseUnits(glwSpotPrice.toFixed(6), 6);
        const usdcNeeded =
          (((glwNeeded * glwPrice) / BigInt(1e18)) * 105n) / 100n;

        // Swap USDC -> USDG
        updateStepStatus("SWAP_USDC_TO_USDG", "waiting_signature");
        updateStepStatus("SWAP_USDC_TO_USDG", "confirming");
        const usdcSwapRes = await swapUSDCToUSDG(usdcNeeded);
        if (!usdcSwapRes.ok) throw new Error(usdcSwapRes.val);
        updateStepStatus("SWAP_USDC_TO_USDG", "completed");

        // Swap USDG -> GLW (Uniswap)
        updateStepStatus("SWAP_USDG_TO_GLOW", "waiting_signature");
        updateStepStatus("SWAP_USDG_TO_GLOW", "confirming");
        const glowSwapRes = await swapUsdgToGlow({
          amount: usdcNeeded,
          slippagePercentTenThousandDenominator: 100n, // 1%
        });
        if (!glowSwapRes.ok) throw new Error(glowSwapRes.val);
        updateStepStatus("SWAP_USDG_TO_GLOW", "completed");

        // We should now have enough GLW.
        updateStepStatus("DELEGATE_GLW", "waiting_signature");
      } else {
        updateStepStatus("BUY_FRACTIONS", "waiting_signature");
      }

      // --- 3. Purchase Fractions (Delegate or Buy Miner) ---
      // Verify balance check skipped (handled by hook/metamask will fail if insufficient)
      // For "Swap & Delegate", we just bought GLW.
      // For "Buy Miner", we have USDC.

      const costBigInt =
        selectedCurrency === "USDC"
          ? BigInt(activeFraction.stepPrice) * BigInt(quantity)
          : BigInt(activeFraction.step) * BigInt(quantity);

      const activeStepId = isSwapDelegate ? "DELEGATE_GLW" : "BUY_FRACTIONS";
      updateStepStatus(activeStepId, "confirming");

      const txHash = await fractionsHook.buyFractions({
        creator: activeFraction.owner,
        id: activeFraction.id,
        stepsToBuy: BigInt(quantity),
        minStepsToBuy: BigInt(quantity),
        refundTo: userAddress,
        creditTo: userAddress,
        useCounterfactualAddressForRefund: false,
      });

      updateStepStatus(activeStepId, "completed", { txHash });

      // --- 4. Confirm & Sponsor ---
      updateStepStatus("CONFIRM_TX", "confirming");
      setTxHash(txHash);

      // Poll splits to confirm
      const initialPurchased = splitsSummary?.totalStepsPurchased || 0;
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        // 30 attempts * 2s = 60s
        await new Promise((r) => setTimeout(r, 2000));
        const res = await refetchSplits();
        if (
          res.data &&
          res.data.summary.totalStepsPurchased > initialPurchased
        ) {
          confirmed = true;
          break;
        }
      }

      if (!confirmed) {
        console.warn(
          "Purchase confirmation timed out, but transaction was submitted."
        );
      }

      // Calculate success metrics
      try {
        const totalSteps = Math.max(
          0,
          Math.floor(activeFraction.totalSteps || 0)
        );
        let filledBeforeSteps = 0;

        if (totalSteps > 0) {
          if (activeFraction.remainingSteps != null) {
            filledBeforeSteps = Math.max(
              0,
              Math.min(
                totalSteps,
                totalSteps -
                  Math.max(0, Math.floor(activeFraction.remainingSteps))
              )
            );
          } else {
            filledBeforeSteps = Math.max(
              0,
              Math.min(totalSteps, Math.floor(activeFraction.splitsSold || 0))
            );
          }
        }

        setSuccessMetrics({
          totalSteps,
          filledBeforeSteps,
          userSteps: Math.max(0, Math.floor(quantity)),
        });
      } catch {
        setSuccessMetrics(null);
      }

      await sponsorMutation.mutateAsync({
        applicationId: application.id,
        amount: costBigInt,
        currency: selectedCurrency,
        txHash: txHash,
        onSuccess: () => {
          updateStepStatus("CONFIRM_TX", "completed", { txHash });
          setPhase("success");

          trackEvent("marketplace_deposit_success", {
            currency: selectedCurrency,
            payment_method: selectedPaymentMethod,
            listing_type:
              selectedCurrency === "USDC" ? "miners" : "delegations",
            application_id: application.id,
            fraction_id: activeFraction.id,
            quantity,
            tx_hash: txHash,
            farm_name: application.farmName ?? null,
            zone_name: application.zone?.name ?? null,
          });

          toast.success(
            selectedCurrency === "USDC"
              ? "Miners purchased!"
              : "Delegation successful!"
          );
          onSuccess?.();
        },
      });
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Transaction failed";

      // Mark the current active step as error (using ref to avoid stale closure)
      const currentSteps = stepsRef.current;
      const activeStep = currentSteps.find(
        (s) => s.status === "waiting_signature" || s.status === "confirming"
      );
      if (activeStep) {
        updateStepStatus(activeStep.id, "error", { errorMessage: msg });
      } else if (currentSteps.length > 0) {
        // If no active step found, mark the first idle step as error
        const firstIdleStep = currentSteps.find((s) => s.status === "idle");
        if (firstIdleStep) {
          updateStepStatus(firstIdleStep.id, "error", { errorMessage: msg });
        }
      }

      const isUserRejected =
        msg.includes("User rejected") || msg.includes("user rejected");

      if (!isUserRejected) {
        trackEvent("marketplace_deposit_error", {
          currency: selectedCurrency,
          payment_method: selectedPaymentMethod,
          listing_type: selectedCurrency === "USDC" ? "miners" : "delegations",
          application_id: application?.id ?? null,
          fraction_id: application?.activeFraction?.id ?? null,
          quantity,
          failed_step: activeStep?.id ?? null,
          error_message: msg.slice(0, 200),
        });
      }

      setPhase("error");
      setErrorMessage(msg);
      if (isUserRejected) {
        toast.error("Transaction rejected");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const farmLabelForShare = React.useMemo(() => {
    if (!application) return null;
    if (application.farmName) return application.farmName;
    return application.zone?.name ?? null;
  }, [application]);

  const shareUrl = React.useMemo(() => {
    try {
      if (!farmLabelForShare) return null;
      if (!successMetrics) return null;

      if (selectedCurrency === "USDC") {
        const text = [
          `I just bought ${quantity} miner${
            quantity > 1 ? "s" : ""
          } from ${farmLabelForShare} on @glowFND`,
          "",
          `Every miner I own earns me GLW weekly for the next 100 weeks.`,
          "",
          `app.glow.org/marketplace`,
        ].join("\n");
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          text
        )}`;
      }

      const text = [
        `I just helped fund ${farmLabelForShare} by delegating GLW tokens.`,
        "",
        `You can do the same and start earning GLW weekly for 100 weeks here: app.glow.org`,
      ].join("\n");

      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}`;
    } catch {
      return null;
    }
  }, [selectedCurrency, farmLabelForShare, successMetrics, quantity]);

  const successDetails: TransactionDetail[] = application?.activeFraction
    ? [
        {
          label: "Quantity",
          value: quantity.toString(),
        },
        {
          label: `Total ${selectedCurrency} Delegated`,
          value: formatNumber(
            parseFloat(
              formatUnits(
                BigInt(application.activeFraction.stepPrice) * BigInt(quantity),
                DECIMALS_BY_TOKEN[selectedCurrency]
              )
            ),
            0
          ),
          unit: selectedCurrency,
        },
      ]
    : [];

  const renderContent = () => {
    if (phase === "success") {
      return (
        <div className="px-6 py-8 text-center space-y-4">
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold text-foreground">
              {selectedCurrency === "USDC"
                ? "Purchase Complete!"
                : "Delegation Complete!"}
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedCurrency === "USDC"
                ? "You helped accelerate real-world solar deployment."
                : "You just activated real-world solar rewards."}
            </div>
          </div>

          {application?.activeFraction && successMetrics ? (
            <div className="flex flex-col items-center">
              <SegmentedCircleProgress
                totalSteps={successMetrics.totalSteps}
                filledBeforeSteps={successMetrics.filledBeforeSteps}
                userSteps={successMetrics.userSteps}
                otherColor={
                  selectedCurrency === "USDC"
                    ? "rgba(255,255,255,0.18)"
                    : "#C084FC"
                }
                userColor={
                  selectedCurrency === "USDC"
                    ? "var(--color-miner-yellow)"
                    : "#4ADE80"
                }
                className="my-2"
              />
              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        selectedCurrency === "USDC"
                          ? "rgba(255,255,255,0.25)"
                          : "#C084FC",
                    }}
                  />
                  <span>Already filled</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        selectedCurrency === "USDC"
                          ? "var(--color-miner-yellow)"
                          : "#4ADE80",
                    }}
                  />
                  <span>Your contribution</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {successDetails.map((detail, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {detail.label}
                </span>
                <div className="text-right">
                  <span className="text-sm font-mono">{detail.value}</span>
                  {detail.unit && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {detail.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-4">
            {shareUrl ? (
              <Button
                className="w-full bg-white text-black hover:bg-white/90"
                asChild
              >
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={shareUrl}
                  onClick={() => {
                    trackEvent("marketplace_deposit_share_x_click", {
                      currency: selectedCurrency,
                      application_id: application?.id ?? null,
                      fraction_id: application?.activeFraction?.id ?? null,
                      steps_to_buy: quantity,
                      tx_hash: txHash ?? null,
                    });
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share on X
                </a>
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        </div>
      );
    }

    if (phase === "processing" || phase === "error") {
      const hasError = phase === "error";

      return (
        <div className="px-6 py-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mx-auto mb-4">
              {hasError ? (
                <motion.div
                  className="h-14 w-14 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                >
                  <X className="h-8 w-8 text-red-500" />
                </motion.div>
              ) : (
                <motion.div
                  className="flex items-center justify-center"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <GlowSymbolAnimated className="size-12" />
                </motion.div>
              )}
            </div>
            <motion.div
              className="text-xl font-semibold text-foreground mb-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {hasError ? "Transaction Failed" : "Processing Transaction"}
            </motion.div>
            <motion.div
              className="text-muted-foreground text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {hasError
                ? "There was an error processing your transaction."
                : "Please wait while we process your transaction."}
            </motion.div>
          </div>

          {/* Transaction Stepper */}
          {transactionSteps.length > 0 ? (
            <motion.div
              className="bg-muted/20 border border-border/50 rounded-2xl p-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <TransactionStepper steps={transactionSteps} chainId={chainId} />
            </motion.div>
          ) : hasError && errorMessage ? (
            /* Error message only when no steps exist */
            <motion.div
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-sm text-red-500 break-words">{errorMessage}</p>
            </motion.div>
          ) : null}

          {/* Error actions */}
          {hasError && (
            <motion.div
              className="mt-5 flex gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setPhase("review");
                  setTransactionSteps([]);
                  stepsRef.current = [];
                  setErrorMessage(null);
                }}
                className="flex-1"
              >
                Try Again
              </Button>
            </motion.div>
          )}
        </div>
      );
    }

    // Default Review Phase
    return (
      <>
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <DialogTitle className="text-xl font-semibold">
              {selectedCurrency === "GLW" ? "Delegate GLW" : "Buy Miners"}
            </DialogTitle>
          </div>
          <div className="text-sm text-muted-foreground">
            {application?.farmName} • {application?.zone?.name}
          </div>
        </div>

        <div className="px-6 space-y-6">
          {/* Quantity Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground/80">
                Quantity
              </label>
              <span className="text-xs text-muted-foreground">
                {maxQuantity} available
              </span>
            </div>
            <div className="flex items-center gap-3 p-1 rounded-xl bg-muted/50 border border-border/50">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center font-mono text-xl font-medium">
                {quantity}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= maxQuantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Estimated Rewards - Animated */}
          <div className="bg-muted/30 rounded-2xl p-4 border border-border/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <div className="relative flex justify-between items-end">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Est. Weekly Rewards
                </div>
                <div className="flex items-baseline gap-1.5">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={estimatedRewards}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-2xl font-bold font-mono text-green-600 dark:text-[#D1FF4D]" // Glow Green-ish
                    >
                      {estimatedRewards.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-sm text-green-600/70 dark:text-[#D1FF4D]/70 font-medium">
                    GLW
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground/80 mb-1">
                  Value
                </div>
                <div className="text-sm text-foreground/80 font-mono">
                  ≈ $
                  {(estimatedRewards * (glwSpotPrice || 0)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground/80">
              {selectedCurrency === "GLW"
                ? "Delegation Source"
                : "Select Currency"}
            </label>
            <div className="space-y-2">
              {/* Option: GLW */}
              {(selectedCurrency === "GLW" || selectedCurrency === "USDC") && (
                <PaymentOption
                  value="GLW"
                  label="Glow (GLW)"
                  balance={
                    glwBalance
                      ? `${parseFloat(
                          formatUnits(glwBalance, 18)
                        ).toLocaleString()} GLW`
                      : "0 GLW"
                  }
                  icon={<TokenIcon symbol="GLW" />}
                  selected={selectedPaymentMethod === "GLW"}
                  onSelect={() => setSelectedPaymentMethod("GLW")}
                  disabled={selectedCurrency === "USDC"} // Can't pay miners with GLW
                  pricePreview={
                    calculateCostInGLW(quantity).toLocaleString() + " GLW"
                  }
                />
              )}
              {/* Option: USDC */}
              <PaymentOption
                value="USDC"
                label="USD Coin (USDC)"
                balance={
                  usdcBalance
                    ? `${parseFloat(
                        formatUnits(usdcBalance, 6)
                      ).toLocaleString()} USDC`
                    : "0 USDC"
                }
                icon={<TokenIcon symbol="USDC" />}
                selected={selectedPaymentMethod === "USDC"}
                onSelect={() => setSelectedPaymentMethod("USDC")}
                pricePreview={
                  calculateCostInUSDC(quantity).toLocaleString() + " USDC"
                }
              />
              {/* Option: ETH */}
              <PaymentOption
                value="ETH"
                label="Ethereum (ETH)"
                balance={
                  ethBalance
                    ? `${parseFloat(formatUnits(ethBalance, 18)).toFixed(
                        4
                      )} ETH`
                    : "0 ETH"
                }
                icon={<TokenIcon symbol="ETH" />}
                selected={selectedPaymentMethod === "ETH"}
                onSelect={() => setSelectedPaymentMethod("ETH")}
                pricePreview={calculateCostInETH(quantity).toFixed(4) + " ETH"}
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted/20 border-t border-border mt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold">Total</span>
            <div className="text-right">
              <div className="text-xl font-bold font-mono">
                {selectedPaymentMethod === "GLW" &&
                  `${calculateCostInGLW(quantity).toLocaleString()} GLW`}
                {selectedPaymentMethod === "USDC" &&
                  `$${calculateCostInUSDC(quantity).toLocaleString()}`}
                {selectedPaymentMethod === "ETH" &&
                  `${calculateCostInETH(quantity).toFixed(4)} ETH`}
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedPaymentMethod !== "USDC"
                  ? `≈ $${calculateCostInUSDC(quantity).toLocaleString()}`
                  : "Stable"}
              </div>
            </div>
          </div>

          <div className="relative">
            {!isConnected ? (
              <ConnectButton size="medium" variant="default" />
            ) : (
              <Button
                className="w-full h-12 rounded-xl text-base font-medium bg-foreground text-background hover:bg-foreground/90"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedCurrency === "GLW"
                  ? selectedPaymentMethod !== "GLW"
                    ? "Swap & Delegate"
                    : "Confirm Delegation"
                  : "Confirm Purchase"}
              </Button>
            )}
          </div>

          <div className="mt-4 text-xs text-center text-muted-foreground/60 px-4 leading-relaxed">
            By confirming, you agree to the Terms of Service. Rewards are
            estimated and subject to network conditions.
          </div>
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="md:max-w-md p-0 gap-0 bg-background border-border text-foreground overflow-hidden shadow-2xl sm:rounded-3xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {renderContent()}

        <SmartAccountWarningDialog
          open={isSmartAccountWarningOpen}
          onOpenChange={setIsSmartAccountWarningOpen}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaymentOption({
  value,
  label,
  balance,
  icon,
  selected,
  onSelect,
  disabled,
  pricePreview,
}: {
  value: string;
  label: string;
  balance: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  pricePreview: string;
}) {
  if (disabled) return null;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200",
        selected
          ? "bg-foreground/5 border-foreground/10 shadow-sm"
          : "bg-transparent border-border hover:bg-foreground/5 hover:border-foreground/5"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border border-border">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground">
            Balance: {balance}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-foreground">
          {pricePreview}
        </div>
        {selected && (
          <div className="h-2 w-2 rounded-full bg-primary ml-auto mt-1" />
        )}
      </div>
    </div>
  );
}
