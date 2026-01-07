"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

interface UnstakingExplanationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnstakingExplanationModal({
  open,
  onOpenChange,
}: UnstakingExplanationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-md w-full border-border overflow-hidden flex flex-col gap-0 max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="px-5 py-4 border-b border-border/60">
          <DialogTitle className="text-lg font-semibold">
            Understanding GCTL Unstaking
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              GCTL uses a gradual unstaking mechanism to ensure stable,
              predictable rewards for solar farms. When you unstake GCTL,{" "}
              <span className="font-medium text-foreground">
                1% of your staked balance is released each week
              </span>
              .
            </p>

            <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2">
              <div className="text-sm font-semibold text-foreground">
                Example:
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    If you stake{" "}
                    <strong className="text-foreground">100 GCTL</strong>, it
                    takes <strong className="text-foreground">100 weeks</strong>{" "}
                    to fully unstake
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    If you stake{" "}
                    <strong className="text-foreground">1,000 GCTL</strong>, you
                    receive{" "}
                    <strong className="text-foreground">
                      10 GCTL per week
                    </strong>{" "}
                    for 100 weeks
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">
                Why This Design?
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <strong className="text-foreground">Stable rewards</strong>{" "}
                    for solar farms - prevents sudden emission drops
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <strong className="text-foreground">
                      Long-term alignment
                    </strong>{" "}
                    - encourages sustained commitment to regions
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <strong className="text-foreground">
                      Predictable planning
                    </strong>{" "}
                    - farms can count on consistent GLW incentives
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/10 p-4">
            <Link
              href="https://glow.org/blog/beginner-guide-to-gctl"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 group"
            >
              <div>
                <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Read the full guide
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Learn more about GCTL mechanics
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </div>

        <div className="border-t border-border/60 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
