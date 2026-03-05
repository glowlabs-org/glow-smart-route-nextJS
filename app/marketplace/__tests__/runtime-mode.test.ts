import { describe, expect, it } from "vitest";
import {
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
