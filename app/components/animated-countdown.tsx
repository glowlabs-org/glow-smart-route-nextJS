"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "@/lib/i18n";

import { cn } from "@/lib/utils";
import { getLaunchpadNowMs } from "@/utils/launchpad-now";

interface CountdownClockParts {
  hours: string;
  minutes: string;
  seconds: string;
}

type CountdownSize = "xs" | "sm" | "md" | "lg" | "xl";

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

  return {
    days,
    hours: pad2(hours),
    minutes: pad2(minutes),
    seconds: pad2(seconds),
  };
}

export function useCountdownTo(params: {
  targetAtMs: number;
  onComplete?: () => void;
  tickMs?: number;
}) {
  const { targetAtMs, onComplete, tickMs = 1000 } = params;
  const [nowMs, setNowMs] = React.useState(() => getLaunchpadNowMs());
  const hasCompletedRef = React.useRef(false);

  React.useEffect(() => {
    const intervalId = window.setInterval(
      () => setNowMs(getLaunchpadNowMs()),
      tickMs,
    );
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
  const isXs = size === "xs";
  const heightClass =
    size === "xs"
      ? "h-5"
      : size === "sm"
      ? "h-7 w-10"
      : size === "md"
      ? "h-8 w-12"
      : size === "lg"
      ? "h-12 w-14 sm:h-16 sm:w-20"
      : size === "xl"
      ? "h-14 w-16 sm:h-20 sm:w-24"
      : "h-12 w-14";
  const textClass =
    size === "xs"
      ? "text-sm"
      : size === "sm"
      ? "text-xl"
      : size === "md"
      ? "text-2xl"
      : size === "lg"
      ? "text-3xl sm:text-5xl"
      : "text-4xl sm:text-6xl";

  // xs variant: inline text only, no box/background
  if (isXs) {
    return (
      <span
        className={cn(
          "relative inline-flex items-center justify-center overflow-hidden",
          heightClass
        )}
        style={{ minWidth: "2ch" }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={value}
            suppressHydrationWarning
            initial={{ y: 8, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.95 }}
            transition={{
              type: "tween",
              duration: 0.2,
              ease: "easeOut",
            }}
            className={cn(
              "absolute inset-0 flex items-center justify-center font-mono font-semibold tabular-nums text-foreground",
              textClass
            )}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-background/60 px-3 sm:px-4 ring-1 ring-border/60",
        heightClass
      )}
      style={{ minWidth: `${minWidthCh}ch` }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          suppressHydrationWarning
          initial={{ y: 12, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -12, opacity: 0, scale: 0.95 }}
          transition={{
            type: "tween",
            duration: 0.2,
            ease: "easeOut",
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
    size === "xs"
      ? "text-sm"
      : size === "sm"
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
  const { t } = useLang();
  const { days, hours, minutes, seconds } = React.useMemo(
    () => formatDhms(remainingMs),
    [remainingMs]
  );

  return (
    <div
      className={cn(
        "grid grid-cols-4 gap-3 md:gap-4 place-items-center",
        className
      )}
    >
      <div className="bg-muted/30 border border-border rounded-xl p-4 w-full">
        <div className="font-mono text-3xl md:text-5xl font-bold tabular-nums text-foreground">
          {days}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-mono">
          {t.common.countdown.daysLong}
        </div>
      </div>
      <div className="bg-muted/30 border border-border rounded-xl p-4 w-full">
        <div className="font-mono text-3xl md:text-5xl font-bold tabular-nums text-foreground">
          {hours}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-mono">
          {t.common.countdown.hoursLong}
        </div>
      </div>
      <div className="bg-muted/30 border border-border rounded-xl p-4 w-full">
        <div className="font-mono text-3xl md:text-5xl font-bold tabular-nums text-foreground">
          {minutes}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-mono">
          {t.common.countdown.minutesLong}
        </div>
      </div>
      <div className="bg-muted/30 border border-border rounded-xl p-4 w-full">
        <div className="font-mono text-3xl md:text-5xl font-bold tabular-nums text-foreground">
          {seconds}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-mono">
          {t.common.countdown.secondsLong}
        </div>
      </div>
    </div>
  );
}

export function AnimatedCountdownDhms({
  remainingMs,
  size = "md",
  className,
  showLabels = false,
}: {
  remainingMs: number;
  size?: CountdownSize;
  className?: string;
  showLabels?: boolean;
}) {
  const { t } = useLang();
  const { days, hours, minutes, seconds } = React.useMemo(
    () => formatDhms(remainingMs),
    [remainingMs]
  );
  const daysLabel = String(days).padStart(2, "0");
  const colonClass =
    size === "xs"
      ? "text-sm"
      : size === "sm"
      ? "text-lg"
      : size === "md"
      ? "text-xl"
      : size === "lg"
      ? "text-2xl"
      : "text-3xl";
  const minWidthCh =
    size === "xs" ? 2 : size === "sm" ? 2 : size === "md" ? 3 : size === "lg" ? 3 : 3;

  const labelClass =
    size === "xs"
      ? "text-[8px]"
      : size === "sm"
      ? "text-[9px]"
      : size === "md"
      ? "text-[10px]"
      : size === "lg"
      ? "text-xs"
      : "text-xs";

  if (showLabels) {
    return (
      <div className={cn("inline-flex items-start gap-1.5", className)}>
        <div className="flex flex-col items-center gap-1">
          <AnimatedTimePart
            value={daysLabel}
            size={size}
            minWidthCh={minWidthCh}
          />
          <span
            className={cn(
              "font-mono uppercase tracking-wider text-muted-foreground",
              labelClass
            )}
          >
            {t.common.countdown.days}
          </span>
        </div>
        <motion.span
          className={cn(
            "px-0.5 font-mono font-bold text-muted-foreground mt-1",
            colonClass
          )}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        >
          :
        </motion.span>
        <div className="flex flex-col items-center gap-1">
          <AnimatedTimePart value={hours} size={size} minWidthCh={minWidthCh} />
          <span
            className={cn(
              "font-mono uppercase tracking-wider text-muted-foreground",
              labelClass
            )}
          >
            {t.common.countdown.hours}
          </span>
        </div>
        <motion.span
          className={cn(
            "px-0.5 font-mono font-bold text-muted-foreground mt-1",
            colonClass
          )}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        >
          :
        </motion.span>
        <div className="flex flex-col items-center gap-1">
          <AnimatedTimePart
            value={minutes}
            size={size}
            minWidthCh={minWidthCh}
          />
          <span
            className={cn(
              "font-mono uppercase tracking-wider text-muted-foreground",
              labelClass
            )}
          >
            {t.common.countdown.min}
          </span>
        </div>
        <motion.span
          className={cn(
            "px-0.5 font-mono font-bold text-muted-foreground mt-1",
            colonClass
          )}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        >
          :
        </motion.span>
        <div className="flex flex-col items-center gap-1">
          <AnimatedTimePart
            value={seconds}
            size={size}
            minWidthCh={minWidthCh}
          />
          <span
            className={cn(
              "font-mono uppercase tracking-wider text-muted-foreground",
              labelClass
            )}
          >
            {t.common.countdown.sec}
          </span>
        </div>
      </div>
    );
  }

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
