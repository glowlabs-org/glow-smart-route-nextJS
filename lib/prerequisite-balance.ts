import {
  isTransactionOperationCancelled,
  type AssertTransactionActive,
} from "@/lib/transaction-operation";
import type { Hash } from "viem";

interface PollPrerequisiteBalanceParams {
  initialBalance: bigint;
  minimumBalance: bigint;
  readBalance: () => Promise<bigint>;
  assertTransactionActive?: AssertTransactionActive;
  attempts?: number;
  delayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
}

interface SynchronizePrerequisiteBalanceParams
  extends Omit<PollPrerequisiteBalanceParams, "initialBalance"> {
  prerequisiteTxHashes: readonly Hash[];
  waitForReceipt: (hash: Hash) => Promise<unknown>;
}

const sleepFor = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

/**
 * Polls through read-after-write replica lag without ever converting an
 * operation cancellation into an ordinary insufficient-balance result.
 */
export async function pollPrerequisiteBalance({
  initialBalance,
  minimumBalance,
  readBalance,
  assertTransactionActive,
  attempts = 8,
  delayMs = 1000,
  sleep = sleepFor,
}: PollPrerequisiteBalanceParams): Promise<bigint> {
  let balance = initialBalance;

  for (let attempt = 0; attempt < attempts && balance < minimumBalance; attempt++) {
    assertTransactionActive?.();
    await sleep(delayMs);
    assertTransactionActive?.();
    try {
      balance = await readBalance();
      assertTransactionActive?.();
    } catch (error) {
      if (isTransactionOperationCancelled(error)) throw error;
      // Ignore only a transient read error. A cancellation that happened at
      // the same time is surfaced by this immediate generation check.
      assertTransactionActive?.();
    }
  }

  assertTransactionActive?.();
  return balance;
}

/**
 * Makes a just-produced token balance visible on the exact RPC/client that
 * will perform the consuming allowance and simulation reads. Receipt waits
 * are advisory; the bounded balance poll is the final source of truth.
 */
export async function synchronizePrerequisiteBalance({
  prerequisiteTxHashes,
  waitForReceipt,
  minimumBalance,
  readBalance,
  assertTransactionActive,
  attempts,
  delayMs,
  sleep,
}: SynchronizePrerequisiteBalanceParams): Promise<bigint> {
  for (const hash of prerequisiteTxHashes) {
    assertTransactionActive?.();
    try {
      await waitForReceipt(hash);
      assertTransactionActive?.();
    } catch (error) {
      if (isTransactionOperationCancelled(error)) throw error;
      // Some RPCs fail the explicit receipt wait while already serving the
      // updated token state. Continue only if this order is still current.
      assertTransactionActive?.();
    }
  }

  let initialBalance = 0n;
  try {
    initialBalance = await readBalance();
    assertTransactionActive?.();
  } catch (error) {
    if (isTransactionOperationCancelled(error)) throw error;
    // Treat an ordinary first-read failure like replica lag, but never let it
    // hide a close/reopen or unmount while the read was pending.
    assertTransactionActive?.();
  }

  return pollPrerequisiteBalance({
    initialBalance,
    minimumBalance,
    readBalance,
    assertTransactionActive,
    attempts,
    delayMs,
    sleep,
  });
}
