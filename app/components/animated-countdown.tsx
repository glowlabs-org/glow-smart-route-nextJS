"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface CountdownClockParts {
  hours: string;
  minutes: string;
  seconds: string;
}

type CountdownSize = "sm" | "md" | "lg" | "xl";

function formatHms(remainingMs: number): CountdownClockParts {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function formatDhms(remainingMs: number): {
  days: number;
  hours: string;
  minutes: string;
  seconds: string;
} {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad2 = (n: number) => String(n).padStart(2, "0");

  return { days, hours: pad2(hours), minutes: pad2(minutes), seconds: pad2(seconds) };
}

export function useCountdownTo(params: {
  targetAtMs: number;
  onComplete?: () => void;
  tickMs?: number;
}) {
  const { targetAtMs, onComplete, tickMs = 1000 } = params;
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const hasCompletedRef = React.useRef(false);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), tickMs);
    return () => window.clearInterval(intervalId);
  }, [tickMs]);

  const remainingMs = Math.max(0, targetAtMs - nowMs);

  React.useEffect(() => {
    if (!onComplete) return;
    if (remainingMs !== 0) return;
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    onComplete();
  }, [remainingMs, onComplete]);

  React.useEffect(() => {
    // Reset completion guard if target changes
    hasCompletedRef.current = false;
  }, [targetAtMs]);

  return remainingMs;
}

function AnimatedTimePart({
  value,
  size = "md",
  minWidthCh = 4,
}: {
  value: string;
  size?: CountdownSize;
  minWidthCh?: number;
}) {
  const heightClass =
    size === "sm"
      ? "h-7"
      : size === "md"
        ? "h-8"
        : size === "lg"
          ? "h-10"
          : "h-12";
  const textClass =
    size === "sm"
      ? "text-xl"
      : size === "md"
        ? "text-2xl"
        : size === "lg"
          ? "text-3xl"
          : "text-4xl";

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-lg bg-background/60 px-1.5 ring-1 ring-border/60",
        heightClass
      )}
      style={{ minWidth: `${minWidthCh}ch` }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: 14, opacity: 0, filter: "blur(6px)", scale: 0.98 }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)", scale: 1 }}
          exit={{ y: -14, opacity: 0, filter: "blur(6px)", scale: 0.98 }}
          transition={{
            type: "spring",
            stiffness: 700,
            damping: 45,
            mass: 0.7,
          }}
          className={cn(
            "absolute inset-0 flex items-center justify-center font-mono font-bold tabular-nums text-foreground",
            textClass
          )}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function AnimatedCountdown({
  remainingMs,
  size = "md",
  className,
}: {
  remainingMs: number;
  size?: CountdownSize;
  className?: string;
}) {
  const { hours, minutes, seconds } = React.useMemo(
    () => formatHms(remainingMs),
    [remainingMs]
  );
  const colonClass =
    size === "sm"
      ? "text-lg"
      : size === "md"
        ? "text-xl"
        : size === "lg"
          ? "text-2xl"
          : "text-3xl";

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <AnimatedTimePart value={hours} size={size} />
      <motion.span
        className={cn(
          "px-0.5 font-mono font-bold text-muted-foreground",
          colonClass
        )}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      >
        :
      </motion.span>
      <AnimatedTimePart value={minutes} size={size} />
      <motion.span
        className={cn(
          "px-0.5 font-mono font-bold text-muted-foreground",
          colonClass
        )}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      >
        :
      </motion.span>
      <AnimatedTimePart value={seconds} size={size} />
    </div>
  );
}

export function CountdownGrid({
  remainingMs,
  className,
}: {
  remainingMs: number;
  className?: string;
}) {
  const { days, hours, minutes, seconds } = React.useMemo(
    () => formatDhms(remainingMs),
    [remainingMs]
  );

  return (
    <div className={cn("grid grid-cols-4 gap-3 md:gap-4 place-items-center", className)}>
      <div className="bg-muted/30 border border-border rounded-xl p-4 w-full">
        <div className="font-mono text-3xl md:text-5xl font-bold tabular-nums text-foreground">
          {days}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-mono">
          Days
        </div>
      </div>
      <div className="bg-muted/30 border border-border rounded-xl p-4 w-full">
        <div className="font-mono text-3xl md:text-5xl font-bold tabular-nums text-foreground">
          {hours}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-mono">
          Hours
        </div>
      </div>
      <div className="bg-muted/30 border border-border rounded-xl p-4 w-full">
        <div className="font-mono text-3xl md:text-5xl font-bold tabular-nums text-foreground">
          {minutes}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-mono">
          Minutes
        </div>
      </div>
      <div className="bg-muted/30 border border-border rounded-xl p-4 w-full">
        <div className="font-mono text-3xl md:text-5xl font-bold tabular-nums text-foreground">
          {seconds}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-mono">
          Seconds
        </div>
      </div>
    </div>
  );
}

export function AnimatedCountdownDhms({
  remainingMs,
  size = "md",
  className,
}: {
  remainingMs: number;
  size?: CountdownSize;
  className?: string;
}) {
  const { days, hours, minutes, seconds } = React.useMemo(
    () => formatDhms(remainingMs),
    [remainingMs]
  );
  const daysLabel = String(days).padStart(2, "0");
  const colonClass =
    size === "sm"
      ? "text-lg"
      : size === "md"
        ? "text-xl"
        : size === "lg"
          ? "text-2xl"
          : "text-3xl";
  const minWidthCh =
    size === "sm" ? 2 : size === "md" ? 3 : size === "lg" ? 3 : 3;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <AnimatedTimePart value={daysLabel} size={size} minWidthCh={minWidthCh} />
      <motion.span
        className={cn(
          "px-0.5 font-mono font-bold text-muted-foreground",
          colonClass
        )}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      >
        :
      </motion.span>
      <AnimatedTimePart value={hours} size={size} minWidthCh={minWidthCh} />
      <motion.span
        className={cn(
          "px-0.5 font-mono font-bold text-muted-foreground",
          colonClass
        )}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      >
        :
      </motion.span>
      <AnimatedTimePart value={minutes} size={size} minWidthCh={minWidthCh} />
      <motion.span
        className={cn(
          "px-0.5 font-mono font-bold text-muted-foreground",
          colonClass
        )}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      >
        :
      </motion.span>
      <AnimatedTimePart value={seconds} size={size} minWidthCh={minWidthCh} />
    </div>
  );
}


