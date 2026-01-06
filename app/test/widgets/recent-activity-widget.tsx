"use client";

import { useAccount } from "wagmi";

import { useRecentActivityFeed } from "@/hooks/useRecentActivityFeed";
import { RecentActivity } from "@/app/wallet/recent-activity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RecentActivityWidgetProps {
  walletAddress?: string | null;
  hideIfEmpty?: boolean;
}

export default function RecentActivityWidget({
  walletAddress,
  hideIfEmpty = true,
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
      className="bg-card dark:bg-muted/30 border-foreground/10 dark:border-border pt-0"
      walletAddress={address}
      splitsActivity={splitsActivity}
      swapsActivity={swapsActivity}
      isSplitsActivityLoading={isSplitsActivityLoading}
      isSwapsActivityLoading={isSwapsActivityLoading}
      hideIfEmpty={hideIfEmpty}
      headerVariant="small"
      headerRight={
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-[11px] font-mono tracking-wider"
            >
              Expand
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Recent Activity</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <RecentActivity
                className="lg:max-h-none h-[75vh]"
                walletAddress={address}
                splitsActivity={splitsActivity}
                swapsActivity={swapsActivity}
                isSplitsActivityLoading={isSplitsActivityLoading}
                isSwapsActivityLoading={isSwapsActivityLoading}
                hideIfEmpty={hideIfEmpty}
                showHeader={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      }
    />
  );
}
