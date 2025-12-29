"use client";

import React from "react";
import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatNumber } from "./utils";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, parseUnits } from "viem";
import {
  DECIMALS_BY_TOKEN,
  useOffchainFractions,
} from "@glowlabs-org/utils/browser";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useAccount, useWalletClient } from "wagmi";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { ConnectButton } from "@/components/connect-button";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import {
  useSponsorApplication,
  type AuctionApplication,
} from "@/hooks";
import { useFractionSplits } from "@/hooks";
import Decimal from "decimal.js";
import Link from "next/link";
import { SmartAccountWarningDialog } from "@/components/wallet/smart-account-warning-dialog";
import { getSmartAccountStatus } from "@/web3/web3/utils/detectSmartAccount";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { trackEvent } from "@/lib/telemetry";

const BUY_GLOW_USDC_BUFFER = new Decimal(1);

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

// const QUOTE_LOCK_MINUTES = 60;

export function DepositDialog({
  open,
  onOpenChange,
  application,
  selectedCurrency,
  rewardScore,
  onSuccess,
}: DepositDialogProps) {
  const { isConnected } = useAccount();
  // const [quoteId, setQuoteId] = React.useState<string>(generateQuoteId());
  const [lockedAtMs, setLockedAtMs] = React.useState<number>(Date.now());
  const [nowMs, setNowMs] = React.useState<number>(Date.now());
  // Use the selectedCurrency from props
  const currency = selectedCurrency;
  const [stepsToBuy, setStepsToBuy] = React.useState(1);
  const [quantityInput, setQuantityInput] = React.useState<string>("1");
  const [isBuyGlowDialogOpen, setIsBuyGlowDialogOpen] = React.useState(false);

  // Transaction states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [networkCostUSD, setNetworkCostUSD] = React.useState<string>("");
  const [isNetworkCostLoading, setIsNetworkCostLoading] = React.useState(false);

  // Hooks
  const { signer } = useEthersSigner();
  const { data: walletClient } = useWalletClient();
  const [signerAddress, setSignerAddress] = React.useState<
    string | undefined
  >();
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const [isSmartAccountWarningOpen, setIsSmartAccountWarningOpen] =
    React.useState(false);
  const [isCheckingSmartAccount, setIsCheckingSmartAccount] =
    React.useState(false);

  React.useEffect(() => {
    if (signer) {
      signer.getAddress().then(setSignerAddress);
    }
  }, [signer]);

  React.useEffect(() => {
    setQuantityInput(String(stepsToBuy));
  }, [stepsToBuy]);

  // Clamp steps to available range when remaining steps changes
  React.useEffect(() => {
    if (!application?.activeFraction) return;
    const maxSteps = application.activeFraction.remainingSteps ?? 0;
    const minBound = maxSteps > 0 ? 1 : 0;
    if (stepsToBuy > maxSteps || stepsToBuy < minBound) {
      const clamped = Math.min(Math.max(stepsToBuy, minBound), maxSteps);
      setStepsToBuy(clamped);
      setQuantityInput(String(clamped));
    }
  }, [
    application?.activeFraction?.remainingSteps,
    application?.activeFraction,
    stepsToBuy,
  ]);

  const sponsorMutation = useSponsorApplication();

  // Initialize offchain fractions hook
  const fractions = useOffchainFractions(
    walletClient,
    publicClient,
    parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!)
  );

  // Balance queries

  // GLW balance query
  const {
    data: glwBalance,
    isLoading: isGlwLoading,
    refetch: refetchGlwBalance,
  } = useQuery({
    queryKey: ["token-balance", "GLW", signerAddress],
    enabled: Boolean(
      signer &&
        fractions.isSignerAvailable &&
        open &&
        signerAddress &&
        currency === "GLW"
    ),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        if (!signer || !fractions.isSignerAvailable) return null;
        const userAddress = await signer.getAddress();
        const bal = await fractions.checkTokenBalance(
          userAddress,
          fractions.addresses.GLW
        );
        return formatUnits(bal, DECIMALS_BY_TOKEN.GLW);
      } catch (e) {
        return null;
      }
    },
  });

  // USDC balance query
  const {
    data: usdcBalance,
    isLoading: isUsdcLoading,
    refetch: refetchUsdcBalance,
  } = useQuery({
    queryKey: ["token-balance", "USDC", signerAddress],
    enabled: Boolean(
      signer &&
        fractions.isSignerAvailable &&
        open &&
        signerAddress &&
        (currency === "USDC" || currency === "GLW")
    ),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        if (!signer || !fractions.isSignerAvailable) return null;
        const userAddress = await signer.getAddress();
        const bal = await fractions.checkTokenBalance(
          userAddress,
          fractions.addresses.USDC
        );
        return formatUnits(bal, DECIMALS_BY_TOKEN.USDC);
      } catch (e) {
        return null;
      }
    },
  });

  // Splits polling using the dedicated hook
  const {
    summary: splitsSummary,
    isLoading: isLoadingSplits,
    refetch: refetchSplits,
  } = useFractionSplits({
    walletAddress: signerAddress || null,
    fractionId: application?.activeFraction?.id || null,
    enabled: Boolean(signerAddress && application?.activeFraction?.id && open),
    refetchInterval: 10_000, // Poll every 10 seconds
  });

  // const expiryMs = lockedAtMs + QUOTE_LOCK_MINUTES * 60 * 1000;
  // const secondsRemaining = Math.max(0, Math.floor((expiryMs - nowMs) / 1000));
  // const minutes = Math.floor(secondsRemaining / 60);
  // const seconds = secondsRemaining % 60;

  // For fractions, we use step-based purchasing instead of deposit amounts
  const depositAmountNumber = 0;

  // Get user balance for selected currency
  const userBalance = React.useMemo(() => {
    try {
      if (currency === "USDC") {
        return new Decimal(usdcBalance || "0").toNumber();
      } else {
        return new Decimal(glwBalance || "0").toNumber();
      }
    } catch {
      return 0;
    }
  }, [glwBalance, usdcBalance, currency]);

  const hasInsufficientBalance = depositAmountNumber > userBalance;

  // Display currency is based on the selected currency
  const displayCurrency = currency;

  const usdcBalanceBigInt = React.useMemo(() => {
    try {
      if (!usdcBalance) return null;
      return parseUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC as number);
    } catch {
      return null;
    }
  }, [usdcBalance]);

  const glwShortfall = React.useMemo(() => {
    try {
      if (!isConnected) return null;
      if (currency !== "GLW") return null;
      if (!application?.activeFraction) return null;

      const requiredGlwUnits =
        BigInt(application.activeFraction.stepPrice) * BigInt(stepsToBuy);
      const requiredGlw = new Decimal(
        formatUnits(requiredGlwUnits, DECIMALS_BY_TOKEN.GLW)
      );

      if (isGlwLoading || glwBalance == null) {
        return {
          requiredGlw,
          currentGlw: null,
          missingGlw: null,
          estimatedUsdcNeeded: null,
          hasInsufficientGlw: false,
          isBalanceKnown: false,
        };
      }

      const currentGlw = new Decimal(glwBalance);
      const missingGlw = Decimal.max(
        new Decimal(0),
        requiredGlw.minus(currentGlw)
      );
      const estimatedUsdcNeeded =
        glwSpotPrice > 0 ? missingGlw.mul(new Decimal(glwSpotPrice)) : null;

      return {
        requiredGlw,
        currentGlw,
        missingGlw,
        estimatedUsdcNeeded,
        hasInsufficientGlw: missingGlw.gt(0),
        isBalanceKnown: true,
      };
    } catch {
      return null;
    }
  }, [
    isConnected,
    currency,
    application?.activeFraction,
    stepsToBuy,
    isGlwLoading,
    glwBalance,
    glwSpotPrice,
  ]);

  const usdcBalanceDecimal = React.useMemo(() => {
    try {
      if (!isConnected) return null;
      if (isUsdcLoading || usdcBalance == null) return null;
      return new Decimal(usdcBalance);
    } catch {
      return null;
    }
  }, [isConnected, isUsdcLoading, usdcBalance]);

  const buyGlowInitialUsdcAmount = React.useMemo(() => {
    try {
      if (currency !== "GLW") return null;
      if (!application?.activeFraction) return null;
      if (!glwSpotPrice || glwSpotPrice <= 0) return null;

      const requiredGlwUnits =
        BigInt(application.activeFraction.stepPrice) * BigInt(stepsToBuy);
      const requiredGlw = new Decimal(
        formatUnits(requiredGlwUnits, DECIMALS_BY_TOKEN.GLW)
      );
      const currentGlw = new Decimal(glwBalance || "0");
      const missingGlw = Decimal.max(
        new Decimal(0),
        requiredGlw.minus(currentGlw)
      );

      if (missingGlw.lte(0)) return null;

      const usdcNeeded = missingGlw
        .mul(new Decimal(glwSpotPrice))
        .add(BUY_GLOW_USDC_BUFFER);
      return usdcNeeded
        .toDecimalPlaces(DECIMALS_BY_TOKEN.USDC as number, Decimal.ROUND_UP)
        .toString();
    } catch {
      return null;
    }
  }, [
    currency,
    application?.activeFraction,
    glwSpotPrice,
    glwBalance,
    stepsToBuy,
  ]);

  // Reset states when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setIsProcessing(false);
      setIsSuccess(false);
      setIsError(false);
      setErrorMessage(null);
      setTxHash(null);
      setNetworkCostUSD("");
    } else {
      // setQuoteId(generateQuoteId());
      setLockedAtMs(Date.now());
    }
  }, [open]);

  // For fractions, currency is always GLW - no need to sync

  // // Update quote when currency changes
  // React.useEffect(() => {
  //   if (open && application) {
  //     setQuoteId(generateQuoteId());
  //     setLockedAtMs(Date.now());
  //   }
  // }, [currency, open, application]);

  // Timer for quote expiry
  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [open]);

  async function handleStepPurchase() {
    if (
      !application?.activeFraction ||
      !signer ||
      !fractions.isSignerAvailable
    ) {
      toast.error(
        currency === "USDC"
          ? "Missing required information for purchase"
          : "Missing required information for delegation"
      );
      trackEvent("marketplace_deposit_error", {
        stage: "precondition",
        currency,
        application_id: application?.id ?? null,
        fraction_id: application?.activeFraction?.id ?? null,
        error_message: "Missing required information for purchase/delegation",
      });
      return;
    }

    let stage:
      | "balance_check"
      | "buy_fractions"
      | "confirm_splits"
      | "refresh_balances"
      | "sponsor_mutation" = "balance_check";
    try {
      setIsSubmitting(true);
      setIsError(false);
      setErrorMessage(null);

      const userAddress = await signer.getAddress();
      const { activeFraction } = application;

      // Determine which token and price to use
      const isUSDC = currency === "USDC";
      const tokenAddress = isUSDC
        ? fractions.addresses.USDC
        : fractions.addresses.GLW;
      const tokenDecimals = isUSDC
        ? DECIMALS_BY_TOKEN.USDC
        : DECIMALS_BY_TOKEN.GLW;
      const tokenSymbol = isUSDC ? "USDC" : "GLW";

      // Calculate total needed based on currency
      // For USDC (mining center), use stepPrice; for GLW (launchpad), use step
      const pricePerStep = BigInt(activeFraction.stepPrice);

      const totalNeeded = pricePerStep * BigInt(stepsToBuy);

      // Check token balance
      stage = "balance_check";
      const tokenBalance = await fractions.checkTokenBalance(
        userAddress,
        tokenAddress
      );

      if (tokenBalance < totalNeeded) {
        throw new Error(
          `Insufficient ${tokenSymbol} balance. Need ${formatUnits(
            totalNeeded,
            tokenDecimals
          )} ${tokenSymbol}, have ${formatUnits(
            tokenBalance,
            tokenDecimals
          )} ${tokenSymbol}`
        );
      }

      stage = "buy_fractions";
      const txHash = await fractions.buyFractions({
        creator: activeFraction.owner,
        id: activeFraction.id,
        stepsToBuy: BigInt(stepsToBuy),
        minStepsToBuy: BigInt(stepsToBuy), // Same as stepsToBuy for now
        refundTo: userAddress,
        creditTo: userAddress,
        useCounterfactualAddressForRefund: false,
      });

      setTxHash(txHash);
      setIsSubmitting(false);
      setIsProcessing(true);
      trackEvent("marketplace_deposit_tx_submitted", {
        tx_hash: txHash,
        currency,
        application_id: application.id,
        fraction_id: activeFraction.id,
        steps_to_buy: stepsToBuy,
        total_needed_base_units: totalNeeded.toString(),
      });

      // Refresh splits immediately to start polling
      stage = "confirm_splits";
      await refetchSplits();

      // Poll splits until we see the purchase reflected
      const maxWaitTime = 60000; // 60 seconds max wait
      const pollInterval = 5000; // Check every 5 seconds
      let waitTime = 0;
      let purchaseConfirmed = false;

      const initialStepsPurchased = splitsSummary.totalStepsPurchased;

      while (waitTime < maxWaitTime && !purchaseConfirmed) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        waitTime += pollInterval;

        // Refresh splits data
        const { data: latestSplits } = await refetchSplits();

        if (
          latestSplits &&
          latestSplits.summary.totalStepsPurchased > initialStepsPurchased
        ) {
          purchaseConfirmed = true;

          break;
        }
      }

      if (!purchaseConfirmed) {
        const action = currency === "USDC" ? "Purchase" : "Delegation";
        console.warn(
          `${action} confirmation timeout - transaction may still be processing`
        );
        throw new Error(
          `${action} confirmation timeout. The transaction was submitted but we couldn't confirm it completed. Please check your wallet and contact support if needed.`
        );
      }

      // Only set success after confirmation
      setIsProcessing(false);
      setIsSuccess(true);
      trackEvent("marketplace_deposit_confirmed", {
        tx_hash: txHash,
        currency,
        application_id: application.id,
        fraction_id: activeFraction.id,
        steps_to_buy: stepsToBuy,
      });

      // Refresh balances
      stage = "refresh_balances";
      if (isUSDC) {
        await refetchUsdcBalance();
      } else {
        await refetchGlwBalance();
      }

      // Trigger the mutation to invalidate queries
      stage = "sponsor_mutation";
      await sponsorMutation.mutateAsync({
        applicationId: application.id,
        amount: totalNeeded,
        currency: tokenSymbol,
        txHash: txHash,
        onSuccess: onSuccess,
      });
    } catch (error: any) {
      setIsSubmitting(false);
      setIsProcessing(false);
      setIsError(true);

      let message =
        currency === "USDC" ? "Purchase failed" : "Delegation failed";

      // Handle specific error types based on OffchainFractionsError enum
      if (error.message === "TRANSACTION_SUBMISSION_TIMEOUT") {
        message =
          "Transaction submission timed out. The transaction may still be processing. Please refresh the page and check your wallet.";
      } else if (
        error.message?.includes("Insufficient balance") ||
        error.message?.includes("Insufficient GLW balance") ||
        error.message?.includes("Insufficient USDC balance")
      ) {
        message = error.message;
      } else if (
        error.message?.includes("User rejected") ||
        error.message?.includes("User denied")
      ) {
        message = "Transaction was rejected";
      } else if (error.message?.includes("Token approval")) {
        message = error.message;
      } else if (error.message?.includes("Invalid parameters")) {
        message = "Invalid purchase parameters";
      } else if (error.message?.includes("Fraction not found")) {
        message = "Application fraction not found";
      } else if (error.message?.includes("Transaction failed on-chain")) {
        message = "Transaction failed. Please check your wallet and try again.";
      } else if (error.message) {
        // Use the error message if it's informative
        message = error.message;
      }

      setErrorMessage(message);
      setTxHash(error?.txHash ?? null);
      console.error("handleStepPurchase error", error);
      toast.error(message);
      trackEvent("marketplace_deposit_error", {
        stage:
          typeof stage === "string"
            ? stage
            : "unknown",
        currency,
        application_id: application?.id ?? null,
        fraction_id: application?.activeFraction?.id ?? null,
        steps_to_buy: stepsToBuy,
        error_message: message,
        tx_hash: error?.txHash ?? txHash ?? null,
      });
    }
  }

  async function handleConfirm() {
    trackEvent("marketplace_deposit_confirm_click", {
      currency,
      application_id: application?.id ?? null,
      fraction_id: application?.activeFraction?.id ?? null,
      steps_to_buy: stepsToBuy,
    });
    // Block if smart/delegated account detected
    setIsCheckingSmartAccount(true);
    try {
      if (signerAddress && walletClient) {
        const status = await getSmartAccountStatus({
          address: signerAddress as `0x${string}`,
          walletClient,
          getBytecode: publicClient?.getBytecode,
        });

        const isSmartAccount =
          status &&
          (status.isContractWallet ||
            status.isEip7702Delegated ||
            status.hasWalletAABatching);
        if (isSmartAccount) {
          setIsSmartAccountWarningOpen(true);
          trackEvent("marketplace_deposit_blocked_smart_account", {
            currency,
            application_id: application?.id ?? null,
            fraction_id: application?.activeFraction?.id ?? null,
            steps_to_buy: stepsToBuy,
          });
          return; // Do not proceed
        }
      }
    } catch (error) {
      console.error("Smart account check failed:", error);
      // If the check fails, allow proceeding to avoid blocking legitimate users
      trackEvent("marketplace_deposit_error", {
        stage: "smart_account_check",
        currency,
        application_id: application?.id ?? null,
        fraction_id: application?.activeFraction?.id ?? null,
        steps_to_buy: stepsToBuy,
        error_message:
          error instanceof Error ? error.message : "Smart account check failed",
      });
    } finally {
      setIsCheckingSmartAccount(false);
    }
    // Only handle step-based purchasing for fractions
    if (application?.activeFraction) {
      return handleStepPurchase();
    }

    // No other payment methods are supported
    toast.error("Only fraction-based applications are supported");
  }

  // Estimated weekly rewards for selected shares (keep hooks unconditionally executed)
  const { estimatedWeeklyGlwForSelection, estimatedWeeklyUsdForSelection } =
    React.useMemo(() => {
      try {
        if (!application?.activeFraction || !rewardScore) {
          return {
            estimatedWeeklyGlwForSelection: null,
            estimatedWeeklyUsdForSelection: null,
          };
        }

        const totalShares = application.activeFraction.totalSteps || 0;
        if (!totalShares) {
          return {
            estimatedWeeklyGlwForSelection: null,
            estimatedWeeklyUsdForSelection: null,
          };
        }

        let glwPerShare = 0;
        let usdPerShare = 0;

        // Check if this is a reward score (launchpad) or mining score (mining center)
        if ("userWeeklyGlwRewards" in rewardScore) {
          // Reward score from launchpad
          const glwRewards = parseFloat(
            formatUnits(
              BigInt(rewardScore.userWeeklyGlwRewards || "0"),
              DECIMALS_BY_TOKEN["GLW"]
            )
          );
          const pdRewards = parseFloat(
            formatUnits(
              BigInt(rewardScore.userWeeklyPdRewards || "0"),
              DECIMALS_BY_TOKEN["GLW"]
            )
          );
          const totalGlw = glwRewards + pdRewards;
          glwPerShare = totalGlw / totalShares;
          usdPerShare = glwPerShare * glwSpotPrice;
        } else if ("miningScore" in rewardScore) {
          // Mining score from mining center
          if (rewardScore.weeklyGlwRewards) {
            const totalGlw = parseFloat(
              formatUnits(
                BigInt(rewardScore.weeklyGlwRewards),
                DECIMALS_BY_TOKEN["GLW"]
              )
            );
            glwPerShare = totalGlw;
          }
          if (rewardScore.weeklyGlwRewardsUsd) {
            const totalUsd = parseFloat(rewardScore.weeklyGlwRewardsUsd);
            usdPerShare = totalUsd;
          }
        }

        const estimatedWeeklyGlwForSelection = glwPerShare * stepsToBuy;
        const estimatedWeeklyUsdForSelection = usdPerShare * stepsToBuy;

        return {
          estimatedWeeklyGlwForSelection,
          estimatedWeeklyUsdForSelection,
        };
      } catch {
        return {
          estimatedWeeklyGlwForSelection: null,
          estimatedWeeklyUsdForSelection: null,
        };
      }
    }, [application?.activeFraction, rewardScore, stepsToBuy, glwSpotPrice]);

  // Early return conditions - check these in render
  if (!application) return null;

  const isStepPurchaseTokenBalanceSufficient = (() => {
    try {
      if (!application.activeFraction) return true;
      if (!isConnected) return false;

      const pricePerStep = BigInt(application.activeFraction.stepPrice);
      const totalCost = pricePerStep * BigInt(stepsToBuy);

      if (currency === "GLW") {
        if (!glwShortfall?.isBalanceKnown) return false;
        return !glwShortfall.hasInsufficientGlw;
      }

      // USDC (miners)
      if (isUsdcLoading || usdcBalance == null) return false;
      const requiredUsdc = parseFloat(
        formatUnits(totalCost, DECIMALS_BY_TOKEN.USDC)
      );
      const currentUsdc = parseFloat(usdcBalance);
      return currentUsdc >= requiredUsdc;
    } catch {
      return false;
    }
  })();

  const canConfirm = application.activeFraction
    ? // For step-based purchasing
      !isSubmitting &&
      !isProcessing &&
      stepsToBuy > 0 &&
      stepsToBuy <= (application.activeFraction.remainingSteps || 0) &&
      isStepPurchaseTokenBalanceSufficient &&
      isConnected
    : // For full sponsorship
      !isSubmitting && !isProcessing && !hasInsufficientBalance && isConnected;

  // Transaction details
  const transactionDetails: TransactionDetail[] = application.activeFraction
    ? [
        {
          label: "Location",
          value: application.zone.name,
        },
      ]
    : [];

  // Success details
  const successDetails: TransactionDetail[] = application.activeFraction
    ? [
        {
          label: "Quantity",
          value: stepsToBuy.toString(),
        },
        {
          label: `Total ${currency} Delegated`,
          value: formatNumber(
            parseFloat(
              formatUnits(
                BigInt(application.activeFraction.stepPrice) *
                  BigInt(stepsToBuy),
                DECIMALS_BY_TOKEN[currency]
              )
            ),
            0
          ),
          unit: currency,
        },
      ]
    : [];

  // Custom success content with processing delay notice
  const customSuccessContent = (
    <div className="space-y-4">
      {successDetails.map((detail, index) => (
        <div key={index} className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{detail.label}</span>
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
      <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 my-4">
        <div className="text-sm">
          Your {currency === "USDC" ? "purchase" : "delegation"} has been
          confirmed on-chain. It may take up to 1 minute to appear on your power
          wallet page due to backend processing.
        </div>
      </div>
    </div>
  );

  // Custom review content
  const reviewContent = (
    <div className="space-y-4">
      {/* Step Selection for Fractions or Currency Selection for Full Sponsorship */}
      {application.activeFraction ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quantity</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStepsToBuy(Math.max(1, stepsToBuy - 1))}
                disabled={stepsToBuy <= 1 || isSubmitting}
                className="h-8 w-8 p-0"
              >
                -
              </Button>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                enterKeyHint="done"
                aria-label="Quantity"
                className="h-10 w-24 text-center font-mono border-accent"
                value={quantityInput}
                onKeyDown={(e) => {
                  const allowedKeys = [
                    "Backspace",
                    "Delete",
                    "ArrowLeft",
                    "ArrowRight",
                    "ArrowUp",
                    "ArrowDown",
                    "Tab",
                    "Home",
                    "End",
                    "Enter",
                  ];
                  if (e.ctrlKey || e.metaKey || e.altKey) {
                    return;
                  }
                  if (allowedKeys.includes(e.key)) return;
                  if (!/^\d$/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (!/^\d+$/.test(pasted)) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setQuantityInput(val);
                    return;
                  }
                  const parsed = parseInt(val, 10);
                  if (Number.isNaN(parsed)) {
                    setQuantityInput(val);
                    return;
                  }
                  const maxSteps =
                    application.activeFraction?.remainingSteps ?? 0;
                  const minBound = maxSteps > 0 ? 1 : 0;
                  const clamped = Math.min(
                    Math.max(parsed, minBound),
                    maxSteps
                  );
                  setQuantityInput(String(clamped));
                  setStepsToBuy(clamped);
                }}
                onBlur={() => {
                  const maxSteps =
                    application.activeFraction?.remainingSteps ?? 0;
                  const minBound = maxSteps > 0 ? 1 : 0;
                  let parsed = parseInt(quantityInput, 10);
                  if (Number.isNaN(parsed)) parsed = minBound;
                  if (parsed < minBound) parsed = minBound;
                  if (parsed > maxSteps) parsed = maxSteps;
                  setStepsToBuy(parsed);
                  setQuantityInput(String(parsed));
                }}
                disabled={isSubmitting}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setStepsToBuy(
                    Math.min(
                      application.activeFraction?.remainingSteps || 1,
                      stepsToBuy + 1
                    )
                  )
                }
                disabled={
                  stepsToBuy >=
                    (application.activeFraction?.remainingSteps || 0) ||
                  isSubmitting
                }
                className="h-8 w-8 p-0"
              >
                +
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Max: {application.activeFraction.remainingSteps} available
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStepsToBuy(1)}
                disabled={stepsToBuy <= 1 || isSubmitting}
                className="h-7 px-2 py-0 text-xs"
              >
                Min
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setStepsToBuy(application.activeFraction?.remainingSteps || 1)
                }
                disabled={
                  stepsToBuy >=
                    (application.activeFraction?.remainingSteps || 0) ||
                  isSubmitting ||
                  (application.activeFraction?.remainingSteps || 0) <= 0
                }
                className="h-7 px-2 py-0 text-xs"
              >
                Max
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Payment Currency
            </span>
            GLW
          </div>
        </div>
      )}

      {/* USDC/USDG toggle not needed for fractions */}

      {/* Balance Info */}
      {!application.activeFraction && (
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Your Balance</span>
            <span
              className={`text-sm font-mono ${
                hasInsufficientBalance ? "text-destructive" : ""
              }`}
            >
              {formatNumber(userBalance, 2)} {displayCurrency}
            </span>
          </div>
        </div>
      )}

      {/* Token Balance Info for Step Purchases */}
      {application.activeFraction && (
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Your {currency} Balance
            </span>
            {!isConnected ? (
              <span className="text-sm text-muted-foreground">
                Connect wallet
              </span>
            ) : currency === "USDC" ? (
              isUsdcLoading || usdcBalance == null ? (
                <span className="text-sm text-muted-foreground">Loading…</span>
              ) : (
                <span className="text-sm font-mono">
                  {formatNumber(parseFloat(usdcBalance), 2)} USDC
                </span>
              )
            ) : isGlwLoading || glwBalance == null ? (
              <span className="text-sm text-muted-foreground">Loading…</span>
            ) : (
              <span className="text-sm font-mono">
                {formatNumber(parseFloat(glwBalance), 2)} GLW
              </span>
            )}
          </div>
        </div>
      )}

      {/* Estimated rewards for selected shares */}
      {application.activeFraction &&
        estimatedWeeklyGlwForSelection !== null && (
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Est. Weekly Rewards
              </span>
              <div className="text-right">
                <span className="text-sm font-mono">
                  {formatNumber(estimatedWeeklyGlwForSelection || 0, 2)}
                </span>
                <span className="text-xs text-muted-foreground ml-1">GLW</span>
                {estimatedWeeklyUsdForSelection !== null && (
                  <div className="text-xs text-muted-foreground">
                    ≈ ${formatNumber(estimatedWeeklyUsdForSelection || 0, 2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Quote Expiry */}
      {/* <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Quote expires in
          </span>
        </div>
        <span className="text-sm font-mono">
          {minutes.toString().padStart(2, "0")}:
          {seconds.toString().padStart(2, "0")}
        </span>
      </div> */}

      {/* Transaction Details */}
      <div className="space-y-3 pt-2">
        {transactionDetails.map((detail, index) => (
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

      {/* Insufficient Balance Warning */}
      {!application.activeFraction && hasInsufficientBalance && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <div className="text-sm text-destructive">
            Insufficient {displayCurrency} balance
          </div>
        </div>
      )}

      {/* Insufficient Token Balance Warning for Step Purchases */}
      {application.activeFraction &&
        (() => {
          if (!isConnected) return null;

          const pricePerStep = BigInt(application.activeFraction.stepPrice);
          const totalCost = pricePerStep * BigInt(stepsToBuy);
          const tokenDecimals = DECIMALS_BY_TOKEN[currency];

          if (currency === "GLW") {
            if (
              !glwShortfall?.isBalanceKnown ||
              !glwShortfall.hasInsufficientGlw
            )
              return null;

            const estimatedUsdcNeededRounded = glwShortfall.estimatedUsdcNeeded
              ? glwShortfall.estimatedUsdcNeeded
                  .add(BUY_GLOW_USDC_BUFFER)
                  .toDecimalPlaces(
                    DECIMALS_BY_TOKEN.USDC as number,
                    Decimal.ROUND_UP
                  )
              : null;

            const hasUsdcInfo = usdcBalanceDecimal !== null;
            const hasEstimate = estimatedUsdcNeededRounded !== null;
            const hasEnoughUsdc =
              hasUsdcInfo && hasEstimate
                ? usdcBalanceDecimal.gte(estimatedUsdcNeededRounded)
                : null;

            return (
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    Top up GLW to continue
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Required{" "}
                    <span className="font-mono text-foreground">
                      {formatNumber(glwShortfall.requiredGlw.toNumber(), 2)} GLW
                    </span>
                    {" • "}
                    Balance{" "}
                    <span className="font-mono text-foreground">
                      {formatNumber(glwShortfall.currentGlw!.toNumber(), 2)} GLW
                    </span>
                    {" • "}
                    Missing{" "}
                    <span className="font-mono text-amber-500">
                      {formatNumber(glwShortfall.missingGlw!.toNumber(), 2)} GLW
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background/40 p-3">
                  {hasEstimate ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Est. cost to buy missing GLW
                      </span>
                      <span className="text-xs font-mono text-foreground">
                        ≈{" "}
                        {formatNumber(
                          estimatedUsdcNeededRounded!.toNumber(),
                          2
                        )}{" "}
                        USDC
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Loading price… we’ll show an estimate once it’s ready.
                    </div>
                  )}
                  {hasEstimate && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Includes a $1 buffer to avoid being short on GLW.
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Your USDC balance
                    </span>
                    {hasUsdcInfo ? (
                      <span
                        className={[
                          "text-xs font-mono",
                          hasEnoughUsdc === false
                            ? "text-amber-500"
                            : "text-foreground",
                        ].join(" ")}
                      >
                        {formatNumber(usdcBalanceDecimal.toNumber(), 2)} USDC
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Loading…
                      </span>
                    )}
                  </div>

                  {hasEnoughUsdc === false && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      To buy more GLW, you must first add/purchase USDC to this
                      wallet. Once you have USDC, you can buy GLW and then
                      delegate.
                    </div>
                  )}
                </div>

                {hasEnoughUsdc === true && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      trackEvent("marketplace_deposit_buy_glw_click", {
                        currency,
                        application_id: application?.id ?? null,
                        fraction_id: application?.activeFraction?.id ?? null,
                        steps_to_buy: stepsToBuy,
                        estimated_usdc_needed:
                          estimatedUsdcNeededRounded?.toString() ?? null,
                      });
                      setIsBuyGlowDialogOpen(true);
                      trackEvent("marketplace_deposit_buy_glw_dialog_open", {
                        application_id: application?.id ?? null,
                        fraction_id: application?.activeFraction?.id ?? null,
                      });
                    }}
                  >
                    Buy GLW
                  </Button>
                )}
              </div>
            );
          }

          // USDC (miners) warning: keep basic behavior but avoid false positives while loading
          if (isUsdcLoading || usdcBalance == null) return null;

          const currentUsdc = parseFloat(usdcBalance);
          const requiredUsdc = parseFloat(
            formatUnits(totalCost, tokenDecimals)
          );

          return currentUsdc < requiredUsdc ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="text-sm font-medium text-foreground">
                Top up USDC to continue
              </div>
              <div className="text-xs text-muted-foreground">
                Required{" "}
                <span className="font-mono text-foreground">
                  {formatNumber(requiredUsdc, 2)} USDC
                </span>
                {" • "}
                Balance{" "}
                <span className="font-mono text-foreground">
                  {formatNumber(currentUsdc, 2)} USDC
                </span>
              </div>
            </div>
          ) : null;
        })()}
    </div>
  );

  // Custom error content for transaction ID display
  const customErrorContent =
    isError && txHash && errorMessage?.includes(txHash) ? (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-4">
            {errorMessage.split(txHash)[0]}
          </div>
          <div className="bg-muted/50 border border-border rounded-lg p-4 mb-4">
            <div className="text-xs text-muted-foreground mb-2">
              Transaction ID
            </div>
            <div className="font-mono text-sm break-all select-all">
              {txHash}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(txHash);
                toast.success("Transaction ID copied to clipboard");
              }}
              className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Click to copy
            </button>
          </div>
          <div className="text-sm text-muted-foreground">
            {errorMessage.split(txHash)[1]}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            asChild
          >
            <a href="https://discord.gg/glowfnd">Contact Support</a>
          </Button>
          <Button
            onClick={() => {
              // Reset states to try again
              setIsError(false);
              setErrorMessage(null);
              setTxHash(null);
              setIsSubmitting(false);
              setIsProcessing(false);
              sponsorMutation.reset();
            }}
            className="flex-1"
          >
            Try Again
          </Button>
        </div>
      </div>
    ) : null;

  // Custom processing content
  const processingContent = null;

  // Custom footer with acknowledgement
  const customFooter =
    !isSubmitting && !isProcessing ? (
      <>
        {/* Prominent Total Cost Row - only for fractions */}
        {application.activeFraction && (
          <div className="my-6 p-4 bg-accent/5 border-2 border-accent/20 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-foreground">
                Total {currency === "USDC" ? "Cost" : "Delegation"}
              </span>
              <div className="text-right">
                <span className="text-xl font-bold text-foreground">
                  {formatNumber(
                    parseFloat(
                      formatUnits(
                        BigInt(application.activeFraction.stepPrice) *
                          BigInt(stepsToBuy),
                        DECIMALS_BY_TOKEN[currency]
                      )
                    ),
                    currency === "USDC" ? 2 : 0
                  )}
                </span>
                <span className="text-base font-semibold text-muted-foreground ml-1">
                  {currency}
                </span>
              </div>
            </div>
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
          {isConnected ? (
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm}
              isLoading={isCheckingSmartAccount}
              className="flex-1"
            >
              {application.activeFraction
                ? currency === "USDC"
                  ? "Buy Miners"
                  : "Delegate GLW"
                : "Confirm Sponsorship"}
            </Button>
          ) : (
            <ConnectButton
              className="flex-1"
              size="medium"
              variant="default"
              onConnect={() => onOpenChange(false)}
            />
          )}
        </div>
      </>
    ) : null;

  return (
    <>
      <SmartAccountWarningDialog
        open={isSmartAccountWarningOpen}
        onOpenChange={setIsSmartAccountWarningOpen}
      />
      <BuyGlowDialog
        open={isBuyGlowDialogOpen}
        onOpenChange={setIsBuyGlowDialogOpen}
        usdcBalance={usdcBalanceBigInt}
        glowSpotPrice={glwSpotPrice || 0}
        defaultUsdcAmount={buyGlowInitialUsdcAmount ?? undefined}
        onSuccess={async () => {
          await Promise.all([refetchGlwBalance(), refetchUsdcBalance()]);
        }}
      />
      <TransactionDialog
        open={open}
        onOpenChange={onOpenChange}
        isSubmitting={isSubmitting || isProcessing}
        isSuccess={isSuccess}
        isError={isError}
        title={
          application.activeFraction
            ? currency === "USDC"
              ? "Buy Miners"
              : "Delegate GLW"
            : "Confirm Sponsorship"
        }
        successTitle={
          application.activeFraction
            ? currency === "USDC"
              ? "Purchase Complete!"
              : "Delegation Complete!"
            : "Farm Sponsored!"
        }
        errorTitle={
          application.activeFraction
            ? currency === "USDC"
              ? "Purchase Failed"
              : "Delegation Failed"
            : "Sponsorship Failed"
        }
        processingTitle={
          isProcessing
            ? "Confirming Transaction"
            : application.activeFraction
            ? currency === "USDC"
              ? "Processing Miners Purchase"
              : "Processing Delegation"
            : "Processing Sponsorship"
        }
        description={
          application.activeFraction
            ? currency === "USDC"
              ? "Review your purchase details"
              : "Review your delegation details"
            : "Review your sponsorship details"
        }
        processingDescription={
          isProcessing
            ? "Confirming transaction and updating records..."
            : application.activeFraction
            ? currency === "USDC"
              ? "Please wait while we process your purchase"
              : "Please wait while we process your delegation"
            : "Please wait while we process your sponsorship"
        }
        errorDescription={
          errorMessage ||
          (application.activeFraction
            ? currency === "USDC"
              ? "Failed to purchase miners"
              : "Failed to delegate"
            : "Failed to sponsor the farm")
        }
        transactionDetails={transactionDetails}
        successDetails={successDetails}
        txHash={txHash}
        isNetworkFeeLoading={isNetworkCostLoading}
        reviewContent={isProcessing ? processingContent : reviewContent}
        successContent={customSuccessContent}
        errorContent={customErrorContent}
        footer={customFooter}
        successFooter={
          application.activeFraction && currency === "GLW" ? (
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/wallet">See Power Wallet</Link>
            </Button>
          ) : null
        }
        showProcessingProgress={isProcessing}
        processingMaxSeconds={90}
        confirmDisabled={!canConfirm}
      />
    </>
  );
}
