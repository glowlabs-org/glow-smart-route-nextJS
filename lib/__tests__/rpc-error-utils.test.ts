import { describe, expect, it, vi } from "vitest";
import {
  getRpcErrorCode,
  getRpcErrorMessage,
  isInternalRpcError,
  isWalletInteractionTimeoutError,
  withInternalRpcRetry,
} from "../rpc-error-utils";

describe("rpc-error-utils", () => {
  it("extracts nested RPC messages", () => {
    expect(
      getRpcErrorMessage({ cause: { data: { message: "Deep nested message" } } })
    ).toBe("Deep nested message");
  });

  it("extracts nested error codes", () => {
    expect(getRpcErrorCode({ cause: { code: -32603 } })).toBe(-32603);
  });

  it("detects wallet interaction timeout errors", () => {
    const error = new Error(
      "The contract function reverted with the following reason: Error: Interaction timeout"
    );
    expect(isWalletInteractionTimeoutError(error)).toBe(true);
    expect(isInternalRpcError(error)).toBe(true);
  });

  it("does not classify user rejection as an internal RPC error", () => {
    expect(isInternalRpcError(new Error("User rejected the request"))).toBe(
      false
    );
  });

  it("retries once on wallet interaction timeout", async () => {
    let attempts = 0;
    const onRetry = vi.fn();

    const result = await withInternalRpcRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error(
            "The contract function reverted with the following reason: Error: Interaction timeout"
          );
        }
        return "ok";
      },
      { maxRetries: 1, delayMs: 1, onRetry }
    );

    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledWith(1);
  });
});
