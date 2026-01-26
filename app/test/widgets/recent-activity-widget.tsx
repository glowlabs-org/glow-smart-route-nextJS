"use client";

import { useAccount } from "wagmi";

import { useRecentActivityFeed } from "@/hooks/useRecentActivityFeed";
import { RecentActivity } from "@/app/wallet/recent-activity";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  variant?: "default" | "flow" | "minimal";
}

export default function RecentActivityWidget({
  walletAddress,
  hideIfEmpty = true,
  variant = "default",
}: RecentActivityWidgetProps) {
  const { address: connectedAddress } = useAccount();
  const address = walletAddress ?? connectedAddress;
  const hasWallet = Boolean(address);
  const isFlow = variant === "flow";
  const isMinimal = variant === "minimal";

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
      className={cn(
        "w-full",
        isMinimal
          ? "bg-transparent border-transparent h-full"
          : isFlow
          ? "bg-card/30 border-border/20"
          : "bg-card dark:bg-card border-border/20"
      )}
      walletAddress={address}
      splitsActivity={splitsActivity}
      swapsActivity={swapsActivity}
      isSplitsActivityLoading={isSplitsActivityLoading}
      isSwapsActivityLoading={isSwapsActivityLoading}
      hideIfEmpty={hideIfEmpty}
      headerVariant="small"
      maxItems={4}
      showKpis={false}
      headerRight={
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
            >
              View All
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md p-0 max-h-[85vh] flex flex-col overflow-hidden bg-card border-border/20 dark:border-border/40 rounded-2xl">
            <DialogHeader className="px-6 py-5 border-b border-border/20 dark:border-border/40 flex-shrink-0">
              <DialogTitle className="text-lg font-semibold tracking-tight">Recent Activity</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
              <RecentActivity
                className="h-auto lg:max-h-none bg-transparent border-transparent overflow-visible"
                walletAddress={address}
                splitsActivity={splitsActivity}
                swapsActivity={swapsActivity}
                isSplitsActivityLoading={isSplitsActivityLoading}
                isSwapsActivityLoading={isSwapsActivityLoading}
                hideIfEmpty={hideIfEmpty}
                showHeader={false}
                showKpis={false}
                maxItems={50}
              />
            </div>
          </DialogContent>
        </Dialog>
      }
    />
  );
}
