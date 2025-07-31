"use client";
import React, { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { formatUnits } from "viem";
import { toast } from "sonner";

// Wagmi hooks
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useChainId,
} from "wagmi";

// UI Components
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Custom hooks
import { useGctlApi } from "@/hooks/useGctlApi";
import { useForwarder } from "@/hooks/useForwarder";

// Feature components
import { MintedEventsTab } from "@/components/buy-gctl/minted-events-tab";
import { PendingTransfersTab } from "@/components/buy-gctl/pending-transfers-tab";
import { StakedEventsTab } from "@/components/buy-gctl/staked-events-tab";
import { FailedOperationsTab } from "@/components/buy-gctl/failed-operations-tab";
import { ProcessingModal } from "@/components/buy-gctl/processing-modal";
import { SuccessModal } from "@/components/buy-gctl/success-modal";
import { StakeGctlTab } from "@/components/buy-gctl/stake-gctl-tab";
import { PurchaseGctlTab } from "@/components/buy-gctl/purchase-gctl-tab";
import { TransactionLookupTab } from "@/components/buy-gctl/transaction-lookup-tab";
import { DashboardTab } from "@/components/buy-gctl/dashboard-tab";
import { ProtocolFeeTab } from "@/components/buy-gctl/protocol-fee-tab";

export default function BuyGctlView() {
  // =================================================================
  // HOOKS & WALLET STATE
  // =================================================================
  const { address } = useAccount();
  // =================================================================
  // URL STATE MANAGEMENT
  // =================================================================
  const [txId, setTxId] = useQueryState("txId", {
    defaultValue: "",
    clearOnDefault: true,
  });

  // =================================================================
  // DATA STATE (GCTL API)
  // =================================================================
  const {
    gctlBalance,
    gctlPrice,
    mintedEvents,
    stakedEvents,
    pendingTransfers,
    failedOperations,
    regions,
    isGctlBalanceLoading,
    isGctlPriceLoading,
    isMintedEventsLoading,
    isStakedEventsLoading,
    isPendingTransfersLoading,
    isFailedOperationsLoading,
    fetchMintedEvents,
    fetchStakedEvents,
    fetchPendingTransfers,
    fetchFailedOperations,
  } = useGctlApi(address);

  // =================================================================
  // TRANSACTION PROCESSING STATE
  // =================================================================
  const [isProcessingTransaction, setIsProcessingTransaction] =
    useState<boolean>(false);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(
    null
  );
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [trackingTxHash, setTrackingTxHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [processedAmount, setProcessedAmount] = useState<string>("0");

  // =================================================================
  // UI STATE
  // =================================================================
  const [activeTab, setActiveTab] = useState<string>("minted");
  const [mainActiveTab, setMainActiveTab] = useState<string>("dashboard");

  // Use React Query loading states instead of manual state
  const gctlDataLoading = isGctlBalanceLoading || isGctlPriceLoading;
  const dataLoading =
    activeTab === "minted"
      ? isMintedEventsLoading
      : activeTab === "staked"
      ? isStakedEventsLoading
      : activeTab === "pending"
      ? isPendingTransfersLoading
      : isFailedOperationsLoading;

  // =================================================================
  // HELPER FUNCTIONS
  // =================================================================

  // Calculate remaining time based on transaction timestamp
  const calculateRemainingTime = (transactionTimestamp: string): number => {
    const txTime = new Date(transactionTimestamp).getTime();
    const now = Date.now();
    const elapsed = now - txTime;
    const fortyFiveSeconds = 45 * 1000; // 45 seconds in ms
    const remaining = Math.max(0, fortyFiveSeconds - elapsed);
    return remaining;
  };

  // Format time for display (mm:ss)
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Reset all modal and transaction states
  const resetStates = () => {
    setIsProcessingTransaction(false);
    setShowSuccess(false);
    setProcessingStartTime(null);
    setTimeRemaining(0);
    setProcessedAmount("0");
    setTrackingTxHash(null);
    setTxId(""); // Clear query parameter
  };

  // =================================================================
  // TRANSACTION HANDLERS
  // =================================================================

  // Handle transaction start from PurchaseGctlTab
  const handleTransactionStart = (txHash: string) => {
    setTrackingTxHash(txHash);
    setTxId(txHash); // Add to query params
    setIsProcessingTransaction(true);
    setProcessingStartTime(Date.now());
    setTimeRemaining(45 * 1000); // 45 seconds

    // Initial fetch to check if transaction appears quickly
    setTimeout(() => {
      fetchPendingTransfers();
      fetchMintedEvents();
    }, 5000); // Check after 5 seconds
  };

  // Handle transaction found from TransactionLookupTab
  const handleTransactionFound = (
    txId: string,
    type: "completed" | "pending" | "failed",
    data?: any
  ) => {
    setTrackingTxHash(txId);
    setTxId(txId); // Add to query params

    switch (type) {
      case "completed":
        // Show success modal
        setProcessedAmount(data.creditedAmount);
        setShowSuccess(true);
        break;
      case "pending":
        // Show processing modal
        setIsProcessingTransaction(true);
        setProcessingStartTime(Date.now());
        setTimeRemaining(data.remainingTime);
        break;
      case "failed":
        // Show error toast
        toast.error(`Transaction failed: ${data.errorMessage}`);
        break;
    }
  };

  // =================================================================
  // EFFECTS - DATA INITIALIZATION
  // =================================================================

  // React Query handles data fetching automatically, no manual initialization needed

  // =================================================================
  // EFFECTS - TRANSACTION PROCESSING
  // =================================================================

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
      const remaining = Math.max(0, 45 * 1000 - elapsed); // 45 seconds in ms
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
    }, 10000); // Check every 10 seconds

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
  }, [
    mintedEvents,
    pendingTransfers,
    isProcessingTransaction,
    trackingTxHash,
    setTxId,
  ]);

  // =================================================================
  // EFFECTS - URL STATE RESTORATION
  // =================================================================

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
        // Fallback to 45 seconds if transfer not found yet
        setTimeRemaining(45 * 1000); // 45 seconds
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

  // =================================================================
  // EFFECTS - TAB DATA FETCHING
  // =================================================================

  // React Query handles data fetching automatically when queries are enabled
  // Manual refetch only needed for specific user actions
  useEffect(() => {
    // Only manually refetch if we need to force refresh the current tab data
    if (activeTab === "minted" && !isMintedEventsLoading) {
      // Data is already being fetched by React Query, no manual fetch needed
    } else if (activeTab === "staked" && !isStakedEventsLoading) {
      // Data is already being fetched by React Query, no manual fetch needed
    } else if (activeTab === "pending" && !isPendingTransfersLoading) {
      // Data is already being fetched by React Query, no manual fetch needed
    } else if (activeTab === "failed" && !isFailedOperationsLoading) {
      // Data is already being fetched by React Query, no manual fetch needed
    }
  }, [
    activeTab,
    isMintedEventsLoading,
    isStakedEventsLoading,
    isPendingTransfersLoading,
    isFailedOperationsLoading,
  ]);

  // =================================================================
  // RENDER
  // =================================================================
  return (
    <div className="min-h-screen">
      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccess}
        processedAmount={processedAmount}
        onClose={resetStates}
        trackingTxHash={trackingTxHash}
        gctlPrice={gctlPrice}
        usdcAmount=""
        onRefreshData={async () => {
          await fetchPendingTransfers();
          await fetchMintedEvents();
          await fetchFailedOperations();
          await fetchStakedEvents();
        }}
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

      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-2 md:px-6 lg:px-12 xl:px-16 relative z-10 min-h-screen flex items-center justify-center pt-20">
        <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto">
          {/* ========== HEADER SECTION ========== */}

          {/* ========== MAIN TABS ========== */}
          <div className="w-full max-w-lg mx-auto mb-8">
            <Tabs
              value={mainActiveTab}
              onValueChange={setMainActiveTab}
              className="space-y-6"
            >
              <div className="bg-card rounded-lg p-2 border border-border">
                <TabsList className="grid w-full grid-cols-5 bg-transparent gap-1">
                  <TabsTrigger
                    value="dashboard"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Dashboard
                  </TabsTrigger>
                  <TabsTrigger
                    value="purchase"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Purchase GCTL
                  </TabsTrigger>
                  <TabsTrigger
                    value="stake"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Stake GCTL
                  </TabsTrigger>
                  <TabsTrigger
                    value="lookup"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Track Transaction
                  </TabsTrigger>
                  <TabsTrigger
                    value="protocol-fee"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Protocol Fee
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="dashboard">
                <DashboardTab walletAddress={address} />
              </TabsContent>

              <TabsContent value="purchase">
                <PurchaseGctlTab
                  gctlBalance={gctlBalance}
                  gctlPrice={gctlPrice}
                  gctlDataLoading={gctlDataLoading}
                  onTransactionStart={handleTransactionStart}
                  fetchPendingTransfers={fetchPendingTransfers}
                  fetchMintedEvents={fetchMintedEvents}
                />
              </TabsContent>

              <TabsContent value="stake">
                <StakeGctlTab />
              </TabsContent>

              <TabsContent value="lookup">
                <TransactionLookupTab
                  mintedEvents={mintedEvents}
                  stakedEvents={stakedEvents}
                  pendingTransfers={pendingTransfers}
                  failedOperations={failedOperations}
                  fetchMintedEvents={fetchMintedEvents}
                  fetchStakedEvents={fetchStakedEvents}
                  fetchPendingTransfers={fetchPendingTransfers}
                  fetchFailedOperations={fetchFailedOperations}
                  onTransactionFound={handleTransactionFound}
                />
              </TabsContent>

              <TabsContent value="protocol-fee">
                <ProtocolFeeTab />
              </TabsContent>
            </Tabs>
          </div>

          {/* ========== TRANSACTION HISTORY TABS ========== */}
          <div className="w-full">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center">
                Transaction History
              </h3>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-2"
            >
              <div className="bg-card rounded-lg p-2 border border-border inline-flex">
                <TabsList className="grid w-full grid-cols-4 bg-transparent gap-1">
                  <TabsTrigger value="pending">Transfer Events</TabsTrigger>
                  <TabsTrigger value="minted">Minted Events</TabsTrigger>
                  <TabsTrigger value="staked">Staked Events</TabsTrigger>

                  <TabsTrigger value="failed">Failed Events</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="pending">
                <PendingTransfersTab
                  pendingTransfers={pendingTransfers}
                  dataLoading={dataLoading}
                  onRefresh={async () => {
                    await fetchPendingTransfers();
                  }}
                />
              </TabsContent>
              <TabsContent value="minted">
                <MintedEventsTab
                  mintedEvents={mintedEvents}
                  dataLoading={dataLoading}
                />
              </TabsContent>

              <TabsContent value="staked">
                <StakedEventsTab
                  stakedEvents={stakedEvents}
                  dataLoading={dataLoading}
                  regions={regions}
                />
              </TabsContent>

              <TabsContent value="failed">
                <FailedOperationsTab
                  failedOperations={failedOperations}
                  dataLoading={dataLoading}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
