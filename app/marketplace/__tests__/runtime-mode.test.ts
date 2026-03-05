import { describe, expect, it } from "vitest";
import {
  getDefaultPaymentMethodForRuntimeCurrency,
  hasConfirmedSplitPurchase,
  requiresSmartAccountCheck,
  resolveDepositDialogMode,
  resolveRuntimeSelectedCurrency,
  type ActiveFraction,
} from "../deposit-dialog-utils";

function createActiveFraction(
  overrides: Partial<ActiveFraction> = {}
): ActiveFraction {
  return {
    id: "fraction-1",
    owner: "0x0000000000000000000000000000000000000000",
    step: "1000000",
    stepPrice: "50000000",
    totalSteps: 10,
    remainingSteps: 8,
    splitsSold: 2,
    delegationAsset: null,
    delegationPhase: null,
    ...overrides,
  };
}

describe("resolveDepositDialogMode", () => {
  it("keeps miners in USDC mode", () => {
    expect(
      resolveDepositDialogMode("USDC", createActiveFraction())
    ).toBe("miners");
  });

  it("resolves SGCTL launchpad listings to sgctl_delegation mode", () => {
    expect(
      resolveDepositDialogMode(
        "GLW",
        createActiveFraction({ delegationAsset: "SGCTL", delegationPhase: "sgctl" })
      )
    ).toBe("sgctl_delegation");
  });

  it("keeps GLW launchpad listings in glw_delegation mode", () => {
    expect(
      resolveDepositDialogMode(
        "GLW",
        createActiveFraction({ delegationAsset: "GLW", delegationPhase: "glw" })
      )
    ).toBe("glw_delegation");
  });
});

describe("resolveRuntimeSelectedCurrency", () => {
  it("returns SGCTL for SGCTL launchpad listings even when the entry prop is GLW", () => {
    expect(
      resolveRuntimeSelectedCurrency(
        "GLW",
        createActiveFraction({ delegationAsset: "SGCTL", delegationPhase: "sgctl" })
      )
    ).toBe("SGCTL");
  });

  it("returns GLW for normal launchpad delegations", () => {
    expect(
      resolveRuntimeSelectedCurrency(
        "GLW",
        createActiveFraction({ delegationAsset: "GLW", delegationPhase: "glw" })
      )
    ).toBe("GLW");
  });

  it("returns USDC for miners", () => {
    expect(
      resolveRuntimeSelectedCurrency("USDC", createActiveFraction())
    ).toBe("USDC");
  });
});

describe("requiresSmartAccountCheck", () => {
  it("does not require the smart-account warning for SGCTL", () => {
    expect(requiresSmartAccountCheck("SGCTL")).toBe(false);
  });

  it("still requires the smart-account warning for GLW and USDC flows", () => {
    expect(requiresSmartAccountCheck("GLW")).toBe(true);
    expect(requiresSmartAccountCheck("USDC")).toBe(true);
  });
});

describe("getDefaultPaymentMethodForRuntimeCurrency", () => {
  it("defaults SGCTL flows to GCTL payment handling", () => {
    expect(getDefaultPaymentMethodForRuntimeCurrency("SGCTL")).toBe("GCTL");
  });

  it("preserves the native default payment method for GLW and USDC flows", () => {
    expect(getDefaultPaymentMethodForRuntimeCurrency("GLW")).toBe("GLW");
    expect(getDefaultPaymentMethodForRuntimeCurrency("USDC")).toBe("USDC");
  });
});

describe("hasConfirmedSplitPurchase", () => {
  it("requires the purchased-step delta to meet the requested quantity", () => {
    expect(hasConfirmedSplitPurchase(5, 5, 1)).toBe(false);
    expect(hasConfirmedSplitPurchase(5, 6, 1)).toBe(true);
    expect(hasConfirmedSplitPurchase(5, 6, 2)).toBe(false);
    expect(hasConfirmedSplitPurchase(5, 7, 2)).toBe(true);
  });

  it("clamps invalid values to safe minimums", () => {
    expect(hasConfirmedSplitPurchase(Number.NaN, 1, Number.NaN)).toBe(true);
    expect(hasConfirmedSplitPurchase(-5, -1, 0)).toBe(false);
  });
});
