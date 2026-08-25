import type { Hash, PublicClient, TransactionReceipt } from "viem";

// Defer the publicClient import to call-time. Importing it at module load
// pulls in createPublicClient with env-derived RPC URLs, which throws when
// none are configured (e.g. in unit tests that pass `options.clients`
// explicitly and never need the defaults).
async function loadDefaultClients(): Promise<PublicClient[]> {
  const mod = await import("@/web3/web3/clients/publicClient");
  return mod.getReceiptPollingClients();
}

// The client callers read from once this resolves. Deferred for the same
// reason as the polling clients above.
async function loadDefaultReadClient(): Promise<PublicClient | null> {
  try {
    const mod = await import("@/web3/web3/clients/publicClient");
    return mod.publicClient as PublicClient;
  } catch {
    return null;
  }
}

// Thrown when polling completes without a confirmed receipt. Carries the
// txHash so the dialog catch can show a "submitted but pending" UX with a
// link to a block explorer instead of a scary failure message. The tx is
// almost certainly on-chain; we just couldn't see it through any of our
// configured RPCs in time.
export class DelayedConfirmationError extends Error {
  readonly txHash: Hash;

  constructor(txHash: Hash, cause?: unknown) {
    super(`Transaction ${txHash} was submitted but confirmation is delayed.`);
    this.name = "DelayedConfirmationError";
    this.txHash = txHash;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

// 10 minutes. Receipts almost always show up inside this window even under
// heavy mainnet congestion or RPC indexing lag. A truly dropped tx is rare
// and waiting longer in the background is preferable to telling a user with
// a confirmed tx that it failed.
const DEFAULT_TIMEOUT_MS = 600_000;
const DEFAULT_POLL_INTERVAL_MS = 4_000;

// Polling round-robins across every configured RPC and returns as soon as ANY
// of them sees the receipt. Callers then read through `publicClient`, whose
// fallback transport stays pinned to the first URL until that URL errors. So
// "confirmed" could mean confirmed on a node the next read never touches, and
// the read comes back pre-transaction: an approval lands, the swap simulate
// still sees allowance 0, and Uniswap reverts TRANSFER_FROM_FAILED
// (APP-GLOW-ORG-FC, 174 events). Hold the receipt until the client callers
// actually read from has the block.
const DEFAULT_READ_CATCH_UP_TIMEOUT_MS = 15_000;
const READ_CATCH_UP_POLL_INTERVAL_MS = 500;

export type WaitForTransactionReceiptOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
  // Inject clients in tests; defaults to per-URL clients from publicClient.
  clients?: PublicClient[];
  // Client to hold the receipt for until it has the receipt's block. Defaults
  // to the shared publicClient; pass null to skip the wait entirely.
  readClient?: PublicClient | null;
  readCatchUpTimeoutMs?: number;
};

export async function waitForTransactionReceipt(
  txHash: Hash,
  options: WaitForTransactionReceiptOptions = {}
): Promise<TransactionReceipt> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const clients = options.clients ?? (await loadDefaultClients());
  const readCatchUpTimeoutMs =
    options.readCatchUpTimeoutMs ?? DEFAULT_READ_CATCH_UP_TIMEOUT_MS;
  const readClient =
    options.readClient === undefined
      ? await loadDefaultReadClient()
      : options.readClient;

  async function settle(receipt: TransactionReceipt) {
    if (receipt.status === "reverted") {
      throw new Error(`Transaction ${txHash} was reverted on-chain`);
    }
    await waitForReadClientBlock(
      readClient,
      receipt.blockNumber,
      readCatchUpTimeoutMs
    );
    return receipt;
  }

  if (clients.length === 0) {
    throw new Error("waitForTransactionReceipt: no polling clients configured");
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Round-robin across every configured RPC each poll cycle. As soon as
    // ANY client returns a non-null receipt we're done.
    const receipt = await tryAllClients(clients, txHash);
    if (receipt) return settle(receipt);
    await sleep(pollIntervalMs);
  }

  // Final check before giving up: ask each RPC whether the tx exists at all.
  // If `getTransaction` returns one with a blockNumber, the tx is mined --
  // the receipt lookup just lagged. Try one more receipt pass; if we still
  // can't see the receipt anywhere, return DelayedConfirmation rather than
  // a hard failure.
  const minedSomewhere = await isMinedAnywhere(clients, txHash);
  if (minedSomewhere) {
    const receipt = await tryAllClients(clients, txHash);
    if (receipt) return settle(receipt);
  }

  throw new DelayedConfirmationError(txHash);
}

/**
 * Blocks until `client` reports a head at or past `blockNumber`.
 *
 * Fails open on timeout or read error: a lagging RPC should delay the caller,
 * never strand a transaction that is already on-chain.
 */
async function waitForReadClientBlock(
  client: PublicClient | null,
  blockNumber: bigint | null,
  timeoutMs: number
): Promise<void> {
  if (!client || blockNumber == null || timeoutMs <= 0) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // cacheTime 0, or viem hands back a head it read before the receipt
      // existed and the wait becomes a no-op.
      const head = await client.getBlockNumber({ cacheTime: 0 });
      if (head >= blockNumber) return;
    } catch {
      return;
    }
    await sleep(READ_CATCH_UP_POLL_INTERVAL_MS);
  }
}

async function tryAllClients(
  clients: PublicClient[],
  txHash: Hash
): Promise<TransactionReceipt | null> {
  for (const client of clients) {
    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash });
      if (receipt) return receipt;
    } catch {
      // viem throws TransactionReceiptNotFoundError when the receipt is not
      // yet visible -- that's the common "still pending" case. Move to the
      // next client; do not give up on the polling loop.
    }
  }
  return null;
}

async function isMinedAnywhere(
  clients: PublicClient[],
  txHash: Hash
): Promise<boolean> {
  for (const client of clients) {
    try {
      const tx = await client.getTransaction({ hash: txHash });
      if (tx?.blockNumber != null) return true;
    } catch {
      // Try next client.
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
