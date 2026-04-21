import {
  getGctlDialogErrorMessage,
  GCTL_CONFIRMATION_DELAYED_MESSAGE,
  GCTL_RPC_INTERNAL_ERROR_MESSAGE,
  RPC_RATE_LIMIT_MESSAGE,
} from "../lib/gctl-dialog-error-message";

describe("getGctlDialogErrorMessage", () => {
  it("surfaces a clear wallet RPC rate-limit message for nested provider errors", () => {
    const error = new Error(
      'missing revert data (action="call", data=null, reason=null, code=CALL_EXCEPTION)'
    ) as Error & {
      cause?: unknown;
    };

    error.cause = {
      code: -32005,
      message: "Request is being rate limited.",
      data: {
        httpStatus: 429,
        cause: null,
      },
    };

    expect(getGctlDialogErrorMessage(error)).toBe(RPC_RATE_LIMIT_MESSAGE);
  });

  it("preserves the existing insufficient balance guidance", () => {
    expect(
      getGctlDialogErrorMessage(
        new Error("ERC20: transfer amount exceeds balance")
      )
    ).toContain("Insufficient token balance");
  });

  it("maps user rejections to the wallet rejection message", () => {
    expect(
      getGctlDialogErrorMessage(new Error("User rejected the request"))
    ).toBe("Transaction was rejected in your wallet.");
  });

  it("maps generic TransactionExecutionError to the RPC/provider guidance", () => {
    expect(
      getGctlDialogErrorMessage(new Error("TransactionExecutionError"))
    ).toBe(GCTL_RPC_INTERNAL_ERROR_MESSAGE);
  });

  it("maps nested viem internal RPC errors to the RPC/provider guidance", () => {
    const error = {
      name: "TransactionExecutionError",
      shortMessage: "An internal error was received.",
      cause: {
        code: -32603,
        message: "Internal JSON-RPC error.",
      },
    };

    expect(getGctlDialogErrorMessage(error)).toBe(
      GCTL_RPC_INTERNAL_ERROR_MESSAGE
    );
  });

  it("surfaces a non-scary message when receipt polling timed out but the tx is likely on-chain", () => {
    expect(
      getGctlDialogErrorMessage(
        new Error("Transaction receipt not found within 60000ms")
      )
    ).toBe(GCTL_CONFIRMATION_DELAYED_MESSAGE);
  });
});
