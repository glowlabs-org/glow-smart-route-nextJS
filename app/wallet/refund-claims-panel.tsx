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
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  useRefundableFractions,
  type RefundableFraction,
} from "@/hooks/useFractionSplits";

interface RefundClaimsPanelProps {
  walletAddress: string | undefined;
}

export function RefundClaimsPanel({ walletAddress }: RefundClaimsPanelProps) {
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

  // Handle individual refund claim
  async function handleClaimRefund(refundableFraction: RefundableFraction) {
    if (!walletClient) {
      toast.error("Please connect your wallet");
      return;
    }

    const fractionId = refundableFraction.fraction.id;
    setProcessingRefunds((prev) => new Set(prev).add(fractionId));
    console.log(
      refundableFraction,
      refundableFraction.refundDetails.user,
      refundableFraction.refundDetails.creator,
      refundableFraction.refundDetails.fractionId
    );
    try {
      const txHash = await claimRefund(
        refundableFraction.refundDetails.user,
        refundableFraction.refundDetails.creator,
        refundableFraction.refundDetails.fractionId
      );

      toast.success("Refund claimed successfully!", {
        description: `Transaction: ${txHash}`,
        action: {
          label: "View",
          onClick: () =>
            window.open(`https://etherscan.io/tx/${txHash}`, "_blank"),
        },
      });

      // Refresh the refundable fractions data
      refetch();
    } catch (error: any) {
      console.error("Failed to claim refund:", error);
      toast.error("Failed to claim refund", {
        description: error?.message || "Please try again",
      });
    } finally {
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
      toast.error("Please connect your wallet");
      return;
    }

    if (refundableFractions.length === 0) {
      toast.info("No refunds available to claim");
      return;
    }

    toast.info(`Processing ${refundableFractions.length} refund claims...`);

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

  // Don't show the panel if there are no refunds and not loading
  if (!isLoading && !isError && refundableFractions.length === 0) {
    return null;
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Available Refunds
            </CardTitle>
            <CardDescription className="mt-2">
              Claim refunds from expired or cancelled farm sponsorships
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {refundableFractions.length > 1 && (
              <Button
                onClick={handleClaimAllRefunds}
                disabled={isProcessing || processingRefunds.size > 0}
              >
                Claim All
                <Badge variant="secondary" className="ml-2">
                  {refundableFractions.length} refunds
                </Badge>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg border bg-orange-50 dark:bg-orange-950/20"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right space-y-1">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-12 px-4 rounded-xl bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Failed to load refundable fractions. Please try refreshing.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        ) : refundableFractions.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl bg-muted/50 border border-border">
            <p className="text-muted-foreground">
              No refunds available at this time
            </p>
          </div>
        ) : (
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
                    "flex items-center justify-between p-4 rounded-lg border",
                    "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-background text-orange-600">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        Farm Sponsorship
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
                              Expired
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Cancelled
                            </>
                          )}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {
                          refundableFraction.userPurchaseData
                            .totalStepsPurchased
                        }{" "}
                        shares
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {formatRefundAmount(
                          refundableFraction.refundDetails.estimatedRefundAmount
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">GLW</div>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleClaimRefund(refundableFraction)}
                      disabled={isProcessingThis || isProcessing}
                    >
                      {isProcessingThis ? (
                        <>
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Claim"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Info Section */}
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <div className="font-medium mb-1">About Refunds</div>
                  <div>
                    Total refundable:{" "}
                    {formatRefundAmount(summary.totalRefundableAmount)} GLW from{" "}
                    {summary.totalRefundableFractions} failed sponsorships (
                    {summary.byStatus.expired} expired,{" "}
                    {summary.byStatus.cancelled} cancelled).
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
