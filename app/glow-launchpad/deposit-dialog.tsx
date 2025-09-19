"use client";

import React from "react";
import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  useSponsorApplication,
  type AuctionApplication,
} from "@/hooks/useGlowLaunchpad";
import {
  useRewardScore,
  getRewardScoreForApplication,
} from "@/hooks/useRewardScore";
import { useFractionSplits } from "@/hooks/useFractionSplits";
import Decimal from "decimal.js";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: AuctionApplication | null;
  selectedCurrency: "GLW"; // Only GLW is supported for fractions
  onSuccess?: () => void;
}

// const QUOTE_LOCK_MINUTES = 60;

export function DepositDialog({
  open,
  onOpenChange,
  application,
  selectedCurrency,
  onSuccess,
}: DepositDialogProps) {
  const { isConnected } = useAccount();
  // const [quoteId, setQuoteId] = React.useState<string>(generateQuoteId());
  const [lockedAtMs, setLockedAtMs] = React.useState<number>(Date.now());
  const [nowMs, setNowMs] = React.useState<number>(Date.now());
  // Only GLW is supported for fractions
  const currency = "GLW";
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [stepsToBuy, setStepsToBuy] = React.useState(1);

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

  React.useEffect(() => {
    if (signer) {
      signer.getAddress().then(setSignerAddress);
    }
  }, [signer]);

  const sponsorMutation = useSponsorApplication();

  // Get reward score for the application
  const { rewardScoreMap } = useRewardScore({
    applications: application ? [application] : [],
    paymentCurrency: currency,
    enabled: Boolean(application && open),
  });

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
      signer && fractions.isSignerAvailable && open && signerAddress
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
      // Only GLW is supported for fractions
      if (application?.activeFraction) {
        return new Decimal(glwBalance || "0").toNumber();
      }

      // Legacy support for non-fraction applications (though these are no longer supported)
      return new Decimal(glwBalance || "0").toNumber();
    } catch {
      return 0;
    }
  }, [glwBalance, application?.activeFraction]);

  const hasInsufficientBalance = depositAmountNumber > userBalance;

  // For fractions, display currency is always GLW
  const displayCurrency = "GLW";

  // Reset states when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setIsProcessing(false);
      setIsSuccess(false);
      setIsError(false);
      setErrorMessage(null);
      setTxHash(null);
      setAcknowledged(false);
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
      toast.error("Missing required information for share purchase");
      return;
    }

    try {
      setIsSubmitting(true);
      setIsError(false);
      setErrorMessage(null);

      const userAddress = await signer.getAddress();
      const { activeFraction } = application;

      // Calculate total GLW needed
      const totalGlwNeeded = BigInt(activeFraction.step) * BigInt(stepsToBuy);

      // Check GLW balance
      const glwBalance = await fractions.checkTokenBalance(
        userAddress,
        fractions.addresses.GLW
      );

      if (glwBalance < totalGlwNeeded) {
        throw new Error(
          `Insufficient GLW balance. Need ${formatUnits(
            totalGlwNeeded,
            DECIMALS_BY_TOKEN.GLW
          )} GLW, have ${formatUnits(glwBalance, DECIMALS_BY_TOKEN.GLW)} GLW`
        );
      }

      // Check and approve GLW allowance if needed
      const currentAllowance = await fractions.checkTokenAllowance(
        userAddress,
        fractions.addresses.GLW
      );

      if (currentAllowance < totalGlwNeeded) {
        try {
          await fractions.approveToken(fractions.addresses.GLW, totalGlwNeeded);

          // Wait a bit for approval to be indexed
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Verify approval was successful
          const newAllowance = await fractions.checkTokenAllowance(
            userAddress,
            fractions.addresses.GLW
          );

          if (newAllowance < totalGlwNeeded) {
            throw new Error("Token approval failed. Please try again.");
          }
        } catch (approvalError: any) {
          if (
            approvalError.message?.includes("User rejected") ||
            approvalError.message?.includes("User denied")
          ) {
            throw new Error("Token approval was rejected");
          }
          throw approvalError;
        }
      }

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

      // Validate that we actually got a transaction hash
      if (!txHash) {
        throw new Error(
          "No transaction hash received. Transaction may not have been submitted."
        );
      }

      // Poll for transaction confirmation
      const provider = signer.provider;
      let receipt = null;

      if (provider) {
        let attempts = 0;
        const maxAttempts = 60; // 60 attempts with 1 second delay = 1 minute max

        while (!receipt && attempts < maxAttempts) {
          try {
            receipt = await provider.getTransactionReceipt(txHash);
            if (receipt) {
              if (receipt.status === 0) {
                throw new Error("Transaction failed on-chain");
              }
              break;
            }
          } catch (e) {
            console.log("Waiting for transaction confirmation...");
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
        }

        if (!receipt) {
          throw new Error(
            "Transaction confirmation timeout. Please check your wallet for the transaction status."
          );
        }
      } else {
        throw new Error(
          "Unable to confirm transaction - provider not available"
        );
      }

      // Refresh splits immediately to start polling
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
          console.log(
            `Purchase confirmed! User now owns ${latestSplits.summary.totalStepsPurchased} total shares`
          );
          break;
        }
      }

      if (!purchaseConfirmed) {
        console.warn(
          "Purchase confirmation timeout - transaction may still be processing"
        );
        toast.warning(
          "Purchase may still be processing. Check your wallet for updates."
        );
      }

      // Only set success after confirmation (or timeout)
      setIsProcessing(false);
      setIsSuccess(true);

      // Refresh balances
      await refetchGlwBalance();

      toast.success(`Successfully purchased ${stepsToBuy} shares!`);

      // Trigger the mutation to invalidate queries
      await sponsorMutation.mutateAsync({
        applicationId: application.id,
        amount: totalGlwNeeded,
        currency: "GLW",
        txHash: txHash,
        onSuccess: onSuccess,
      });
    } catch (error: any) {
      setIsSubmitting(false);
      setIsProcessing(false);
      setIsError(true);

      let message = "Share purchase failed";

      // Handle specific error types based on OffchainFractionsError enum
      if (
        error.message?.includes("Insufficient balance") ||
        error.message?.includes("Insufficient GLW balance")
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
    }
  }

  async function handleConfirm() {
    // Only handle step-based purchasing for fractions
    if (application?.activeFraction) {
      return handleStepPurchase();
    }

    // No other payment methods are supported
    toast.error("Only fraction-based applications are supported");
  }

  // Get reward score for display (must be before any early returns to keep hook order stable)
  const rewardScore = application
    ? getRewardScoreForApplication(rewardScoreMap, application.id)
    : null;

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
        const glwPerShare = totalGlw / totalShares;

        const totalUsd = parseFloat(
          formatUnits(BigInt(rewardScore.userEstimatedWeeklyCash || "0"), 6)
        );
        const usdPerShare = totalUsd / totalShares;

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
    }, [application?.activeFraction, rewardScore, stepsToBuy]);

  // Early return conditions - check these in render
  if (!application) return null;

  const canConfirm = application.activeFraction
    ? // For step-based purchasing
      !isSubmitting &&
      !isProcessing &&
      stepsToBuy > 0 &&
      stepsToBuy <= (application.activeFraction.remainingSteps || 0) &&
      isConnected &&
      acknowledged
    : // For full sponsorship
      !isSubmitting &&
      !isProcessing &&
      !hasInsufficientBalance &&
      isConnected &&
      acknowledged;

  // Transaction details
  const transactionDetails: TransactionDetail[] = application.activeFraction
    ? [
        {
          label: "Location",
          value: application.zone.name,
        },

        {
          label: "Price per Share",
          value: formatNumber(
            parseFloat(
              formatUnits(
                BigInt(application.activeFraction.step),
                DECIMALS_BY_TOKEN["GLW"]
              )
            ),
            0
          ),
          unit: "GLW",
        },
      ]
    : [];

  // Success details
  const successDetails: TransactionDetail[] = application.activeFraction
    ? [
        {
          label: "Shares Purchased",
          value: stepsToBuy.toString(),
        },
        {
          label: "Total GLW Paid",
          value: formatNumber(
            parseFloat(
              formatUnits(
                BigInt(application.activeFraction.step) * BigInt(stepsToBuy),
                DECIMALS_BY_TOKEN["GLW"]
              )
            ),
            0
          ),
          unit: "GLW",
        },
        {
          label: "Farm",
          value:
            application.enquiryFields?.farmOwnerName ||
            `Farm ${application.id.slice(0, 8)}`,
        },
      ]
    : [];

  // Custom review content
  const reviewContent = (
    <div className="space-y-4">
      {/* Step Selection for Fractions or Currency Selection for Full Sponsorship */}
      {application.activeFraction ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Shares to Buy</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStepsToBuy(Math.max(1, stepsToBuy - 1))}
                disabled={stepsToBuy <= 1 || isSubmitting}
                className="h-8 w-8 p-0"
              >
                -
              </Button>
              <span className="text-sm font-mono w-12 text-center">
                {stepsToBuy}
              </span>
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
          <div className="text-xs text-muted-foreground text-right">
            Max: {application.activeFraction.remainingSteps} shares available
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

      {/* GLW Balance Info for Step Purchases */}
      {application.activeFraction && (
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Your GLW Balance
            </span>
            <span className="text-sm font-mono">
              {formatNumber(parseFloat(glwBalance || "0"), 2)} GLW
            </span>
          </div>
        </div>
      )}

      {/* Estimated rewards for selected shares */}
      {application.activeFraction &&
        estimatedWeeklyGlwForSelection !== null && (
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Est. Weekly Rewards for {stepsToBuy} share
                {stepsToBuy !== 1 ? "s" : ""}
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

      {/* Insufficient GLW Balance Warning for Step Purchases */}
      {application.activeFraction &&
        parseFloat(glwBalance || "0") <
          parseFloat(
            formatUnits(
              BigInt(application.activeFraction.step) * BigInt(stepsToBuy),
              DECIMALS_BY_TOKEN["GLW"]
            )
          ) && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="text-sm text-destructive">
              Insufficient GLW balance for {stepsToBuy} shares
            </div>
          </div>
        )}
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
        <div className="mb-6 mt-4 p-4 bg-muted/50 border border-border rounded-xl">
          <label
            htmlFor="ack-sponsor"
            className="flex items-start gap-3 text-sm cursor-pointer"
          >
            <Checkbox
              id="ack-sponsor"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(Boolean(v))}
              className="mt-0.5 border-accent size-5"
            />
            <span className="text-foreground leading-relaxed">
              {application.activeFraction
                ? `I understand that I am purchasing ${stepsToBuy} shares of this solar farm and will receive ${(
                    (application.activeFraction.sponsorSplitPercent *
                      stepsToBuy) /
                    (application.activeFraction.totalSteps || 1)
                  ).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}% of the weekly GLW rewards for each share owned`
                : `I understand that I am sponsoring this solar farm and will receive ${application.sponsorSplitPercent}% of the weekly GLW rewards generated`}
            </span>
          </label>
        </div>

        {/* Prominent Total Cost Row - only for fractions */}
        {application.activeFraction && (
          <div className="mb-6 p-4 bg-accent/5 border-2 border-accent/20 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-foreground">
                Total Cost
              </span>
              <div className="text-right">
                <span className="text-xl font-bold text-foreground">
                  {formatNumber(
                    parseFloat(
                      formatUnits(
                        BigInt(application.activeFraction.step) *
                          BigInt(stepsToBuy),
                        DECIMALS_BY_TOKEN["GLW"]
                      )
                    ),
                    0
                  )}
                </span>
                <span className="text-base font-semibold text-muted-foreground ml-1">
                  GLW
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
              className="flex-1"
            >
              {application.activeFraction
                ? `Buy ${stepsToBuy} Shares`
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
    <TransactionDialog
      open={open}
      onOpenChange={onOpenChange}
      isSubmitting={isSubmitting || isProcessing}
      isSuccess={isSuccess}
      isError={isError}
      title={
        application.activeFraction ? "Buy Farm Shares" : "Confirm Sponsorship"
      }
      successTitle={
        application.activeFraction ? "Shares Purchased!" : "Farm Sponsored!"
      }
      errorTitle={
        application.activeFraction
          ? "Share Purchase Failed"
          : "Sponsorship Failed"
      }
      processingTitle={
        isProcessing
          ? "Confirming Transaction"
          : application.activeFraction
          ? "Processing Share Purchase"
          : "Processing Sponsorship"
      }
      description={
        application.activeFraction
          ? "Review your share purchase details"
          : "Review your sponsorship details"
      }
      processingDescription={
        isProcessing
          ? "Confirming transaction and updating records..."
          : application.activeFraction
          ? "Please wait while we process your share purchase"
          : "Please wait while we process your sponsorship"
      }
      errorDescription={
        errorMessage ||
        (application.activeFraction
          ? "Failed to purchase shares"
          : "Failed to sponsor the farm")
      }
      transactionDetails={transactionDetails}
      successDetails={successDetails}
      txHash={txHash}
      isNetworkFeeLoading={isNetworkCostLoading}
      reviewContent={isProcessing ? processingContent : reviewContent}
      errorContent={customErrorContent}
      footer={customFooter}
      confirmDisabled={!canConfirm}
    />
  );
}
