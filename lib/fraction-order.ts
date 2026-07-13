import { getAddress, type Address } from "viem";

export const FRACTION_ORDER_CHANGED_MESSAGE =
  "The miner price or payment token changed. Review the purchase again.";

export interface FractionPurchaseTerms {
  paymentToken: Address | string;
  stepAmount: bigint | string | { toString(): string };
  stepsToBuy: bigint;
  expectedPaymentToken: Address;
  expectedRequiredAmount: bigint;
}

/**
 * Binds the backend-reviewed fixed-price order to the fraction read on-chain.
 * Call this before any balance, allowance, approval, simulation, or purchase.
 */
export function validateFractionPurchaseTerms({
  paymentToken,
  stepAmount,
  stepsToBuy,
  expectedPaymentToken,
  expectedRequiredAmount,
}: FractionPurchaseTerms): { paymentToken: Address; requiredAmount: bigint } {
  if (stepsToBuy <= 0n || expectedRequiredAmount <= 0n) {
    throw new Error(FRACTION_ORDER_CHANGED_MESSAGE);
  }

  let normalizedPaymentToken: Address;
  let normalizedExpectedToken: Address;
  let requiredAmount: bigint;
  try {
    normalizedPaymentToken = getAddress(paymentToken);
    normalizedExpectedToken = getAddress(expectedPaymentToken);
    requiredAmount = stepsToBuy * BigInt(stepAmount.toString());
  } catch {
    throw new Error(FRACTION_ORDER_CHANGED_MESSAGE);
  }

  if (
    normalizedPaymentToken !== normalizedExpectedToken ||
    requiredAmount !== expectedRequiredAmount
  ) {
    throw new Error(FRACTION_ORDER_CHANGED_MESSAGE);
  }

  return { paymentToken: normalizedPaymentToken, requiredAmount };
}
