import { describe, expect, it, vi } from "vitest";
import {
  extractControlTransferTrackingId,
  pollControlTransferConfirmation,
} from "../deposit-dialog-utils";

describe("extractControlTransferTrackingId", () => {
  it("extracts tracking ids from known response shapes", () => {
    expect(extractControlTransferTrackingId("tx-1")).toBe("tx-1");
    expect(extractControlTransferTrackingId({ txHash: "tx-2" })).toBe("tx-2");
    expect(extractControlTransferTrackingId({ transferId: "tx-3" })).toBe(
      "tx-3"
    );
    expect(extractControlTransferTrackingId({ operationId: "tx-4" })).toBe(
      "tx-4"
    );
    expect(extractControlTransferTrackingId({ id: "tx-5" })).toBe("tx-5");
  });

  it("returns null for missing tracking ids", () => {
    expect(extractControlTransferTrackingId(null)).toBeNull();
    expect(extractControlTransferTrackingId({})).toBeNull();
  });
});

describe("pollControlTransferConfirmation", () => {
  it("waits until the transfer is confirmed", async () => {
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "confirmed" });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await pollControlTransferConfirmation({
      poll,
      sleep,
      delayMs: 1,
      maxAttempts: 3,
    });

    expect(result.status).toBe("confirmed");
    expect(poll).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("keeps polling through retriable fetch errors until confirmed", async () => {
    const poll = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "confirmed" });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await pollControlTransferConfirmation({
      poll,
      sleep,
      delayMs: 1,
      maxAttempts: 3,
    });

    expect(result.status).toBe("confirmed");
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it("retries when Control has not indexed the transfer record yet", async () => {
    const poll = vi
      .fn()
      .mockRejectedValueOnce(new Error("Transfer not found"))
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "confirmed" });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await pollControlTransferConfirmation({
      poll,
      sleep,
      delayMs: 1,
      maxAttempts: 3,
    });

    expect(result.status).toBe("confirmed");
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it("throws the Control failure message when the transfer fails", async () => {
    await expect(
      pollControlTransferConfirmation({
        poll: async () => ({
          status: "failed",
          errorMessage: "Transfer rejected",
        }),
        sleep: async () => undefined,
        delayMs: 1,
        maxAttempts: 1,
      })
    ).rejects.toThrow("Transfer rejected");
  });
});
