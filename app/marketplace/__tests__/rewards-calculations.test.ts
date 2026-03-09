/**
 * Tests for reward calculations in deposit-dialog.
 *
 * Run with: pnpm vitest run app/marketplace/__tests__/rewards-calculations.test.ts
 */

import { describe, it, expect } from "vitest";
import { parseUnits } from "viem";
import {
  calculateEstimatedRewards,
  calculateEstimatedRewardsBreakdown,
  calculateImpactPointsBreakdown,
  calculateCostInGLW,
  type ActiveFraction,
  type LaunchpadRewardScore,
  type MiningCenterScore,
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
    totalSteps: 10,
    remainingSteps: 5,
    ...overrides,
  };
}

function createLaunchpadScore(
  overrides: Partial<LaunchpadRewardScore> = {}
): LaunchpadRewardScore {
  return {
    userWeeklyGlwRewards: parseUnits("100", 18).toString(), // 100 GLW
    userWeeklyPdRewards: parseUnits("50", 18).toString(), // 50 GLW from PD
    ...overrides,
  };
}

function createMiningScore(
  overrides: Partial<MiningCenterScore> = {}
): MiningCenterScore {
  return {
    miningScore: 100,
    weeklyGlwRewards: parseUnits("10", 18).toString(), // 10 GLW
    weeklyGlwRewardsUsd: "1.00",
    ...overrides,
  };
}

// ============================================================================
// calculateEstimatedRewards tests
// ============================================================================

describe("calculateEstimatedRewards", () => {
  describe("edge cases", () => {
    it("returns 0 for null fraction", () => {
      const result = calculateEstimatedRewards(1, null, createLaunchpadScore());
      expect(result).toBe(0);
    });

    it("returns 0 for null rewardScore", () => {
      const result = calculateEstimatedRewards(1, createFraction(), null);
      expect(result).toBe(0);
    });

    it("returns 0 for zero quantity", () => {
      const result = calculateEstimatedRewards(
        0,
        createFraction(),
        createLaunchpadScore()
      );
      expect(result).toBe(0);
    });
  });

  describe("launchpad rewards (delegation)", () => {
    it("combines userWeeklyGlwRewards and userWeeklyPdRewards", () => {
      const fraction = createFraction({ totalSteps: 10 });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("100", 18).toString(), // 100 GLW
        userWeeklyPdRewards: parseUnits("50", 18).toString(), // 50 GLW
      });

      // (100 + 50) / 10 steps = 15 GLW per step
      const result = calculateEstimatedRewards(1, fraction, score);
      expect(result).toBe(15);
    });

    it("scales linearly with quantity", () => {
      const fraction = createFraction({ totalSteps: 10 });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("100", 18).toString(),
        userWeeklyPdRewards: parseUnits("0", 18).toString(),
      });

      // 100 / 10 = 10 GLW per step
      expect(calculateEstimatedRewards(1, fraction, score)).toBe(10);
      expect(calculateEstimatedRewards(5, fraction, score)).toBe(50);
      expect(calculateEstimatedRewards(10, fraction, score)).toBe(100);
    });

    it("handles zero PD rewards", () => {
      const fraction = createFraction({ totalSteps: 5 });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("50", 18).toString(),
        userWeeklyPdRewards: parseUnits("0", 18).toString(),
      });

      // 50 / 5 = 10 GLW per step
      expect(calculateEstimatedRewards(1, fraction, score)).toBe(10);
    });

    it("keeps SGCTL PD rewards out of GLW totals", () => {
      const fraction = createFraction({
        totalSteps: 10,
        delegationAsset: "SGCTL",
      });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("100", 18).toString(), // 100 GLW emissions
        userWeeklyPdRewards: parseUnits("50", 6).toString(), // 50 SGCTL PD recovery
      });

      // SGCTL PD recovery is a different token, so GLW estimate is emission-only.
      expect(calculateEstimatedRewards(1, fraction, score)).toBe(10);
    });

    it("returns SGCTL PD amount in rewards breakdown for multi-asset listings", () => {
      const fraction = createFraction({
        totalSteps: 10,
        delegationAsset: "SGCTL",
      });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("100", 18).toString(), // 100 GLW emissions
        userWeeklyPdRewards: parseUnits("50", 6).toString(), // 50 SGCTL PD recovery
      });

      const breakdown = calculateEstimatedRewardsBreakdown(1, fraction, score);
      expect(breakdown.glw).toBe(10);
      expect(breakdown.pd).toBe(5);
      expect(breakdown.pdSymbol).toBe("SGCTL");
      expect(breakdown.totalGlwEquivalent).toBe(10);
    });

    it("avoids division by zero with totalSteps=0", () => {
      const fraction = createFraction({ totalSteps: 0 });
      const score = createLaunchpadScore();

      // Should default to totalSteps=1
      const result = calculateEstimatedRewards(1, fraction, score);
      expect(Number.isFinite(result)).toBe(true);
    });
  });

  describe("mining rewards", () => {
    it("uses weeklyGlwRewards directly", () => {
      const fraction = createFraction({ totalSteps: 10 });
      const score = createMiningScore({
        weeklyGlwRewards: parseUnits("20", 18).toString(), // 20 GLW
      });

      // Mining uses direct weeklyGlwRewards * quantity
      // Note: Mining doesn't divide by totalSteps
      const result = calculateEstimatedRewards(1, fraction, score);
      expect(result).toBe(20);
    });

    it("scales with quantity", () => {
      const fraction = createFraction();
      const score = createMiningScore({
        weeklyGlwRewards: parseUnits("5", 18).toString(),
      });

      expect(calculateEstimatedRewards(1, fraction, score)).toBe(5);
      expect(calculateEstimatedRewards(3, fraction, score)).toBe(15);
    });

    it("handles missing weeklyGlwRewards", () => {
      const fraction = createFraction();
      const score: MiningCenterScore = {
        miningScore: 100,
        // No weeklyGlwRewards
      };

      const result = calculateEstimatedRewards(1, fraction, score);
      expect(result).toBe(0);
    });

    it("handles empty string weeklyGlwRewards", () => {
      const fraction = createFraction();
      const score = createMiningScore({
        weeklyGlwRewards: "",
      });

      // Empty string should result in 0
      const result = calculateEstimatedRewards(1, fraction, score);
      expect(result).toBe(0);
    });
  });
});

// ============================================================================
// calculateImpactPointsBreakdown tests
// ============================================================================

describe("calculateImpactPointsBreakdown", () => {
  // Helper to create the cost function
  const createCostFn = (fraction: ActiveFraction) => (qty: number) =>
    calculateCostInGLW(qty, fraction);

  describe("edge cases", () => {
    it("returns zeros for null fraction", () => {
      const result = calculateImpactPointsBreakdown(
        1,
        null,
        createLaunchpadScore(),
        () => 0
      );
      expect(result).toEqual({
        emissionPoints: 0,
        vaultBonusPoints: 0,
        total: 0,
      });
    });

    it("returns zeros for null rewardScore", () => {
      const result = calculateImpactPointsBreakdown(
        1,
        createFraction(),
        null,
        () => 100
      );
      expect(result).toEqual({
        emissionPoints: 0,
        vaultBonusPoints: 0,
        total: 0,
      });
    });
  });

  describe("launchpad (delegation) impact points", () => {
    it("calculates emission points from weekly GLW rewards", () => {
      const fraction = createFraction({ totalSteps: 10 });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("100", 18).toString(), // 100 GLW total
        userWeeklyPdRewards: parseUnits("0", 18).toString(),
      });

      const result = calculateImpactPointsBreakdown(
        1,
        fraction,
        score,
        createCostFn(fraction)
      );

      // 100 GLW / 10 steps = 10 emission points per step
      expect(result.emissionPoints).toBe(10);
    });

    it("calculates vault bonus at 0.005 per GLW delegated", () => {
      const fraction = createFraction({
        step: parseUnits("1000", 18).toString(), // 1000 GLW per step
        totalSteps: 10,
      });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("0", 18).toString(),
        userWeeklyPdRewards: parseUnits("0", 18).toString(),
      });

      const result = calculateImpactPointsBreakdown(
        1,
        fraction,
        score,
        createCostFn(fraction)
      );

      // 1000 GLW * 0.005 = 5 vault bonus points
      expect(result.vaultBonusPoints).toBe(5);
    });

    it("vault bonus scales with quantity", () => {
      const fraction = createFraction({
        step: parseUnits("100", 18).toString(), // 100 GLW per step
        totalSteps: 10,
      });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("0", 18).toString(),
        userWeeklyPdRewards: parseUnits("0", 18).toString(),
      });

      // 1 step = 100 GLW * 0.005 = 0.5 points
      const result1 = calculateImpactPointsBreakdown(
        1,
        fraction,
        score,
        createCostFn(fraction)
      );
      expect(result1.vaultBonusPoints).toBeCloseTo(0.5, 10);

      // 5 steps = 500 GLW * 0.005 = 2.5 points
      const result5 = calculateImpactPointsBreakdown(
        5,
        fraction,
        score,
        createCostFn(fraction)
      );
      expect(result5.vaultBonusPoints).toBeCloseTo(2.5, 10);
    });

    it("total is sum of emission and vault bonus", () => {
      const fraction = createFraction({
        step: parseUnits("1000", 18).toString(),
        totalSteps: 10,
      });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("100", 18).toString(), // 10 per step
        userWeeklyPdRewards: parseUnits("0", 18).toString(),
      });

      const result = calculateImpactPointsBreakdown(
        1,
        fraction,
        score,
        createCostFn(fraction)
      );

      // Emission: 100 / 10 = 10
      // Vault: 1000 * 0.005 = 5
      // Total: 15
      expect(result.emissionPoints).toBe(10);
      expect(result.vaultBonusPoints).toBe(5);
      expect(result.total).toBe(15);
    });

    it("handles realistic delegation scenario", () => {
      const fraction = createFraction({
        step: parseUnits("250", 18).toString(), // 250 GLW per step
        totalSteps: 400,
      });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("1000", 18).toString(), // 1000 GLW total rewards
        userWeeklyPdRewards: parseUnits("500", 18).toString(), // 500 GLW PD rewards
      });

      const result = calculateImpactPointsBreakdown(
        10, // 10 steps
        fraction,
        score,
        createCostFn(fraction)
      );

      // Emission: 1000 / 400 * 10 = 25
      // Vault: 250 * 10 * 0.005 = 12.5
      expect(result.emissionPoints).toBeCloseTo(25, 5);
      expect(result.vaultBonusPoints).toBeCloseTo(12.5, 5);
      expect(result.total).toBeCloseTo(37.5, 5);
    });
  });

  describe("mining impact points", () => {
    it("calculates emission points only (no vault bonus)", () => {
      const fraction = createFraction({
        step: parseUnits("100", 18).toString(),
        totalSteps: 10,
      });
      const score = createMiningScore({
        weeklyGlwRewards: parseUnits("50", 18).toString(), // 50 GLW
      });

      const result = calculateImpactPointsBreakdown(
        1,
        fraction,
        score,
        createCostFn(fraction)
      );

      // Mining: emission = weeklyGlwRewards * quantity
      expect(result.emissionPoints).toBe(50);
      expect(result.vaultBonusPoints).toBe(0); // No vault bonus for miners
      expect(result.total).toBe(50);
    });

    it("scales emission points with quantity", () => {
      const fraction = createFraction();
      const score = createMiningScore({
        weeklyGlwRewards: parseUnits("10", 18).toString(),
      });

      const result1 = calculateImpactPointsBreakdown(
        1,
        fraction,
        score,
        createCostFn(fraction)
      );
      expect(result1.emissionPoints).toBe(10);

      const result5 = calculateImpactPointsBreakdown(
        5,
        fraction,
        score,
        createCostFn(fraction)
      );
      expect(result5.emissionPoints).toBe(50);
    });

    it("returns zeros when weeklyGlwRewards is missing", () => {
      const fraction = createFraction();
      const score: MiningCenterScore = {
        miningScore: 100,
        // No weeklyGlwRewards
      };

      const result = calculateImpactPointsBreakdown(
        1,
        fraction,
        score,
        createCostFn(fraction)
      );

      expect(result.emissionPoints).toBe(0);
      expect(result.vaultBonusPoints).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("impact points rules", () => {
    it("emission rate is 1 point per GLW earned", () => {
      // For launchpad: emission = (weeklyGlwRewards / totalSteps) * quantity
      const fraction = createFraction({ totalSteps: 1 });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("100", 18).toString(),
        userWeeklyPdRewards: parseUnits("0", 18).toString(),
      });

      const result = calculateImpactPointsBreakdown(
        1,
        fraction,
        score,
        createCostFn(fraction)
      );

      // 100 GLW earned = 100 emission points
      expect(result.emissionPoints).toBe(100);
    });

    it("vault bonus rate is 0.005 per GLW delegated", () => {
      const fraction = createFraction({
        step: parseUnits("200", 18).toString(), // 200 GLW per step
        totalSteps: 1,
      });
      const score = createLaunchpadScore({
        userWeeklyGlwRewards: parseUnits("0", 18).toString(),
        userWeeklyPdRewards: parseUnits("0", 18).toString(),
      });

      const result = calculateImpactPointsBreakdown(
        1,
        fraction,
        score,
        createCostFn(fraction)
      );

      // 200 GLW * 0.005 = 1 point
      expect(result.vaultBonusPoints).toBe(1);
    });

    it("miners do not get vault bonus", () => {
      const fraction = createFraction({
        step: parseUnits("1000", 18).toString(), // Large GLW value
      });
      const score = createMiningScore({
        weeklyGlwRewards: parseUnits("100", 18).toString(),
      });

      const result = calculateImpactPointsBreakdown(
        1,
        fraction,
        score,
        createCostFn(fraction)
      );

      // Even with large GLW step value, miners get 0 vault bonus
      expect(result.vaultBonusPoints).toBe(0);
    });
  });
});
