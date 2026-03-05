/**
 * Tests for error handling utilities in deposit-dialog.
 *
 * Run with: pnpm vitest run app/marketplace/__tests__/error-handling.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  getErrorMessage,
  getErrorCode,
  isInternalRpcError,
  findErrorInMessage,
  getSwapVolatilityErrorMessage,
  CONTRACT_ERROR_MESSAGES,
  RPC_INTERNAL_ERROR_MESSAGE,
  SWAP_VOLATILITY_ERROR_MESSAGE,
} from "../deposit-dialog-utils";

// ============================================================================
// CONTRACT_ERROR_MESSAGES mapping tests
// ============================================================================

describe("CONTRACT_ERROR_MESSAGES", () => {
  it("has user-friendly messages for all known contract errors", () => {
    const expectedErrors = [
      "InsufficientSharesAvailable",
      "Expired",
      "AlreadyClosed",
      "ZeroSteps",
      "MinStepsToBuyCannotBeZero",
      "InsufficientBalance",
      "AddressInsufficientBalance",
      "SafeERC20FailedOperation",
      "ReentrancyGuardReentrantCall",
      "FailedInnerCall",
    ];

    for (const errorName of expectedErrors) {
      expect(CONTRACT_ERROR_MESSAGES[errorName]).toBeDefined();
      expect(CONTRACT_ERROR_MESSAGES[errorName].message).toBeTruthy();
    }
  });

  it("marks availability-related errors with shouldRefresh: true", () => {
    const refreshErrors = [
      "InsufficientSharesAvailable",
      "Expired",
      "AlreadyClosed",
    ];

    for (const errorName of refreshErrors) {
      expect(CONTRACT_ERROR_MESSAGES[errorName].shouldRefresh).toBe(true);
    }
  });

  it("does NOT mark user-input errors with shouldRefresh", () => {
    const noRefreshErrors = [
      "ZeroSteps",
      "MinStepsToBuyCannotBeZero",
      "InsufficientBalance",
      "deadline_expired",
      "signer_mismatch",
      "signature_failed",
    ];

    for (const errorName of noRefreshErrors) {
      expect(CONTRACT_ERROR_MESSAGES[errorName].shouldRefresh).toBeFalsy();
    }
  });
});

// ============================================================================
// findErrorInMessage tests
// ============================================================================

describe("findErrorInMessage", () => {
  it.each(Object.entries(CONTRACT_ERROR_MESSAGES))(
    "finds '%s' error in message",
    (errorName, expectedConfig) => {
      const msg = `ContractFunctionExecutionError: ${errorName}`;
      const result = findErrorInMessage(msg);
      expect(result).toEqual(expectedConfig);
    }
  );

  it("finds error when embedded in viem error chain", () => {
    const msg =
      "ContractFunctionExecutionError: The contract function 'buyFractions' reverted with the following reason: InsufficientSharesAvailable";
    const result = findErrorInMessage(msg);
    expect(result).toEqual(CONTRACT_ERROR_MESSAGES.InsufficientSharesAvailable);
  });

  it("finds error when embedded in ethers error", () => {
    const msg =
      'execution reverted: "InsufficientBalance" (action="estimateGas")';
    const result = findErrorInMessage(msg);
    expect(result).toEqual(CONTRACT_ERROR_MESSAGES.InsufficientBalance);
  });

  it("returns null for unknown errors", () => {
    expect(findErrorInMessage("Some random error")).toBeNull();
    expect(findErrorInMessage("")).toBeNull();
    expect(findErrorInMessage("User rejected")).toBeNull();
  });

  it("returns null for partial matches that are not actual error names", () => {
    // "Insufficient" alone should not match
    expect(findErrorInMessage("Insufficient something")).toBeNull();
    // "Zero" alone should not match
    expect(findErrorInMessage("Zero value")).toBeNull();
  });

  it("returns first match when multiple errors in message", () => {
    const msg = "InsufficientSharesAvailable and also Expired";
    const result = findErrorInMessage(msg);
    // Should return InsufficientSharesAvailable (first in iteration order)
    expect(result).toBeDefined();
    expect(result?.shouldRefresh).toBe(true);
  });

  it("maps Control signature validation reasons to user-friendly messages", () => {
    expect(findErrorInMessage("deadline_expired")).toEqual(
      CONTRACT_ERROR_MESSAGES.deadline_expired
    );
    expect(findErrorInMessage("deadline_too_far")).toEqual(
      CONTRACT_ERROR_MESSAGES.deadline_too_far
    );
    expect(findErrorInMessage("deadline_is_milliseconds")).toEqual(
      CONTRACT_ERROR_MESSAGES.deadline_is_milliseconds
    );
    expect(findErrorInMessage("signature_failed")).toEqual(
      CONTRACT_ERROR_MESSAGES.signature_failed
    );
    expect(findErrorInMessage("signer_mismatch")).toEqual(
      CONTRACT_ERROR_MESSAGES.signer_mismatch
    );
  });

  it("maps reused nonce errors from Control to a refreshable message", () => {
    expect(
      findErrorInMessage("Nonce and wallet keypair insert error (most likely already used)")
    ).toEqual(CONTRACT_ERROR_MESSAGES["already used"]);
    expect(findErrorInMessage("Nonce already used or invalid")).toEqual(
      CONTRACT_ERROR_MESSAGES["Nonce already used"]
    );
  });

  it("maps CRM SGCTL validation errors to refreshable messages", () => {
    expect(
      findErrorInMessage(
        "Fraction fraction_1 is not active (status=cancelled)"
      )
    ).toEqual(CONTRACT_ERROR_MESSAGES["is not active (status="]);
    expect(
      findErrorInMessage(
        "Delegation paymentDate is after fraction expiration for fraction_1"
      )
    ).toEqual(
      CONTRACT_ERROR_MESSAGES[
        "Delegation paymentDate is after fraction expiration"
      ]
    );
    expect(
      findErrorInMessage(
        "Fraction fraction_1 is not in SGCTL delegation phase at paymentDate"
      )
    ).toEqual(
      CONTRACT_ERROR_MESSAGES["is not in SGCTL delegation phase at paymentDate"]
    );
    expect(
      findErrorInMessage(
        "Region mismatch for application app_1: expected 7, got 9"
      )
    ).toEqual(CONTRACT_ERROR_MESSAGES["Region mismatch for application"]);
    expect(findErrorInMessage("Zone is not active")).toEqual(
      CONTRACT_ERROR_MESSAGES["Zone is not active"]
    );
    expect(findErrorInMessage("Application not found: app_1")).toEqual(
      CONTRACT_ERROR_MESSAGES["Application not found"]
    );
    expect(
      findErrorInMessage("Active launchpad fraction not found for application app_1")
    ).toEqual(CONTRACT_ERROR_MESSAGES["Active launchpad fraction not found"]);
  });
});

describe("getSwapVolatilityErrorMessage", () => {
  it("returns friendly message for swap volatility/liquidity failures", () => {
    const msg =
      "Transaction failed. This could be due to insufficient liquidity, slippage tolerance exceeded, or contract revert.";
    expect(getSwapVolatilityErrorMessage(msg, "SWAP_USDG_TO_GLOW")).toBe(
      SWAP_VOLATILITY_ERROR_MESSAGE
    );
  });

  it("returns friendly message for reserve quote failures", () => {
    expect(
      getSwapVolatilityErrorMessage(
        "Failed to get amount out",
        "SWAP_USDG_TO_GLOW"
      )
    ).toBe(SWAP_VOLATILITY_ERROR_MESSAGE);
  });

  it("returns null for non-swap steps", () => {
    expect(
      getSwapVolatilityErrorMessage(
        "insufficient liquidity",
        "SWAP_USDC_TO_USDG"
      )
    ).toBeNull();
  });

  it("returns null for unrelated errors on swap step", () => {
    expect(
      getSwapVolatilityErrorMessage(
        "Insufficient USDC balance",
        "SWAP_USDG_TO_GLOW"
      )
    ).toBeNull();
  });
});

// ============================================================================
// getErrorMessage tests (extended)
// ============================================================================

describe("getErrorMessage", () => {
  it("returns 'Unknown error' for null/undefined", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
    expect(getErrorMessage(undefined)).toBe("Unknown error");
  });

  it("extracts message from Error instance", () => {
    const error = new Error("Test error message");
    expect(getErrorMessage(error)).toBe("Test error message");
  });

  it("extracts message from nested cause", () => {
    const error = { cause: { message: "Nested cause message" } };
    expect(getErrorMessage(error)).toBe("Nested cause message");
  });

  it("extracts message from cause.data.message (viem style)", () => {
    const error = { cause: { data: { message: "Deep nested message" } } };
    expect(getErrorMessage(error)).toBe("Deep nested message");
  });

  it("extracts message from data.message", () => {
    const error = { data: { message: "Data message" } };
    expect(getErrorMessage(error)).toBe("Data message");
  });

  it("extracts message from error.message (nested error object)", () => {
    const error = { error: { message: "Nested error message" } };
    expect(getErrorMessage(error)).toBe("Nested error message");
  });

  it("extracts shortMessage (viem style)", () => {
    const error = { shortMessage: "Short viem message" };
    expect(getErrorMessage(error)).toBe("Short viem message");
  });

  it("extracts message from top-level message as fallback", () => {
    const error = { message: "Top level message" };
    expect(getErrorMessage(error)).toBe("Top level message");
  });

  it("prioritizes cause.message over shortMessage", () => {
    const error = {
      cause: { message: "Cause message" },
      shortMessage: "Short message",
      message: "Top message",
    };
    expect(getErrorMessage(error)).toBe("Cause message");
  });

  it("handles realistic viem ContractFunctionExecutionError", () => {
    const viemError = {
      name: "ContractFunctionExecutionError",
      message: "The contract function reverted",
      shortMessage: "Contract call failed",
      cause: {
        name: "ContractFunctionRevertedError",
        message: "InsufficientSharesAvailable",
        data: {
          errorName: "InsufficientSharesAvailable",
        },
      },
    };
    expect(getErrorMessage(viemError)).toBe("InsufficientSharesAvailable");
  });

  it("handles realistic wagmi/viem RPC error", () => {
    const rpcError = {
      name: "TransactionExecutionError",
      shortMessage: "An internal error was received.",
      cause: {
        code: -32603,
        message: "Internal JSON-RPC error.",
        data: {
          message: "execution reverted",
        },
      },
    };
    expect(getErrorMessage(rpcError)).toBe("Internal JSON-RPC error.");
  });
});

// ============================================================================
// getErrorCode tests (extended)
// ============================================================================

describe("getErrorCode", () => {
  it("returns undefined for errors without code", () => {
    expect(getErrorCode(new Error("No code"))).toBeUndefined();
    expect(getErrorCode({})).toBeUndefined();
    expect(getErrorCode(null)).toBeUndefined();
    expect(getErrorCode(undefined)).toBeUndefined();
  });

  it("extracts code from top level", () => {
    expect(getErrorCode({ code: -32603 })).toBe(-32603);
    expect(getErrorCode({ code: 4001 })).toBe(4001);
  });

  it("extracts code from cause", () => {
    expect(getErrorCode({ cause: { code: -32000 } })).toBe(-32000);
  });

  it("prefers cause code over top level", () => {
    expect(getErrorCode({ code: 1, cause: { code: -32603 } })).toBe(-32603);
  });

  it("returns undefined for non-numeric codes", () => {
    expect(getErrorCode({ code: "INSUFFICIENT_FUNDS" })).toBeUndefined();
    expect(getErrorCode({ code: null })).toBeUndefined();
  });

  it("handles common JSON-RPC error codes", () => {
    // Internal error
    expect(getErrorCode({ code: -32603 })).toBe(-32603);
    // User rejected
    expect(getErrorCode({ code: 4001 })).toBe(4001);
    // Unauthorized
    expect(getErrorCode({ code: 4100 })).toBe(4100);
    // Invalid params
    expect(getErrorCode({ code: -32602 })).toBe(-32602);
  });
});

// ============================================================================
// isInternalRpcError tests (extended)
// ============================================================================

describe("isInternalRpcError", () => {
  describe("detects by error code", () => {
    it("detects error code -32603 at top level", () => {
      expect(isInternalRpcError({ code: -32603 })).toBe(true);
    });

    it("detects error code -32603 in cause", () => {
      expect(isInternalRpcError({ cause: { code: -32603 } })).toBe(true);
    });

    it("does NOT detect other error codes", () => {
      expect(isInternalRpcError({ code: -32000 })).toBe(false);
      expect(isInternalRpcError({ code: 4001 })).toBe(false);
      expect(isInternalRpcError({ code: -32602 })).toBe(false);
    });
  });

  describe("detects by message content", () => {
    it("detects 'internal error' (case insensitive)", () => {
      expect(isInternalRpcError(new Error("An internal error was received"))).toBe(true);
      expect(isInternalRpcError(new Error("INTERNAL ERROR occurred"))).toBe(true);
    });

    it("detects 'internalrpcerror'", () => {
      expect(isInternalRpcError(new Error("InternalRpcError: something"))).toBe(true);
    });

    it("detects 'could not coalesce'", () => {
      expect(isInternalRpcError(new Error("could not coalesce error"))).toBe(true);
    });

    it("detects 'missing or invalid parameters'", () => {
      expect(isInternalRpcError(new Error("missing or invalid parameters"))).toBe(true);
    });
  });

  describe("does NOT detect non-RPC errors", () => {
    it("does not detect user rejection", () => {
      expect(isInternalRpcError(new Error("User rejected the request"))).toBe(false);
      expect(isInternalRpcError({ code: 4001, message: "User rejected" })).toBe(false);
    });

    it("does not detect insufficient funds", () => {
      expect(isInternalRpcError(new Error("Insufficient funds"))).toBe(false);
    });

    it("does not detect contract errors", () => {
      expect(isInternalRpcError(new Error("InsufficientSharesAvailable"))).toBe(false);
      expect(isInternalRpcError(new Error("Expired"))).toBe(false);
    });

    it("does not detect generic errors", () => {
      expect(isInternalRpcError(new Error("Something went wrong"))).toBe(false);
      expect(isInternalRpcError({})).toBe(false);
    });
  });

  describe("handles realistic error shapes", () => {
    it("handles viem TransactionExecutionError with internal error", () => {
      const error = {
        name: "TransactionExecutionError",
        shortMessage: "An internal error was received.",
        cause: {
          code: -32603,
          message: "Internal JSON-RPC error.",
        },
      };
      expect(isInternalRpcError(error)).toBe(true);
    });

    it("handles ethers internal error", () => {
      const error = {
        code: "CALL_EXCEPTION",
        message: "could not coalesce error",
        reason: null,
      };
      expect(isInternalRpcError(error)).toBe(true);
    });
  });
});

// ============================================================================
// RPC_INTERNAL_ERROR_MESSAGE constant
// ============================================================================

describe("RPC_INTERNAL_ERROR_MESSAGE", () => {
  it("provides a user-friendly message for RPC errors", () => {
    expect(RPC_INTERNAL_ERROR_MESSAGE).toBe(
      "RPC/provider error. Please retry or switch RPC."
    );
  });
});
