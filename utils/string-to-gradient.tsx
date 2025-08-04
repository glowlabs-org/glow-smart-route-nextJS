import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

function stringToHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Convert to positive number and then to hex, padded to ensure we have enough characters
  const positiveHash = Math.abs(hash);
  let hexHash = positiveHash.toString(16);

  // Ensure we have at least 64 characters by repeating and concatenating
  while (hexHash.length < 64) {
    hexHash += hexHash;
  }

  // Trim to exactly 64 characters
  return hexHash.slice(0, 64);
}

export function hashToGradient(hash: string): string {
  if (hash.startsWith("0x")) {
    hash = hash.slice(2);
  }
  if (hash.length !== 64) {
    throw new Error(
      "Invalid hash length. Expected a 32-byte hash represented as a 64-character hexadecimal string."
    );
  }

  // Helper function to convert part of the hash into an RGB color
  const hexToRgb = (hex: string): string => {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Extract multiple colors from the hash to create a more colorful gradient
  const color1 = hexToRgb(hash.slice(0, 6));
  const color2 = hexToRgb(hash.slice(12, 18));
  const color3 = hexToRgb(hash.slice(24, 30));
  const color4 = hexToRgb(hash.slice(48, 54));

  // Create the gradient with multiple color stops
  const gradient = `linear-gradient(135deg, ${color1}, ${color2}, ${color3}, ${color4})`;

  return gradient;
}

export interface StringToGradientProps
  extends React.HTMLAttributes<HTMLDivElement> {
  text?: string;
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
}

export const StringToGradient = React.forwardRef<
  HTMLDivElement,
  StringToGradientProps
>(({ className, text, isLoading, size = "md", ...props }, ref) => {
  if (isLoading || !text) {
    return <Skeleton className={className} {...props} />;
  }

  const sizeClass = {
    sm: "2rem",
    md: "3rem",
    lg: "4rem",
  };

  const stringHash = stringToHash(text);
  const gradient = hashToGradient(stringHash);

  return (
    <div
      ref={ref}
      className={className}
      {...props}
      style={{
        background: gradient,
        borderRadius: "9999px",
        padding: "0.25rem",
        width: sizeClass[size],
        height: sizeClass[size],
      }}
    ></div>
  );
});

StringToGradient.displayName = "StringToGradient";
