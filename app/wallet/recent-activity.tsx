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
import { useMultipleFractionSplits } from "@/hooks/useFractionSplits";
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
}

export function RecentActivity({ walletAddress }: RecentActivityProps) {
  // Fetch wallet events data
  const {
    mintedEvents,
    stakeEvents,
    isMintedEventsLoading,
    isStakeEventsLoading,
  } = useWallets({
    walletAddress,
    enabled: Boolean(walletAddress),
    limit: 10, // Limit to recent 10 events
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
        ).toFixed(2),
        token: "GCTL",
        region: event.regionName || `Region ${event.regionId}`,
        regionId: event.regionId,
        epoch: event.epoch,
        timestamp: new Date(event.ts).getTime(),
      });
    });

    // Sort by timestamp (newest first)
    return allActivities.sort((a, b) => b.timestamp - a.timestamp);
  }, [mintedEvents, stakeEvents, regions]);

  const isLoading = isMintedEventsLoading || isStakeEventsLoading;
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "swap":
        return <ArrowDownUp className="w-4 h-4" />;
      case "send":
        return <Send className="w-4 h-4" />;
      case "claim":
        return <Gift className="w-4 h-4" />;
      case "stake":
        return <TrendingUp className="w-4 h-4" />;
      case "unstake":
        return <TrendingDown className="w-4 h-4" />;
      case "mint":
        return <Sparkles className="w-4 h-4" />;
      case "fraction-purchase":
        return <ShoppingCart className="w-4 h-4" />;
      case "impact-redemption":
        return <Sparkles className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
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
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {activity.amount} {activity.from}
            </span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className="font-medium">
              {activity.received} {activity.to}
            </span>
          </div>
        );
      case "send":
        return (
          <div className="flex items-center gap-2">
            <span>Sent</span>
            <span className="font-medium">
              {activity.amount} {activity.token}
            </span>
            <span className="text-muted-foreground">to</span>
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              {activity.to}
            </code>
          </div>
        );
      case "claim":
        return (
          <div className="flex items-center gap-2">
            <span>Claimed</span>
            <span className="font-medium">
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
          <div className="flex items-center gap-2">
            <span>Staked</span>
            <span className="font-medium">
              {activity.amount} {activity.token}
            </span>
            <span className="text-muted-foreground">in</span>
            <Badge variant="secondary">{activity.region}</Badge>
          </div>
        );
      case "mint":
        return (
          <div className="flex items-center gap-2">
            <span>Minted</span>
            <span className="font-medium">
              {activity.amount} {activity.token}
            </span>
            <span className="text-muted-foreground">from</span>
            <span className="font-medium">
              {activity.originalAmount} {activity.originalCurrency}
            </span>
          </div>
        );
      case "fraction-purchase":
        return (
          <div className="flex items-center gap-2">
            <span>Purchased</span>
            <span className="font-medium">{activity.shares} shares</span>
            <span className="text-muted-foreground">for</span>
            <span className="font-medium">{activity.amount} GLW</span>
            {activity.region && (
              <Badge variant="secondary">{activity.region}</Badge>
            )}
          </div>
        );
      case "unstake":
        return (
          <div className="flex items-center gap-2">
            <span>Started unstaking</span>
            <span className="font-medium">{activity.amount} GCTL</span>
            <span className="text-muted-foreground">from</span>
            <Badge variant="secondary">{activity.region}</Badge>
          </div>
        );
      case "impact-redemption":
        return (
          <div className="flex items-center gap-2">
            <span>Redeemed</span>
            <span className="font-medium">
              {activity.amount} Impact ({activity.region})
            </span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className="font-medium">{activity.received}</span>
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
      toast.success("Opening transaction on Etherscan");
    } else {
      toast.info("Transaction hash not available");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Your latest transactions and actions across Glow
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg border animate-pulse"
                >
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-1/2 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity, idx) => (
                <div
                  key={idx}
                  className="group flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <div
                    className={cn(
                      "p-2 rounded-full",
                      getActivityColor(activity.type)
                    )}
                  >
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-sm">
                          {getActivityDescription(activity)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {activity.time}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleViewTransaction(activity)}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && activities.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <div className="text-sm">No recent activity</div>
              <div className="text-xs mt-1">
                Your transactions will appear here
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
