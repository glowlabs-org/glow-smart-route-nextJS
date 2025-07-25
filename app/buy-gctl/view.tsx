"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useChainId,
} from "wagmi";
import { ConnectButton } from "@/components/connect-button";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useGctlApi } from "@/hooks/useGctlApi";
import { MintedEventsTab } from "@/components/buy-gctl/minted-events-tab";
import { PendingTransfersTab } from "@/components/buy-gctl/pending-transfers-tab";
import { FailedOperationsTab } from "@/components/buy-gctl/failed-operations-tab";
import { ProcessingModal } from "@/components/buy-gctl/processing-modal";
import { SuccessModal } from "@/components/buy-gctl/success-modal";
import { ERC20_ABI } from "@/web3/web3/abis/erc20.abi";
import { useForwarder } from "@/hooks/useForwarder";
import { BigNumber } from "ethers";
import { useQueryState } from "nuqs";

export default function BuyGctlView() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const isOnSepolia = chainId === 11155111;

  // Use the forwarder hook
  const { forwardUSDC, checkAllowance, isProcessing, addresses } =
    useForwarder();

  // Query state for transaction ID persistence
  const [txId, setTxId] = useQueryState("txId", {
    defaultValue: "",
    clearOnDefault: true,
  });

  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));
  const [inputAmount, setInputAmount] = useState<string>("");
  const [outputAmount, setOutputAmount] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [usdcBalanceLoading, setUsdcBalanceLoading] = useState<boolean>(true);
  const [gctlDataLoading, setGctlDataLoading] = useState<boolean>(true);

  // Centralised off-chain API data & helpers
  const {
    gctlBalance,
    fetchGctlBalance,
    gctlPrice,
    fetchGctlPrice,
    mintedEvents,
    fetchMintedEvents,
    pendingTransfers,
    fetchPendingTransfers,
    failedOperations,
    fetchFailedOperations,
  } = useGctlApi(address);

  const [needsApproval, setNeedsApproval] = useState<boolean>(false);
  const [isProcessingTransaction, setIsProcessingTransaction] =
    useState<boolean>(false);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(
    null
  );
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [trackingTxHash, setTrackingTxHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [processedAmount, setProcessedAmount] = useState<string>("0");

  // Transaction lookup states
  const [lookupTxId, setLookupTxId] = useState<string>("");
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  // Data for tabs now comes from useGctlApi
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("minted");
  const [mainActiveTab, setMainActiveTab] = useState<string>("purchase");

  // Fetch USDC balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !publicClient) {
        setUsdcBalanceLoading(false);
        return;
      }
      setUsdcBalanceLoading(true);
      try {
        const bal = (await publicClient.readContract({
          address: addresses.USDC,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        setUsdcBalance(bal);
      } catch (error) {
        toast.error("Failed to fetch USDC balance");
      } finally {
        setUsdcBalanceLoading(false);
      }
    };
    if (isConnected) fetchBalance();
    else setUsdcBalanceLoading(false);
  }, [address, isConnected, publicClient, addresses.USDC]);

  // Fetch GCTL price and balance on mount
  useEffect(() => {
    const initializeData = async () => {
      setGctlDataLoading(true);
      try {
        await fetchGctlPrice();
        await fetchGctlBalance();
      } catch (error) {
        console.error("Failed to initialize GCTL data:", error);
      } finally {
        setGctlDataLoading(false);
      }
    };

    initializeData();
  }, [address, fetchGctlPrice, fetchGctlBalance]);

  // Helper function to calculate remaining time based on transaction timestamp
  const calculateRemainingTime = (transactionTimestamp: string): number => {
    const txTime = new Date(transactionTimestamp).getTime();
    const now = Date.now();
    const elapsed = now - txTime;
    const twentyMinutes = 20 * 60 * 1000; // 20 minutes in ms
    const remaining = Math.max(0, twentyMinutes - elapsed);
    return remaining;
  };

  // Timer effect for processing countdown
  useEffect(() => {
    if (!isProcessingTransaction || !processingStartTime) return;

    const interval = setInterval(() => {
      // Try to find the pending transfer to get accurate timing
      if (trackingTxHash) {
        const pendingTransfer = pendingTransfers.find(
          (transfer) =>
            transfer.txId.toLowerCase() === trackingTxHash.toLowerCase()
        );

        if (pendingTransfer) {
          // Use dynamic calculation based on transaction timestamp
          const dynamicRemaining = calculateRemainingTime(pendingTransfer.ts);
          setTimeRemaining(dynamicRemaining);

          if (dynamicRemaining === 0) {
            setIsProcessingTransaction(false);
            setTrackingTxHash(null);
          }
          return;
        }
      }

      // Fallback to elapsed time calculation if no pending transfer found
      const elapsed = Date.now() - processingStartTime;
      const remaining = Math.max(0, 20 * 60 * 1000 - elapsed); // 20 minutes in ms
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setIsProcessingTransaction(false);
        setTrackingTxHash(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isProcessingTransaction,
    processingStartTime,
    trackingTxHash,
    pendingTransfers,
  ]);

  // Periodic transaction status refresh during processing
  useEffect(() => {
    if (!isProcessingTransaction || !trackingTxHash) return;

    const interval = setInterval(async () => {
      await fetchPendingTransfers();
      await fetchMintedEvents();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [
    isProcessingTransaction,
    trackingTxHash,
    fetchPendingTransfers,
    fetchMintedEvents,
  ]);

  // Detect transaction completion by checking minted events
  useEffect(() => {
    if (!isProcessingTransaction || !trackingTxHash) return;

    // Check if transaction appears in minted events (completed)
    const mintedEvent = mintedEvents.find(
      (event) => event.txId.toLowerCase() === trackingTxHash.toLowerCase()
    );

    if (mintedEvent) {
      const creditedAmount = formatUnits(BigInt(mintedEvent.gctlMinted), 6);
      setProcessedAmount(parseFloat(creditedAmount).toFixed(6));
      setIsProcessingTransaction(false);
      setTrackingTxHash(null);
      setTxId(""); // Clear query parameter
      setShowSuccess(true);
      return;
    }

    // Optional: Check if transaction appears in pending transfers (being processed)
    const pendingTransfer = pendingTransfers.find(
      (transfer) => transfer.txId.toLowerCase() === trackingTxHash.toLowerCase()
    );

    if (pendingTransfer) {
      // Transaction is being processed, could show different status if needed
      console.log("Transaction found in pending transfers, being processed...");
    }
  }, [mintedEvents, pendingTransfers, isProcessingTransaction, trackingTxHash]);

  // Check for existing txId in query params on page load
  useEffect(() => {
    if (txId && !isProcessingTransaction && !showSuccess) {
      // Reopen processing modal with the transaction from query params
      setTrackingTxHash(txId);
      setIsProcessingTransaction(true);
      setProcessingStartTime(Date.now());

      // Calculate dynamic remaining time based on pending transfer timestamp
      const pendingTransfer = pendingTransfers.find(
        (transfer) => transfer.txId.toLowerCase() === txId.toLowerCase()
      );

      console.log("pendingTransfer", pendingTransfer);

      if (pendingTransfer) {
        const remainingTime = calculateRemainingTime(pendingTransfer.ts);
        setTimeRemaining(remainingTime);
      } else {
        // Fallback to 20 minutes if transfer not found yet
        setTimeRemaining(20 * 60 * 1000); // 20 minutes
      }

      // Fetch latest data to check transaction status
      fetchPendingTransfers();
      fetchMintedEvents();
      fetchFailedOperations();
    }
  }, [
    txId,
    isProcessingTransaction,
    showSuccess,
    pendingTransfers,
    fetchPendingTransfers,
    fetchMintedEvents,
    fetchFailedOperations,
  ]);

  // Check approval status
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!address || !inputAmount) return;
      try {
        const amount = BigNumber.from(parseUnits(inputAmount, 6).toString());
        const allowanceResult = await checkAllowance(address);

        if (allowanceResult.ok) {
          setNeedsApproval(allowanceResult.val.lt(amount));
        }
      } catch (error) {
        console.error("Error checking approval:", error);
      }
    };
    if (isConnected && inputAmount) checkApprovalStatus();
  }, [address, inputAmount, isConnected, checkAllowance]);

  // Handle input change with dynamic pricing
  const handleInputChange = (value: string) => {
    setInputAmount(value);
    if (!value) {
      setOutputAmount("");
      return;
    }
    const usdc = parseFloat(value);
    if (isNaN(usdc) || gctlPrice <= 0) {
      setOutputAmount("");
      return;
    }
    const gctl = usdc / gctlPrice;
    setOutputAmount(gctl.toFixed(6));
  };

  // Forward USDC through forwarder contract using the hook
  const handleBuy = async () => {
    if (!inputAmount || !address) return;
    setLoading(true);

    try {
      const amount = BigNumber.from(parseUnits(inputAmount, 6).toString());
      const result = await forwardUSDC(amount, address);

      if (result.ok) {
        const txHash = result.val;
        toast.success("USDC sent! You will receive GCTL within ~20 minutes.");

        // Start processing state and track this transaction
        setTrackingTxHash(txHash);
        setTxId(txHash); // Add to query params
        setIsProcessingTransaction(true);
        setProcessingStartTime(Date.now());
        setTimeRemaining(20 * 60 * 1000); // 20 minutes

        setInputAmount("");
        setOutputAmount("");

        // Refresh balance
        if (publicClient) {
          const bal = (await publicClient.readContract({
            address: addresses.USDC,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          })) as bigint;
          setUsdcBalance(bal);
        }

        // Initial fetch to check if transaction appears quickly
        setTimeout(() => {
          fetchPendingTransfers();
          fetchMintedEvents();
        }, 5000); // Check after 5 seconds
      } else {
        toast.error(`Transaction failed: ${result.val}`);
        setTrackingTxHash(null);
      }
    } catch (error) {
      toast.error("Transaction failed");
      setTrackingTxHash(null);
    } finally {
      setLoading(false);
    }
  };

  // All tab data fetchers now provided by hook
  useEffect(() => {
    const fetchTabData = async () => {
      setDataLoading(true);
      try {
        let result;
        switch (activeTab) {
          case "minted":
            result = await fetchMintedEvents();
            break;
          case "pending":
            result = await fetchPendingTransfers();
            break;
          case "failed":
            result = await fetchFailedOperations();
            break;
        }

        if (result && result.err) {
          toast.error(result.val);
        }
      } finally {
        setDataLoading(false);
      }
    };

    fetchTabData();
  }, [activeTab]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const resetStates = () => {
    setIsProcessingTransaction(false);
    setShowSuccess(false);
    setProcessingStartTime(null);
    setTimeRemaining(0);
    setProcessedAmount("0");
    setTrackingTxHash(null);
    setLookupTxId("");
    setTxId(""); // Clear query parameter
  };

  // Handle manual transaction lookup
  const handleTransactionLookup = async () => {
    if (!lookupTxId.trim()) {
      toast.error("Please enter a transaction ID");
      return;
    }

    setIsLookingUp(true);

    try {
      // Fetch latest data to ensure we have current information
      await Promise.all([
        fetchMintedEvents(),
        fetchPendingTransfers(),
        fetchFailedOperations(),
      ]);

      const txId = lookupTxId.trim().toLowerCase();

      // Check if transaction is completed (in minted events)
      const mintedEvent = mintedEvents.find(
        (event) => event.txId.toLowerCase() === txId
      );

      if (mintedEvent) {
        // Transaction is completed - show success modal
        const creditedAmount = formatUnits(BigInt(mintedEvent.gctlMinted), 6);
        setProcessedAmount(parseFloat(creditedAmount).toFixed(6));
        setTrackingTxHash(txId);
        setTxId(txId); // Add to query params
        setShowSuccess(true);
        setLookupTxId("");
        return;
      }

      // Check if transaction is pending
      const pendingTransfer = pendingTransfers.find(
        (transfer) => transfer.txId.toLowerCase() === txId
      );

      if (pendingTransfer) {
        // Transaction is pending - show processing modal
        setTrackingTxHash(txId);
        setTxId(txId); // Add to query params
        setIsProcessingTransaction(true);
        setProcessingStartTime(Date.now());

        // Calculate dynamic remaining time based on pending transfer timestamp
        const remainingTime = calculateRemainingTime(pendingTransfer.ts);
        setTimeRemaining(remainingTime);

        setLookupTxId("");
        return;
      }

      // Check if transaction failed
      const failedOperation = failedOperations.find(
        (op) => op.txId.toLowerCase() === txId
      );

      if (failedOperation) {
        toast.error(
          `Transaction failed: ${
            failedOperation.errorMessage || "Unknown reason"
          }`
        );
        setLookupTxId("");
        return;
      }

      // Transaction not found in any category
      toast.error(
        "Transaction not found. Please check the transaction ID or try again later."
      );
    } catch (error) {
      console.error("Error looking up transaction:", error);
      toast.error("Failed to lookup transaction. Please try again.");
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccess}
        processedAmount={processedAmount}
        onClose={resetStates}
        trackingTxHash={trackingTxHash}
        gctlPrice={gctlPrice}
        usdcAmount={inputAmount}
      />

      {/* Processing Modal */}
      {isProcessingTransaction && (
        <ProcessingModal
          isOpen={isProcessingTransaction}
          onClose={resetStates}
          timeRemaining={timeRemaining}
          trackingTxHash={trackingTxHash}
          formatTime={formatTime}
        />
      )}

      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-2 md:px-6 lg:px-12 xl:px-16 relative z-10 min-h-screen flex items-center justify-center pt-20 ">
        <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto">
          {/* Header Section */}
          <div className="mb-8 text-center">
            {isConnected && (
              <div className="inline-flex items-center px-4 py-2 bg-card rounded-full border border-border">
                <div className="w-2 h-2 bg-chart-4 rounded-full mr-2"></div>
                {gctlDataLoading ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Off-chain GCTL balance:
                    </span>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    Off-chain GCTL balance:{" "}
                    {parseFloat(
                      formatUnits(BigInt(gctlBalance), 6)
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 6,
                    })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Main Tabs */}
          <div className="w-full max-w-md mx-auto mb-8">
            <Tabs
              value={mainActiveTab}
              onValueChange={setMainActiveTab}
              className="space-y-6"
            >
              <div className="bg-card rounded-lg p-2 border border-border">
                <TabsList className="grid w-full grid-cols-2 bg-transparent gap-1">
                  <TabsTrigger
                    value="purchase"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Purchase GCTL
                  </TabsTrigger>
                  <TabsTrigger
                    value="lookup"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Track Transaction
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="purchase">
                {/* Main Purchase Card */}
                <Card className="border border-border bg-white/95 backdrop-blur-sm w-full">
                  <CardHeader className="pb-4 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-semibold text-foreground flex items-center">
                        Purchase GCTL
                      </CardTitle>
                      {gctlDataLoading ? (
                        <Skeleton className="h-7 w-32 rounded-full" />
                      ) : gctlPrice > 0 ? (
                        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border">
                          1 GCTL = ${gctlPrice.toFixed(4)} USDC
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* From Section - USDC */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium text-muted-foreground">
                          From
                        </Label>
                        {isConnected && (
                          <div className="text-sm text-muted-foreground">
                            {usdcBalanceLoading ? (
                              <div className="flex items-center space-x-1">
                                <span>Balance:</span>
                                <Skeleton className="h-4 w-16" />
                              </div>
                            ) : (
                              `Balance: ${formatUnits(usdcBalance, 6)} USDC`
                            )}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={inputAmount}
                          onChange={(e) => handleInputChange(e.target.value)}
                          className="h-16 text-2xl font-medium pr-32 border-2 focus:border-primary transition-all duration-200 bg-background/50"
                          disabled={gctlDataLoading || gctlPrice <= 0}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-3">
                          {isConnected &&
                            usdcBalance > BigInt(0) &&
                            !usdcBalanceLoading && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleInputChange(formatUnits(usdcBalance, 6))
                                }
                                className="h-7 px-3 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/10 border border-primary/20"
                                disabled={gctlDataLoading || gctlPrice <= 0}
                              >
                                MAX
                              </Button>
                            )}
                          <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-full border border-blue-200">
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-white">
                                $
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-blue-700">
                              USDC
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Conversion Arrow */}
                    {inputAmount && gctlPrice > 0 && (
                      <div className="flex justify-center py-2">
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center border border-border">
                          <svg
                            className="w-5 h-5 text-muted-foreground"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* To Section - GCTL */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium text-muted-foreground">
                          To
                        </Label>
                        {isConnected && (
                          <div className="text-sm text-muted-foreground">
                            {gctlDataLoading ? (
                              <div className="flex items-center space-x-1">
                                <span>Balance:</span>
                                <Skeleton className="h-4 w-20" />
                              </div>
                            ) : (
                              `Balance: ${parseFloat(
                                gctlBalance
                              ).toLocaleString()} GCTL`
                            )}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={outputAmount}
                          readOnly
                          className="h-16 text-2xl font-medium pr-32 bg-muted/30 border-2 border-border cursor-not-allowed"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <div className="flex items-center space-x-2 bg-gradient-to-r from-green-50 to-blue-50 px-3 py-2 rounded-full border border-green-200">
                            <div className="w-5 h-5 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-white">
                                G
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-green-700">
                              GCTL
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Conversion Rate */}
                    {inputAmount && (gctlPrice > 0 || gctlDataLoading) && (
                      <div className="bg-muted/30 border border-border rounded-lg p-4">
                        {gctlDataLoading ? (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Exchange Rate
                              </span>
                              <Skeleton className="h-4 w-24" />
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                You&apos;ll receive
                              </span>
                              <Skeleton className="h-4 w-20" />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">
                                Exchange Rate
                              </span>
                              <span className="font-medium">
                                1 USDC = {(1 / gctlPrice).toFixed(2)} GCTL
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm mt-2">
                              <span className="text-muted-foreground">
                                You&apos;ll receive
                              </span>
                              <span className="font-medium">
                                ~
                                {parseFloat(outputAmount || "0").toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 6,
                                  }
                                )}{" "}
                                GCTL
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Buy Button */}
                    <Button
                      className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                      onClick={handleBuy}
                      disabled={
                        !isConnected ||
                        !isOnSepolia ||
                        !inputAmount ||
                        loading ||
                        isProcessing ||
                        gctlDataLoading ||
                        gctlPrice <= 0
                      }
                    >
                      {loading || isProcessing ? (
                        <>
                          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                          {needsApproval
                            ? "Approving & Sending..."
                            : "Processing..."}
                        </>
                      ) : !isConnected ? (
                        "Connect Wallet"
                      ) : !isOnSepolia ? (
                        "Switch to Sepolia"
                      ) : gctlDataLoading ? (
                        <>
                          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                          Loading data...
                        </>
                      ) : gctlPrice <= 0 ? (
                        <>
                          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                          Loading price...
                        </>
                      ) : !inputAmount ? (
                        "Enter an amount"
                      ) : (
                        "Purchase GCTL"
                      )}
                    </Button>

                    {/* Info Section */}
                    <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="font-medium text-blue-900">
                            How it works:
                          </p>
                          <ul className="space-y-1 text-blue-700">
                            <li>
                              • GCTL is credited to your account within ~20
                              minutes
                            </li>
                            <li>
                              • GCTL is an{" "}
                              <span className="font-semibold">
                                off-chain purchase
                              </span>
                              , not a blockchain token
                            </li>
                            <li>
                              • GCTL is{" "}
                              <span className="font-semibold">
                                non-transferable
                              </span>{" "}
                              until GLOW V2 phase 2
                            </li>
                          </ul>
                          {!isOnSepolia && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
                              <div className="flex items-center space-x-2 text-red-700 font-medium text-sm">
                                <svg
                                  className="w-4 h-4"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span>
                                  Please switch to Sepolia Testnet to purchase
                                  GCTL
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="lookup">
                {/* Transaction Lookup Card */}
                <Card className="border border-border bg-white/95 backdrop-blur-sm w-full">
                  <CardHeader className="pb-4 border-b border-border/50">
                    <CardTitle className="text-xl font-semibold text-foreground flex items-center">
                      <div className="w-6 h-6 bg-blue-500 rounded-lg mr-3 flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                      Check Transaction Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Transaction ID
                      </Label>
                      <div className="flex space-x-3">
                        <Input
                          type="text"
                          placeholder="0x..."
                          value={lookupTxId}
                          onChange={(e) => setLookupTxId(e.target.value)}
                          className="flex-1 h-12 font-mono text-sm border-2 focus:border-primary transition-all duration-200 bg-background/50"
                          disabled={isLookingUp}
                        />
                        <Button
                          onClick={handleTransactionLookup}
                          disabled={!lookupTxId.trim() || isLookingUp}
                          size="default"
                          className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all duration-200"
                        >
                          {isLookingUp ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                              </svg>
                              Check
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="font-medium text-blue-900">
                            Track your transaction:
                          </p>
                          <p className="text-blue-700">
                            Enter your Ethereum transaction hash to check if
                            it&apos;s completed, pending, or failed.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Transaction History Tabs */}
          <div className="w-full">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center">
                <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg mr-3 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                Transaction History
              </h3>
            </div>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-2"
            >
              <div className="bg-card rounded-lg p-2 border border-border inline-flex">
                <TabsList className="grid w-full grid-cols-3 bg-transparent gap-1">
                  <TabsTrigger value="minted">✅ Minted Events</TabsTrigger>
                  <TabsTrigger value="pending">⏳ Pending</TabsTrigger>
                  <TabsTrigger value="failed">❌ Failed</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="minted">
                <MintedEventsTab
                  mintedEvents={mintedEvents}
                  dataLoading={dataLoading}
                  usdcDecimals={6}
                />
              </TabsContent>

              <TabsContent value="pending">
                <PendingTransfersTab
                  pendingTransfers={pendingTransfers}
                  dataLoading={dataLoading}
                  usdcDecimals={6}
                />
              </TabsContent>

              <TabsContent value="failed">
                <FailedOperationsTab
                  failedOperations={failedOperations}
                  dataLoading={dataLoading}
                  usdcDecimals={6}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
