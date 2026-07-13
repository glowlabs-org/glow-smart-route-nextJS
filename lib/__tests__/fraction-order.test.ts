import { describe, expect, it, vi } from "vitest";
import {
  FRACTION_ORDER_CHANGED_MESSAGE,
  validateFractionPurchaseTerms,
} from "@/lib/fraction-order";

const USDC = "0x0000000000000000000000000000000000000010" as const;
const OTHER_TOKEN = "0x0000000000000000000000000000000000000020" as const;

describe("fraction purchase term binding", () => {
  it("accepts the exact reviewed token and fixed-price total", () => {
    expect(
      validateFractionPurchaseTerms({
        paymentToken: USDC,
        stepAmount: 399_000_000n,
        stepsToBuy: 2n,
        expectedPaymentToken: USDC,
        expectedRequiredAmount: 798_000_000n,
      }),
    ).toEqual({ paymentToken: USDC, requiredAmount: 798_000_000n });
  });

  it("rejects a changed on-chain price before an allowance or wallet write", () => {
    const readAllowance = vi.fn();
    const writeContract = vi.fn();

    expect(() => {
      validateFractionPurchaseTerms({
        paymentToken: USDC,
        stepAmount: 500_000_000n,
        stepsToBuy: 1n,
        expectedPaymentToken: USDC,
        expectedRequiredAmount: 399_000_000n,
      });
      readAllowance();
      writeContract();
    }).toThrow(FRACTION_ORDER_CHANGED_MESSAGE);
    expect(readAllowance).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("rejects a changed payment token even with pre-existing allowance", () => {
    const writeContract = vi.fn();

    expect(() => {
      validateFractionPurchaseTerms({
        paymentToken: OTHER_TOKEN,
        stepAmount: 399_000_000n,
        stepsToBuy: 1n,
        expectedPaymentToken: USDC,
        expectedRequiredAmount: 399_000_000n,
      });
      // This models the sufficient-allowance branch, which would otherwise
      // skip approval and proceed directly to the purchase write.
      writeContract();
    }).toThrow(FRACTION_ORDER_CHANGED_MESSAGE);
    expect(writeContract).not.toHaveBeenCalled();
  });
});
