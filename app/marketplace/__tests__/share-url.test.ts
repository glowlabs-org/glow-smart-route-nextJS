/**
 * Tests for share URL generation in deposit-dialog.
 *
 * Run with: pnpm vitest run app/marketplace/__tests__/share-url.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  generateShareUrl,
  calculateSuccessMetrics,
  clampQuantity,
  parseQuantityInput,
  type ActiveFraction,
} from "../deposit-dialog-utils";
import { parseUnits } from "viem";

// ============================================================================
// generateShareUrl tests
// ============================================================================

describe("generateShareUrl", () => {
  describe("edge cases", () => {
    it("returns null when farmLabelForShare is null", () => {
      const result = generateShareUrl("USDC", 1, null, true);
      expect(result).toBeNull();
    });

    it("returns null when farmLabelForShare is empty string", () => {
      const result = generateShareUrl("USDC", 1, "", true);
      expect(result).toBeNull();
    });

    it("returns null when hasSuccessMetrics is false", () => {
      const result = generateShareUrl("USDC", 1, "Test Farm", false);
      expect(result).toBeNull();
    });
  });

  describe("USDC (miners) share URL", () => {
    it("generates Twitter intent URL", () => {
      const url = generateShareUrl("USDC", 1, "Solar Farm", true);
      expect(url).toContain("https://twitter.com/intent/tweet");
    });

    it("includes farm name in message", () => {
      const url = generateShareUrl("USDC", 1, "Smith Solar", true);
      expect(url).toContain(encodeURIComponent("Smith Solar"));
    });

    it("includes correct quantity with singular 'miner'", () => {
      const url = generateShareUrl("USDC", 1, "Farm", true);
      expect(url).toContain(encodeURIComponent("1 miner"));
      expect(url).not.toContain(encodeURIComponent("1 miners"));
    });

    it("includes correct quantity with plural 'miners'", () => {
      const url = generateShareUrl("USDC", 5, "Farm", true);
      expect(url).toContain(encodeURIComponent("5 miners"));
    });

    it("mentions @glowFND", () => {
      const url = generateShareUrl("USDC", 1, "Farm", true);
      expect(url).toContain(encodeURIComponent("@glowFND"));
    });

    it("mentions 99 weeks", () => {
      const url = generateShareUrl("USDC", 1, "Farm", true);
      expect(url).toContain(encodeURIComponent("99 weeks"));
    });

    it("uses actual miner life remaining when provided", () => {
      const url = generateShareUrl("USDC", 1, "Farm", true, 80);
      expect(url).toContain(encodeURIComponent("80 weeks"));
      expect(url).not.toContain(encodeURIComponent("99 weeks"));
    });

    it("includes app domain with zero-width spaces", () => {
      const url = generateShareUrl("USDC", 1, "Farm", true);
      // The domain has zero-width spaces: app.\u200Bglow.\u200Borg
      expect(url).toContain(encodeURIComponent("app.\u200Bglow.\u200Borg"));
    });
  });

  describe("GLW (delegation) share URL", () => {
    it("generates Twitter intent URL", () => {
      const url = generateShareUrl("GLW", 1, "Solar Farm", true);
      expect(url).toContain("https://twitter.com/intent/tweet");
    });

    it("includes farm name in message", () => {
      const url = generateShareUrl("GLW", 1, "Mountain Solar", true);
      expect(url).toContain(encodeURIComponent("Mountain Solar"));
    });

    it("mentions delegating GLW tokens", () => {
      const url = generateShareUrl("GLW", 1, "Farm", true);
      expect(url).toContain(encodeURIComponent("delegating GLW tokens"));
    });

    it("mentions 100 weeks (delegation has longer period)", () => {
      const url = generateShareUrl("GLW", 1, "Farm", true);
      expect(url).toContain(encodeURIComponent("100 weeks"));
    });

    it("does NOT include quantity in delegation message", () => {
      const url = generateShareUrl("GLW", 10, "Farm", true);
      // Delegation message doesn't mention specific quantity
      expect(url).not.toContain(encodeURIComponent("10 "));
    });
  });

  describe("URL encoding", () => {
    it("encodes special characters in farm name", () => {
      const url = generateShareUrl("USDC", 1, "Smith & Sons Farm", true);
      expect(url).toContain(encodeURIComponent("Smith & Sons Farm"));
      expect(url).not.toContain("&Sons"); // Would be unencoded
    });

    it("encodes quotes in farm name", () => {
      const url = generateShareUrl("USDC", 1, 'The "Best" Farm', true);
      expect(url).toContain(encodeURIComponent('The "Best" Farm'));
    });

    it("encodes newlines properly", () => {
      const url = generateShareUrl("USDC", 1, "Farm", true);
      // Newlines should be encoded as %0A
      expect(url).toContain("%0A");
    });

    it("handles unicode in farm name", () => {
      const url = generateShareUrl("USDC", 1, "Solar Granja", true);
      expect(url).toBeTruthy();
      expect(url).toContain("Solar");
    });

    it("handles very long farm names", () => {
      const longName = "A".repeat(100);
      const url = generateShareUrl("USDC", 1, longName, true);
      expect(url).toBeTruthy();
      expect(url!.length).toBeGreaterThan(100);
    });
  });
});

// ============================================================================
// clampQuantity tests
// ============================================================================

describe("clampQuantity", () => {
  it("returns value when within range", () => {
    expect(clampQuantity(5, 1, 10)).toBe(5);
    expect(clampQuantity(1, 1, 10)).toBe(1);
    expect(clampQuantity(10, 1, 10)).toBe(10);
  });

  it("clamps to min when below range", () => {
    expect(clampQuantity(0, 1, 10)).toBe(1);
    expect(clampQuantity(-5, 1, 10)).toBe(1);
  });

  it("clamps to max when above range", () => {
    expect(clampQuantity(15, 1, 10)).toBe(10);
    expect(clampQuantity(100, 1, 10)).toBe(10);
  });

  it("handles edge case where min equals max", () => {
    expect(clampQuantity(5, 5, 5)).toBe(5);
    expect(clampQuantity(1, 5, 5)).toBe(5);
    expect(clampQuantity(10, 5, 5)).toBe(5);
  });
});

// ============================================================================
// parseQuantityInput tests
// ============================================================================

describe("parseQuantityInput", () => {
  it("parses valid integer input", () => {
    expect(parseQuantityInput("5", 1, 100)).toBe(5);
    expect(parseQuantityInput("50", 1, 100)).toBe(50);
  });

  it("clamps to max when input exceeds max", () => {
    expect(parseQuantityInput("150", 1, 100)).toBe(100);
  });

  it("clamps to min when input is below min", () => {
    expect(parseQuantityInput("0", 1, 100)).toBe(1);
    expect(parseQuantityInput("-5", 1, 100)).toBe(1);
  });

  it("returns 1 for empty string", () => {
    expect(parseQuantityInput("", 5, 100)).toBe(1);
  });

  it("returns current quantity for invalid input", () => {
    expect(parseQuantityInput("abc", 5, 100)).toBe(5);
    expect(parseQuantityInput("12.5", 5, 100)).toBe(12); // parseInt truncates
    expect(parseQuantityInput("  ", 5, 100)).toBe(5);
  });

  it("handles leading/trailing whitespace in numbers", () => {
    expect(parseQuantityInput(" 10 ", 1, 100)).toBe(10);
  });

  it("handles numbers with leading zeros", () => {
    expect(parseQuantityInput("007", 1, 100)).toBe(7);
  });
});

// ============================================================================
// calculateSuccessMetrics tests
// ============================================================================

describe("calculateSuccessMetrics", () => {
  function createFraction(overrides: Partial<ActiveFraction> = {}): ActiveFraction {
    return {
      id: "test",
      owner: "0x123",
      step: parseUnits("100", 18).toString(),
      stepPrice: parseUnits("50", 6).toString(),
      totalSteps: 100,
      remainingSteps: 50,
      ...overrides,
    };
  }

  it("calculates correct metrics from remainingSteps", () => {
    const fraction = createFraction({
      totalSteps: 100,
      remainingSteps: 30,
    });

    const result = calculateSuccessMetrics(fraction, 5);

    expect(result).toEqual({
      totalSteps: 100,
      filledBeforeSteps: 70, // 100 - 30
      userSteps: 5,
    });
  });

  it("uses splitsSold when remainingSteps is null", () => {
    const fraction = createFraction({
      totalSteps: 100,
      remainingSteps: null as any, // Simulate null
      splitsSold: 40,
    });

    const result = calculateSuccessMetrics(fraction, 10);

    expect(result).toEqual({
      totalSteps: 100,
      filledBeforeSteps: 40,
      userSteps: 10,
    });
  });

  it("handles zero totalSteps", () => {
    const fraction = createFraction({
      totalSteps: 0,
      remainingSteps: 0,
    });

    const result = calculateSuccessMetrics(fraction, 1);

    expect(result).toEqual({
      totalSteps: 0,
      filledBeforeSteps: 0,
      userSteps: 1,
    });
  });

  it("clamps filledBeforeSteps to not exceed totalSteps", () => {
    const fraction = createFraction({
      totalSteps: 50,
      remainingSteps: -10, // Edge case: negative remaining
    });

    const result = calculateSuccessMetrics(fraction, 1);

    expect(result?.filledBeforeSteps).toBeLessThanOrEqual(50);
  });

  it("ensures non-negative values", () => {
    const fraction = createFraction({
      totalSteps: -5, // Invalid
      remainingSteps: -10, // Invalid
    });

    const result = calculateSuccessMetrics(fraction, -3);

    expect(result?.totalSteps).toBeGreaterThanOrEqual(0);
    expect(result?.filledBeforeSteps).toBeGreaterThanOrEqual(0);
    expect(result?.userSteps).toBeGreaterThanOrEqual(0);
  });

  it("handles fractional values by flooring", () => {
    const fraction = createFraction({
      totalSteps: 10.7 as any,
      remainingSteps: 3.2 as any,
    });

    const result = calculateSuccessMetrics(fraction, 2.9 as any);

    expect(result?.totalSteps).toBe(10);
    expect(result?.filledBeforeSteps).toBe(7); // floor(10) - floor(3)
    expect(result?.userSteps).toBe(2);
  });

  it("returns correct metrics for fully filled offering", () => {
    const fraction = createFraction({
      totalSteps: 100,
      remainingSteps: 0,
    });

    const result = calculateSuccessMetrics(fraction, 0);

    expect(result).toEqual({
      totalSteps: 100,
      filledBeforeSteps: 100,
      userSteps: 0,
    });
  });

  it("returns correct metrics for empty offering", () => {
    const fraction = createFraction({
      totalSteps: 100,
      remainingSteps: 100,
    });

    const result = calculateSuccessMetrics(fraction, 10);

    expect(result).toEqual({
      totalSteps: 100,
      filledBeforeSteps: 0,
      userSteps: 10,
    });
  });
});
