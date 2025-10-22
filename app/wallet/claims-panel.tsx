"use client";

import React from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Gift,
  Coins,
  Sparkles,
  AlertCircle,
  ChevronRight,
  Clock,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClaimableRewards } from "@/hooks/useClaimableRewards";
import { useRewardsKernelWrapper } from "@/hooks/useRewardsKernelWrapper";
import {
  getHotWalletAddress,
  useMerkleProofs,
  weekToNonce,
} from "@/hooks/useMerkleProofs";
import { getCurrentEpoch, GENESIS_TIMESTAMP } from "@/utils/getCurrentEpoch";

// Currency configurations
const CURRENCY_CONFIG = {
  GLW: {
    icon: <Sparkles className="w-4 h-4" />,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    label: "GLOW",
  },
  USDC: {
    icon: <Coins className="w-4 h-4" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    label: "USDC",
  },
  USDG: {
    icon: <Coins className="w-4 h-4" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    label: "USDG",
  },
} as const;

type CurrencyKey = keyof typeof CURRENCY_CONFIG;

// Helper to format week number to date
function formatWeekDate(week: number): string {
  const weekTimestamp = GENESIS_TIMESTAMP + week * 7 * 86400;
  const date = new Date(weekTimestamp * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ClaimsPanel() {
  const { address, isConnected } = useAccount();
  const currentEpoch = getCurrentEpoch();
  const [claimedWeeks, setClaimedWeeks] = React.useState<Set<number>>(
    new Set()
  );

  // Fetch claimable rewards
  const { aggregatedTotals, weeklyBreakdown, isLoading, isError, refetch } =
    useClaimableRewards(address);

  // Rewards claiming functionality
  const {
    claimWeekRewards,
    claimAllRewards,
    isClaimingWeek,
    isClaimingAll,
    checkIfClaimed,
  } = useRewardsKernelWrapper();

  // Don't show panel if not connected
  if (!isConnected || !address) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Error Loading Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Failed to load your claimable rewards. Please try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Check if there are any claimable rewards
  const hasClaimableRewards = Object.keys(aggregatedTotals).length > 0;

  if (!hasClaimableRewards) {
    return null;
  }

  // Calculate total number of claimable weeks
  const totalClaimableWeeks = weeklyBreakdown.length;

  // Handle claim all
  const handleClaimAll = async () => {
    if (!address || weeklyBreakdown.length === 0) return;

    const hotWalletAddress = getHotWalletAddress();

    // Fetch all merkle proofs for unclaimed weeks
    const weeklyDataPromises = weeklyBreakdown
      .filter((week) => !claimedWeeks.has(week.week))
      .map(async (weekData) => {
        try {
          const response = await fetch(
            `https://pub-311748c72106476cbeabe0a22a59217d.r2.dev/weekly-report-week-${weekData.week}.json`
          );

          if (!response.ok) return null;

          const data = await response.json();
          const userProof = data.readableLeaves?.find(
            (leaf: any) => leaf.user.toLowerCase() === address.toLowerCase()
          );

          if (!userProof) return null;

          return {
            week: weekData.week,
            rewards: weekData.rewards,
            nonce: weekToNonce(weekData.week),
            proof: userProof.v2MerkleProof.map(
              (p: string) => p as `0x${string}`
            ),
            fromAddress: hotWalletAddress,
          };
        } catch (error) {
          console.error(
            `Failed to fetch proof for week ${weekData.week}:`,
            error
          );
          return null;
        }
      });

    const weeklyClaimData = (await Promise.all(weeklyDataPromises)).filter(
      (data): data is NonNullable<typeof data> => data !== null
    );

    if (weeklyClaimData.length === 0) {
      toast.error("No claimable rewards found");
      return;
    }

    // Mark all weeks as claimed optimistically
    const weeksToClaimSet = new Set(weeklyClaimData.map((d) => d.week));
    setClaimedWeeks((prev) => new Set([...prev, ...weeksToClaimSet]));

    try {
      const successfulTxHashes = await claimAllRewards(weeklyClaimData);

      // If some claims failed, remove them from claimed set
      if (successfulTxHashes.length < weeklyClaimData.length) {
        const successfulWeeks = new Set(
          weeklyClaimData.slice(0, successfulTxHashes.length).map((d) => d.week)
        );
        setClaimedWeeks((prev) => {
          const next = new Set(prev);
          weeksToClaimSet.forEach((week) => {
            if (!successfulWeeks.has(week)) {
              next.delete(week);
            }
          });
          return next;
        });
      }
    } catch (error) {
      console.error("Claim all error:", error);
      // Remove all weeks from claimed on error
      setClaimedWeeks((prev) => {
        const next = new Set(prev);
        weeksToClaimSet.forEach((week) => next.delete(week));
        return next;
      });
    }
  };

  // Component for week claim button with merkle proof loading
  const WeekClaimButton = ({
    weekData,
    isClaimingThisWeek,
    isClaimed,
    size = "sm",
    className,
  }: {
    weekData: any;
    isClaimingThisWeek: boolean;
    isClaimed: boolean;
    size?: "sm" | "default";
    className?: string;
  }) => {
    const {
      userProof,
      nonce,
      isLoading: isProofLoading,
    } = useMerkleProofs(weekData.week, address);

    const handleClaim = async () => {
      if (!userProof) {
        toast.error("No rewards found for your address in this week");
        return;
      }

      // Mark as claimed optimistically
      setClaimedWeeks((prev) => new Set([...prev, weekData.week]));

      try {
        const hotWalletAddress = getHotWalletAddress();

        // Convert string proof to proper format
        const proof = userProof.v2MerkleProof.map((p) => p as `0x${string}`);

        const txHash = await claimWeekRewards(
          weekData.week,
          weekData.rewards,
          nonce,
          proof,
          hotWalletAddress
        );

        if (!txHash) {
          // If claim failed, remove from claimed set
          setClaimedWeeks((prev) => {
            const next = new Set(prev);
            next.delete(weekData.week);
            return next;
          });
        }
      } catch (error) {
        console.error("Claim error:", error);
        toast.error("Failed to claim rewards");
        setClaimedWeeks((prev) => {
          const next = new Set(prev);
          next.delete(weekData.week);
          return next;
        });
      }
    };

    return (
      <Button
        size={size}
        className={cn("w-full mt-3", className)}
        onClick={handleClaim}
        disabled={
          isClaimingThisWeek ||
          isClaimingAll ||
          isClaimed ||
          isProofLoading ||
          !userProof
        }
        variant={isClaimed ? "secondary" : "default"}
      >
        {isClaimingThisWeek ? (
          <>
            <Clock className="w-4 h-4 mr-2 animate-spin" />
            Claiming...
          </>
        ) : isClaimed ? (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            Claimed
          </>
        ) : isProofLoading ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Loading proof...
          </>
        ) : !userProof ? (
          <>No rewards</>
        ) : (
          <>
            Claim Week {weekData.week}
            <ChevronRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    );
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Farm Rewards Available
            </CardTitle>
            <CardDescription className="mt-2">
              Claim your earned rewards from solar farm delegations
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleClaimAll}
              disabled={isClaimingAll || totalClaimableWeeks === 0}
              className="gap-2"
            >
              {isClaimingAll ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  Claim All
                  <Badge variant="secondary" className="ml-1">
                    {totalClaimableWeeks} weeks
                  </Badge>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Aggregated Totals Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Total Claimable
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(aggregatedTotals).map(([currency, amount]) => {
                const config = CURRENCY_CONFIG[currency as CurrencyKey] || {
                  icon: <Coins className="w-4 h-4" />,
                  color: "text-gray-600",
                  bgColor: "bg-gray-50 dark:bg-gray-950/20",
                  label: currency,
                };

                return (
                  <div
                    key={currency}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border",
                      config.bgColor
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-full bg-background",
                          config.color
                        )}
                      >
                        {config.icon}
                      </div>
                      <div>
                        <div className="font-medium">{config.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {totalClaimableWeeks} weeks
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {parseFloat(amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly Breakdown Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Weekly Breakdown
            </h3>
            <div className="space-y-2">
              {weeklyBreakdown.map((weekData) => {
                const isClaimingThisWeek = isClaimingWeek === weekData.week;
                const isClaimed = claimedWeeks.has(weekData.week);

                return (
                  <Collapsible
                    key={weekData.week}
                    className={cn(
                      "border rounded-lg transition-all",
                      isClaimed && "opacity-60 bg-muted/20"
                    )}
                  >
                    <div className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                      <CollapsibleTrigger className="flex flex-1 items-center justify-between text-left">
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <div className="font-medium">
                              Week {weekData.week}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatWeekDate(weekData.week)}
                            </div>
                          </div>
                          <Badge
                            variant={isClaimed ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {isClaimed ? "Claimed" : "Finalized"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {weekData.totalGlw !== "0" && (
                            <Badge variant="secondary">
                              {parseFloat(weekData.totalGlw).toFixed(2)} GLW
                            </Badge>
                          )}
                          {Array.from(
                            weekData.totalProtocolDeposit.entries()
                          ).map(([currency, amount]) => (
                            <Badge key={currency} variant="secondary">
                              {parseFloat(amount).toFixed(2)} {currency}
                            </Badge>
                          ))}
                          <ChevronRight className="w-4 h-4 text-muted-foreground ml-2" />
                        </div>
                      </CollapsibleTrigger>
                      <div className="ml-3 w-40">
                        <WeekClaimButton
                          weekData={weekData}
                          isClaimingThisWeek={isClaimingThisWeek}
                          isClaimed={isClaimed}
                          size="default"
                          className="mt-0"
                        />
                      </div>
                    </div>
                    <CollapsibleContent className="px-4 pb-4">
                      <div className="space-y-3 mt-3">
                        {weekData.rewards.map((reward, idx) => {
                          const config = CURRENCY_CONFIG[
                            reward.currency as CurrencyKey
                          ] || {
                            icon: <Coins className="w-4 h-4" />,
                            color: "text-gray-600",
                            bgColor: "bg-gray-50 dark:bg-gray-950/20",
                            label: reward.currency,
                          };

                          return (
                            <div
                              key={`${reward.currency}-${reward.type}-${idx}`}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "p-1.5 rounded-full",
                                    config.color
                                  )}
                                >
                                  {config.icon}
                                </div>
                                <div>
                                  <div className="text-sm font-medium">
                                    {config.label}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {reward.type === "glowInflation"
                                      ? "Inflation Rewards"
                                      : "Protocol Deposit"}
                                  </div>
                                </div>
                              </div>
                              <div className="text-sm font-medium">
                                {parseFloat(reward.amount).toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  }
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <div className="font-medium mb-1">About Claims</div>
                <div>
                  Rewards become claimable after a 3-week finality period. Week{" "}
                  {currentEpoch - 3} and earlier are available to claim.
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
