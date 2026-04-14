import { describe, expect, it } from "vitest";

import { getSgctlPreparationCutoffGuard } from "../deposit-dialog-utils";

describe("getSgctlPreparationCutoffGuard", () => {
  const fractionCreatedAt = "2026-04-13T16:52:59.147Z"; // Monday 12:52:59 PM ET

  it("allows mint-and-stake paths before the Tuesday noon ET cutoff", () => {
    const result = getSgctlPreparationCutoffGuard({
      selectedCurrency: "SGCTL",
      sgctlSource: "mint_usdc",
      fractionCreatedAt,
      nowMs: Date.parse("2026-04-14T15:59:59.000Z"), // Tue 11:59:59 AM ET
    });

    expect(result.isBlocked).toBe(false);
    expect(result.message).toBeNull();
  });

  it("blocks mint-and-stake paths once the Tuesday noon ET cutoff is reached", () => {
    const result = getSgctlPreparationCutoffGuard({
      selectedCurrency: "SGCTL",
      sgctlSource: "mint_eth",
      fractionCreatedAt,
      nowMs: Date.parse("2026-04-14T16:00:00.000Z"), // Tue 12:00:00 PM ET
    });

    expect(result.isBlocked).toBe(true);
    expect(result.message).toContain("closed at 12:00 PM ET");
    expect(result.message).toContain("12:05 PM ET");
  });

  it("also blocks wallet GCTL stake-and-delegate after noon", () => {
    const result = getSgctlPreparationCutoffGuard({
      selectedCurrency: "SGCTL",
      sgctlSource: "wallet_gctl",
      fractionCreatedAt,
      nowMs: Date.parse("2026-04-14T16:03:00.000Z"), // Tue 12:03 PM ET
    });

    expect(result.isBlocked).toBe(true);
  });

  it("never blocks already-staked SGCTL delegations", () => {
    const result = getSgctlPreparationCutoffGuard({
      selectedCurrency: "SGCTL",
      sgctlSource: "staked",
      fractionCreatedAt,
      nowMs: Date.parse("2026-04-14T16:04:59.000Z"), // Tue 12:04:59 PM ET
    });

    expect(result.isBlocked).toBe(false);
    expect(result.message).toBeNull();
  });

  it("does not apply to non-SGCTL flows", () => {
    const result = getSgctlPreparationCutoffGuard({
      selectedCurrency: "GLW",
      sgctlSource: "mint_usdc",
      fractionCreatedAt,
      nowMs: Date.parse("2026-04-14T16:10:00.000Z"),
    });

    expect(result.isBlocked).toBe(false);
    expect(result.message).toBeNull();
  });
});
