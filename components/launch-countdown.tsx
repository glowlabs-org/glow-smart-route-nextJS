"use client";

import React from "react";

interface LaunchCountdownProps {
  target: Date;
  title?: string;
  subtitle?: string;
}

export function LaunchCountdown({
  target,
  title,
  subtitle,
}: LaunchCountdownProps) {
  const targetTimestamp = React.useMemo(() => target.getTime(), [target]);

  const [now, setNow] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Math.max(targetTimestamp - now, 0);

  const { days, hours, minutes, seconds } = React.useMemo(() => {
    const totalSeconds = Math.floor(remaining / 1000);
    const d = Math.floor(totalSeconds / (3600 * 24));
    const h = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return { days: d, hours: h, minutes: m, seconds: s };
  }, [remaining]);

  const pad2 = (n: number) => n.toString().padStart(2, "0");

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
        <div className="grid grid-cols-4 gap-3 md:gap-4 place-items-center">
          <div className="bg-muted/50 border border-border rounded-xl p-4 w-full">
            <div
              className="text-2xl sm:text-3xl md:text-5xl"
              style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
            >
              {days}
            </div>
            <div
              className="text-xs uppercase tracking-wider text-muted-foreground mt-1"
              style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
            >
              Days
            </div>
          </div>
          <div className="bg-muted/50 border border-border rounded-xl p-4 w-full">
            <div
              className="text-2xl sm:text-3xl md:text-5xl"
              style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
            >
              {pad2(hours)}
            </div>
            <div
              className="text-xs uppercase tracking-wider text-muted-foreground mt-1"
              style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
            >
              Hours
            </div>
          </div>
          <div className="bg-muted/50 border border-border rounded-xl p-4 w-full">
            <div
              className="text-2xl sm:text-3xl md:text-5xl"
              style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
            >
              {pad2(minutes)}
            </div>
            <div
              className="text-xs uppercase tracking-wider text-muted-foreground mt-1"
              style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
            >
              Minutes
            </div>
          </div>
          <div className="bg-muted/50 border border-border rounded-xl p-4 w-full">
            <div
              className="text-2xl sm:text-3xl md:text-5xl"
              style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
            >
              {pad2(seconds)}
            </div>
            <div
              className="text-xs uppercase tracking-wider text-muted-foreground mt-1"
              style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
            >
              Seconds
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
