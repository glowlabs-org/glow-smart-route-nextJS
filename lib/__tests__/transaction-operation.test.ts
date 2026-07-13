import { describe, expect, it } from "vitest";
import {
  createTransactionOperationController,
  getTransactionOperationCancellation,
  isTransactionOperationCancelled,
  TransactionOperationCancelledError,
} from "@/lib/transaction-operation";

describe("transaction operation controller", () => {
  it("locks synchronously and invalidates an operation when its UI closes", () => {
    const controller = createTransactionOperationController(true);
    controller.activate();

    const operation = controller.begin();
    expect(operation).not.toBeNull();
    expect(controller.begin()).toBeNull();
    expect(() => operation?.assertActive()).not.toThrow();

    controller.setOpen(false);
    expect(() => operation?.assertActive()).toThrow(
      TransactionOperationCancelledError,
    );
  });

  it("keeps old operations invalid after the UI reopens", () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const firstOperation = controller.begin();

    controller.setOpen(false);
    controller.setOpen(true);
    const secondOperation = controller.begin();

    expect(secondOperation).not.toBeNull();
    expect(() => firstOperation?.assertActive()).toThrow(
      TransactionOperationCancelledError,
    );
    expect(() => secondOperation?.assertActive()).not.toThrow();
  });

  it("invalidates an operation on unmount", () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const operation = controller.begin();

    controller.dispose();

    expect(() => operation?.assertActive()).toThrow(
      TransactionOperationCancelledError,
    );
    expect(controller.begin()).toBeNull();
  });

  it("recognizes cancellation wrapped by a transaction helper", () => {
    const cancellation = new TransactionOperationCancelledError();
    const wrapped = new Error("wrapped", { cause: cancellation });

    expect(isTransactionOperationCancelled(wrapped)).toBe(true);
    expect(isTransactionOperationCancelled(new Error("other"))).toBe(false);
  });

  it("can explicitly release a completed operation", () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const operation = controller.begin();

    expect(operation?.finish()).toBe(true);
    expect(operation?.finish()).toBe(false);
    expect(controller.begin()).not.toBeNull();
  });

  it("replaces an older latest-only operation synchronously", () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const staleOperation = controller.beginLatest();
    const currentOperation = controller.beginLatest();

    expect(() => staleOperation?.assertActive()).toThrow(
      TransactionOperationCancelledError,
    );
    expect(() => currentOperation?.assertActive()).not.toThrow();
    expect(staleOperation?.finish()).toBe(false);
    expect(currentOperation?.finish()).toBe(true);
  });

  it("does not let a stale operation release a newer one", () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const staleOperation = controller.begin();

    controller.setOpen(false);
    controller.setOpen(true);
    const currentOperation = controller.begin();

    expect(staleOperation?.finish()).toBe(false);
    expect(controller.begin()).toBeNull();
    expect(currentOperation?.finish()).toBe(true);
  });

  it("rejects a stale continuation that resolves after close and reopen", async () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const staleOperation = controller.begin();
    let resolvePrecheck!: () => void;
    const precheck = new Promise<void>((resolve) => {
      resolvePrecheck = resolve;
    });
    const staleContinuation = (async () => {
      await precheck;
      staleOperation?.assertActive();
      return "wallet-write";
    })();

    controller.setOpen(false);
    controller.setOpen(true);
    const currentOperation = controller.begin();
    resolvePrecheck();

    await expect(staleContinuation).rejects.toThrow(
      TransactionOperationCancelledError,
    );
    expect(() => currentOperation?.assertActive()).not.toThrow();
  });

  it("blocks stale error handling when an ordinary rejection arrives after reopen", async () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const staleOperation = controller.begin();
    let rejectRead!: (error: Error) => void;
    const read = new Promise<never>((_resolve, reject) => {
      rejectRead = reject;
    });
    const mutations: string[] = [];
    const staleContinuation = (async () => {
      try {
        await read;
      } catch (error) {
        const cancellation = getTransactionOperationCancellation(
          error,
          staleOperation?.assertActive,
        );
        if (cancellation) throw cancellation;
        mutations.push("ERROR", "Sentry");
      }
    })();

    controller.setOpen(false);
    controller.setOpen(true);
    const currentOperation = controller.begin();
    rejectRead(new Error("ordinary provider failure"));

    await expect(staleContinuation).rejects.toThrow(
      TransactionOperationCancelledError,
    );
    expect(mutations).toEqual([]);
    expect(() => currentOperation?.assertActive()).not.toThrow();
  });

  it("blocks stale error handling when an ordinary rejection arrives after unmount", async () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const operation = controller.begin();
    controller.dispose();

    const cancellation = getTransactionOperationCancellation(
      new Error("ordinary timeout"),
      operation?.assertActive,
    );

    expect(isTransactionOperationCancelled(cancellation)).toBe(true);
  });

  it("blocks stale hash and progress mutations after a deferred wallet write", async () => {
    const controller = createTransactionOperationController(true);
    controller.activate();
    const staleOperation = controller.begin();
    let resolveWalletWrite!: (hash: `0x${string}`) => void;
    const walletWrite = new Promise<`0x${string}`>((resolve) => {
      resolveWalletWrite = resolve;
    });
    const mutations: string[] = [];
    const staleContinuation = (async () => {
      const hash = await walletWrite;
      staleOperation?.assertActive();
      mutations.push(hash, "confirming");
    })();

    controller.setOpen(false);
    controller.setOpen(true);
    const currentOperation = controller.begin();
    resolveWalletWrite(`0x${"1".repeat(64)}`);

    await expect(staleContinuation).rejects.toThrow(
      TransactionOperationCancelledError,
    );
    expect(mutations).toEqual([]);
    expect(() => currentOperation?.assertActive()).not.toThrow();
  });

  it("can reactivate after a development-mode effect cleanup", () => {
    const controller = createTransactionOperationController(true);
    controller.activate(true);
    controller.dispose();
    controller.activate(true);

    expect(controller.begin()).not.toBeNull();
  });
});
