"use client";
import React, { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface BackgroundBeamsProps {
  className?: string;
  width?: number;
  height?: number;
  strokeDasharray?: string;
  squares?: [number, number][];
}

export const BackgroundBeams = React.memo(
  ({
    className,
    width = 80,
    height = 80,
    strokeDasharray = "0",
    squares,
  }: BackgroundBeamsProps) => {
    const id = useId();

    return (
      <div
        className={cn(
          "absolute inset-0 flex h-full w-full items-center justify-center [mask-repeat:no-repeat] [mask-size:40px]",
          className
        )}
      >
        <motion.svg
          className="pointer-events-none absolute z-0 h-full w-full"
          width="100%"
          height="100%"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        >
          <defs>
            <motion.pattern
              id={id}
              width={width}
              height={height}
              patternUnits="userSpaceOnUse"
              x={-1}
              y={-1}
              initial={{ opacity: 0.1 }}
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{
                duration: 4,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "reverse",
              }}
            >
              <motion.path
                d={`M.5 ${height}V.5H${width}`}
                fill="none"
                stroke="url(#gridGradient)"
                strokeWidth="0.5"
                strokeDasharray={strokeDasharray}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
              />
            </motion.pattern>

            <linearGradient
              id="gridGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#F3F3F3" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#F3F3F3" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#F3F3F3" stopOpacity="0.3" />
            </linearGradient>

            <linearGradient
              id="bottomFadeGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="70%" stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>

            <mask id="bottomFadeMask">
              <rect
                width="100%"
                height="100%"
                fill="url(#bottomFadeGradient)"
              />
            </mask>
          </defs>

          <rect
            width="100%"
            height="100%"
            strokeWidth={0}
            fill={`url(#${id})`}
            mask="url(#bottomFadeMask)"
          />

          {/* Overlay gradient for depth */}
          <rect width="100%" height="100%" fill="url(#gridRadialGradient)" />

          {squares && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
            >
              {squares.map(([x, y], index) => (
                <motion.rect
                  key={`${x}-${y}`}
                  strokeWidth="0"
                  width={width - 1}
                  height={height - 1}
                  x={x * width + 1}
                  y={y * height + 1}
                  fill="url(#gridGradient)"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: [0.3, 0.8, 0.3],
                    scale: [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 3,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatType: "reverse",
                    delay: index * 0.1,
                  }}
                />
              ))}
            </motion.g>
          )}
        </motion.svg>
      </div>
    );
  }
);

BackgroundBeams.displayName = "BackgroundBeams";
