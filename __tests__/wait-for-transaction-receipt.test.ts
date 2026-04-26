import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Hash, PublicClient, TransactionReceipt } from "viem";
import {
  DelayedConfirmationError,
  waitForTransactionReceipt,
} from "@/lib/wait-for-transaction-receipt";

const TX_HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as Hash;

type ReceiptFn = (args: { hash: Hash }) => Promise<TransactionReceipt | null>;
type TxFn = (args: { hash: Hash }) => Promise<{ blockNumber: bigint | null } | null>;

function makeClient(opts: {
  getTransactionReceipt: ReceiptFn;
  getTransaction?: TxFn;
}): PublicClient {
  return {
    getTransactionReceipt: opts.getTransactionReceipt,
    getTransaction:
      opts.getTransaction ??
      (async () => {
        throw new Error("not configured");
      }),
  } as unknown as PublicClient;
}

const successReceipt: TransactionReceipt = {
  status: "success",
  blockNumber: 1n,
  // remaining fields are unused by the helper
} as unknown as TransactionReceipt;

const revertedReceipt: TransactionReceipt = {
  status: "reverted",
  blockNumber: 1n,
} as unknown as TransactionReceipt;

describe("waitForTransactionReceipt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the receipt as soon as the first client surfaces it", async () => {
    const fn = vi.fn(async () => successReceipt);
    const client = makeClient({ getTransactionReceipt: fn });

    const receipt = await waitForTransactionReceipt(TX_HASH, {
      clients: [client],
      timeoutMs: 60_000,
      pollIntervalMs: 1_000,
    });

    expect(receipt).toBe(successReceipt);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("falls through to the second client when the first returns null", async () => {
    const first = vi.fn(async () => null);
    const second = vi.fn(async () => successReceipt);

    const promise = waitForTransactionReceipt(TX_HASH, {
      clients: [
        makeClient({ getTransactionReceipt: first }),
        makeClient({ getTransactionReceipt: second }),
      ],
      timeoutMs: 60_000,
      pollIntervalMs: 1_000,
    });

    const receipt = await promise;
    expect(receipt).toBe(successReceipt);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("falls through to the second client when the first throws (TransactionReceiptNotFound)", async () => {
    const first = vi.fn(async () => {
      throw Object.assign(new Error("Transaction with hash ... could not be found"), {
        name: "TransactionReceiptNotFoundError",
      });
    });
    const second = vi.fn(async () => successReceipt);

    const receipt = await waitForTransactionReceipt(TX_HASH, {
      clients: [
        makeClient({ getTransactionReceipt: first }),
        makeClient({ getTransactionReceipt: second }),
      ],
      timeoutMs: 60_000,
      pollIntervalMs: 1_000,
    });

    expect(receipt).toBe(successReceipt);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("throws when receipt status is reverted", async () => {
    const fn = vi.fn(async () => revertedReceipt);
    const client = makeClient({ getTransactionReceipt: fn });

    await expect(
      waitForTransactionReceipt(TX_HASH, {
        clients: [client],
        timeoutMs: 60_000,
        pollIntervalMs: 1_000,
      })
    ).rejects.toThrow(/was reverted on-chain/);
  });

  it("throws DelayedConfirmationError carrying txHash when no client ever surfaces the receipt", async () => {
    const receiptFn = vi.fn(async () => null);
    const txFn = vi.fn(async () => null);
    const client = makeClient({
      getTransactionReceipt: receiptFn,
      getTransaction: txFn,
    });

    const promise = waitForTransactionReceipt(TX_HASH, {
      clients: [client],
      timeoutMs: 5_000,
      pollIntervalMs: 1_000,
    });
    // Attach a no-op rejection handler immediately so the failure surfaces
    // through `caught` below rather than as an unhandled rejection while we
    // pump fake timers.
    const caught = promise.catch((error: unknown) => error);

    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(1_000);
    }

    const error = await caught;
    expect(error).toBeInstanceOf(DelayedConfirmationError);
    expect(error).toMatchObject({
      name: "DelayedConfirmationError",
      txHash: TX_HASH,
    });
  });

  it("recovers via final getTransaction check when the tx is mined but the receipt isn't visible", async () => {
    let receiptCallCount = 0;
    const receiptFn = vi.fn(async () => {
      receiptCallCount++;
      // First polling pass: no receipt anywhere. Second pass (after the
      // final getTransaction confirms it's mined): return the success receipt.
      if (receiptCallCount <= 2) return null;
      return successReceipt;
    });
    const txFn = vi.fn(async () => ({ blockNumber: 42n }));
    const client = makeClient({
      getTransactionReceipt: receiptFn,
      getTransaction: txFn,
    });

    const promise = waitForTransactionReceipt(TX_HASH, {
      clients: [client],
      timeoutMs: 2_000,
      pollIntervalMs: 1_000,
    });

    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(1_000);
    }

    const receipt = await promise;
    expect(receipt).toBe(successReceipt);
    expect(txFn).toHaveBeenCalled();
  });

  it("throws when called with no clients configured", async () => {
    await expect(
      waitForTransactionReceipt(TX_HASH, {
        clients: [],
        timeoutMs: 1_000,
      })
    ).rejects.toThrow(/no polling clients configured/);
  });
});
