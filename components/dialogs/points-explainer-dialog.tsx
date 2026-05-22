"use client";

import * as React from "react";
import Link from "next/link";
import { Coins, ShoppingBag, CalendarCheck, ArrowRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PointsExplainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 text-[color:var(--color-glow-orange)]">•</span>
      <span>{children}</span>
    </li>
  );
}

export function PointsExplainerDialog({
  open,
  onOpenChange,
}: PointsExplainerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="px-6 pt-8 pb-6 border-b border-border/40">
          <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
            How points work
          </DialogTitle>
          <DialogDescription className="sr-only">
            A simple guide to how you earn and spend points.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-5 overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Points are a reward you can spend.
            </span>{" "}
            Take part in Glow, collect points, then trade them for real perks in
            the points shop.
          </p>

          {/* Ways to earn */}
          <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
              <Coins className="h-3.5 w-3.5" />
              Ways to earn
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              <Bullet>
                <strong className="text-foreground">Delegate GLW</strong> to a
                solar farm.
              </Bullet>
              <Bullet>
                <strong className="text-foreground">Delegate sGCTL</strong>{" "}
                (staked GCTL) to a solar farm.
              </Bullet>
              <Bullet>
                <strong className="text-foreground">Buy a miner</strong> in the
                marketplace.
              </Bullet>
              <Bullet>
                Keep a <strong className="text-foreground">weekly streak</strong>{" "}
                by staying active.
              </Bullet>
              <Bullet>
                <strong className="text-foreground">Invite friends</strong> and
                earn a share of their points.
              </Bullet>
            </ul>
            <p className="text-xs text-muted-foreground/80">
              The more you put in, the more points you get.
            </p>
          </div>

          {/* When you get them */}
          <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
              <CalendarCheck className="h-3.5 w-3.5" />
              When you get them
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              <Bullet>
                <strong className="text-foreground">Right away:</strong> when you
                delegate or buy a miner, you get those points once, on the spot.
              </Bullet>
              <Bullet>
                <strong className="text-foreground">Every week:</strong> your
                streak bonus and your share from friends keep adding up week
                after week.
              </Bullet>
            </ul>
            <p className="text-xs text-muted-foreground/80">
              Just holding GLW in your wallet does not earn points.
            </p>
          </div>

          {/* What they're for */}
          <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
              <ShoppingBag className="h-3.5 w-3.5" />
              What they are for
            </div>
            <p className="text-sm text-muted-foreground">
              Spend your points in the shop on miners, watts, early access and a
              weekly mega prize. New items drop every week, first come, first
              served.
            </p>
          </div>

          <p className="text-xs text-muted-foreground/80">
            Your starting balance was carried over from the old points system,
            so nothing you earned before was lost.
          </p>
        </div>

        <div className="border-t border-border/40 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link
              href="/shop"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center gap-1.5"
            >
              Open the points shop
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
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
