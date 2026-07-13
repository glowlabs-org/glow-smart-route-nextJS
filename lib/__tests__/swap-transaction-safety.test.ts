import { describe, expect, it } from "vitest";

import { computeBoundedPurchaseSpend } from "@/lib/bonding-curve-budget";
import {
  createSwapQuoteKey,
  isCurrentSwapQuote,
  SWAP_QUOTE_MAX_AGE_MS,
  validateSmartBalancingQuote,
} from "@/lib/swap-quote";
import {
  computeBufferedGasCostWei,
  computeRequiredEthBalanceWei,
  estimateSwapGasUnits,
} from "@/lib/transaction-gas";

describe("swap quote identity and expiry", () => {
  const baseIdentity = {
    amount: "10",
    sellToken: "ETH",
    buyToken: "GLOW",
    chainId: 1,
    slippageBps: 100n,
    priceBasis: "0.42",
  };

  it("invalidates a quote when any execution input changes", () => {
    const key = createSwapQuoteKey(baseIdentity);

    expect(createSwapQuoteKey({ ...baseIdentity, amount: "11" })).not.toBe(key);
    expect(
      createSwapQuoteKey({ ...baseIdentity, sellToken: "USDC" }),
    ).not.toBe(key);
    expect(createSwapQuoteKey({ ...baseIdentity, chainId: 11155111 })).not.toBe(
      key,
    );
    expect(createSwapQuoteKey({ ...baseIdentity, slippageBps: 200n })).not.toBe(
      key,
    );
    expect(createSwapQuoteKey({ ...baseIdentity, priceBasis: "0.43" })).not.toBe(
      key,
    );
  });

  it("accepts only the matching, unexpired quote", () => {
    const now = 1_000_000;
    const key = createSwapQuoteKey(baseIdentity);
    const quote = { key, quotedAt: now };

    expect(isCurrentSwapQuote({ quote, expectedKey: key, now })).toBe(true);
    expect(
      isCurrentSwapQuote({
        quote,
        expectedKey: key,
        now: now + SWAP_QUOTE_MAX_AGE_MS,
      }),
    ).toBe(true);
    expect(
      isCurrentSwapQuote({
        quote,
        expectedKey: key,
        now: now + SWAP_QUOTE_MAX_AGE_MS + 1,
      }),
    ).toBe(false);
    expect(
      isCurrentSwapQuote({ quote, expectedKey: `${key}|changed`, now }),
    ).toBe(false);
  });
});

describe("smart route budget validation", () => {
  const quote = {
    amount_in_uni: 600n,
    amount_in_glow_bonding_curve: 400n,
    amount_out_uni: "12.5",
    amount_out_glow: "7.5",
    usdgToSpend: "0.001",
  };

  it("accepts an executable allocation within the order budget", () => {
    expect(validateSmartBalancingQuote({ quote, budgetAtomic: 1_000n })).toEqual(
      { ok: true, allocatedAtomic: 1_000n },
    );
  });

  it("rejects missing, empty, oversized, and output-free routes", () => {
    expect(validateSmartBalancingQuote({ quote: undefined }).ok).toBe(false);
    expect(
      validateSmartBalancingQuote({
        quote: { ...quote, amount_in_uni: 0n, amount_in_glow_bonding_curve: 0n },
      }).ok,
    ).toBe(false);
    expect(validateSmartBalancingQuote({ quote, budgetAtomic: 997n }).ok).toBe(
      false,
    );
    expect(
      validateSmartBalancingQuote({
        quote: { ...quote, amount_out_uni: "0", amount_out_glow: "0" },
      }).ok,
    ).toBe(false);
  });

  it("rejects underallocation and a quoted input that differs from the order", () => {
    expect(
      validateSmartBalancingQuote({
        quote: { ...quote, amount_in_uni: 596n },
        budgetAtomic: 1_000n,
      }).ok,
    ).toBe(false);
    expect(
      validateSmartBalancingQuote({
        quote: { ...quote, usdgToSpend: "0.0009" },
        budgetAtomic: 1_000n,
      }).ok,
    ).toBe(false);
  });

  it("allows only the explicit two-atomic rounding tolerance", () => {
    expect(
      validateSmartBalancingQuote({
        quote: { ...quote, amount_in_uni: 598n },
        budgetAtomic: 1_000n,
      }).ok,
    ).toBe(true);
  });

  it("rejects negative outputs and allocation/output mismatches per leg", () => {
    expect(
      validateSmartBalancingQuote({
        quote: { ...quote, amount_out_uni: "-1" },
      }).ok,
    ).toBe(false);
    expect(
      validateSmartBalancingQuote({
        quote: { ...quote, amount_in_uni: 0n, amount_out_uni: "12.5" },
      }).ok,
    ).toBe(false);
    expect(
      validateSmartBalancingQuote({
        quote: { ...quote, amount_out_glow: "0" },
      }).ok,
    ).toBe(false);
  });
});

describe("bonding-curve spend bounds", () => {
  it("caps the slippage buffer at the allocation", () => {
    expect(
      computeBoundedPurchaseSpend({
        quotedPrice: 100n,
        slippageBps: 1_000n,
        maxBudget: 105n,
      }),
    ).toEqual({ ok: true, maxSpend: 105n });
  });

  it("requires a fresh order when the raw price exceeds the allocation", () => {
    expect(
      computeBoundedPurchaseSpend({
        quotedPrice: 106n,
        slippageBps: 100n,
        maxBudget: 105n,
      }).ok,
    ).toBe(false);
  });
});

describe("full-flow ETH budgeting", () => {
  it("reserves gas for every leg and adds the native swap value", () => {
    const simpleGas = estimateSwapGasUnits({
      sellToken: "ETH",
      buyToken: "USDC",
    });
    const multiLegGas = estimateSwapGasUnits({
      sellToken: "ETH",
      buyToken: "GLOW",
      hasBondingAllocation: true,
    });
    expect(multiLegGas).toBeGreaterThan(simpleGas);

    const gasCost = computeBufferedGasCostWei({
      gasUnits: multiLegGas,
      gasPriceWei: 10n,
      safetyBps: 1_500,
    });
    expect(
      computeRequiredEthBalanceWei({
        gasUnits: multiLegGas,
        gasPriceWei: 10n,
        valueWei: 5_000n,
        safetyBps: 1_500,
      }),
    ).toBe(gasCost + 5_000n);
  });

  it("includes approval and redemption gas for standalone USDG exits", () => {
    expect(
      estimateSwapGasUnits({ sellToken: "USDG", buyToken: "USDC" }),
    ).toBe(170_000n);
    expect(
      estimateSwapGasUnits({ sellToken: "GLOW", buyToken: "USDC" }),
    ).toBeGreaterThan(
      estimateSwapGasUnits({ sellToken: "GLOW", buyToken: "USDG" }),
    );
  });

  it("reserves both approvals for the USDC reset-allowance fallback", () => {
    expect(
      estimateSwapGasUnits({ sellToken: "USDC", buyToken: "USDG" }),
    ).toBe(240_000n);
    expect(
      estimateSwapGasUnits({
        sellToken: "USDC",
        buyToken: "GLOW",
        hasBondingAllocation: false,
      }),
    ).toBeGreaterThan(420_000n);
  });
});
