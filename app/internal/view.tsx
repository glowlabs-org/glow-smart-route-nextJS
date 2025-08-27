"use client";
import React, { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { formatUnits } from "viem";
import { toast } from "sonner";

// Wagmi hooks
import { useAccount } from "wagmi";

// UI Components
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Custom hooks

// Feature components
import { MintedEventsTab } from "@/components/buy-gctl/minted-events-tab";
import { PendingTransfersTab } from "@/components/buy-gctl/pending-transfers-tab";
import { StakedEventsTab } from "@/components/buy-gctl/staked-events-tab";
import { FailedOperationsTab } from "@/components/buy-gctl/failed-operations-tab";
import { ProcessingModal } from "@/components/buy-gctl/processing-modal";
import { DashboardTab } from "@/components/buy-gctl/dashboard-tab";
import { useGctlApi } from "@/hooks/useGctlApi";
import { useRegions } from "@/hooks/useRegions";

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
    isGctlPriceLoading,
    fetchMintedEvents,
    fetchPendingTransfers,
    fetchFailedOperations,
    gctlPriceNumber,
    useMintedEvents,
    usePendingTransfers,
    useFailedOperations,
    useRegionStake,
    useStakeEvents,
    glwPriceNumber,
    isGlwPriceLoading,
  } = useGctlApi(address);

  const { regions, isRegionsLoading } = useRegions();

  const { data: mintedEvents, isLoading: isMintedEventsLoading } =
    useMintedEvents();
  const { data: pendingTransfers, isLoading: isPendingTransfersLoading } =
    usePendingTransfers();
  const { data: failedOperations, isLoading: isFailedOperationsLoading } =
    useFailedOperations();
  const { data: regionStake, isLoading: isRegionStakeLoading } =
    useRegionStake(1);
  const { data: stakeEvents, isLoading: isStakedEventsLoading } =
    useStakeEvents();

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

  // Timer effect for processing countdown
  useEffect(() => {
    if (!isProcessingTransaction || !processingStartTime) return;

    const interval = setInterval(() => {
      // Try to find the pending transfer to get accurate timing
      if (trackingTxHash) {
        const pendingTransfer = pendingTransfers?.transfers.find(
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
    const mintedEvent = mintedEvents?.events.find(
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
    const pendingTransfer = pendingTransfers?.transfers.find(
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
      const pendingTransfer = pendingTransfers?.transfers.find(
        (transfer) => transfer.txId.toLowerCase() === txId.toLowerCase()
      );

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
    <div className="min-h-screen bg-background">
      {/* Processing Modal */}
      {isProcessingTransaction && (
        <ProcessingModal
          isOpen={isProcessingTransaction}
          onClose={resetStates}
          trackingTxHash={trackingTxHash}
        />
      )}

      <div className="relative overflow-hidden min-h-screen pt-20">
        <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-2 md:px-6 lg:px-12 xl:px-16 relative z-10 min-h-screen flex items-center justify-center pt-20 lg:pt-0">
          <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto">
            {/* ========== HEADER SECTION ========== */}
            <div className="w-full mb-8 text-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
                GCTL Network
              </h1>
              <p className="text-muted-foreground">
                Monitor and manage your GCTL operations
              </p>
            </div>

            {/* ========== PRICE DISPLAY SECTION ========== */}
            <div className="w-full mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* GCTL Price Card */}
                <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        GCTL Price
                      </p>
                      {isGctlPriceLoading ? (
                        <Skeleton className="h-8 w-32" />
                      ) : (
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-foreground">
                            ${gctlPriceNumber}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            USD
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="size-14 bg-primary/10 rounded-xl flex items-center justify-center">
                      <span className="text-primary font-bold">GCTL</span>
                    </div>
                  </div>
                </div>

                {/* GLW Price Card */}
                <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        GLW Price
                      </p>
                      {isGlwPriceLoading ? (
                        <Skeleton className="h-8 w-32" />
                      ) : (
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-foreground">
                            ${glwPriceNumber}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            USD
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="size-14 bg-green-500/10 rounded-xl flex items-center justify-center">
                      <span className="text-green-500 font-bold">GLW</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ========== MAIN TABS ========== */}
            <div className="w-full mb-8">
              <Tabs
                value={mainActiveTab}
                onValueChange={setMainActiveTab}
                className="space-y-6"
              >
                <TabsList>
                  <TabsTrigger value="dashboard" className="rounded-lg">
                    Dashboard
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="dashboard" className="mt-0">
                  <DashboardTab
                    walletAddress={address}
                    mintedEvents={mintedEvents?.events ?? []}
                    regions={regions ?? []}
                    pendingTransfers={pendingTransfers?.transfers ?? []}
                    isMintedEventsLoading={isMintedEventsLoading}
                    isStakedEventsLoading={isStakedEventsLoading}
                    isRegionsLoading={isRegionsLoading}
                    isPendingTransfersLoading={isPendingTransfersLoading}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* ========== TRANSACTION HISTORY TABS ========== */}
            <div className="w-full bg-card/60 backdrop-blur-xl rounded-3xl border border-border overflow-hidden">
              <div className="p-6 pb-4 border-b border-border/20">
                <h3 className="text-xl font-semibold text-foreground">
                  Transaction History
                </h3>
              </div>

              <div className="p-6">
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="space-y-4"
                >
                  <TabsList>
                    <TabsTrigger value="pending" className="rounded-lg">
                      Transfer Events
                    </TabsTrigger>
                    <TabsTrigger value="minted" className="rounded-lg">
                      Minted Events
                    </TabsTrigger>
                    <TabsTrigger value="staked" className="rounded-lg">
                      Staked Events
                    </TabsTrigger>
                    <TabsTrigger value="failed" className="rounded-lg">
                      Failed Events
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="pending">
                    <PendingTransfersTab
                      pendingTransfers={pendingTransfers?.transfers ?? []}
                      dataLoading={dataLoading}
                      onRefresh={async () => {
                        await fetchPendingTransfers();
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="minted">
                    <MintedEventsTab
                      mintedEvents={mintedEvents?.events ?? []}
                      dataLoading={dataLoading}
                    />
                  </TabsContent>

                  <TabsContent value="staked">
                    <StakedEventsTab
                      stakedEvents={stakeEvents ?? []}
                      dataLoading={dataLoading}
                      regions={regions ?? []}
                      isRegionsLoading={isRegionsLoading}
                    />
                  </TabsContent>

                  <TabsContent value="failed">
                    <FailedOperationsTab
                      failedOperations={failedOperations?.operations ?? []}
                      dataLoading={dataLoading}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
