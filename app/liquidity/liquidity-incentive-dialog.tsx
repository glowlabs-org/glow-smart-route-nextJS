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
import { GLW_INCENTIVES_END_TIME } from "@/hooks/useLiquidityPositionsOptimized";

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
  const isAfterCutoff = Date.now() > GLW_INCENTIVES_END_TIME;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            Liquidity Incentive Grant{isAfterCutoff ? " (Ended)" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isAfterCutoff ? (
            <>
              <p className="text-sm text-muted-foreground">
                The GLW liquidity incentive program ran from September 2nd, 2025
                to November 25th, 2025 and has now ended.
              </p>
              <p className="text-sm text-muted-foreground">
                Existing liquidity providers will receive their earned GLW
                rewards when the GLW V2 smart contracts go live. The UI
                continues to track your liquidity positions and earned rewards.
              </p>
              <p className="text-sm text-muted-foreground">
                You can still add liquidity to earn exchange fees, but no
                additional GLW incentives will be distributed.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Glow is running a promotion from September 2nd, 2025 to November
                25th, 2025 where it is distributing 5,000 GLW per week to
                liquidity providers.
              </p>
              <p className="text-sm text-muted-foreground">
                Liquidity providers will earn GLW tokens based on how much
                liquidity they provide, and based on how long they have been
                providing liquidity. The rewards are structured to be
                exponential:
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
                The GLW rewards will be distributed to liquidity providers when
                the GLW V2 smart contracts go live. The UI will track your
                liquidity positions, as well as how many rewards they have
                earned.
              </p>
            </>
          )}
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
