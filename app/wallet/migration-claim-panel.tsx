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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatUnits } from "ethers";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Gift, Info } from "lucide-react";
import { useMigrationClaim } from "@/hooks/useMigrationClaim";

interface MigrationData {
  wallet: string;
  migrationAmount: string;
  claimed: boolean;
  eligible: boolean;
}

interface MigrationClaimPanelProps {
  walletAddress?: string;
  migrationData?: MigrationData;
  isLoading?: boolean;
  isError?: boolean;
  onClaim?: () => void;
}

export function MigrationClaimPanel({
  walletAddress,
  migrationData,
  isLoading = false,
  isError = false,
  onClaim,
}: MigrationClaimPanelProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);

  const {
    executeMigrationClaim,
    isClaimingMigration,
    isSuccess: isClaimSuccess,
    reset: resetMutation,
  } = useMigrationClaim();

  // Reset mutation state when dialog opens/closes or data changes
  React.useEffect(() => {
    if (migrationData?.claimed && isClaimSuccess) {
      resetMutation();
    }
  }, [migrationData?.claimed, isClaimSuccess, resetMutation]);
  // Don't render if wallet not connected
  if (!walletAddress) {
    return null;
  }

  // Don't render if loading and no data
  if (isLoading && !migrationData) {
    return (
      <Card className="mb-8 ">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            <CardTitle>GCTL Migration</CardTitle>
          </div>
          <CardDescription>Checking for available GCTL tokens</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if error or no migration data and not eligible
  if (isError || (!migrationData && !isLoading)) {
    return null;
  }

  // Don't render if not eligible and not claimed (no migration available)
  if (migrationData && !migrationData.eligible && !migrationData.claimed) {
    return null;
  }

  const formatMigrationAmount = (amount: string): string => {
    try {
      const amountBigInt = BigInt(amount);
      const formatted = formatUnits(amountBigInt, DECIMALS_BY_TOKEN.GCTL);
      const num = parseFloat(formatted);
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    } catch {
      return "0.00";
    }
  };

  const handleOpenConfirmDialog = () => {
    if (migrationData?.claimed) {
      toast.info("GCTL has already been claimed");
      return;
    }

    if (!migrationData?.eligible) {
      toast.info("No GCTL amount available");
      return;
    }

    setConfirmDialogOpen(true);
  };

  const handleConfirmClaim = async () => {
    setConfirmDialogOpen(false);

    try {
      const success = await executeMigrationClaim();

      if (success) {
        // Call the onClaim callback to refresh data
        onClaim?.();
      }
    } catch (error) {
      console.error("Migration claim failed:", error);
      // Error handling is done in the mutation's onError
    }
  };

  const migrationAmountFormatted = migrationData
    ? formatMigrationAmount(migrationData.migrationAmount)
    : "0.00";

  return (
    <Card className="mb-8 ">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>GCTL Allocation</CardTitle>
            <CardDescription className="mt-2">
              {migrationData?.claimed || isClaimSuccess
                ? "GCTL claimed successfully"
                : "Claim your GCTL tokens from the CGP"}
            </CardDescription>
          </div>
          {(migrationData?.claimed || isClaimSuccess) && (
            <Badge
              variant="secondary"
              className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Claimed
            </Badge>
          )}
          {migrationData?.eligible &&
            !migrationData.claimed &&
            !isClaimSuccess && (
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                <AlertCircle className="w-3 h-3 mr-1" />
                Available
              </Badge>
            )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Migration Amount Display */}
            <div className="p-6 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Available GCTL
                  </div>
                  <div className="text-3xl font-bold">
                    {migrationAmountFormatted} GCTL
                  </div>
                  {(migrationData?.claimed || isClaimSuccess) && (
                    <div className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      {isClaimSuccess && !migrationData?.claimed
                        ? "Processing claim..."
                        : "Successfully claimed"}
                    </div>
                  )}
                </div>
                <Gift className="w-12 h-12 text-muted-foreground/20" />
              </div>
            </div>

            {/* Claim Button */}
            {migrationData?.eligible &&
              !migrationData.claimed &&
              !isClaimSuccess && (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleOpenConfirmDialog}
                    disabled={isClaimingMigration}
                    className="flex-1"
                    size="lg"
                  >
                    {isClaimingMigration ? (
                      <>
                        <Gift className="w-4 h-4 mr-2 animate-spin" />
                        Claiming...
                      </>
                    ) : (
                      <>
                        <Gift className="w-4 h-4 mr-2" />
                        Claim GCTL
                      </>
                    )}
                  </Button>
                </div>
              )}

            {/* Success Message */}
            {isClaimSuccess && !migrationData?.claimed && (
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <div className="font-medium mb-1">Claim Successful!</div>
                    <div className="text-green-600 dark:text-green-400">
                      Your GCTL tokens have been transferred to your wallet.
                      Balances will update automatically.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Info for claimed migrations */}
            {migrationData?.claimed && !isClaimSuccess && (
              <div className="text-sm text-muted-foreground">
                This GCTL has been successfully claimed and transferred to your
                wallet.
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Claim GCTL Allocation</DialogTitle>
            <DialogDescription>
              Confirm that you want to claim your GCTL tokens from the CGP
              (Carbon Glow Protocol).
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Amount to claim
                  </div>
                  <div className="text-2xl font-bold">
                    {migrationAmountFormatted} GCTL
                  </div>
                </div>
                <Gift className="w-10 h-10 text-muted-foreground/30" />
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  This will transfer your allocated GCTL tokens to your wallet
                  balance. This action can only be done once.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={isClaimingMigration}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmClaim} disabled={isClaimingMigration}>
              {isClaimingMigration ? (
                <>
                  <Gift className="w-4 h-4 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4 mr-2" />
                  Confirm Claim
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
