import React from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils"; // Assuming you have a `cn` utility for class names

// Props interface for type-safety and reusability
interface Vo2MaxCardProps {
  /** The main title of the card. */
  title: string;
  /** The primary numerical value to display. */
  value: number;
  /** A descriptive status text below the value (e.g., 'Excellent'). */
  status: string;
  /** A footer description. Can be a string or a ReactNode for rich text. */
  description: React.ReactNode;
  /** The progress percentage (0-100) for the radial bar. */
  progress: number;
  /** An icon component to display in the top-right corner. */
  icon: React.ReactNode;
  /** Optional className to merge with the default card styles. */
  className?: string;
}

export const Vo2MaxCard: React.FC<Vo2MaxCardProps> = ({
  title,
  value,
  status,
  description,
  progress,
  icon,
  className,
}) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const progressValue = useMotionValue(0);

  React.useEffect(() => {
    // Animate the numerical value
    const valueAnimation = animate(count, value, {
      duration: 1.5,
      ease: [0.43, 0.13, 0.23, 0.96],
    });

    // Animate the progress bar
    const progressAnimation = animate(progressValue, progress, {
      duration: 1.5,
      ease: [0.43, 0.13, 0.23, 0.96],
    });

    return () => {
      valueAnimation.stop();
      progressAnimation.stop();
    };
  }, [value, progress, count, progressValue]);

  // SVG circle properties
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = useTransform(
    progressValue,
    (v) => circumference - (v / 100) * circumference
  );

  return (
    <div
      className={cn(
        "relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm overflow-hidden",
        className
      )}
    >
      {/* Subtle decorative glow */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-primary/10 rounded-full blur-3xl -z-10" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-muted-foreground">{title}</h3>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {icon}
        </div>
      </div>

      {/* Radial Progress and Value */}
      <div className="relative flex h-56 w-full items-center justify-center">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="-rotate-90"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* Background track */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            strokeWidth="12"
            fill="transparent"
            className="stroke-primary/10"
            strokeDasharray="8 12" // Creates the segmented look
            strokeLinecap="round"
          />
          {/* Foreground progress */}
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            strokeWidth="12"
            fill="transparent"
            className="stroke-primary"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeLinecap="round"
            style={{ strokeDashoffset }}
          />
        </svg>

        {/* Central Text Content */}
        <div className="absolute flex flex-col items-center justify-center">
          <motion.span className="text-6xl font-bold tracking-tighter">
            {rounded}
          </motion.span>
          <p className="text-xl font-medium text-muted-foreground">{status}</p>
        </div>
      </div>

      {/* Footer Description */}
      <div className="text-center text-sm text-muted-foreground">
        {description}
      </div>
    </div>
  );
};

interface SegmentedCircleProgressProps {
  totalSteps: number;
  filledBeforeSteps: number;
  userSteps: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  otherColor?: string;
  userColor?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function SegmentedCircleProgress({
  totalSteps,
  filledBeforeSteps,
  userSteps,
  label,
  sublabel,
  otherColor = "var(--color-delegation-purple)", // Delegation Purple
  userColor = "#4ADE80", // GLW Green
  size = 200,
  strokeWidth = 12,
  className,
}: SegmentedCircleProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeTotal = Math.max(0, Math.floor(totalSteps));
  const safeFilledBefore = clampNumber(
    Math.floor(filledBeforeSteps),
    0,
    safeTotal
  );
  const safeUserSteps = clampNumber(Math.floor(userSteps), 0, safeTotal);

  const filledAfter = clampNumber(
    safeFilledBefore + safeUserSteps,
    0,
    safeTotal
  );
  const leftAfter = Math.max(0, safeTotal - filledAfter);

  const otherPct = safeTotal > 0 ? (safeFilledBefore / safeTotal) * 100 : 0;
  const userPct =
    safeTotal > 0
      ? (Math.min(safeUserSteps, safeTotal - safeFilledBefore) / safeTotal) *
        100
      : 0;

  const otherProgress = useMotionValue(0);
  const userProgress = useMotionValue(0);

  React.useEffect(() => {
    const otherAnim = animate(otherProgress, otherPct, {
      duration: 1.1,
      ease: [0.43, 0.13, 0.23, 0.96],
    });
    const userAnim = animate(userProgress, userPct, {
      duration: 1.1,
      delay: otherPct > 0 ? 0.1 : 0,
      ease: [0.43, 0.13, 0.23, 0.96],
    });
    return () => {
      otherAnim.stop();
      userAnim.stop();
    };
  }, [otherPct, userPct, otherProgress, userProgress]);

  const otherDashOffset = useTransform(
    otherProgress,
    (v) => circumference - (v / 100) * circumference
  );
  const userDashOffset = useTransform(
    userProgress,
    (v) => circumference - (v / 100) * circumference
  );

  const centerLabel =
    label ?? (
      <span className="text-4xl font-bold tracking-tight font-mono">
        {filledAfter}/{safeTotal}
      </span>
    );

  const centerSublabel =
    sublabel ?? (
      <span className="text-xs text-muted-foreground">
        {leftAfter} left
      </span>
    );

  const viewBox = `0 0 ${size} ${size}`;
  const center = size / 2;
  const rotation = (otherPct / 100) * 360;

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        className="-rotate-90"
        role="progressbar"
        aria-valuenow={filledAfter}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          className="stroke-primary/10"
          strokeDasharray="8 12"
          strokeLinecap="round"
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          stroke={otherColor}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeLinecap="round"
          style={{ strokeDashoffset: otherDashOffset, opacity: 0.65 }}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          stroke={userColor}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${center} ${center})`}
          style={{ strokeDashoffset: userDashOffset }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-foreground">{centerLabel}</div>
        <div className="mt-1">{centerSublabel}</div>
      </div>
    </div>
  );
}
