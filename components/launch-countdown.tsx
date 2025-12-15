"use client";

import React from "react";
import { motion } from "framer-motion";
import { CountdownGrid, useCountdownTo } from "@/app/components/animated-countdown";

interface LaunchCountdownProps {
  target: Date;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
}

export function LaunchCountdown({
  target,
  title,
  subtitle,
  onComplete,
}: LaunchCountdownProps) {
  const targetTimestamp = React.useMemo(() => target.getTime(), [target]);
  const remainingMs = useCountdownTo({ targetAtMs: targetTimestamp, onComplete });

  return (
    <div className="w-full flex items-center justify-center py-16 md:py-24">
      <div className="text-center max-w-2xl px-0 md:px-6">
        <div
          className="text-2xl sm:text-3xl md:text-4xl mb-4"
          style={{ fontFamily: "Duplicate Slab, serif", fontWeight: 300 }}
        >
          {title || "Coming Soon"}
        </div>
        {subtitle && (
          <div
            className="text-sm md:text-base text-muted-foreground mb-8"
            style={{ fontFamily: "Söhne, sans-serif", fontWeight: 400 }}
          >
            {subtitle}
          </div>
        )}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 p-4 md:p-6">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-24 opacity-35"
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            style={{
              background:
                "conic-gradient(from 0deg, transparent, hsl(var(--primary) / 0.22), transparent)",
            }}
          />
          <div className="relative">
            <CountdownGrid remainingMs={remainingMs} />
          </div>
        </div>
      </div>
    </div>
  );
}
