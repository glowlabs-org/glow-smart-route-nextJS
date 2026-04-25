"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle,
  RefreshCw,
  Clock,
  XCircle,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUnits } from "viem";
import { useOffchainFractions } from "@glowlabs-org/utils/browser";
import { useWalletClient } from "wagmi";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { useRefundableFractions, type RefundableFraction } from "@/hooks";
import { usePolling } from "@/utils/use-polling";
import { useLang } from "@/lib/i18n";

interface RefundClaimsPanelProps {
  walletAddress: string | undefined;
  onClaimSuccess?: () => void;
  variant?: "page" | "dialog";
}

export function RefundClaimsPanel({
  walletAddress,
  onClaimSuccess,
  variant = "page",
}: RefundClaimsPanelProps) {
  const { t } = useLang();
  const { data: walletClient } = useWalletClient();
  const [processingRefunds, setProcessingRefunds] = React.useState<Set<string>>(
    new Set()
  );

  // Get refundable fractions
  const { refundableFractions, summary, isLoading, isError, refetch } =
    useRefundableFractions({
      walletAddress: walletAddress || null,
      enabled: Boolean(walletAddress),
    });

  // Get offchain fractions contract functions
  const { claimRefund, isProcessing } = useOffchainFractions(
    walletClient,
    publicClient,
    parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!)
  );

  // Helper function to format refund amount (GLW with 18 decimals)
  function formatRefundAmount(amount: string): string {
    try {
      const formatted = formatUnits(BigInt(amount), 18); // GLW uses 18 decimals
      const num = parseFloat(formatted);
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    } catch {
      return "0.00";
    }
  }

  // Use polling hook for checking refund status
  const { startPolling, isPolling } = usePolling({
    pollFn: async () => {
      const { data } = await refetch();
      return data;
    },
    pollInterval: 10000, // 10 seconds
    maxDuration: 120, // 2 minutes max
    shouldStopPolling: (data) => {
      if (!data) return false;
      // Stop polling when the refund is no longer in the list
      const processingFractionIds = Array.from(processingRefunds);
      if (processingFractionIds.length === 0) return false;

      const stillExists = data.refundableFractions.some((refund) =>
        processingFractionIds.includes(refund.fraction.id)
      );
      return !stillExists;
    },
    onSuccess: (data) => {
      setProcessingRefunds(new Set());
      // Show success toast when refund is confirmed removed
      toast.success(t.dialogs.refundClaims.refunded, {
        description: t.dialogs.refundClaims.refundedDesc,
      });
      if (onClaimSuccess) {
        onClaimSuccess();
      }
    },
    onError: (error) => {
      console.error("Polling timeout:", error);
      setProcessingRefunds(new Set());
      toast.warning(t.dialogs.refundClaims.slowPipeline, {
        description: t.dialogs.refundClaims.slowPipelineDesc,
      });
    },
  });

  // Handle individual refund claim
  async function handleClaimRefund(refundableFraction: RefundableFraction) {
    if (!walletClient) {
      toast.error(t.dialogs.refundClaims.connectWallet);
      return;
    }

    const fractionId = refundableFraction.fraction.id;
    setProcessingRefunds((prev) => new Set(prev).add(fractionId));

    try {
      const txHash = await claimRefund(
        refundableFraction.refundDetails.user,
        refundableFraction.refundDetails.creator,
        refundableFraction.refundDetails.fractionId
      );

      // Show initial transaction submitted toast
      toast.info(t.dialogs.refundClaims.submitted, {
        description: t.dialogs.refundClaims.submittedDesc(txHash),
        action: {
          label: t.dialogs.refundClaims.viewAction,
          onClick: () =>
            window.open(`https://etherscan.io/tx/${txHash}`, "_blank"),
        },
      });

      // Start polling to check when refund is removed from the list
      startPolling();
    } catch (error: any) {
      console.error("Failed to claim refund:", error);
      toast.error(t.dialogs.refundClaims.failed, {
        description: error?.message || t.dialogs.refundClaims.tryAgain,
      });

      // Remove from processing on error
      setProcessingRefunds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fractionId);
        return newSet;
      });
    }
  }

  // Handle claim all refunds
  async function handleClaimAllRefunds() {
    if (!walletClient) {
      toast.error(t.dialogs.refundClaims.connectWallet);
      return;
    }

    if (refundableFractions.length === 0) {
      toast.info(t.dialogs.refundClaims.noRefunds);
      return;
    }

    toast.info(
      t.dialogs.refundClaims.processingCount(refundableFractions.length),
    );

    for (const refundableFraction of refundableFractions) {
      try {
        await handleClaimRefund(refundableFraction);
        // Add a small delay between transactions to avoid nonce issues
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(
          `Failed to claim refund for ${refundableFraction.fraction.id}:`,
          error
        );
        // Continue with other refunds even if one fails
      }
    }
  }

  // Only show the panel if there are actual refunds
  if (isLoading || isError || refundableFractions.length === 0) {
    return null;
  }

  return (
    <Card
      className={cn(
        "bg-transparent",
        variant === "page" ? "mb-8" : "mb-0 border-0 shadow-none"
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              {t.dialogs.refundClaims.availableRefunds}
            </CardTitle>
            <CardDescription className="mt-2 text-base">
              {t.dialogs.refundClaims.description}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {refundableFractions.length > 1 && (
              <Button
                onClick={handleClaimAllRefunds}
                disabled={
                  isProcessing || processingRefunds.size > 0 || isPolling
                }
                className="w-full sm:w-auto"
              >
                {isPolling ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t.dialogs.refundClaims.confirming}
                  </>
                ) : (
                  <>
                    {t.dialogs.refundClaims.claimAll}
                    <Badge variant="secondary" className="ml-2">
                      {refundableFractions.length}
                    </Badge>
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="default"
              onClick={() => refetch()}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              {t.dialogs.refundClaims.refresh}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Individual Refund Items */}
          {refundableFractions.map((refundableFraction) => {
            const isProcessingThis = processingRefunds.has(
              refundableFraction.fraction.id
            );

            return (
              <div
                key={refundableFraction.fraction.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 rounded-xl border",
                  "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                )}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-2 rounded-full bg-background text-orange-600 flex-shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex flex-wrap items-center gap-2 mb-1">
                      <span>{t.dialogs.refundClaims.quantity}</span>
                      <Badge
                        variant={
                          refundableFraction.fraction.status === "expired"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {refundableFraction.fraction.status === "expired" ? (
                          <>
                            <Clock className="w-3 h-3 mr-1" />
                            {t.dialogs.refundClaims.expired}
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" />
                            {t.dialogs.refundClaims.cancelled}
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {refundableFraction.userPurchaseData.totalStepsPurchased}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <div className="font-bold text-xl tracking-tight">
                      {formatRefundAmount(
                        refundableFraction.refundDetails.estimatedRefundAmount
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      GLW
                    </div>
                  </div>
                  <Button
                    size="default"
                    variant="default"
                    onClick={() => handleClaimRefund(refundableFraction)}
                    disabled={isProcessingThis || isProcessing || isPolling}
                    className="flex-shrink-0"
                  >
                    {isProcessingThis ||
                    (isPolling &&
                      processingRefunds.has(refundableFraction.fraction.id)) ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        {isPolling
                          ? t.dialogs.refundClaims.confirming
                          : t.dialogs.refundClaims.processing}
                      </>
                    ) : (
                      t.dialogs.refundClaims.claim
                    )}
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Info Section */}
          <div className="mt-6 p-4 md:p-6 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <div className="font-semibold mb-2">
                  {t.dialogs.refundClaims.aboutTitle}
                </div>
                <div className="leading-relaxed">
                  {t.dialogs.refundClaims.totalRefundable}{" "}
                  <span className="font-medium text-foreground">
                    {t.dialogs.refundClaims.aboutDescription(
                      formatRefundAmount(summary.totalRefundableAmount),
                      summary.totalRefundableFractions,
                      summary.byStatus.expired,
                      summary.byStatus.cancelled,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
