"use client";

import React from "react";
import { motion, Variants } from "framer-motion";

export interface GlowSymbolProps {
  className?: string;
}

// Helper function to calculate polygon area using Shoelace formula
function calculatePolygonArea(pathData: string): number {
  // Extract coordinates from SVG path
  const coords: [number, number][] = [];
  const numbers = pathData.match(/[\d.]+/g) || [];

  for (let i = 0; i < numbers.length; i += 2) {
    if (i + 1 < numbers.length) {
      coords.push([parseFloat(numbers[i]), parseFloat(numbers[i + 1])]);
    }
  }

  // Calculate area using Shoelace formula
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }

  return Math.abs(area) / 2;
}

export function GlowSymbolAnimated({ className }: GlowSymbolProps) {
  const pathVariants: Variants = {
    initial: {
      fill: "currentColor",
      scale: 1,
    },
    highlight: (i: number) => ({
      opacity: [1, 0.5, 1],
      scale: [1, 0.9, 1],
      transition: {
        delay: i * 0.2,
        duration: 0.8,
        ease: "easeInOut" as const,
        repeat: Infinity,
        repeatDelay: (8 - 1) * 0.2 + 1.2, // Wait for all panels to complete one cycle
      },
    }),
  };

  const paths = [
    "M75.3805 0L63.6266 59.9862L102.965 86.2833L114.719 26.2971L75.3805 0Z",
    "M172.625 6.85553L121.898 40.9609L130.935 86.4428L181.663 52.3399L172.625 6.85553Z",
    "M236.181 80.1185L176.197 68.3622L150.952 106.128L210.935 117.882L236.181 80.1185Z",
    "M228.455 176.248L194.35 125.521L150.722 134.189L184.828 184.916L228.455 176.248Z",
    "M131.043 153.862L119.29 213.849L155.481 238.043L167.235 178.056L131.043 153.862Z",
    "M102.84 154.032L52.1126 188.138L60.4102 229.908L111.14 195.803L102.84 154.032Z",
    "M83.1263 134.28L23.1426 122.524L0 157.142L59.9862 168.896L83.1263 134.28Z",
    "M9.2948 63.4374L43.4002 114.165L83.3131 106.235L49.2101 55.5074L9.2948 63.4374Z",
  ];

  // Calculate areas and create indexed array
  const panelsWithArea = paths.map((path, index) => ({
    path,
    index,
    area: calculatePolygonArea(path),
  }));

  // Sort by area (smallest to largest)
  const sortedByArea = [...panelsWithArea].sort((a, b) => a.area - b.area);

  // Create the animation order: start with panel 7 (10 o'clock), then continue counter-clockwise from smallest to largest
  // Panel positions clockwise from top: 0 (top), 1, 2, 3, 4 (bottom), 5, 6, 7
  // Counter-clockwise from panel 7: 7, 6, 5, 4, 3, 2, 1, 0
  const counterClockwiseOrder = [7, 6, 5, 4, 3, 2, 1, 0];

  // Create animation sequence: smallest panel at position 7, then remaining panels by size
  const animationOrder: number[] = [];
  const remainingPanels = new Set(counterClockwiseOrder);

  // Start with panel 7 (10 o'clock position)
  animationOrder.push(7);
  remainingPanels.delete(7);

  // Add remaining panels in size order (smallest to largest) following counter-clockwise pattern
  sortedByArea.forEach(({ index }) => {
    if (remainingPanels.has(index)) {
      animationOrder.push(index);
      remainingPanels.delete(index);
    }
  });

  // Create a mapping from original index to animation order
  const animationOrderMap = new Map<number, number>();
  animationOrder.forEach((originalIndex, animOrder) => {
    animationOrderMap.set(originalIndex, animOrder);
  });

  return (
    <svg
      width="237"
      height="239"
      viewBox="0 0 237 239"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-black dark:text-white ${className ?? ""}`}
    >
      <defs>
        <linearGradient
          id="glowGradient"
          x1="0%"
          y1="0%"
          x2="70.71%"
          y2="70.71%"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="12.01%" stopColor="#f7fcc4" />
          <stop offset="39.47%" stopColor="#ccffd4" />
          <stop offset="93.61%" stopColor="#dcc4ff" />
        </linearGradient>
      </defs>
      {paths.map((path, i) => (
        <motion.path
          key={i}
          d={path}
          fill="currentColor"
          initial="initial"
          animate="highlight"
          custom={animationOrderMap.get(i) ?? i}
          variants={pathVariants}
        />
      ))}
    </svg>
  );
}
