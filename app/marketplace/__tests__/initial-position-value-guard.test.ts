import { describe, expect, it } from "vitest";

import {
  getInitialPositionValueGuard,
  INITIAL_POSITION_USD_GRACE,
  MIN_INITIAL_POSITION_USD,
} from "../deposit-dialog-utils";

describe("getInitialPositionValueGuard", () => {
  it("blocks first-time positions below the minimum dollar value", () => {
    const result = getInitialPositionValueGuard({
      purchaseValueUsd: 150,
      hasExistingPositions: false,
    });

    expect(result.isBlocked).toBe(true);
    expect(result.minimumUsd).toBe(MIN_INITIAL_POSITION_USD);
    expect(result.shortfallUsd).toBe(50);
    expect(result.message).toContain("$200");
  });

  it("allows first-time positions at the minimum dollar value", () => {
    const result = getInitialPositionValueGuard({
      purchaseValueUsd: MIN_INITIAL_POSITION_USD,
      hasExistingPositions: false,
    });

    expect(result.isBlocked).toBe(false);
    expect(result.shortfallUsd).toBe(0);
    expect(result.message).toBeNull();
  });

  it("allows first-time positions within the configured rounding grace", () => {
    const result = getInitialPositionValueGuard({
      purchaseValueUsd: MIN_INITIAL_POSITION_USD - INITIAL_POSITION_USD_GRACE + 0.01,
      hasExistingPositions: false,
    });

    expect(result.isBlocked).toBe(false);
    expect(result.shortfallUsd).toBe(0);
    expect(result.message).toBeNull();
  });

  it("does not apply once the wallet already has a miner or delegation", () => {
    const result = getInitialPositionValueGuard({
      purchaseValueUsd: 50,
      hasExistingPositions: true,
    });

    expect(result.isBlocked).toBe(false);
    expect(result.shortfallUsd).toBe(0);
    expect(result.message).toBeNull();
  });
});
