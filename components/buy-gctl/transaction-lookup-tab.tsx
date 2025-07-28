"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { formatUnits } from "viem";

interface TransactionLookupTabProps {
  mintedEvents: any[];
  stakedEvents: any[];
  pendingTransfers: any[];
  failedOperations: any[];
  fetchMintedEvents: () => Promise<any>;
  fetchStakedEvents: () => Promise<any>;
  fetchPendingTransfers: () => Promise<any>;
  fetchFailedOperations: () => Promise<any>;
  onTransactionFound: (
    txId: string,
    type: "completed" | "pending" | "failed",
    data?: any
  ) => void;
}

export function TransactionLookupTab({
  mintedEvents,
  stakedEvents,
  pendingTransfers,
  failedOperations,
  fetchMintedEvents,
  fetchStakedEvents,
  fetchPendingTransfers,
  fetchFailedOperations,
  onTransactionFound,
}: TransactionLookupTabProps) {
  const [lookupTxId, setLookupTxId] = useState<string>("");
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  // Helper function to calculate remaining time based on transaction timestamp
  const calculateRemainingTime = (transactionTimestamp: string): number => {
    const txTime = new Date(transactionTimestamp).getTime();
    const now = Date.now();
    const elapsed = now - txTime;
    const fortyFiveSeconds = 45 * 1000; // 45 seconds in ms
    const remaining = Math.max(0, fortyFiveSeconds - elapsed);
    return remaining;
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
        fetchStakedEvents(),
        fetchPendingTransfers(),
        fetchFailedOperations(),
      ]);

      const txId = lookupTxId.trim().toLowerCase();

      // Check if transaction is completed (in minted events)
      const mintedEvent = mintedEvents.find(
        (event) => event.txId.toLowerCase() === txId
      );

      if (mintedEvent) {
        // Transaction is completed - notify parent
        const creditedAmount = formatUnits(BigInt(mintedEvent.gctlMinted), 6);
        onTransactionFound(txId, "completed", {
          creditedAmount: parseFloat(creditedAmount).toFixed(6),
        });
        setLookupTxId("");
        return;
      }

      // Check if transaction is a staking event (using updated field names)
      const stakedEvent = stakedEvents.find(
        (event) => event.id.toLowerCase() === txId
      );

      if (stakedEvent) {
        // Staking transaction found - notify parent
        const amount = formatUnits(BigInt(stakedEvent.amount), 6);
        onTransactionFound(txId, "completed", {
          type: stakedEvent.direction, // Updated from 'type' to 'direction'
          amount: parseFloat(amount).toFixed(6),
          regionId: stakedEvent.regionId,
        });
        setLookupTxId("");
        return;
      }

      // Check if transaction is pending
      const pendingTransfer = pendingTransfers.find(
        (transfer) => transfer.txId.toLowerCase() === txId
      );

      if (pendingTransfer) {
        // Transaction is pending - notify parent
        const remainingTime = calculateRemainingTime(pendingTransfer.ts);
        onTransactionFound(txId, "pending", { remainingTime });
        setLookupTxId("");
        return;
      }

      // Check if transaction failed
      const failedOperation = failedOperations.find(
        (op) => op.txId.toLowerCase() === txId
      );

      if (failedOperation) {
        onTransactionFound(txId, "failed", {
          errorMessage: failedOperation.errorMessage || "Unknown reason",
        });
        setLookupTxId("");
        return;
      }

      // Transaction not found in any category
      toast.error(
        "Transaction not found. Transactions can take up to 45 seconds to appear in our system. Please wait and try again."
      );
    } catch (error) {
      console.error("Error looking up transaction:", error);
      toast.error("Failed to lookup transaction. Please try again.");
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
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
                Enter your Ethereum transaction hash to check if it&apos;s
                completed, pending, or failed.
              </p>
              <p className="text-blue-600 font-medium">
                ⏱️ New transactions can take up to 45 seconds to appear in our
                system.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
