"use client";

import React from "react";

export function MiniCountdown({ target }: { target: Date }) {
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

  const pad2 = (value: number) => value.toString().padStart(2, "0");

  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="rounded-lg border border-border bg-muted/50 p-3 text-center">
        <div className="text-2xl font-bold">{days}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Days
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/50 p-3 text-center">
        <div className="text-2xl font-bold">{pad2(hours)}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Hours
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/50 p-3 text-center">
        <div className="text-2xl font-bold">{pad2(minutes)}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Min
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/50 p-3 text-center">
        <div className="text-2xl font-bold">{pad2(seconds)}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Sec
        </div>
      </div>
    </div>
  );
}
