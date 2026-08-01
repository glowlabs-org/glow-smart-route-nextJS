import { beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

import {
  captureSwapDialogFailure,
  isUserRejectedSwapError,
} from "@/lib/swap-error-reporting";

const baseContext = {
  fallbackMessage: "Transaction failed",
  sellToken: "USDC",
  buyToken: "GLOW",
  failedStep: "SWAP_USDG_TO_GLOW_UNISWAP",
  amountToSell: "100",
  reviewedMinimumOut: 3_289_826_670_034_148_000_000n,
  slippageBps: 100n,
  quote: {
    amount_in_uni: 100_000_000n,
    amount_in_glow_bonding_curve: 0n,
    amount_out_uni: "3323.057242660755946417",
    amount_out_glow: "0",
  },
};

describe("isUserRejectedSwapError", () => {
  it("matches wallet rejection codes", () => {
    expect(isUserRejectedSwapError({ code: 4001 }, "boom")).toBe(true);
    expect(isUserRejectedSwapError({ code: "ACTION_REJECTED" }, "boom")).toBe(
      true,
    );
  });

  it("matches both spellings the dialogs surface", () => {
    expect(isUserRejectedSwapError({}, "User rejected the request")).toBe(true);
    expect(isUserRejectedSwapError({}, "user rejected the request")).toBe(true);
    expect(isUserRejectedSwapError({}, "User denied transaction")).toBe(true);
  });

  it("does not swallow real failures", () => {
    expect(
      isUserRejectedSwapError(
        {},
        "This route cannot guarantee the minimum amount you reviewed.",
      ),
    ).toBe(false);
  });
});

describe("captureSwapDialogFailure", () => {
  beforeEach(() => {
    captureException.mockClear();
  });

  it("reports the guard rejection with the route legs attached", () => {
    captureSwapDialogFailure({
      ...baseContext,
      error: new Error(
        "This route cannot guarantee the minimum amount you reviewed.",
      ),
    });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [reported, options] = captureException.mock.calls[0] as [
      Error,
      { tags: Record<string, string>; extra: Record<string, unknown> },
    ];

    expect(reported.message).toContain("cannot guarantee the minimum");
    expect(options.tags).toMatchObject({
      swapStage: "dialog_execute",
      sellToken: "USDC",
      buyToken: "GLOW",
      failedStep: "SWAP_USDG_TO_GLOW_UNISWAP",
    });
    expect(options.extra.quotedAmountOutUni).toBe(
      "3323.057242660755946417",
    );
    expect(options.extra.reviewedMinimumOut).toBe(
      "3289826670034148000000",
    );
  });

  it("stringifies every bigint so the event survives JSON serialisation", () => {
    captureSwapDialogFailure({ ...baseContext, error: new Error("boom") });

    const [, options] = captureException.mock.calls[0] as [
      Error,
      { extra: Record<string, unknown> },
    ];
    expect(() => JSON.stringify(options.extra)).not.toThrow();
    for (const value of Object.values(options.extra)) {
      expect(typeof value).not.toBe("bigint");
    }
  });

  it("tolerates a failure that happened before the floor was computed", () => {
    captureSwapDialogFailure({
      ...baseContext,
      reviewedMinimumOut: null,
      quote: undefined,
      failedStep: null,
      error: new Error("boom"),
    });

    const [, options] = captureException.mock.calls[0] as [
      Error,
      { tags: Record<string, string>; extra: Record<string, unknown> },
    ];
    expect(options.tags.failedStep).toBe("none");
    expect(options.extra.reviewedMinimumOut).toBeNull();
    expect(options.extra.quotedAmountOutUni).toBeUndefined();
  });

  it("stays quiet when the user rejects in their wallet", () => {
    captureSwapDialogFailure({
      ...baseContext,
      error: Object.assign(new Error("User rejected the request"), {
        code: 4001,
      }),
    });

    expect(captureException).not.toHaveBeenCalled();
  });
});
