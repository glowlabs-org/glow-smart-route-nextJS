/**
 * Tests for cost calculation utilities in deposit-dialog.
 *
 * Run with: pnpm vitest run app/marketplace/__tests__/cost-calculations.test.ts
 */

import { describe, it, expect } from "vitest";
import { parseUnits, formatUnits } from "viem";
import {
  calculateCostInGCTL,
  calculateCostInGLW,
  calculateCostInUSDC,
  calculateCostInETH,
  type ActiveFraction,
} from "../deposit-dialog-utils";

// ============================================================================
// Test Fixtures
// ============================================================================

function createFraction(overrides: Partial<ActiveFraction> = {}): ActiveFraction {
  return {
    id: "test-fraction",
    owner: "0x1234567890123456789012345678901234567890",
    step: parseUnits("100", 18).toString(), // 100 GLW per step
    stepPrice: parseUnits("50", 6).toString(), // $50 USDC per step
    totalSteps: 100,
    remainingSteps: 50,
    ...overrides,
  };
}

// ============================================================================
// calculateCostInGLW tests
// ============================================================================

describe("calculateCostInGLW", () => {
  it("returns 0 for null fraction", () => {
    expect(calculateCostInGLW(1, null)).toBe(0);
    expect(calculateCostInGLW(10, null)).toBe(0);
  });

  it("calculates cost for single unit", () => {
    const fraction = createFraction({ step: parseUnits("100", 18).toString() });
    expect(calculateCostInGLW(1, fraction)).toBe(100);
  });

  it("calculates cost for multiple units", () => {
    const fraction = createFraction({ step: parseUnits("100", 18).toString() });
    expect(calculateCostInGLW(5, fraction)).toBe(500);
    expect(calculateCostInGLW(10, fraction)).toBe(1000);
  });

  it("handles fractional step values", () => {
    // 1.5 GLW per step
    const fraction = createFraction({ step: parseUnits("1.5", 18).toString() });
    expect(calculateCostInGLW(2, fraction)).toBeCloseTo(3, 10);
    expect(calculateCostInGLW(10, fraction)).toBeCloseTo(15, 10);
  });

  it("handles very small step values", () => {
    // 0.001 GLW per step
    const fraction = createFraction({ step: parseUnits("0.001", 18).toString() });
    expect(calculateCostInGLW(1000, fraction)).toBeCloseTo(1, 10);
  });

  it("handles very large step values", () => {
    // 1,000,000 GLW per step
    const fraction = createFraction({ step: parseUnits("1000000", 18).toString() });
    expect(calculateCostInGLW(1, fraction)).toBe(1000000);
    expect(calculateCostInGLW(100, fraction)).toBe(100000000);
  });

  it("handles zero quantity", () => {
    const fraction = createFraction();
    expect(calculateCostInGLW(0, fraction)).toBe(0);
  });

  it("handles edge case with maximum safe integer quantity", () => {
    const fraction = createFraction({ step: parseUnits("1", 18).toString() });
    // Use a large but reasonable quantity
    expect(calculateCostInGLW(1000000, fraction)).toBe(1000000);
  });
});

describe("calculateCostInGCTL", () => {
  it("returns 0 for null fraction", () => {
    expect(calculateCostInGCTL(1, null)).toBe(0);
  });

  it("calculates cost using 6 decimals", () => {
    const fraction = createFraction({ step: parseUnits("125.5", 6).toString() });
    expect(calculateCostInGCTL(2, fraction)).toBeCloseTo(251, 6);
  });

  it("uses delegation override amount when provided", () => {
    const fraction = createFraction({ step: parseUnits("999999", 6).toString() });
    const overrideStep = parseUnits("28.152", 6);
    expect(calculateCostInGCTL(1, fraction, overrideStep)).toBeCloseTo(28.152, 6);
    expect(calculateCostInGCTL(2, fraction, overrideStep)).toBeCloseTo(56.304, 6);
  });
});

// ============================================================================
// calculateCostInUSDC tests
// ============================================================================

describe("calculateCostInUSDC", () => {
  describe("for miners (selectedCurrency=USDC)", () => {
    it("returns 0 for null fraction", () => {
      expect(calculateCostInUSDC(1, null, "USDC", 1.0)).toBe(0);
    });

    it("calculates direct stepPrice for single unit", () => {
      const fraction = createFraction({ stepPrice: parseUnits("50", 6).toString() });
      expect(calculateCostInUSDC(1, fraction, "USDC", 1.0)).toBe(50);
    });

    it("calculates direct stepPrice for multiple units", () => {
      const fraction = createFraction({ stepPrice: parseUnits("50", 6).toString() });
      expect(calculateCostInUSDC(5, fraction, "USDC", 1.0)).toBe(250);
      expect(calculateCostInUSDC(10, fraction, "USDC", 1.0)).toBe(500);
    });

    it("ignores GLW spot price (uses stepPrice directly)", () => {
      const fraction = createFraction({ stepPrice: parseUnits("100", 6).toString() });
      // GLW price should not affect miner cost
      expect(calculateCostInUSDC(1, fraction, "USDC", 0.5)).toBe(100);
      expect(calculateCostInUSDC(1, fraction, "USDC", 2.0)).toBe(100);
      expect(calculateCostInUSDC(1, fraction, "USDC", 0)).toBe(100);
    });

    it("handles fractional stepPrice values", () => {
      // $1.50 per step
      const fraction = createFraction({ stepPrice: parseUnits("1.5", 6).toString() });
      expect(calculateCostInUSDC(2, fraction, "USDC", 1.0)).toBeCloseTo(3, 6);
    });
  });

  describe("for delegation (selectedCurrency=GLW)", () => {
    it("returns 0 for null fraction", () => {
      expect(calculateCostInUSDC(1, null, "GLW", 1.0)).toBe(0);
    });

    it("calculates GLW cost * spot price", () => {
      const fraction = createFraction({
        step: parseUnits("100", 18).toString(), // 100 GLW per step
      });
      // GLW price = $1.00
      expect(calculateCostInUSDC(1, fraction, "GLW", 1.0)).toBe(100);
      // GLW price = $0.50
      expect(calculateCostInUSDC(1, fraction, "GLW", 0.5)).toBe(50);
      // GLW price = $2.00
      expect(calculateCostInUSDC(1, fraction, "GLW", 2.0)).toBe(200);
    });

    it("returns 0 when GLW spot price is 0", () => {
      const fraction = createFraction({ step: parseUnits("100", 18).toString() });
      expect(calculateCostInUSDC(1, fraction, "GLW", 0)).toBe(0);
    });

    it("returns 0 when GLW spot price is null/undefined", () => {
      const fraction = createFraction({ step: parseUnits("100", 18).toString() });
      expect(calculateCostInUSDC(1, fraction, "GLW", null as any)).toBe(0);
      expect(calculateCostInUSDC(1, fraction, "GLW", undefined as any)).toBe(0);
    });

    it("handles realistic GLW prices", () => {
      const fraction = createFraction({
        step: parseUnits("1000", 18).toString(), // 1000 GLW per step
      });
      // GLW at $0.15
      expect(calculateCostInUSDC(1, fraction, "GLW", 0.15)).toBeCloseTo(150, 2);
      // GLW at $0.0823
      expect(calculateCostInUSDC(10, fraction, "GLW", 0.0823)).toBeCloseTo(823, 1);
    });
  });

  describe("for SGCTL delegation (selectedCurrency=SGCTL)", () => {
    it("calculates GCTL cost * GCTL spot price", () => {
      const fraction = createFraction({
        step: parseUnits("100", 6).toString(),
      });
      expect(calculateCostInUSDC(1, fraction, "SGCTL", 0.1, 0.5)).toBe(50);
      expect(calculateCostInUSDC(2, fraction, "SGCTL", 0.1, 0.75)).toBe(150);
    });

    it("returns 0 when GCTL spot price is unavailable", () => {
      const fraction = createFraction({ step: parseUnits("100", 6).toString() });
      expect(calculateCostInUSDC(1, fraction, "SGCTL", 0.1, 0)).toBe(0);
    });

    it("uses delegation override amount for SGCTL pricing", () => {
      const fraction = createFraction({ step: parseUnits("999999", 6).toString() });
      const overrideStep = parseUnits("28.152", 6);
      expect(
        calculateCostInUSDC(1, fraction, "SGCTL", 0.1, 0.5, overrideStep)
      ).toBeCloseTo(14.076, 6);
    });
  });
});

// ============================================================================
// calculateCostInETH tests
// ============================================================================

describe("calculateCostInETH", () => {
  it("returns 0 for null fraction", () => {
    expect(calculateCostInETH(1, null, "USDC", 1.0, 2000)).toBe(0);
  });

  it("converts USDC cost to ETH", () => {
    const fraction = createFraction({
      stepPrice: parseUnits("100", 6).toString(), // $100 USDC
    });
    // ETH at $2000
    expect(calculateCostInETH(1, fraction, "USDC", 1.0, 2000)).toBeCloseTo(0.05, 6);
    // ETH at $4000
    expect(calculateCostInETH(1, fraction, "USDC", 1.0, 4000)).toBeCloseTo(0.025, 6);
  });

  it("returns 0 when ETH price is 0", () => {
    const fraction = createFraction({ stepPrice: parseUnits("100", 6).toString() });
    expect(calculateCostInETH(1, fraction, "USDC", 1.0, 0)).toBe(0);
  });

  it("handles delegation path (GLW -> USDC -> ETH)", () => {
    const fraction = createFraction({
      step: parseUnits("1000", 18).toString(), // 1000 GLW per step
    });
    // GLW at $0.10, ETH at $2000
    // 1000 GLW * $0.10 = $100 USDC / $2000 = 0.05 ETH
    expect(calculateCostInETH(1, fraction, "GLW", 0.1, 2000)).toBeCloseTo(0.05, 6);
  });

  it("handles SGCTL delegation path (GCTL -> USDC -> ETH)", () => {
    const fraction = createFraction({
      step: parseUnits("100", 6).toString(),
    });
    expect(calculateCostInETH(1, fraction, "SGCTL", 0.1, 2000, 0.5)).toBeCloseTo(
      0.025,
      6
    );
  });

  it("handles realistic prices", () => {
    const fraction = createFraction({
      stepPrice: parseUnits("500", 6).toString(), // $500 per miner
    });
    // ETH at $3500
    expect(calculateCostInETH(1, fraction, "USDC", 1.0, 3500)).toBeCloseTo(0.142857, 4);
    // Multiple miners
    expect(calculateCostInETH(5, fraction, "USDC", 1.0, 3500)).toBeCloseTo(0.714286, 4);
  });

  it("handles very high ETH prices", () => {
    const fraction = createFraction({ stepPrice: parseUnits("100", 6).toString() });
    // ETH at $10000
    expect(calculateCostInETH(1, fraction, "USDC", 1.0, 10000)).toBeCloseTo(0.01, 6);
  });

  it("handles very low ETH prices", () => {
    const fraction = createFraction({ stepPrice: parseUnits("100", 6).toString() });
    // ETH at $100
    expect(calculateCostInETH(1, fraction, "USDC", 1.0, 100)).toBeCloseTo(1, 6);
  });
});

// ============================================================================
// Integration tests
// ============================================================================

describe("cost calculations integration", () => {
  it("maintains consistency across all three calculations", () => {
    const fraction = createFraction({
      step: parseUnits("1000", 18).toString(), // 1000 GLW per step
      stepPrice: parseUnits("100", 6).toString(), // $100 per step (for miners)
    });
    const glwPrice = 0.1; // $0.10 per GLW
    const ethPrice = 2000; // $2000 per ETH

    // For delegation:
    const glwCost = calculateCostInGLW(1, fraction); // 1000 GLW
    const usdcCostDelegation = calculateCostInUSDC(1, fraction, "GLW", glwPrice); // 1000 * 0.1 = $100
    const ethCostDelegation = calculateCostInETH(1, fraction, "GLW", glwPrice, ethPrice); // 100 / 2000 = 0.05 ETH

    expect(glwCost).toBe(1000);
    expect(usdcCostDelegation).toBe(100);
    expect(ethCostDelegation).toBeCloseTo(0.05, 6);

    // Verify: glwCost * glwPrice = usdcCostDelegation
    expect(glwCost * glwPrice).toBeCloseTo(usdcCostDelegation, 6);
    // Verify: usdcCostDelegation / ethPrice = ethCostDelegation
    expect(usdcCostDelegation / ethPrice).toBeCloseTo(ethCostDelegation, 6);
  });

  it("scales linearly with quantity", () => {
    const fraction = createFraction({
      step: parseUnits("100", 18).toString(),
      stepPrice: parseUnits("50", 6).toString(),
    });
    const glwPrice = 0.5;
    const ethPrice = 2500;

    // Test linear scaling
    for (const qty of [1, 5, 10, 100]) {
      const baseCostGLW = calculateCostInGLW(1, fraction);
      const baseCostUSDC = calculateCostInUSDC(1, fraction, "USDC", glwPrice);
      const baseCostETH = calculateCostInETH(1, fraction, "USDC", glwPrice, ethPrice);

      expect(calculateCostInGLW(qty, fraction)).toBeCloseTo(baseCostGLW * qty, 10);
      expect(calculateCostInUSDC(qty, fraction, "USDC", glwPrice)).toBeCloseTo(baseCostUSDC * qty, 6);
      expect(calculateCostInETH(qty, fraction, "USDC", glwPrice, ethPrice)).toBeCloseTo(baseCostETH * qty, 10);
    }
  });

  it("handles real-world fraction data", () => {
    // Based on actual production data
    const realFraction = createFraction({
      step: "250000000000000000000", // 250 GLW (250e18)
      stepPrice: "25000000", // $25 USDC (25e6)
      totalSteps: 400,
      remainingSteps: 123,
    });

    const glwPrice = 0.082; // Realistic GLW price
    const ethPrice = 3200; // Realistic ETH price

    // Single unit costs
    expect(calculateCostInGLW(1, realFraction)).toBe(250);
    expect(calculateCostInUSDC(1, realFraction, "USDC", glwPrice)).toBe(25);
    expect(calculateCostInUSDC(1, realFraction, "GLW", glwPrice)).toBeCloseTo(20.5, 1); // 250 * 0.082
    expect(calculateCostInETH(1, realFraction, "USDC", glwPrice, ethPrice)).toBeCloseTo(0.0078125, 5);

    // Bulk purchase (10 units)
    expect(calculateCostInGLW(10, realFraction)).toBe(2500);
    expect(calculateCostInUSDC(10, realFraction, "USDC", glwPrice)).toBe(250);
  });
});
