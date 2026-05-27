import { describe, expect, it } from "vitest";

import {
  getInitialPositionValueGuard,
  INITIAL_POSITION_USD_GRACE,
  MIN_INITIAL_POSITION_USD,
} from "@/lib/initial-position-guard";

describe("getInitialPositionValueGuard", () => {
  it("blocks a small first miner or delegation position", () => {
    const result = getInitialPositionValueGuard({
      purchaseValueUsd: 10,
      hasExistingPositions: false,
    });

    expect(result.isBlocked).toBe(true);
    expect(result.minimumUsd).toBe(MIN_INITIAL_POSITION_USD);
    expect(result.shortfallUsd).toBe(190);
  });

  it("allows small positions when the wallet already has reward splits", () => {
    expect(
      getInitialPositionValueGuard({
        purchaseValueUsd: 10,
        hasExistingPositions: true,
      }).isBlocked,
    ).toBe(false);
  });

  it("allows first positions inside the configured grace window", () => {
    expect(
      getInitialPositionValueGuard({
        purchaseValueUsd: MIN_INITIAL_POSITION_USD - INITIAL_POSITION_USD_GRACE,
        hasExistingPositions: false,
      }).isBlocked,
    ).toBe(false);
  });
});
