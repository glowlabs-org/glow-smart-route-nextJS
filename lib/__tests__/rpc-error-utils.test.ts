import { describe, expect, it, vi } from "vitest";
import {
  getRpcErrorCode,
  getRpcErrorMessage,
  getReadableRpcErrorMessage,
  isInternalRpcError,
  isInsufficientGasError,
  isNonceTooLowError,
  isWalletInteractionTimeoutError,
  normalizeSwapFailureMessage,
  SLIPPAGE_EXCEEDED_ERROR_MESSAGE,
  withInternalRpcRetry,
} from "../rpc-error-utils";
import { WalletResponseTimeoutError } from "../wallet-request";

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

    const wrapped = new Error("Contract write failed", {
      cause: new WalletResponseTimeoutError("eth_sendTransaction", "request-1"),
    });
    expect(isWalletInteractionTimeoutError(wrapped)).toBe(true);
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

  it("maps Uniswap output reverts to a slippage-specific message", () => {
    expect(
      normalizeSwapFailureMessage("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT")
    ).toBe(SLIPPAGE_EXCEEDED_ERROR_MESSAGE);
  });

  it("detects nonce too low errors from viem error chain", () => {
    const realSentryMessage =
      'The contract function "claimRewardFromBucket" reverted with the following reason:\n' +
      "nonce=1398 minNonce=1399 txHash=0xdbcbd27493c6ab8c1e8bbd5e4c7b87d339d04380b0116f50b7908353b94efe35: nonce too low\n\n" +
      "Details: nonce=1398 minNonce=1399 txHash=0xdbcbd27493c6ab8c1e8bbd5e4c7b87d339d04380b0116f50b7908353b94efe35: nonce too low";

    expect(isNonceTooLowError(new Error(realSentryMessage))).toBe(true);
    expect(isNonceTooLowError(realSentryMessage)).toBe(true);
    expect(
      isNonceTooLowError(
        Object.assign(new Error("anything"), { name: "NonceTooLowError" })
      )
    ).toBe(true);
    expect(isNonceTooLowError(new Error("Insufficient funds for gas"))).toBe(
      false
    );
  });

  it("never retries a wallet response timeout", async () => {
    const operation = vi.fn(async () => {
      throw new WalletResponseTimeoutError(
        "eth_sendTransaction",
        "request-1",
      );
    });
    const onRetry = vi.fn();

    await expect(
      withInternalRpcRetry(operation, {
        maxRetries: 1,
        delayMs: 1,
        onRetry,
      }),
    ).rejects.toBeInstanceOf(WalletResponseTimeoutError);

    expect(operation).toHaveBeenCalledOnce();
    expect(onRetry).not.toHaveBeenCalled();
  });
});
