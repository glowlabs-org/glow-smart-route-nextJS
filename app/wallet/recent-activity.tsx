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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Activity {
  type: string;
  time: string;
  [key: string]: any;
}

interface RecentActivityProps {
  activities: Activity[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
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
            <span className="font-medium">{activity.amount} GCTL</span>
            <span className="text-muted-foreground">in</span>
            <Badge variant="secondary">{activity.region}</Badge>
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
    toast.info("Opening transaction on Etherscan", {
      description: `Tx: 0x${Math.random().toString(36).substring(7)}...`,
    });
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
        </ScrollArea>

        {activities.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <div className="text-sm">No recent activity</div>
            <div className="text-xs mt-1">
              Your transactions will appear here
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
