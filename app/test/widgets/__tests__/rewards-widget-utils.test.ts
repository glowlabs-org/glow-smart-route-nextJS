import { describe, expect, it } from "vitest";

import {
  formatNextClaimLabel,
  formatProtocolDepositAsset,
  getClaimableBreakdown,
  normalizeDashboardAsset,
  parseProtocolDepositTokenAmount,
} from "@/app/test/widgets/rewards-widget-utils";

describe("rewards-widget-utils", () => {
  it("includes sGCTL in the next-claim label", () => {
    expect(
      formatNextClaimLabel({
        GLW: 12_644,
        SGCTL: 124.787285,
      }),
    ).toBe("12,644 GLW + 125 sGCTL");
  });

  it("promotes SGCTL to the primary claimable entry when it is the only claim", () => {
    expect(
      getClaimableBreakdown({
        claimableTotalsByCurrency: {
          SGCTL: 124.787285,
        },
      }),
    ).toEqual([
      {
        currency: "SGCTL",
        value: 124.787285,
        label: "125 sGCTL",
        isPrimary: true,
      },
    ]);
  });

  it("normalizes GCTL protocol deposit assets to SGCTL", () => {
    expect(formatProtocolDepositAsset("GCTL")).toBe("SGCTL");
    expect(normalizeDashboardAsset("gctl")).toBe("SGCTL");
  });

  it("parses SGCTL protocol deposit rewards with 6 decimals", () => {
    expect(parseProtocolDepositTokenAmount("124787285", "GCTL")).toBe(
      124.787285,
    );
    expect(parseProtocolDepositTokenAmount("124787285", "SGCTL")).toBe(
      124.787285,
    );
  });
});
