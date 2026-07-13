import { describe, expect, it, vi } from "vitest";
import {
  pollPrerequisiteBalance,
  synchronizePrerequisiteBalance,
} from "@/lib/prerequisite-balance";
import {
  createTransactionOperationController,
  TransactionOperationCancelledError,
} from "@/lib/transaction-operation";

describe("prerequisite balance polling", () => {
  it("rethrows cancellation from the final balance read", async () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const operation = controller.begin();
    let resolveBalance!: (balance: bigint) => void;
    let markReadStarted!: () => void;
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    const balanceRead = new Promise<bigint>((resolve) => {
      resolveBalance = resolve;
    });

    const polling = pollPrerequisiteBalance({
      initialBalance: 0n,
      minimumBalance: 1n,
      attempts: 1,
      delayMs: 0,
      sleep: async () => {},
      readBalance: async () => {
        markReadStarted();
        return balanceRead;
      },
      assertTransactionActive: operation?.assertActive,
    });

    await readStarted;
    controller.setOpen(false);
    resolveBalance(0n);

    await expect(polling).rejects.toThrow(TransactionOperationCancelledError);
  });

  it("tolerates transient reads and returns a later replicated balance", async () => {
    let reads = 0;
    const balance = await pollPrerequisiteBalance({
      initialBalance: 0n,
      minimumBalance: 5n,
      attempts: 2,
      delayMs: 0,
      sleep: async () => {},
      readBalance: async () => {
        reads += 1;
        if (reads === 1) throw new Error("replica unavailable");
        return 5n;
      },
    });

    expect(balance).toBe(5n);
    expect(reads).toBe(2);
  });

  it("mirrors a producer receipt and waits for a stale consuming RPC balance", async () => {
    const hash = `0x${"1".repeat(64)}` as const;
    const waitForReceipt = vi.fn().mockResolvedValue({ status: "success" });
    const readBalance = vi
      .fn<() => Promise<bigint>>()
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(399_000_000n);

    await expect(
      synchronizePrerequisiteBalance({
        prerequisiteTxHashes: [hash],
        waitForReceipt,
        minimumBalance: 399_000_000n,
        readBalance,
        sleep: async () => undefined,
      }),
    ).resolves.toBe(399_000_000n);

    expect(waitForReceipt).toHaveBeenCalledWith(hash);
    expect(readBalance).toHaveBeenCalledTimes(2);
  });

  it("turns an ordinary deferred receipt failure into cancellation after close", async () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const operation = controller.begin();
    let rejectReceipt!: (error: Error) => void;
    const waitForReceipt = vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          rejectReceipt = reject;
        }),
    );
    const readBalance = vi.fn().mockResolvedValue(10n);

    const synchronization = synchronizePrerequisiteBalance({
      prerequisiteTxHashes: [`0x${"2".repeat(64)}`],
      waitForReceipt,
      minimumBalance: 10n,
      readBalance,
      assertTransactionActive: operation?.assertActive,
      sleep: async () => undefined,
    });

    controller.setOpen(false);
    rejectReceipt(new Error("ordinary RPC timeout"));

    await expect(synchronization).rejects.toThrow(
      TransactionOperationCancelledError,
    );
    expect(readBalance).not.toHaveBeenCalled();
  });
});
