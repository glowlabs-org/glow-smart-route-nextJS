/**
 * Tests for affordability calculation in deposit-dialog.
 *
 * Run with: pnpm vitest run app/marketplace/__tests__/affordability.test.ts
 */

import { describe, it, expect } from "vitest";
import { parseUnits } from "viem";
import {
  calculateAffordability,
  type ActiveFraction,
  type AffordabilityInput,
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

function createInput(overrides: Partial<AffordabilityInput> = {}): AffordabilityInput {
  return {
    activeFraction: createFraction(),
    quantity: 1,
    selectedCurrency: "GLW",
    selectedPaymentMethod: "GLW",
    glwSpotPrice: 1.0,
    gctlSpotPrice: 0.5,
    ethSpotPrice: 2000,
    glwBalance: parseUnits("1000", 18), // 1000 GLW
    gctlBalance: parseUnits("1000", 6), // 1000 GCTL
    usdcBalance: parseUnits("1000", 6), // 1000 USDC
    ethBalance: parseUnits("1", 18), // 1 ETH
    ...overrides,
  };
}

// ============================================================================
// Edge cases
// ============================================================================

describe("affordability edge cases", () => {
  it("returns cannot submit when fraction is null", () => {
    const result = calculateAffordability(
      createInput({ activeFraction: null })
    );
    expect(result.canSubmit).toBe(false);
    expect(result.hasEnoughByMethod.GLW).toBe(false);
    expect(result.hasEnoughByMethod.USDC).toBe(false);
    expect(result.hasEnoughByMethod.ETH).toBe(false);
  });

  it("returns cannot submit when quantity is 0", () => {
    const result = calculateAffordability(createInput({ quantity: 0 }));
    expect(result.canSubmit).toBe(false);
  });

  it("returns cannot submit when quantity is negative", () => {
    const result = calculateAffordability(createInput({ quantity: -5 }));
    expect(result.canSubmit).toBe(false);
  });

  it("handles fractional quantity by flooring", () => {
    // 1.9 should be treated as 1
    const result = calculateAffordability(createInput({ quantity: 1.9 }));
    expect(result.requiredByMethod.GLW).toBe(parseUnits("100", 18));
  });
});

// ============================================================================
// GLW payment tests
// ============================================================================

describe("GLW payment affordability", () => {
  it("calculates required GLW correctly", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 18).toString() }),
        quantity: 5,
        selectedPaymentMethod: "GLW",
      })
    );
    // 5 * 100 GLW = 500 GLW required
    expect(result.requiredByMethod.GLW).toBe(parseUnits("500", 18));
  });

  it("can submit with exact balance", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 18).toString() }),
        quantity: 1,
        selectedPaymentMethod: "GLW",
        glwBalance: parseUnits("100", 18), // Exactly 100 GLW
      })
    );
    expect(result.hasEnoughByMethod.GLW).toBe(true);
    expect(result.canSubmit).toBe(true);
  });

  it("cannot submit with insufficient balance", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 18).toString() }),
        quantity: 1,
        selectedPaymentMethod: "GLW",
        glwBalance: parseUnits("99.99", 18), // Just under 100 GLW
      })
    );
    expect(result.hasEnoughByMethod.GLW).toBe(false);
    expect(result.canSubmit).toBe(false);
  });

  it("can submit with excess balance", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 18).toString() }),
        quantity: 1,
        selectedPaymentMethod: "GLW",
        glwBalance: parseUnits("1000", 18), // 10x required
      })
    );
    expect(result.hasEnoughByMethod.GLW).toBe(true);
    expect(result.canSubmit).toBe(true);
  });
});

describe("GCTL payment affordability (SGCTL delegation)", () => {
  it("calculates required GCTL correctly", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("25", 6).toString() }),
        quantity: 4,
        selectedCurrency: "SGCTL",
        selectedPaymentMethod: "GCTL",
      })
    );

    expect(result.requiredByMethod.GCTL).toBe(parseUnits("100", 6));
    expect(result.hasEnoughByMethod.GCTL).toBe(true);
  });

  it("allows staking then delegating when wallet + staked GCTL covers the requirement", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("25", 6).toString() }),
        quantity: 4,
        selectedCurrency: "SGCTL",
        selectedPaymentMethod: "GCTL",
        gctlBalance: parseUnits("40", 6),
        stakedGctlBalance: parseUnits("60", 6),
      })
    );

    expect(result.requiredByMethod.GCTL).toBe(parseUnits("100", 6));
    expect(result.balances.GCTL).toBe(parseUnits("100", 6));
    expect(result.hasEnoughByMethod.GCTL).toBe(true);
    expect(result.canSubmit).toBe(true);
  });

  it("cannot submit with insufficient GCTL balance", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("25", 6).toString() }),
        quantity: 4,
        selectedCurrency: "SGCTL",
        selectedPaymentMethod: "GCTL",
        gctlBalance: parseUnits("99", 6),
      })
    );

    expect(result.hasEnoughByMethod.GCTL).toBe(false);
    expect(result.canSubmit).toBe(false);
  });
});

// ============================================================================
// USDC payment tests (Miners)
// ============================================================================

describe("USDC payment affordability (miners)", () => {
  it("calculates required USDC directly from stepPrice", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ stepPrice: parseUnits("50", 6).toString() }),
        quantity: 3,
        selectedCurrency: "USDC",
        selectedPaymentMethod: "USDC",
      })
    );
    // 3 * $50 = $150 USDC required
    expect(result.requiredByMethod.USDC).toBe(parseUnits("150", 6));
  });

  it("can submit with exact balance", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ stepPrice: parseUnits("100", 6).toString() }),
        quantity: 1,
        selectedCurrency: "USDC",
        selectedPaymentMethod: "USDC",
        usdcBalance: parseUnits("100", 6),
      })
    );
    expect(result.hasEnoughByMethod.USDC).toBe(true);
    expect(result.canSubmit).toBe(true);
  });

  it("cannot submit with insufficient balance", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ stepPrice: parseUnits("100", 6).toString() }),
        quantity: 1,
        selectedCurrency: "USDC",
        selectedPaymentMethod: "USDC",
        usdcBalance: parseUnits("99", 6),
      })
    );
    expect(result.hasEnoughByMethod.USDC).toBe(false);
    expect(result.canSubmit).toBe(false);
  });
});

// ============================================================================
// USDC payment tests (Delegation swap)
// ============================================================================

describe("USDC payment affordability (delegation swap)", () => {
  it("includes 2% buffer for swap", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 18).toString() }),
        quantity: 1,
        selectedCurrency: "GLW",
        selectedPaymentMethod: "USDC",
        glwSpotPrice: 1.0, // 100 GLW * $1 = $100 base
      })
    );
    // $100 * 1.02 = $102 USDC required
    expect(result.requiredByMethod.USDC).toBe(parseUnits("102", 6));
  });

  it("cannot submit without buffer", () => {
    // 100 GLW at $1 = $100 base, need $102 with buffer
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 18).toString() }),
        quantity: 1,
        selectedCurrency: "GLW",
        selectedPaymentMethod: "USDC",
        glwSpotPrice: 1.0,
        usdcBalance: parseUnits("101", 6), // $101 (insufficient)
      })
    );
    expect(result.hasEnoughByMethod.USDC).toBe(false);
    expect(result.canSubmit).toBe(false);
  });

  it("can submit with exactly buffer amount", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 18).toString() }),
        quantity: 1,
        selectedCurrency: "GLW",
        selectedPaymentMethod: "USDC",
        glwSpotPrice: 1.0,
        usdcBalance: parseUnits("102", 6), // $102 (exactly enough)
      })
    );
    expect(result.hasEnoughByMethod.USDC).toBe(true);
    expect(result.canSubmit).toBe(true);
  });

  it("returns null required when GLW price is 0", () => {
    const result = calculateAffordability(
      createInput({
        selectedCurrency: "GLW",
        selectedPaymentMethod: "USDC",
        glwSpotPrice: 0,
      })
    );
    expect(result.requiredByMethod.USDC).toBeNull();
    expect(result.hasEnoughByMethod.USDC).toBe(false);
  });

  it("returns null required when GLW price is NaN", () => {
    const result = calculateAffordability(
      createInput({
        selectedCurrency: "GLW",
        selectedPaymentMethod: "USDC",
        glwSpotPrice: NaN,
      })
    );
    expect(result.requiredByMethod.USDC).toBeNull();
    expect(result.hasEnoughByMethod.USDC).toBe(false);
  });

  it("handles realistic GLW price", () => {
    // 1000 GLW at $0.082 = $82 base, + 2% = $83.64
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("1000", 18).toString() }),
        quantity: 1,
        selectedCurrency: "GLW",
        selectedPaymentMethod: "USDC",
        glwSpotPrice: 0.082,
        usdcBalance: parseUnits("100", 6),
      })
    );
    // 1000 * 0.082 = 82, * 1.02 = 83.64
    expect(result.hasEnoughByMethod.USDC).toBe(true);
    expect(result.canSubmit).toBe(true);
  });
});

describe("USDC payment affordability (SGCTL mint and stake)", () => {
  it("includes 2% buffer for SGCTL mint path", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 6).toString() }),
        selectedCurrency: "SGCTL",
        selectedPaymentMethod: "USDC",
        gctlSpotPrice: 0.5,
      })
    );

    expect(result.requiredByMethod.USDC).toBe(parseUnits("51", 6));
  });

  it("prices only the unstaked SGCTL shortfall", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 6).toString() }),
        selectedCurrency: "SGCTL",
        selectedPaymentMethod: "USDC",
        gctlSpotPrice: 0.5,
        stakedGctlBalance: parseUnits("40", 6),
      })
    );

    expect(result.requiredByMethod.GCTL).toBe(parseUnits("100", 6));
    expect(result.requiredByMethod.USDC).toBe(parseUnits("30.6", 6));
  });

  it("needs no USDC top-up when the region stake already covers the delegation", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 6).toString() }),
        selectedCurrency: "SGCTL",
        selectedPaymentMethod: "USDC",
        gctlSpotPrice: 0.5,
        stakedGctlBalance: parseUnits("100", 6),
      })
    );

    expect(result.requiredByMethod.USDC).toBe(0n);
    expect(result.hasEnoughByMethod.USDC).toBe(true);
    expect(result.canSubmit).toBe(true);
  });

  it("returns null USDC requirement when GCTL price is unavailable", () => {
    const result = calculateAffordability(
      createInput({
        selectedCurrency: "SGCTL",
        selectedPaymentMethod: "USDC",
        gctlSpotPrice: 0,
      })
    );

    expect(result.requiredByMethod.USDC).toBeNull();
    expect(result.hasEnoughByMethod.USDC).toBe(false);
  });
});

// ============================================================================
// ETH payment tests
// ============================================================================

describe("ETH payment affordability", () => {
  it("includes 3% buffer for ETH swap", () => {
    // $100 USDC at $2000/ETH = 0.05 ETH base
    // With 3% buffer = 0.0515 ETH
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ stepPrice: parseUnits("100", 6).toString() }),
        quantity: 1,
        selectedCurrency: "USDC",
        selectedPaymentMethod: "ETH",
        ethSpotPrice: 2000,
        ethBalance: parseUnits("0.0515", 18),
      })
    );
    expect(result.hasEnoughByMethod.ETH).toBe(true);
    expect(result.canSubmit).toBe(true);
  });

  it("cannot submit without buffer", () => {
    // $100 USDC at $2000/ETH = 0.05 ETH base
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ stepPrice: parseUnits("100", 6).toString() }),
        quantity: 1,
        selectedCurrency: "USDC",
        selectedPaymentMethod: "ETH",
        ethSpotPrice: 2000,
        ethBalance: parseUnits("0.05", 18), // Exactly base, no buffer
      })
    );
    expect(result.hasEnoughByMethod.ETH).toBe(false);
    expect(result.canSubmit).toBe(false);
  });

  it("returns null required when ETH price is 0", () => {
    const result = calculateAffordability(
      createInput({
        selectedPaymentMethod: "ETH",
        ethSpotPrice: 0,
      })
    );
    expect(result.requiredByMethod.ETH).toBeNull();
    expect(result.hasEnoughByMethod.ETH).toBe(false);
  });

  it("handles delegation path (GLW -> USDC -> ETH)", () => {
    // 100 GLW at $1 = $100 USDC + 5% = $105
    // $105 at $2000/ETH = 0.0525 ETH + 3% = 0.054075 ETH
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({ step: parseUnits("100", 18).toString() }),
        quantity: 1,
        selectedCurrency: "GLW",
        selectedPaymentMethod: "ETH",
        glwSpotPrice: 1.0,
        ethSpotPrice: 2000,
        ethBalance: parseUnits("0.1", 18), // Enough
      })
    );
    expect(result.hasEnoughByMethod.ETH).toBe(true);
    expect(result.canSubmit).toBe(true);
  });
});

// ============================================================================
// hasEnoughByMethod correctness
// ============================================================================

describe("hasEnoughByMethod shows all methods", () => {
  it("shows correct status for wallet with mixed balances", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({
          step: parseUnits("100", 18).toString(),
          stepPrice: parseUnits("50", 6).toString(),
        }),
        quantity: 1,
        selectedCurrency: "USDC",
        selectedPaymentMethod: "USDC",
        glwSpotPrice: 0.5,
        ethSpotPrice: 2000,
        glwBalance: parseUnits("50", 18), // 50 GLW (need 100) - insufficient
        usdcBalance: parseUnits("100", 6), // $100 (need $50) - sufficient
        ethBalance: parseUnits("0.1", 18), // 0.1 ETH - sufficient for $50
      })
    );

    expect(result.hasEnoughByMethod.GLW).toBe(false); // Need 100, have 50
    expect(result.hasEnoughByMethod.USDC).toBe(true); // Need 50, have 100
    expect(result.hasEnoughByMethod.ETH).toBe(true); // 0.1 ETH > ~0.026 ETH needed
  });

  it("canSubmit reflects selected payment method", () => {
    const baseInput = createInput({
      activeFraction: createFraction({
        step: parseUnits("100", 18).toString(),
        stepPrice: parseUnits("50", 6).toString(),
      }),
      quantity: 1,
      selectedCurrency: "USDC",
      glwSpotPrice: 0.5,
      ethSpotPrice: 2000,
      glwBalance: parseUnits("50", 18), // Insufficient for GLW
      usdcBalance: parseUnits("100", 6), // Sufficient for USDC
      ethBalance: parseUnits("0.1", 18), // Sufficient for ETH
    });

    // GLW selected but insufficient
    const glwResult = calculateAffordability({
      ...baseInput,
      selectedPaymentMethod: "GLW",
    });
    expect(glwResult.canSubmit).toBe(false);

    // USDC selected and sufficient
    const usdcResult = calculateAffordability({
      ...baseInput,
      selectedPaymentMethod: "USDC",
    });
    expect(usdcResult.canSubmit).toBe(true);

    // ETH selected and sufficient
    const ethResult = calculateAffordability({
      ...baseInput,
      selectedPaymentMethod: "ETH",
    });
    expect(ethResult.canSubmit).toBe(true);
  });
});

// ============================================================================
// Large value tests
// ============================================================================

describe("affordability with large values", () => {
  it("handles bulk purchase (100 units)", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({
          step: parseUnits("100", 18).toString(),
          stepPrice: parseUnits("50", 6).toString(),
        }),
        quantity: 100,
        selectedCurrency: "USDC",
        selectedPaymentMethod: "USDC",
        usdcBalance: parseUnits("5000", 6), // $5000 USDC
      })
    );
    // 100 * $50 = $5000 required
    expect(result.requiredByMethod.USDC).toBe(parseUnits("5000", 6));
    expect(result.hasEnoughByMethod.USDC).toBe(true);
    expect(result.canSubmit).toBe(true);
  });

  it("handles very large GLW step values", () => {
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({
          step: parseUnits("10000", 18).toString(), // 10k GLW per step
        }),
        quantity: 10,
        selectedCurrency: "GLW",
        selectedPaymentMethod: "GLW",
        glwBalance: parseUnits("100000", 18), // 100k GLW
      })
    );
    // 10 * 10000 = 100k GLW required
    expect(result.requiredByMethod.GLW).toBe(parseUnits("100000", 18));
    expect(result.hasEnoughByMethod.GLW).toBe(true);
    expect(result.canSubmit).toBe(true);
  });

  it("does not overflow with maximum realistic values", () => {
    // 1M GLW at $10 = $10M USDC
    const result = calculateAffordability(
      createInput({
        activeFraction: createFraction({
          step: parseUnits("1000000", 18).toString(),
        }),
        quantity: 1,
        selectedCurrency: "GLW",
        selectedPaymentMethod: "USDC",
        glwSpotPrice: 10,
        usdcBalance: parseUnits("11000000", 6), // $11M USDC
      })
    );
    // Should calculate without overflow
    expect(result.requiredByMethod.USDC).toBeDefined();
    expect(result.hasEnoughByMethod.USDC).toBe(true);
  });
});
