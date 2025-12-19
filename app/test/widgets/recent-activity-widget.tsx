"use client";

import { useAccount } from "wagmi";

import { useRecentActivityFeed } from "@/hooks/useRecentActivityFeed";
import { RecentActivity } from "@/app/wallet/recent-activity";

interface RecentActivityWidgetProps {
  walletAddress?: string | null;
}

export default function RecentActivityWidget({
  walletAddress,
}: RecentActivityWidgetProps) {
  const { address: connectedAddress } = useAccount();
  const address = walletAddress ?? connectedAddress;
  const hasWallet = Boolean(address);

  const {
    splitsActivity,
    swapsActivity,
    isSplitsActivityLoading,
    isSwapsActivityLoading,
  } = useRecentActivityFeed(address);

  if (!hasWallet) {
    return null;
  }

  return (
    <RecentActivity
      className="col-span-12 lg:col-span-4 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border"
      walletAddress={address}
      splitsActivity={splitsActivity}
      swapsActivity={swapsActivity}
      isSplitsActivityLoading={isSplitsActivityLoading}
      isSwapsActivityLoading={isSwapsActivityLoading}
      hideIfEmpty
    />
  );
}
