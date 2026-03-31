import { describe, expect, it, vi } from "vitest";
import {
  getRpcErrorCode,
  getRpcErrorMessage,
  getReadableRpcErrorMessage,
  isInternalRpcError,
  isInsufficientGasError,
  isWalletInteractionTimeoutError,
  normalizeSwapFailureMessage,
  withInternalRpcRetry,
} from "../rpc-error-utils";

describe("rpc-error-utils", () => {
  it("returns raw string error messages", () => {
    expect(getRpcErrorMessage("plain string error")).toBe("plain string error");
  });

  it("extracts nested RPC messages", () => {
    expect(
      getRpcErrorMessage({ cause: { data: { message: "Deep nested message" } } })
    ).toBe("Deep nested message");
  });

  it("extracts nested error codes", () => {
    expect(getRpcErrorCode({ cause: { code: -32603 } })).toBe(-32603);
  });

  it("extracts a specific revert reason from viem contract errors", () => {
    const message =
      'The contract function "swapExactTokensForTokens" reverted with the following reason:\n' +
      "gas required exceeds allowance (29743)\n\n" +
      "Details: gas required exceeds allowance (29743)";

    expect(getReadableRpcErrorMessage(new Error(message))).toBe(
      "gas required exceeds allowance (29743)"
    );
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

  it("detects insufficient gas node errors", () => {
    expect(
      isInsufficientGasError(
        new Error("Details: gas required exceeds allowance (29743)")
      )
    ).toBe(true);
    expect(
      normalizeSwapFailureMessage("gas required exceeds allowance (29743)")
    ).toBe("Insufficient ETH for gas. Add more ETH to your wallet and try again.");
  });

  it("keeps specific revert reasons instead of collapsing them into swap boilerplate", () => {
    expect(
      normalizeSwapFailureMessage("gas required exceeds allowance (29743)")
    ).toBe("Insufficient ETH for gas. Add more ETH to your wallet and try again.");
    expect(
      normalizeSwapFailureMessage("Price feed heartbeat exceeded")
    ).toBe("Price feed heartbeat exceeded");
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
