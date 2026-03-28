import {
  getGctlDialogErrorMessage,
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
});
