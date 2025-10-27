"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowDownUp,
  Send,
  Gift,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Clock,
  ExternalLink,
  ArrowRight,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useWallets } from "@/hooks/useWallets";
import { useRegions } from "@/hooks/useRegions";
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";

interface Activity {
  type: string;
  time: string;
  amount: string;
  token: string;
  txHash?: string;
  epoch?: number;
  timestamp: number;
  originalAmount?: string;
  originalCurrency?: string;
  region?: string;
  regionId?: number;
  [key: string]: any;
}

interface RecentActivityProps {
  walletAddress?: string;
  splitsActivity: any[];
}

export function RecentActivity({
  walletAddress,
  splitsActivity,
}: RecentActivityProps) {
  // Fetch wallet events data
  const {
    mintedEvents,
    stakeEvents,
    isMintedEventsLoading,
    isStakeEventsLoading,
  } = useWallets({
    walletAddress,
    enabled: Boolean(walletAddress),
    limit: 20, // Limit to recent 20 events
  });

  // Fetch regions for mapping region IDs to names
  const { regions } = useRegions();

  // Combine and format all activities
  const activities = React.useMemo(() => {
    const allActivities: Activity[] = [];

    // Add minted events
    mintedEvents.forEach((event) => {
      allActivities.push({
        type: "mint",
        time: new Date(event.ts).toLocaleDateString(),
        amount: parseFloat(
          formatUnits(BigInt(event.gctlMinted), DECIMALS_BY_TOKEN.GCTL)
        ).toFixed(2),
        token: "GCTL",
        originalAmount: parseFloat(
          formatUnits(
            BigInt(event.amountRaw),
            event.currency === "USDG" ? 6 : 18
          )
        ).toFixed(2),
        originalCurrency: event.currency,
        txHash: event.txId,
        epoch: event.epoch,
        timestamp: new Date(event.ts).getTime(),
      });
    });

    // Add stake events
    stakeEvents.forEach((event) => {
      allActivities.push({
        type: event.direction === "stake" ? "stake" : "unstake",
        time: new Date(event.ts).toLocaleDateString(),
        amount: parseFloat(
          formatUnits(BigInt(event.amount), DECIMALS_BY_TOKEN.GCTL)
        ).toFixed(0),
        token: "GCTL",
        region: event.regionName || `Region ${event.regionId}`,
        regionId: event.regionId,
        epoch: event.epoch,
        timestamp: new Date(event.ts).getTime(),
      });
    });

    // Add splits activity (fraction purchases)
    splitsActivity.forEach((split) => {
      const decimals =
        DECIMALS_BY_TOKEN[split.currency as keyof typeof DECIMALS_BY_TOKEN] ||
        18;
      allActivities.push({
        type: "fraction-purchase",
        time: new Date(split.timestamp * 1000).toLocaleDateString(),
        amount: parseFloat(
          formatUnits(BigInt(split.amount), decimals)
        ).toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
        token: split.currency,
        shares: split.stepsPurchased,
        applicationId: split.applicationId,
        fractionId: split.fractionId,
        fractionType: split.fractionType,
        fractionStatus: split.fractionStatus,
        progressPercent: split.progressPercent,
        txHash: split.transactionHash,
        timestamp: split.timestamp * 1000, // Convert to milliseconds
      });
    });

    // Sort by timestamp (newest first)
    return allActivities.sort((a, b) => b.timestamp - a.timestamp);
  }, [mintedEvents, stakeEvents, splitsActivity, regions]);

  const isLoading = isMintedEventsLoading || isStakeEventsLoading;
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "swap":
        return <ArrowDownUp className="w-4 h-4 md:w-6 md:h-6" />;
      case "send":
        return <Send className="w-4 h-4 md:w-6 md:h-6" />;
      case "claim":
        return <Gift className="w-4 h-4 md:w-6 md:h-6" />;
      case "stake":
        return <TrendingUp className="w-4 h-4 md:w-6 md:h-6" />;
      case "unstake":
        return <TrendingDown className="w-4 h-4 md:w-6 md:h-6" />;
      case "mint":
        return <Sparkles className="w-4 h-4 md:w-6 md:h-6" />;
      case "fraction-purchase":
        return <ShoppingCart className="w-4 h-4 md:w-6 md:h-6" />;
      case "impact-redemption":
        return <Sparkles className="w-4 h-4 md:w-6 md:h-6" />;
      default:
        return <Clock className="w-4 h-4 md:w-6 md:h-6" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "swap":
        return "text-blue-600 bg-blue-50 dark:bg-blue-950/20";
      case "send":
        return "text-purple-600 bg-purple-50 dark:bg-purple-950/20";
      case "claim":
        return "text-green-600 bg-green-50 dark:bg-green-950/20";
      case "stake":
        return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20";
      case "unstake":
        return "text-orange-600 bg-orange-50 dark:bg-orange-950/20";
      case "mint":
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20";
      case "fraction-purchase":
        return "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20";
      case "impact-redemption":
        return "text-pink-600 bg-pink-50 dark:bg-pink-950/20";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-950/20";
    }
  };

  const getActivityDescription = (activity: Activity) => {
    switch (activity.type) {
      case "swap":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {activity.amount} {activity.from}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="font-semibold">
              {activity.received} {activity.to}
            </span>
          </div>
        );
      case "send":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span>Sent</span>
            <span className="font-semibold">
              {activity.amount} {activity.token}
            </span>
            <span className="text-muted-foreground">to</span>
            <code className="text-xs bg-muted px-2 py-0.5 rounded break-all">
              {activity.to}
            </code>
          </div>
        );
      case "claim":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span>Claimed</span>
            <span className="font-semibold">
              {activity.amount} {activity.token}
            </span>
            {activity.region && (
              <Badge variant="secondary" className="text-xs">
                {activity.region}
              </Badge>
            )}
          </div>
        );
      case "stake":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span>Staked</span>
            <span className="font-semibold">
              {activity.amount} {activity.token}
            </span>
            <span className="text-muted-foreground">in</span>
            <Badge variant="secondary">{activity.region}</Badge>
          </div>
        );
      case "mint":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span>Minted</span>
            <span className="font-semibold">
              {activity.amount} {activity.token}
            </span>
            <span className="text-muted-foreground">from</span>
            <span className="font-semibold">
              {activity.originalAmount} {activity.originalCurrency}
            </span>
          </div>
        );
      case "fraction-purchase":
        const isMiningCenter = activity.fractionType === "mining-center";
        return (
          <div className="flex flex-wrap items-center gap-2">
            {isMiningCenter ? (
              <>
                <span>Purchased</span>
                <span className="font-semibold">{activity.shares}</span>
                <span className="text-muted-foreground">miners for</span>
                <span className="font-semibold">
                  {activity.amount} {activity.token}
                </span>
              </>
            ) : (
              <>
                <span>Delegated</span>
                <span className="font-semibold">
                  {activity.amount} {activity.token}
                </span>
              </>
            )}
            <Badge variant="secondary" className="text-xs">
              {activity.progressPercent}% filled
            </Badge>
          </div>
        );
      case "unstake":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span>Started unstaking</span>
            <span className="font-semibold">{activity.amount} GCTL</span>
            <span className="text-muted-foreground">from</span>
            <Badge variant="secondary">{activity.region}</Badge>
          </div>
        );
      case "impact-redemption":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span>Redeemed</span>
            <span className="font-semibold">
              {activity.amount} Impact ({activity.region})
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="font-semibold">{activity.received}</span>
          </div>
        );
      default:
        return <span>Unknown activity</span>;
    }
  };

  const handleViewTransaction = (activity: Activity) => {
    if (activity.txHash) {
      const etherscanUrl = `https://etherscan.io/tx/${activity.txHash}`;
      window.open(etherscanUrl, "_blank", "noopener,noreferrer");
    } else {
      toast.info(
        "Transaction hash not available, this is an off-chain activity"
      );
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold">Recent Activity</CardTitle>
        <CardDescription className="text-base mt-2">
          Your latest transactions and actions across Glow
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 md:p-6 rounded-xl border animate-pulse"
                >
                  <div className="w-12 h-12 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 w-3/4 bg-muted rounded" />
                    <div className="h-4 w-1/2 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, idx) => (
                <div
                  key={idx}
                  className="group flex items-start gap-4 p-4 md:p-6 rounded-xl border bg-muted dark:bg-muted/30 hover:bg-transparent hover:dark:bg-transparent transition-colors cursor-pointer"
                  onClick={() => handleViewTransaction(activity)}
                >
                  <div
                    className={cn(
                      "p-2.5 rounded-full flex-shrink-0",
                      getActivityColor(activity.type)
                    )}
                  >
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="text-sm md:text-base break-words">
                          {getActivityDescription(activity)}
                        </div>
                        <div className="text-xs md:text-sm text-muted-foreground">
                          {activity.time}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewTransaction(activity);
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && activities.length === 0 && (
            <div className="text-center py-16 px-4 text-muted-foreground">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <div className="text-base font-medium mb-2">
                No recent activity
              </div>
              <div className="text-sm">Your transactions will appear here</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
