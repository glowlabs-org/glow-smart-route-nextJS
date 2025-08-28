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
import Link from "next/link";

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
            Liquidity incentive program
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We propose a 12-week grant of 5,000 GLW per week to Uniswap LPs.
            Rewards are distributed proportionally by liquidity share with an
            exponential loyalty bonus that grows the longer your liquidity stays
            deposited.
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>1 day: no bonus</li>
            <li>10 days: +50% bonus</li>
            <li>100 days: +125% bonus</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            GLW incentives are distributed after the v2 launch when epochs
            finalize. The v2 launch date is not yet defined.
          </p>

          <div>
            <Link
              href="/blog/liquidity-incentive-proposal"
              target="_blank"
              rel="noreferrer"
              className="text-sm underline text-primary hover:text-primary/80"
            >
              Read the full article →
            </Link>
          </div>
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
