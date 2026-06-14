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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/lib/i18n";

export interface LaunchpadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LaunchpadDialog({ open, onOpenChange }: LaunchpadDialogProps) {
  const { t } = useLang();
  const [depositOpen, setDepositOpen] = React.useState(false);
  const [selectedApplicationForDeposit, setSelectedApplicationForDeposit] =
    React.useState<TaggedAuctionApplication | null>(null);
  const [selectedRewardScore, setSelectedRewardScore] = React.useState<
    LaunchpadRewardScore | MiningCenterScore | null
  >(null);
  // The leg the card chose (eligibility-gated). Drives the delegation dialog's
  // mode so an eligible "Delegate sGCTL" opens the sGCTL path, not GLW.
  const [selectedDepositCurrency, setSelectedDepositCurrency] = React.useState<
    "GLW" | "SGCTL" | "USDC" | null
  >(null);

  const handleLaunchpadOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (nextOpen) return;
      setDepositOpen(false);
      setSelectedApplicationForDeposit(null);
      setSelectedRewardScore(null);
      setSelectedDepositCurrency(null);
    },
    [onOpenChange]
  );

  const handlePayDeposit = React.useCallback(
    (
      application: TaggedAuctionApplication,
      scoreData?: LaunchpadRewardScore | MiningCenterScore | null,
      selectedCurrency?: "GLW" | "SGCTL" | "USDC"
    ) => {
      setSelectedApplicationForDeposit(application);
      setSelectedRewardScore(scoreData ?? null);
      setSelectedDepositCurrency(selectedCurrency ?? null);
      setDepositOpen(true);
    },
    [onOpenChange]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleLaunchpadOpenChange}>
        <DialogContent className="p-0 gap-0 sm:max-w-6xl w-full h-[85vh] overflow-hidden rounded-[24px] bg-card border border-border/40">
          <DialogTitle className="sr-only">{t.dialogs.launchpad.title}</DialogTitle>
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
          // Caller-driven leg: the card passes the eligibility-gated currency it
          // displayed, so an eligible "Delegate sGCTL" opens the sGCTL path.
          // Falls back to GLW (always available) when the card didn't specify.
          selectedCurrency={
            selectedDepositCurrency === "SGCTL" ? "SGCTL" : "GLW"
          }
          rewardScore={selectedRewardScore as LaunchpadRewardScore | null}
        />
      )}
    </>
  );
}
