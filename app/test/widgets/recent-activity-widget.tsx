"use client";

import React from "react";
import { useAccount } from "wagmi";
import { Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSplitsActivity } from "@/hooks/useGlowLaunchpad";
import { RecentActivity } from "@/app/wallet/recent-activity";

export default function RecentActivityWidget() {
  const { address } = useAccount();
  const hasWallet = Boolean(address);

  const { activity: splitsActivity, isLoading } = useSplitsActivity({
    walletAddress: address,
    enabled: hasWallet,
    limit: 50,
  });

  if (!hasWallet) {
    return (
      <Card className="h-full max-h-[360px] overflow-hidden flex flex-col">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="tracking-tight">Recent Activity</CardTitle>
            <span className="text-[10px] font-mono uppercase text-muted-foreground">
              Wallet
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex items-center justify-center">
          <div className="text-center px-6 text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <div className="text-sm font-medium text-foreground/80">
              Connect wallet
            </div>
            <div className="text-xs mt-1">
              Activity will show up here once connected.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <RecentActivity
      walletAddress={address}
      splitsActivity={splitsActivity}
      isSplitsActivityLoading={isLoading}
    />
  );
}
