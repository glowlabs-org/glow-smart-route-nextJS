/**
 * Tests for RPC retry logic in deposit-dialog.tsx
 *
 * Run with: pnpm vitest run app/marketplace/__tests__/rpc-retry.test.ts
 */

import { describe, it, expect, vi } from "vitest";

// ============================================================================
// Helper functions (copied from deposit-dialog.tsx for isolated testing)
// ============================================================================

function getErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error && error.message) return error.message;
  const anyError = error as any;
  return (
    anyError?.cause?.message ||
    anyError?.cause?.data?.message ||
    anyError?.data?.message ||
    anyError?.error?.message ||
    anyError?.shortMessage ||
    anyError?.message ||
    "Unknown error"
  );
}

function getErrorCode(error: unknown): number | undefined {
  const anyError = error as any;
  const code = anyError?.cause?.code ?? anyError?.code;
  return typeof code === "number" ? code : undefined;
}

function isInternalRpcError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = getErrorCode(error);
  return (
    code === -32603 ||
    message.includes("internal error") ||
    message.includes("internalrpcerror") ||
    message.includes("could not coalesce") ||
    message.includes("missing or invalid parameters")
  );
}

async function withInternalRpcRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    onRetry?: (attempt: number) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 1;
  const delayMs = options.delayMs ?? 1500;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt >= maxRetries;
      if (isLastAttempt || !isInternalRpcError(error)) {
        throw error;
      }
      options.onRetry?.(attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Retry loop exited unexpectedly");
}

// ============================================================================
// Tests
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

  it("extracts message from cause.data.message", () => {
    const error = { cause: { data: { message: "Deep nested message" } } };
    expect(getErrorMessage(error)).toBe("Deep nested message");
  });

  it("extracts shortMessage (viem style)", () => {
    const error = { shortMessage: "Short viem message" };
    expect(getErrorMessage(error)).toBe("Short viem message");
  });
});

describe("getErrorCode", () => {
  it("returns undefined for errors without code", () => {
    expect(getErrorCode(new Error("No code"))).toBeUndefined();
    expect(getErrorCode({})).toBeUndefined();
  });

  it("extracts code from top level", () => {
    expect(getErrorCode({ code: -32603 })).toBe(-32603);
  });

  it("extracts code from cause", () => {
    expect(getErrorCode({ cause: { code: -32000 } })).toBe(-32000);
  });

  it("prefers cause code over top level", () => {
    expect(getErrorCode({ code: 1, cause: { code: -32603 } })).toBe(-32603);
  });
});

describe("isInternalRpcError", () => {
  it("detects error code -32603", () => {
    expect(isInternalRpcError({ code: -32603 })).toBe(true);
    expect(isInternalRpcError({ cause: { code: -32603 } })).toBe(true);
  });

  it("detects 'internal error' in message", () => {
    expect(
      isInternalRpcError(new Error("An internal error was received"))
    ).toBe(true);
  });

  it("detects 'internalrpcerror' in message", () => {
    expect(
      isInternalRpcError(new Error("InternalRpcError: something went wrong"))
    ).toBe(true);
  });

  it("detects 'could not coalesce' in message", () => {
    expect(isInternalRpcError(new Error("could not coalesce error"))).toBe(
      true
    );
  });

  it("does NOT detect unrelated errors", () => {
    expect(isInternalRpcError(new Error("User rejected"))).toBe(false);
    expect(isInternalRpcError(new Error("Insufficient funds"))).toBe(false);
    expect(isInternalRpcError({ code: -32000 })).toBe(false);
  });
});

describe("withInternalRpcRetry", () => {
  it("returns result on success (no retry needed)", async () => {
    const result = await withInternalRpcRetry(async () => "success", {
      delayMs: 1,
    });
    expect(result).toBe("success");
  });

  it("retries on internal RPC error and succeeds", async () => {
    let attempts = 0;
    const result = await withInternalRpcRetry(
      async () => {
        attempts++;
        if (attempts === 1) {
          throw { code: -32603, message: "Internal error" };
        }
        return "success after retry";
      },
      { maxRetries: 1, delayMs: 1 }
    );
    expect(attempts).toBe(2);
    expect(result).toBe("success after retry");
  });

  it("calls onRetry callback with attempt number", async () => {
    const onRetry = vi.fn();
    let attempts = 0;

    await withInternalRpcRetry(
      async () => {
        attempts++;
        if (attempts <= 2) {
          throw new Error("Internal error occurred");
        }
        return "done";
      },
      {
        maxRetries: 2,
        delayMs: 1,
        onRetry,
      }
    );

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2);
  });

  it("throws immediately for non-RPC errors", async () => {
    let attempts = 0;

    await expect(
      withInternalRpcRetry(
        async () => {
          attempts++;
          throw new Error("User rejected the request");
        },
        { maxRetries: 3, delayMs: 1 }
      )
    ).rejects.toThrow("User rejected the request");

    expect(attempts).toBe(1);
  });

  it("throws after max retries exhausted", async () => {
    let attempts = 0;

    await expect(
      withInternalRpcRetry(
        async () => {
          attempts++;
          throw { code: -32603, message: "Persistent internal error" };
        },
        { maxRetries: 2, delayMs: 1 }
      )
    ).rejects.toMatchObject({ code: -32603 });

    expect(attempts).toBe(3);
  });

  it("respects custom maxRetries", async () => {
    let attempts = 0;

    try {
      await withInternalRpcRetry(
        async () => {
          attempts++;
          throw new Error("Internal error");
        },
        { maxRetries: 5, delayMs: 1 }
      );
    } catch {
      // expected
    }

    expect(attempts).toBe(6);
  });
});

describe("Integration: simulated buyFractions flow", () => {
  it("simulates successful purchase after RPC retry", async () => {
    let rpcCallCount = 0;
    const onRetry = vi.fn();

    const mockBuyFractions = async () => {
      rpcCallCount++;
      if (rpcCallCount === 1) {
        const error = new Error(
          "TransactionExecutionError: An internal error was received."
        );
        (error as any).code = -32603;
        throw error;
      }
      return "0x1234567890abcdef";
    };

    const txHash = await withInternalRpcRetry(mockBuyFractions, {
      maxRetries: 1,
      delayMs: 10,
      onRetry,
    });

    expect(txHash).toBe("0x1234567890abcdef");
    expect(rpcCallCount).toBe(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1);
  });

  it("simulates failed purchase (max retries exceeded)", async () => {
    let rpcCallCount = 0;

    const mockBuyFractions = async () => {
      rpcCallCount++;
      throw { code: -32603, message: "Persistent RPC failure" };
    };

    await expect(
      withInternalRpcRetry(mockBuyFractions, {
        maxRetries: 1,
        delayMs: 1,
      })
    ).rejects.toMatchObject({ code: -32603 });

    expect(rpcCallCount).toBe(2);
  });

  it("does not retry on contract errors", async () => {
    let rpcCallCount = 0;

    const mockBuyFractions = async () => {
      rpcCallCount++;
      const error = new Error("InsufficientSharesAvailable");
      (error as any).cause = {
        data: { errorName: "InsufficientSharesAvailable" },
      };
      throw error;
    };

    await expect(
      withInternalRpcRetry(mockBuyFractions, {
        maxRetries: 3,
        delayMs: 1,
      })
    ).rejects.toThrow("InsufficientSharesAvailable");

    expect(rpcCallCount).toBe(1);
  });
});
