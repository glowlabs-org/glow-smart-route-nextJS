"use client";

import React from "react";
import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getCurrencyDecimals, getDisplayDecimals } from "@/lib/currency";
import { formatNumber } from "./utils";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, parseUnits } from "viem";
import { DECIMALS_BY_TOKEN, useForwarder } from "@glowlabs-org/utils/browser";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useGctlApi } from "@/hooks/useGctlApi";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/connect-button";
import {
  calculateProtocolDepositAmount,
  calculateGctlPaymentAmount,
  getAvailableCurrencies,
  useSponsorApplication,
  type PaymentCurrency,
  type AuctionApplication,
} from "@/hooks/useMiningMarketplace";
import Decimal from "decimal.js";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: AuctionApplication | null;
  selectedCurrency: PaymentCurrency;
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
  const [currency, setCurrency] =
    React.useState<PaymentCurrency>(selectedCurrency);
  const [useUSDG, setUseUSDG] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);

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
  const [signerAddress, setSignerAddress] = React.useState<
    string | undefined
  >();

  React.useEffect(() => {
    if (signer) {
      signer.getAddress().then(setSignerAddress);
    }
  }, [signer]);

  const { fetchTransferDetails, gctlPriceNumber } = useGctlApi(signerAddress);
  const sponsorMutation = useSponsorApplication();

  // Initialize forwarder (will handle null signer internally)
  const forwarder = useForwarder(
    signer,
    parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!)
  );

  // Balance queries
  const {
    data: usdcBalance,
    isLoading: isUsdcLoading,
    refetch: refetchUsdcBalance,
  } = useQuery({
    queryKey: ["token-balance", "USDC", signerAddress],
    enabled: Boolean(signer && forwarder && open && signerAddress),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        if (!signer || !forwarder) return null;
        const userAddress = await signer.getAddress();
        const bal = await forwarder.checkTokenBalance(userAddress, "USDC");
        return formatUnits(bal, DECIMALS_BY_TOKEN.USDC);
      } catch (e) {
        return null;
      }
    },
  });

  const {
    data: usdgBalance,
    isLoading: isUsdgLoading,
    refetch: refetchUsdgBalance,
  } = useQuery({
    queryKey: ["token-balance", "USDG", signerAddress],
    enabled: Boolean(signer && forwarder && open && signerAddress),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        if (!signer || !forwarder) return null;
        const userAddress = await signer.getAddress();
        const bal = await forwarder.checkTokenBalance(userAddress, "USDG");
        return formatUnits(bal, DECIMALS_BY_TOKEN.USDG);
      } catch (e) {
        return null;
      }
    },
  });

  const {
    data: glwBalance,
    isLoading: isGlwLoading,
    refetch: refetchGlwBalance,
  } = useQuery({
    queryKey: ["token-balance", "GLW", signerAddress],
    enabled: Boolean(signer && forwarder && open && signerAddress),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        if (!signer || !forwarder) return null;
        const userAddress = await signer.getAddress();
        const bal = await forwarder.checkTokenBalance(userAddress, "GLW");
        return formatUnits(bal, DECIMALS_BY_TOKEN.GLW);
      } catch (e) {
        return null;
      }
    },
  });

  // const expiryMs = lockedAtMs + QUOTE_LOCK_MINUTES * 60 * 1000;
  // const secondsRemaining = Math.max(0, Math.floor((expiryMs - nowMs) / 1000));
  // const minutes = Math.floor(secondsRemaining / 60);
  // const seconds = secondsRemaining % 60;

  // Calculate deposit amounts and available currencies
  const availableCurrencies = React.useMemo(() => {
    return application
      ? getAvailableCurrencies(application.applicationPriceQuotes)
      : [];
  }, [application]);

  const depositAmount = React.useMemo(() => {
    if (!application) return null;

    // If GCTL is selected and we're paying with USDC/USDG
    if (currency === "GCTL" && gctlPriceNumber > 0) {
      return calculateGctlPaymentAmount(
        application.finalProtocolFee,
        application.applicationPriceQuotes,
        gctlPriceNumber
      );
    }

    // For all other currencies, use standard calculation
    return calculateProtocolDepositAmount(
      application.finalProtocolFee,
      application.applicationPriceQuotes,
      currency
    );
  }, [application, currency, gctlPriceNumber]);

  const depositAmountNumber = React.useMemo(() => {
    if (!depositAmount) return 0;
    try {
      return new Decimal(depositAmount).toNumber();
    } catch {
      return 0;
    }
  }, [depositAmount]);

  // Get user balance for selected currency
  const userBalance = React.useMemo(() => {
    const effectiveCurrency =
      currency === "GCTL" ? (useUSDG ? "USDG" : "USDC") : currency;

    try {
      switch (effectiveCurrency) {
        case "USDC":
          return new Decimal(usdcBalance || "0").toNumber();
        case "USDG":
          return new Decimal(usdgBalance || "0").toNumber();
        case "GLW":
          return new Decimal(glwBalance || "0").toNumber();
        default:
          return 0;
      }
    } catch {
      return 0;
    }
  }, [currency, useUSDG, usdcBalance, usdgBalance, glwBalance]);

  const hasInsufficientBalance = depositAmountNumber > userBalance;

  // Format display values - moved before early returns to maintain hook order
  const displayCurrency =
    currency === "GCTL" ? (useUSDG ? "USDG" : "USDC") : currency;
  const paymentAmountText = React.useMemo(() => {
    if (!application) return "0";
    if (currency === "GCTL" && gctlPriceNumber > 0) {
      const gctlPaymentAmount = calculateGctlPaymentAmount(
        application.finalProtocolFee,
        application.applicationPriceQuotes,
        gctlPriceNumber
      );
      if (gctlPaymentAmount) {
        try {
          const amount = new Decimal(gctlPaymentAmount);
          return formatNumber(amount.toNumber(), 0);
        } catch {
          return "0";
        }
      }
      return "0";
    }
    return formatNumber(depositAmountNumber, 0);
  }, [application, currency, gctlPriceNumber, depositAmountNumber]);

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

  // Sync with externally selected currency
  React.useEffect(() => {
    if (availableCurrencies.includes(selectedCurrency)) {
      setCurrency(selectedCurrency);
    } else if (availableCurrencies.length > 0) {
      setCurrency(availableCurrencies[0]);
    }
  }, [selectedCurrency, availableCurrencies]);

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

  async function handleConfirm() {
    if (!application || !signer || !forwarder || !depositAmount) {
      toast.error("Missing required information for payment");
      return;
    }

    try {
      setIsSubmitting(true);
      setIsError(false);
      setErrorMessage(null);

      const userAddress = await signer.getAddress();

      // Determine actual payment currency and amount
      const useGCTL = currency === "GCTL";
      const actualPaymentCurrency = useGCTL
        ? useUSDG
          ? "USDG"
          : "USDC"
        : currency;

      const paymentAmount = useGCTL
        ? calculateGctlPaymentAmount(
            application.finalProtocolFee,
            application.applicationPriceQuotes,
            gctlPriceNumber
          )
        : depositAmount;

      if (!paymentAmount) {
        throw new Error(`Price not available in ${actualPaymentCurrency}`);
      }

      const actualDecimals = getCurrencyDecimals(actualPaymentCurrency);
      console.log("paymentAmount", paymentAmount);
      console.log("actualDecimals", actualDecimals);

      // Use Decimal for precise conversion
      const paymentAmountDecimal = new Decimal(paymentAmount);
      const multiplier = new Decimal(10).pow(actualDecimals);
      const amountBigInt = BigInt(
        paymentAmountDecimal.mul(multiplier).toFixed(0)
      );
      const amount = amountBigInt;

      // Phase 1: Token Approval
      await forwarder.approveToken(
        amount,
        actualPaymentCurrency as "USDC" | "USDG" | "GLW"
      );

      // Refresh balances after approval
      await Promise.all([
        refetchUsdcBalance(),
        refetchUsdgBalance(),
        refetchGlwBalance(),
      ]);

      // Phase 2: Payment Processing
      const paymentTxHash = useGCTL
        ? await forwarder.sponsorProtocolFeeAndMintGCTLAndStake(
            amount,
            userAddress,
            application.id,
            actualPaymentCurrency as "USDC" | "USDG"
          )
        : await forwarder.sponsorProtocolFee(
            amount,
            userAddress,
            application.id,
            actualPaymentCurrency as "USDC" | "USDG" | "GLW"
          );

      setTxHash(paymentTxHash);
      setIsSubmitting(false);
      setIsProcessing(true);

      // Store values for use in polling callback
      const sponsorshipData = {
        applicationId: application.id,
        amount: amount,
        currency: actualPaymentCurrency,
        txHash: paymentTxHash,
      };

      // Start polling for transaction confirmation
      let pollCount = 0;
      const maxPolls = 15; // Poll for up to 5 minutes (15 * 10s)
      let transferFound = false;

      const pollInterval = setInterval(async () => {
        try {
          pollCount++;

          const result = await fetchTransferDetails(paymentTxHash);

          if (result.ok) {
            const transfer = result.val;
            transferFound = true;
            console.log("Transfer status:", transfer.status);

            if (transfer.status === "confirmed") {
              clearInterval(pollInterval);
              setIsProcessing(false);
              setIsSuccess(true);

              // Refresh balances after payment
              await Promise.all([
                refetchUsdcBalance(),
                refetchUsdgBalance(),
                refetchGlwBalance(),
              ]);

              // Trigger the mutation to invalidate queries
              await sponsorMutation.mutateAsync({
                ...sponsorshipData,
                onSuccess: onSuccess,
              });
            } else if (transfer.status === "failed") {
              clearInterval(pollInterval);
              setIsProcessing(false);
              setIsError(true);
              setErrorMessage("Transaction failed");
            }
          } else if (pollCount >= maxPolls) {
            // After 2 minutes, if transfer not found, show error
            clearInterval(pollInterval);
            setIsProcessing(false);
            setIsError(true);

            if (!transferFound) {
              setErrorMessage(
                `Transaction not found after 2 minutes. Your transaction ID is: ${paymentTxHash}. Please save this ID and try again later or contact support.`
              );
            } else {
              // Transfer was found but still pending after 2 minutes
              setErrorMessage(
                `Transaction is taking longer than expected. Your transaction ID is: ${paymentTxHash}. Please save this ID and check back later.`
              );
            }
          }
        } catch (error) {
          console.error("Error polling transaction status:", error);
          // Continue polling on error
        }
      }, 10000); // Poll every 10 seconds
    } catch (error: any) {
      setIsSubmitting(false);
      setIsError(true);
      const message = error?.message || "Transaction failed";
      setErrorMessage(message);
      setTxHash(error?.txHash ?? null);
      console.error("handlePayment error", error);
      toast.error(message);
    }
  }

  // Early return conditions - check these in render
  if (!application) return null;

  // Show connect wallet state
  if (!isConnected) {
    return (
      <TransactionDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Connect Wallet Required"
        description="Please connect your wallet to sponsor this application"
        transactionDetails={[]}
        reviewContent={
          <div className="py-8">
            <ConnectButton variant="default" size="large" className="w-full" />
          </div>
        }
      />
    );
  }

  const canConfirm =
    !isSubmitting &&
    !isProcessing &&
    !hasInsufficientBalance &&
    depositAmount &&
    isConnected &&
    acknowledged;

  // Transaction details
  const transactionDetails: TransactionDetail[] = [
    {
      label: "Reward Score",
      value: 0, //TODO: Replace with actual reward score
    },
    {
      label: "Location",
      value: application.zone.name,
    },
    {
      label: currency === "GCTL" ? "Payment Amount" : "Protocol Deposit",
      value: paymentAmountText,
      unit: displayCurrency,
    },
    ...(currency === "GCTL"
      ? [
          {
            label: "GCTL Amount",
            value: formatNumber(
              new Decimal(
                calculateProtocolDepositAmount(
                  application.finalProtocolFee,
                  application.applicationPriceQuotes,
                  "GCTL"
                ) || "0"
              ).toNumber(),
              0
            ),
            unit: "GCTL",
          },
        ]
      : []),
    {
      label: "Sponsor Split",
      value: `${application.sponsorSplitPercent}%`,
    },
  ];

  // Success details
  const successDetails: TransactionDetail[] = [
    {
      label: "Amount Paid",
      value: paymentAmountText,
      unit: displayCurrency,
    },
    {
      label: "Farm Sponsored",
      value:
        application.enquiryFields?.farmOwnerName ||
        `Farm ${application.id.slice(0, 8)}`,
    },
    {
      label: "Your Sponsor Split",
      value: `${application.sponsorSplitPercent}%`,
    },
  ];

  // Custom review content
  const reviewContent = (
    <div className="space-y-4">
      {/* Currency Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Payment Currency
          </span>
          <Select
            value={currency}
            onValueChange={(v) => setCurrency(v as PaymentCurrency)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableCurrencies.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* USDC/USDG toggle for GCTL */}
        {currency === "GCTL" && (
          <div className="flex items-center justify-between pl-4">
            <span className="text-xs text-muted-foreground">Pay with</span>
            <Select
              value={useUSDG ? "USDG" : "USDC"}
              onValueChange={(v) => setUseUSDG(v === "USDG")}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-[100px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USDC">USDC</SelectItem>
                <SelectItem value="USDG">USDG</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Balance Info */}
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
      {hasInsufficientBalance && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <div className="text-sm text-destructive">
            Insufficient {displayCurrency} balance
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
              I understand that I am sponsoring this solar farm and will receive{" "}
              {application.sponsorSplitPercent}% of the weekly GLW rewards
              generated
            </span>
          </label>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1"
          >
            Confirm Sponsorship
          </Button>
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
      title="Confirm Sponsorship"
      successTitle="Farm Sponsored!"
      errorTitle="Sponsorship Failed"
      processingTitle={
        isProcessing ? "Confirming Transaction" : "Processing Sponsorship"
      }
      description="Review your sponsorship details"
      processingDescription={
        isProcessing
          ? "Waiting for blockchain confirmation..."
          : "Please wait while we process your sponsorship"
      }
      errorDescription={errorMessage || "Failed to sponsor the farm"}
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
