import React from "react";
import { checksumAddress, keccak256 } from "viem";
import { Skeleton } from "@/components/ui/skeleton";

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

export interface AddressToGradientProps
  extends React.HTMLAttributes<HTMLDivElement> {
  address?: `0x${string}`;
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
}

export const AddressToGradient = React.forwardRef<
  HTMLDivElement,
  AddressToGradientProps
>(({ className, address, isLoading, size = "md", ...props }, ref) => {
  if (isLoading || !address) {
    return <Skeleton className={className} {...props} />;
  }
  const sizeClass = {
    sm: "2rem",
    md: "3rem",
    lg: "4rem",
  };
  let normalizedAddress = checksumAddress(address);
  if (!normalizedAddress.startsWith("0x")) {
    normalizedAddress = `0x${normalizedAddress}`;
  }
  const addressHash = keccak256(normalizedAddress);
  const gradient = hashToGradient(addressHash);

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

AddressToGradient.displayName = "AddressToGradient";
