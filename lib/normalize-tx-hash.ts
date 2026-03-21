const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
export const INVALID_WALLET_TX_RESPONSE_MESSAGE =
  "Wallet returned an invalid transaction response. Please reopen your wallet and try again.";

const TX_HASH_CANDIDATE_KEYS = [
  "hash",
  "transactionHash",
  "transaction_hash",
  "txHash",
  "tx_hash",
  "txId",
  "txid",
  "transactionId",
  "transaction_id",
  "result",
  "value",
] as const;
const TX_HASH_CANDIDATE_KEY_SET = new Set<string>(TX_HASH_CANDIDATE_KEYS);
const MAX_HASH_SEARCH_DEPTH = 8;

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && TX_HASH_REGEX.test(value);
}

function isObjectLike(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getErrorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (!record) return "";
  const message = record.message;
  if (typeof message === "string") return message;
  return "";
}

export function isInvalidWalletTxResponseError(value: unknown): boolean {
  const message = getErrorMessage(value);
  if (!message) return false;
  if (/invalid transaction hash/i.test(message)) return true;
  if (
    message.includes("eth_getTransactionReceipt") &&
    message.includes("Invalid params")
  ) {
    return true;
  }
  if (message.includes("invalid type: map, expected 32 bytes")) return true;
  return false;
}

function findPreferredTxHash(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  allowDirectHash: boolean
): `0x${string}` | null {
  if (allowDirectHash && isTxHash(value)) return value;
  if (depth > MAX_HASH_SEARCH_DEPTH || !isObjectLike(value)) return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findPreferredTxHash(
        item,
        seen,
        depth + 1,
        allowDirectHash
      );
      if (candidate) return candidate;
    }
    return null;
  }

  if (value instanceof Map) {
    for (const key of TX_HASH_CANDIDATE_KEYS) {
      if (!value.has(key)) continue;
      const candidate = findPreferredTxHash(
        value.get(key),
        seen,
        depth + 1,
        true
      );
      if (candidate) return candidate;
    }

    for (const nested of value.values()) {
      const candidate = findPreferredTxHash(nested, seen, depth + 1, false);
      if (candidate) return candidate;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(record)) {
    if (!TX_HASH_CANDIDATE_KEY_SET.has(key)) continue;
    const candidate = findPreferredTxHash(nested, seen, depth + 1, true);
    if (candidate) return candidate;
  }

  for (const nested of Object.values(record)) {
    const candidate = findPreferredTxHash(nested, seen, depth + 1, false);
    if (candidate) return candidate;
  }

  return null;
}

function findAnyTxHash(
  value: unknown,
  seen: WeakSet<object>,
  depth: number
): `0x${string}` | null {
  if (isTxHash(value)) return value;
  if (depth > MAX_HASH_SEARCH_DEPTH || !isObjectLike(value)) return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findAnyTxHash(item, seen, depth + 1);
      if (candidate) return candidate;
    }
    return null;
  }

  if (value instanceof Map) {
    for (const nested of value.values()) {
      const candidate = findAnyTxHash(nested, seen, depth + 1);
      if (candidate) return candidate;
    }
    return null;
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    const candidate = findAnyTxHash(nested, seen, depth + 1);
    if (candidate) return candidate;
  }

  return null;
}

export function normalizeTxHash(value: unknown): `0x${string}` {
  const preferredHash = findPreferredTxHash(value, new WeakSet<object>(), 0, true);
  if (preferredHash) return preferredHash;

  const fallbackHash = findAnyTxHash(value, new WeakSet<object>(), 0);
  if (fallbackHash) return fallbackHash;

  throw new Error(INVALID_WALLET_TX_RESPONSE_MESSAGE);
}
