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
import { useLang } from "@/lib/i18n";

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
  const { t } = useLang();
  const ld = t.routes.liquidityDialogs;
  const isAfterCutoff = Date.now() > GLW_INCENTIVES_END_TIME;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isAfterCutoff ? ld.incentiveTitleEnded : ld.incentiveTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isAfterCutoff ? (
            <>
              <p className="text-sm text-muted-foreground">{ld.incentiveEnded1}</p>
              <p className="text-sm text-muted-foreground">{ld.incentiveEnded2}</p>
              <p className="text-sm text-muted-foreground">{ld.incentiveEnded3}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{ld.incentiveActive1}</p>
              <p className="text-sm text-muted-foreground">{ld.incentiveActive2}</p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>{ld.incentiveBullet1}</li>
                <li>{ld.incentiveBullet2}</li>
                <li>{ld.incentiveBullet3}</li>
              </ul>
              <p className="text-sm text-muted-foreground">{ld.incentiveActive3}</p>
              <p className="text-sm text-muted-foreground">{ld.incentiveActive4}</p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {ld.closeButton}
          </Button>
          <Button
            onClick={() => {
              onAcknowledge();
            }}
          >
            {ld.iUnderstand}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
