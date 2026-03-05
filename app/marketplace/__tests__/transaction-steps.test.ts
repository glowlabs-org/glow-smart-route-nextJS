/**
 * Tests for transaction step initialization in deposit-dialog.
 *
 * Run with: pnpm vitest run app/marketplace/__tests__/transaction-steps.test.ts
 */

import { describe, it, expect } from "vitest";
import { initializeTransactionSteps } from "../deposit-dialog-utils";

// ============================================================================
// Direct purchase/delegation flows
// ============================================================================

describe("direct purchase/delegation steps", () => {
  it("creates 2 steps for direct USDC miner purchase", () => {
    const steps = initializeTransactionSteps("USDC", "USDC");

    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.id)).toEqual(["BUY_FRACTIONS", "CONFIRM_TX"]);
  });

  it("creates 2 steps for direct GLW delegation", () => {
    const steps = initializeTransactionSteps("GLW", "GLW");

    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.id)).toEqual(["BUY_FRACTIONS", "CONFIRM_TX"]);
  });

  it("sets correct title for miner purchase", () => {
    const steps = initializeTransactionSteps("USDC", "USDC");

    const buyStep = steps.find((s) => s.id === "BUY_FRACTIONS");
    expect(buyStep?.title).toBe("Purchase Miners");
    expect(buyStep?.description).toBe("Purchasing miner units");
    expect(buyStep?.tokenFrom).toBe("USDC");
  });

  it("sets correct title for GLW delegation", () => {
    const steps = initializeTransactionSteps("GLW", "GLW");

    const buyStep = steps.find((s) => s.id === "BUY_FRACTIONS");
    expect(buyStep?.title).toBe("Delegate GLW");
    expect(buyStep?.description).toBe("Delegating GLW to the solar farm");
    expect(buyStep?.tokenFrom).toBe("GLW");
  });

  it("all steps start with idle status", () => {
    const steps = initializeTransactionSteps("USDC", "USDC");

    for (const step of steps) {
      expect(step.status).toBe("idle");
    }
  });
});

// ============================================================================
// ETH to USDC (miners) flow
// ============================================================================

describe("ETH to USDC miner purchase steps", () => {
  it("creates 3 steps for ETH miner purchase", () => {
    const steps = initializeTransactionSteps("USDC", "ETH");

    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.id)).toEqual([
      "SWAP_ETH_TO_USDC",
      "BUY_FRACTIONS",
      "CONFIRM_TX",
    ]);
  });

  it("sets correct metadata for ETH swap step", () => {
    const steps = initializeTransactionSteps("USDC", "ETH");

    const swapStep = steps.find((s) => s.id === "SWAP_ETH_TO_USDC");
    expect(swapStep?.title).toBe("Swap ETH → USDC");
    expect(swapStep?.description).toBe("Converting ETH to USDC via Uniswap");
    expect(swapStep?.tokenFrom).toBe("ETH");
    expect(swapStep?.tokenTo).toBe("USDC");
  });

  it("BUY_FRACTIONS comes after swap", () => {
    const steps = initializeTransactionSteps("USDC", "ETH");

    const swapIndex = steps.findIndex((s) => s.id === "SWAP_ETH_TO_USDC");
    const buyIndex = steps.findIndex((s) => s.id === "BUY_FRACTIONS");

    expect(buyIndex).toBe(swapIndex + 1);
  });

  it("CONFIRM_TX is always last", () => {
    const steps = initializeTransactionSteps("USDC", "ETH");

    expect(steps[steps.length - 1].id).toBe("CONFIRM_TX");
  });
});

// ============================================================================
// USDC to GLW (delegation swap) flow
// ============================================================================

describe("USDC to GLW delegation steps", () => {
  it("creates 4 steps for USDC delegation swap", () => {
    const steps = initializeTransactionSteps("GLW", "USDC");

    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.id)).toEqual([
      "SWAP_USDC_TO_USDG",
      "SWAP_USDG_TO_GLOW",
      "DELEGATE_GLW",
      "CONFIRM_TX",
    ]);
  });

  it("sets correct metadata for USDC to USDG swap", () => {
    const steps = initializeTransactionSteps("GLW", "USDC");

    const step = steps.find((s) => s.id === "SWAP_USDC_TO_USDG");
    expect(step?.title).toBe("Swap USDC → USDG");
    expect(step?.description).toBe("Converting USDC to USDG");
    expect(step?.tokenFrom).toBe("USDC");
    expect(step?.tokenTo).toBe("USDG");
  });

  it("sets correct metadata for USDG to GLW swap", () => {
    const steps = initializeTransactionSteps("GLW", "USDC");

    const step = steps.find((s) => s.id === "SWAP_USDG_TO_GLOW");
    expect(step?.title).toBe("Swap USDG → GLW");
    expect(step?.description).toBe("Converting USDG to GLW via Uniswap");
    expect(step?.tokenFrom).toBe("USDG");
    expect(step?.tokenTo).toBe("GLW");
  });

  it("sets correct metadata for delegation step", () => {
    const steps = initializeTransactionSteps("GLW", "USDC");

    const step = steps.find((s) => s.id === "DELEGATE_GLW");
    expect(step?.title).toBe("Delegate GLW");
    expect(step?.description).toBe("Delegating GLW to the solar farm");
    expect(step?.tokenFrom).toBe("GLW");
  });

  it("steps are in correct order", () => {
    const steps = initializeTransactionSteps("GLW", "USDC");

    const ids = steps.map((s) => s.id);
    expect(ids.indexOf("SWAP_USDC_TO_USDG")).toBeLessThan(
      ids.indexOf("SWAP_USDG_TO_GLOW")
    );
    expect(ids.indexOf("SWAP_USDG_TO_GLOW")).toBeLessThan(
      ids.indexOf("DELEGATE_GLW")
    );
    expect(ids.indexOf("DELEGATE_GLW")).toBeLessThan(ids.indexOf("CONFIRM_TX"));
  });
});

// ============================================================================
// ETH to GLW (full swap chain) flow
// ============================================================================

describe("ETH to GLW delegation steps", () => {
  it("creates 5 steps for ETH delegation swap", () => {
    const steps = initializeTransactionSteps("GLW", "ETH");

    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.id)).toEqual([
      "SWAP_ETH_TO_USDC",
      "SWAP_USDC_TO_USDG",
      "SWAP_USDG_TO_GLOW",
      "DELEGATE_GLW",
      "CONFIRM_TX",
    ]);
  });

  it("ETH swap is first step", () => {
    const steps = initializeTransactionSteps("GLW", "ETH");

    expect(steps[0].id).toBe("SWAP_ETH_TO_USDC");
    expect(steps[0].tokenFrom).toBe("ETH");
    expect(steps[0].tokenTo).toBe("USDC");
  });

  it("follows complete swap chain: ETH -> USDC -> USDG -> GLW -> delegate", () => {
    const steps = initializeTransactionSteps("GLW", "ETH");

    // Verify token flow is continuous
    expect(steps[0].tokenFrom).toBe("ETH");
    expect(steps[0].tokenTo).toBe("USDC");

    expect(steps[1].tokenFrom).toBe("USDC");
    expect(steps[1].tokenTo).toBe("USDG");

    expect(steps[2].tokenFrom).toBe("USDG");
    expect(steps[2].tokenTo).toBe("GLW");

    expect(steps[3].tokenFrom).toBe("GLW");
  });

  it("CONFIRM_TX is always last", () => {
    const steps = initializeTransactionSteps("GLW", "ETH");

    expect(steps[steps.length - 1].id).toBe("CONFIRM_TX");
    expect(steps[steps.length - 1].title).toBe("Confirm Transaction");
    expect(steps[steps.length - 1].description).toBe(
      "Waiting for blockchain confirmation"
    );
  });
});

// ============================================================================
// SGCTL delegation flows
// ============================================================================

describe("SGCTL delegation steps", () => {
  it("creates 2 steps for direct staked SGCTL delegation", () => {
    const steps = initializeTransactionSteps("SGCTL", "GCTL", {
      sgctlSource: "staked",
    });

    expect(steps.map((s) => s.id)).toEqual([
      "DELEGATE_SGCTL",
      "CONFIRM_TX",
    ]);
  });

  it("creates 3 steps for wallet GCTL stake then delegate", () => {
    const steps = initializeTransactionSteps("SGCTL", "GCTL", {
      sgctlSource: "wallet_gctl",
    });

    expect(steps.map((s) => s.id)).toEqual([
      "STAKE_GCTL",
      "DELEGATE_SGCTL",
      "CONFIRM_TX",
    ]);
  });

  it("creates 3 steps for USDC mint and stake then delegate", () => {
    const steps = initializeTransactionSteps("SGCTL", "USDC", {
      sgctlSource: "mint_usdc",
    });

    expect(steps.map((s) => s.id)).toEqual([
      "MINT_AND_STAKE_GCTL",
      "DELEGATE_SGCTL",
      "CONFIRM_TX",
    ]);
  });

  it("creates 4 steps for ETH mint and stake then delegate", () => {
    const steps = initializeTransactionSteps("SGCTL", "ETH", {
      sgctlSource: "mint_eth",
    });

    expect(steps.map((s) => s.id)).toEqual([
      "SWAP_ETH_TO_USDC",
      "MINT_AND_STAKE_GCTL",
      "DELEGATE_SGCTL",
      "CONFIRM_TX",
    ]);
  });
});

// ============================================================================
// Step structure validation
// ============================================================================

describe("step structure", () => {
  const allCombinations: Array<
    ["GLW" | "SGCTL" | "USDC", "GLW" | "GCTL" | "USDC" | "ETH"]
  > = [
    ["GLW", "GLW"],
    ["GLW", "USDC"],
    ["GLW", "ETH"],
    ["SGCTL", "GCTL"],
    ["SGCTL", "USDC"],
    ["SGCTL", "ETH"],
    ["USDC", "USDC"],
    ["USDC", "ETH"],
  ];

  it.each(allCombinations)(
    "all steps have required fields for currency=%s, payment=%s",
    (currency, payment) => {
      const steps = initializeTransactionSteps(currency, payment);

      for (const step of steps) {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.description).toBeTruthy();
        expect(step.status).toBe("idle");
      }
    }
  );

  it.each(allCombinations)(
    "CONFIRM_TX is always last for currency=%s, payment=%s",
    (currency, payment) => {
      const steps = initializeTransactionSteps(currency, payment);

      expect(steps[steps.length - 1].id).toBe("CONFIRM_TX");
    }
  );

  it.each(allCombinations)(
    "no duplicate step IDs for currency=%s, payment=%s",
    (currency, payment) => {
      const steps = initializeTransactionSteps(currency, payment);

      const ids = steps.map((s) => s.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids).toHaveLength(uniqueIds.length);
    }
  );
});

// ============================================================================
// isSwapDelegate logic
// ============================================================================

describe("isSwapDelegate detection", () => {
  it("is NOT a swap delegate when currency=GLW and payment=GLW", () => {
    const steps = initializeTransactionSteps("GLW", "GLW");

    // Should use BUY_FRACTIONS, not DELEGATE_GLW
    expect(steps.map((s) => s.id)).toContain("BUY_FRACTIONS");
    expect(steps.map((s) => s.id)).not.toContain("DELEGATE_GLW");
  });

  it("IS a swap delegate when currency=GLW and payment=USDC", () => {
    const steps = initializeTransactionSteps("GLW", "USDC");

    // Should use DELEGATE_GLW, not BUY_FRACTIONS
    expect(steps.map((s) => s.id)).toContain("DELEGATE_GLW");
    expect(steps.map((s) => s.id)).not.toContain("BUY_FRACTIONS");
  });

  it("IS a swap delegate when currency=GLW and payment=ETH", () => {
    const steps = initializeTransactionSteps("GLW", "ETH");

    // Should use DELEGATE_GLW, not BUY_FRACTIONS
    expect(steps.map((s) => s.id)).toContain("DELEGATE_GLW");
    expect(steps.map((s) => s.id)).not.toContain("BUY_FRACTIONS");
  });

  it("is NOT a swap delegate when currency=USDC (miners)", () => {
    // For miners, we always use BUY_FRACTIONS regardless of payment method
    const usdcSteps = initializeTransactionSteps("USDC", "USDC");
    const ethSteps = initializeTransactionSteps("USDC", "ETH");

    expect(usdcSteps.map((s) => s.id)).toContain("BUY_FRACTIONS");
    expect(ethSteps.map((s) => s.id)).toContain("BUY_FRACTIONS");
    expect(usdcSteps.map((s) => s.id)).not.toContain("DELEGATE_GLW");
    expect(ethSteps.map((s) => s.id)).not.toContain("DELEGATE_GLW");
  });
});
