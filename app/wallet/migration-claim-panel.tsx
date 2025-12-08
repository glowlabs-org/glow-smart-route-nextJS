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
import {
  AlertCircle,
  CheckCircle2,
  Gift,
  Info,
  ExternalLink,
} from "lucide-react";
import { useMigrationClaim } from "@/hooks/useMigrationClaim";
import { useRegions } from "@/hooks/useRegions";
import FallbackImage from "@/components/ui/fallback-image";

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
  const [showSuccessState, setShowSuccessState] = React.useState(false);

  const {
    executeMigrationClaim,
    isClaimingMigration,
    isSuccess: isClaimSuccess,
    reset: resetMutation,
  } = useMigrationClaim();

  const { regions, isRegionsLoading } = useRegions();

  // Filter for active regions
  const activeRegions = regions.filter((region) => region.isActive);
  const hasClaimableMigrationAmount = React.useMemo(() => {
    if (!migrationData || migrationData.claimed) {
      return false;
    }
    try {
      return BigInt(migrationData.migrationAmount || "0") > BigInt(0);
    } catch {
      return false;
    }
  }, [migrationData]);

  // When claim succeeds, show success state
  React.useEffect(() => {
    if (isClaimSuccess && confirmDialogOpen) {
      setShowSuccessState(true);
    }
  }, [isClaimSuccess, confirmDialogOpen]);

  // Reset states when dialog closes
  React.useEffect(() => {
    if (!confirmDialogOpen) {
      setShowSuccessState(false);
      if (isClaimSuccess) {
        resetMutation();
      }
    }
  }, [confirmDialogOpen, isClaimSuccess]);
  // Don't render if wallet not connected
  if (!walletAddress) {
    return null;
  }

  // Don't render if loading and no data
  if (isLoading && !migrationData) {
    return (
      <Card className="mb-8 md:max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            <CardTitle>GCTL Allocation</CardTitle>
          </div>
          <CardDescription>Checking your V2 GCTL allocation</CardDescription>
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
  if (isError) {
    return null;
  }
  if (!isLoading && !hasClaimableMigrationAmount) {
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
    setConfirmDialogOpen(true);
  };

  const handleConfirmClaim = async () => {
    try {
      const success = await executeMigrationClaim();

      if (success) {
        // Keep dialog open to show success state
        // Call the onClaim callback to refresh data
        onClaim?.();
      }
    } catch (error) {
      console.error("Migration claim failed:", error);
      // Error handling is done in the mutation's onError
      // Keep dialog open on error so user can retry
    }
  };

  const migrationAmountFormatted = migrationData
    ? formatMigrationAmount(migrationData.migrationAmount)
    : "0.00";

  return (
    <Card className="relative overflow-hidden bg-muted dark:bg-muted/30 border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-xl md:text-2xl font-semibold">
                GCTL Allocation
              </CardTitle>
              {!isClaimSuccess && (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Available
                </Badge>
              )}
            </div>
            <CardDescription className="mt-2">
              Your V2 GCTL allocation is staked to the Clean Grid Project by
              default. Claim to unstake to your wallet.
            </CardDescription>
          </div>
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
            <div className="p-6 rounded-xl bg-background border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    GCTL available to unstake
                  </div>
                  <div className="text-3xl font-bold">
                    {migrationAmountFormatted} GCTL
                  </div>
                </div>
                <Gift className="w-12 h-12 text-muted-foreground/20" />
              </div>
            </div>

            {/* Claim Button */}
            {!isClaimSuccess && (
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
                      Unstake and claim GCTL
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Success Message */}
            {isClaimSuccess && (
              <div className="space-y-4">
                <div
                  className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 shadow-sm"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 text-sm text-green-700 dark:text-green-300">
                      <div className="font-semibold mb-1">Claim successful</div>
                      <div className="text-green-700 dark:text-green-300">
                        Your GCTL allocation has been unstaked from the Clean
                        Grid Project and transferred to your wallet. Balances
                        will update automatically.
                      </div>
                      <div className="mt-3">
                        <Button asChild variant="secondary" size="sm">
                          <a
                            href="https://impact.glow.org/vcr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1"
                          >
                            Explore regions
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Regions to stake to */}
                <div className="p-4 rounded-xl border border-border">
                  <div className="flex items-start gap-3 mb-4">
                    <Info className="w-5 h-5 text-muted-foreground/20 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-muted-foreground">
                      <div className="font-medium mb-1">Stake your GCTL</div>
                      <div className="text-muted-foreground">
                        Consider staking your GCTL to one of these active
                        regions to support renewable energy and earn rewards:
                      </div>
                    </div>
                  </div>

                  {isRegionsLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="w-full aspect-[16/9]" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeRegions.map((region) => (
                        <a
                          key={region.id}
                          href={`https://impact.glow.org/vcr/${region.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative overflow-hidden rounded-lg border border-border hover:border-primary/50 transition-all duration-200 hover:shadow-lg bg-background"
                        >
                          <div className="relative w-full aspect-[16/9]">
                            <FallbackImage
                              src={region.bannerUrl}
                              alt={region.name}
                              loading="lazy"
                              decoding="async"
                              disableProxy
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                              <div className="text-white font-semibold text-sm line-clamp-1">
                                {region.name}
                              </div>
                              <ExternalLink className="w-4 h-4 text-white/80 group-hover:text-white transition-colors flex-shrink-0" />
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className={"md:max-w-sm"}>
          {!showSuccessState ? (
            <>
              <DialogHeader>
                <DialogTitle>Unstake and claim GCTL</DialogTitle>
                <DialogDescription>
                  Your V2 GCTL allocation from prior contributions is currently
                  staked to the Clean Grid Project. Confirm to unstake and
                  transfer it to your wallet.
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
                      This will instantly unstake your GCTL and move it to your
                      wallet. This can only be done once, after that all
                      unstaking events take 100 weeks
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
                <Button
                  onClick={handleConfirmClaim}
                  disabled={isClaimingMigration}
                >
                  {isClaimingMigration ? (
                    <>
                      <Gift className="w-4 h-4 mr-2 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Confirm unstake and claim
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </span>
                  Claim successful
                </DialogTitle>
                <DialogDescription>
                  Your GCTL has been unstaked and transferred to your wallet.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-4">
                {/* Success info */}
                <div
                  className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 shadow-sm"
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-green-700 dark:text-green-300 mb-1">
                        Amount claimed
                      </div>
                      <div className="text-3xl font-bold text-green-800 dark:text-green-200">
                        {migrationAmountFormatted} GCTL
                      </div>
                    </div>
                    <CheckCircle2 className="w-10 h-10 text-green-600/30 dark:text-green-400/30" />
                  </div>
                </div>

                {/* Regions section */}
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3 mb-4">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <div className="font-medium mb-1">Stake your GCTL</div>
                      <div className="text-blue-600 dark:text-blue-400">
                        Consider staking your GCTL to one of these active
                        regions to support renewable energy and earn rewards:
                      </div>
                    </div>
                  </div>

                  {isRegionsLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="w-full aspect-[16/9]" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeRegions.map((region) => (
                        <a
                          key={region.id}
                          href={`https://impact.glow.org/vcr/${region.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative overflow-hidden rounded-lg border border-border hover:border-primary/50 transition-all duration-200 hover:shadow-lg bg-background"
                        >
                          <div className="relative w-full aspect-[16/9]">
                            <FallbackImage
                              src={region.bannerUrl}
                              alt={region.name}
                              loading="lazy"
                              decoding="async"
                              disableProxy
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                              <div className="text-white font-semibold text-sm line-clamp-1">
                                {region.name}
                              </div>
                              <ExternalLink className="w-4 h-4 text-white/80 group-hover:text-white transition-colors flex-shrink-0" />
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setConfirmDialogOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
