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
        "pt-0 w-full",
        isMinimal
          ? "bg-transparent border-transparent h-full"
          : isFlow
          ? "bg-card/30 border-foreground/5"
          : "bg-card dark:bg-muted/30 border-foreground/10 dark:border-border"
      )}
      walletAddress={address}
      splitsActivity={splitsActivity}
      swapsActivity={swapsActivity}
      isSplitsActivityLoading={isSplitsActivityLoading}
      isSwapsActivityLoading={isSwapsActivityLoading}
      hideIfEmpty={hideIfEmpty}
      headerVariant="small"
      maxItems={4}
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
          <DialogContent className="sm:max-w-md p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Recent Activity</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <RecentActivity
                className="lg:max-h-none h-[75vh] bg-transparent border-transparent"
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
