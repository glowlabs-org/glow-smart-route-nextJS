import * as React from "react";

/**
 * ReplyCorp logo (red square + neon-green stylized "R" with arrow
 * accents). SVG approximation of the brand mark — swap to a hosted
 * PNG/SVG when one is dropped in `public/images/replycorp-logo.png`.
 */
export function ReplycorpLogo({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-label="ReplyCorp"
      className={className}
    >
      <rect width="40" height="40" rx="6" fill="#E5251A" />
      <g
        stroke="#D8FF1F"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* R body */}
        <path d="M11 9 L11 31" />
        <path d="M11 9 L24 9 Q31 9 31 16 Q31 22 24 22 L11 22" />
        {/* R leg with arrowhead detail */}
        <path d="M22 22 L31 31" />
        <path d="M28 28 L31 31 L31 27" />
      </g>
    </svg>
  );
}
