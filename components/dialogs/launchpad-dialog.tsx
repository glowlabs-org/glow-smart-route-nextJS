"use client";

import React from "react";

import { DepositDialog } from "@/app/marketplace/deposit-dialog";
import type {
  LaunchpadRewardScore,
  MiningCenterScore,
} from "@/app/marketplace/deposit-dialog";
import { LaunchpadView } from "@/app/marketplace/launchpad-view";
import type { TaggedAuctionApplication } from "@/app/marketplace/launchpad-view";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface LaunchpadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LaunchpadDialog({ open, onOpenChange }: LaunchpadDialogProps) {
  const [depositOpen, setDepositOpen] = React.useState(false);
  const [selectedApplicationForDeposit, setSelectedApplicationForDeposit] =
    React.useState<TaggedAuctionApplication | null>(null);
  const [selectedRewardScore, setSelectedRewardScore] = React.useState<
    LaunchpadRewardScore | MiningCenterScore | null
  >(null);

  const handleLaunchpadOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (nextOpen) return;
      setDepositOpen(false);
      setSelectedApplicationForDeposit(null);
      setSelectedRewardScore(null);
    },
    [onOpenChange]
  );

  const handlePayDeposit = React.useCallback(
    (
      application: TaggedAuctionApplication,
      scoreData?: LaunchpadRewardScore | MiningCenterScore | null
    ) => {
      setSelectedApplicationForDeposit(application);
      setSelectedRewardScore(scoreData ?? null);
      setDepositOpen(true);
    },
    [onOpenChange]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleLaunchpadOpenChange}>
        <DialogContent className="p-0 sm:max-w-6xl w-full h-[85vh] overflow-hidden rounded-3xl border-foreground/10 dark:border-border">
          <ScrollArea className="h-[85vh]">
            <LaunchpadView variant="dialog" onPayDeposit={handlePayDeposit} />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedApplicationForDeposit?._type === "miners" ? (
        <DepositDialog
          open={depositOpen}
          onOpenChange={setDepositOpen}
          application={selectedApplicationForDeposit}
          selectedCurrency="USDC"
          rewardScore={selectedRewardScore as MiningCenterScore | null}
        />
      ) : (
        <DepositDialog
          open={depositOpen}
          onOpenChange={setDepositOpen}
          application={selectedApplicationForDeposit}
          selectedCurrency="GLW"
          rewardScore={selectedRewardScore as LaunchpadRewardScore | null}
        />
      )}
    </>
  );
}
