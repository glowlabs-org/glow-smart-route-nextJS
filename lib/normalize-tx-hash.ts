const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
export const INVALID_WALLET_TX_RESPONSE_MESSAGE =
  "Wallet returned an invalid transaction response. Please reopen your wallet and try again.";

const TX_HASH_CANDIDATE_KEYS = [
  "hash",
  "transactionHash",
  "txHash",
  "result",
  "value",
] as const;

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && TX_HASH_REGEX.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
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

export function normalizeTxHash(value: unknown): `0x${string}` {
  if (isTxHash(value)) return value;

  const record = asRecord(value);
  if (record) {
    for (const key of TX_HASH_CANDIDATE_KEYS) {
      const candidate = record[key];
      if (isTxHash(candidate)) return candidate;
    }

    const nestedResult = asRecord(record.result);
    if (nestedResult) {
      for (const key of TX_HASH_CANDIDATE_KEYS) {
        const candidate = nestedResult[key];
        if (isTxHash(candidate)) return candidate;
      }
    }
  }

  throw new Error(INVALID_WALLET_TX_RESPONSE_MESSAGE);
}
