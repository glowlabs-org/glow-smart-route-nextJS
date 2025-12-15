"use client";

import React from "react";
import { Timer } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AnimatedCountdown,
  useCountdownTo,
} from "@/app/components/animated-countdown";

interface RewardsWidgetProps {
  initialDurationMs?: number;
}

const DEFAULT_INITIAL_DURATION_MS = (4 * 60 * 60 + 12 * 60 + 33) * 1000;

export default function RewardsWidget({
  initialDurationMs = DEFAULT_INITIAL_DURATION_MS,
}: RewardsWidgetProps) {
  const targetAtMsRef = React.useRef<number | null>(null);
  if (targetAtMsRef.current === null) {
    targetAtMsRef.current = Date.now() + Math.max(0, initialDurationMs);
  }
  const remainingMs = useCountdownTo({ targetAtMs: targetAtMsRef.current });
  const lifetimeRewardsUsd = 12340;

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-3 space-y-3">
        <CardTitle>Rewards</CardTitle>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 p-3">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-16 opacity-45"
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            style={{
              background:
                "conic-gradient(from 0deg, transparent, hsl(var(--primary) / 0.25), transparent)",
            }}
          />
          <div className="relative flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Next distribution in
              </span>
            </div>
            <div className="flex justify-center">
              <AnimatedCountdown remainingMs={remainingMs} size="sm" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 gap-4 pt-0">
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center px-1">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Claimable
          </div>
          <div className="mt-2 font-mono text-4xl font-bold tracking-tighter text-foreground tabular-nums">
            $450.00
          </div>
          <div className="mt-3 font-mono text-xs text-muted-foreground">
            Lifetime earned: $
            {lifetimeRewardsUsd.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
        </div>

        <Button className="w-full h-12 rounded-2xl font-mono font-bold text-base shrink-0">
          Claim
        </Button>
      </CardContent>
    </Card>
  );
}
