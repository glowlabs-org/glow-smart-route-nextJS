import type { Hash, PublicClient, TransactionReceipt } from "viem";

// Defer the publicClient import to call-time. Importing it at module load
// pulls in createPublicClient with env-derived RPC URLs, which throws when
// none are configured (e.g. in unit tests that pass `options.clients`
// explicitly and never need the defaults).
async function loadDefaultClients(): Promise<PublicClient[]> {
  const mod = await import("@/web3/web3/clients/publicClient");
  return mod.getReceiptPollingClients();
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

export type WaitForTransactionReceiptOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
  // Inject clients in tests; defaults to per-URL clients from publicClient.
  clients?: PublicClient[];
};

export async function waitForTransactionReceipt(
  txHash: Hash,
  options: WaitForTransactionReceiptOptions = {}
): Promise<TransactionReceipt> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const clients = options.clients ?? (await loadDefaultClients());

  if (clients.length === 0) {
    throw new Error("waitForTransactionReceipt: no polling clients configured");
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Round-robin across every configured RPC each poll cycle. As soon as
    // ANY client returns a non-null receipt we're done.
    const receipt = await tryAllClients(clients, txHash);
    if (receipt) {
      if (receipt.status === "reverted") {
        throw new Error(`Transaction ${txHash} was reverted on-chain`);
      }
      return receipt;
    }
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
    if (receipt) {
      if (receipt.status === "reverted") {
        throw new Error(`Transaction ${txHash} was reverted on-chain`);
      }
      return receipt;
    }
  }

  throw new DelayedConfirmationError(txHash);
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
