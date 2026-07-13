import { describe, expect, it } from "vitest";
import { isDeterministicAllowanceResetError } from "@/lib/erc20-approval";

describe("allowance reset errors", () => {
  it("recognizes deterministic non-zero allowance reverts", () => {
    expect(
      isDeterministicAllowanceResetError(
        new Error("ERC20: approve from non-zero to non-zero allowance"),
      ),
    ).toBe(true);
    expect(
      isDeterministicAllowanceResetError(
        new Error("Token requires the allowance to be reset to zero"),
      ),
    ).toBe(true);
  });

  it("does not treat ambiguous transport failures as reset instructions", () => {
    expect(
      isDeterministicAllowanceResetError(
        new Error("connection reset by peer"),
      ),
    ).toBe(false);
    expect(
      isDeterministicAllowanceResetError({
        name: "TransactionExecutionError",
        message: "Wallet interaction timed out",
      }),
    ).toBe(false);
    expect(
      isDeterministicAllowanceResetError(
        new Error("allowance must be at least 1000000"),
      ),
    ).toBe(false);
    expect(
      isDeterministicAllowanceResetError(
        new Error("allowance must be greater than 0"),
      ),
    ).toBe(false);
    expect(
      isDeterministicAllowanceResetError(
        Object.assign(new Error("Wallet interaction timed out"), {
          cause: new Error("approve from non-zero to non-zero allowance"),
        }),
      ),
    ).toBe(false);
    expect(
      isDeterministicAllowanceResetError(
        Object.assign(new Error("Internal JSON-RPC error"), {
          code: -32603,
          cause: new Error("Token requires the allowance to be reset to zero"),
        }),
      ),
    ).toBe(false);
    for (const message of [
      "Connection failed",
      "Connection refused",
      "Connection lost",
    ]) {
      expect(
        isDeterministicAllowanceResetError(
          Object.assign(new Error(message), {
            cause: new Error("approve from non-zero to non-zero allowance"),
          }),
        ),
      ).toBe(false);
    }
    expect(
      isDeterministicAllowanceResetError(
        Object.assign(new Error("Provider request failed"), {
          code: -32005,
          cause: new Error("approve from non-zero to non-zero allowance"),
        }),
      ),
    ).toBe(false);
    expect(
      isDeterministicAllowanceResetError(
        Object.assign(new Error("Wallet provider error"), {
          error: { code: 4001, message: "User rejected the request" },
          cause: new Error("Token requires the allowance reset to zero"),
        }),
      ),
    ).toBe(false);
    expect(
      isDeterministicAllowanceResetError({
        message: "Request failed",
        body: JSON.stringify({
          error: { code: -32005, message: "Rate limit exceeded" },
        }),
        cause: new Error("approve from non-zero to non-zero allowance"),
      }),
    ).toBe(false);
    expect(
      isDeterministicAllowanceResetError({
        message: "Request failed",
        info: {
          payload: { method: "eth_sendTransaction" },
          response: { status: "503", statusText: "Service Unavailable" },
        },
        cause: new Error("approve from non-zero to non-zero allowance"),
      }),
    ).toBe(false);
    for (const error of [
      {
        message: "Request failed",
        data: { httpStatus: 429 },
      },
      {
        message: "Request failed",
        response: { statusCode: "503" },
      },
      {
        message: "Provider request failed",
      },
      {
        message: JSON.stringify({ error: { code: -32005 } }),
      },
    ]) {
      expect(
        isDeterministicAllowanceResetError({
          ...error,
          cause: new Error("approve from non-zero to non-zero allowance"),
        }),
      ).toBe(false);
    }
    for (const status of [400, 401, 403]) {
      const cyclic: Record<string, unknown> = {
        message: "HTTP request failed",
        httpStatus: status,
        cause: new Error("Token requires the allowance to be reset to zero"),
      };
      cyclic.error = cyclic;
      expect(isDeterministicAllowanceResetError(cyclic)).toBe(false);
    }
  });
});
