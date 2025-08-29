"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LiquidityIncentiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
}

export function LiquidityIncentiveDialog({
  open,
  onOpenChange,
  onAcknowledge,
}: LiquidityIncentiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            Liquidity Incentive Grant
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Glow is running a promotion from September 2nd, 2025 to November
            25th, 2025 where it is distributing 5,000 GLW per week to liquidity
            providers. If the program is successful, it is likely to be extended
            beyond November 25th.
          </p>
          <p className="text-sm text-muted-foreground">
            Liquidity providers will earn GLW tokens based on how much liquidity
            they provide, and based on how long they have been providing
            liquidity. The rewards are structured to be exponential:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>After 1 day, liquidity providers earn 1x rewards</li>
            <li>After 10 days, liquidity providers earn 1.5x rewards</li>
            <li>After 100 days, liquidity providers earn 2.25x rewards</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            ...and so on, with rewards steadily increasing every few minutes
          </p>
          <p className="text-sm text-muted-foreground">
            The GLW rewards will be distributed to liquidity providers when the
            GLW V2 smart contracts go live. The UI will track your liquidity
            positions, as well as how many rewards they have earned.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              onAcknowledge();
            }}
          >
            I understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
