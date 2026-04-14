import { isInternalRpcError } from "@/lib/rpc-error-utils";

const RPC_RATE_LIMIT_MESSAGE =
  "Your wallet's RPC provider is being rate limited, so the app can't verify your balance or allowance right now. Switch to a different RPC endpoint in your wallet, or wait a moment and try again.";
export const GCTL_RPC_INTERNAL_ERROR_MESSAGE =
  "RPC/provider error. Please retry or switch RPC.";

function collectErrorStrings(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0
): string[] {
  if (value == null || depth > 5) return [];
  if (typeof value === "string") return [value];
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectErrorStrings(entry, seen, depth + 1));
  }

  if (typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const errorLike = value as Record<string, unknown>;
  const directFields = [
    "shortMessage",
    "message",
    "details",
    "reason",
    "code",
    "status",
  ];
  const nestedFields = [
    "cause",
    "data",
    "error",
    "info",
    "metaMessages",
    "originalError",
  ];

  const direct = directFields.flatMap((field) =>
    collectErrorStrings(errorLike[field], seen, depth + 1)
  );
  const nested = nestedFields.flatMap((field) =>
    collectErrorStrings(errorLike[field], seen, depth + 1)
  );

  return [...direct, ...nested];
}

function isInsufficientBalanceError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("0xe450d38c") ||
    normalized.includes("erc20: transfer amount exceeds balance") ||
    normalized.includes("transfer amount exceeds balance") ||
    normalized.includes("insufficient balance")
  );
}

function isRpcRateLimitError(error: unknown) {
  const normalized = collectErrorStrings(error).join("\n").toLowerCase();
  return (
    normalized.includes("request is being rate limited") ||
    normalized.includes("monthly capacity limit exceeded") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit exceeded") ||
    normalized.includes("rate limited") ||
    normalized.includes("-32005")
  );
}

function extractPrimaryMessage(error: unknown) {
  const messages = collectErrorStrings(error)
    .map((message) => message.trim())
    .filter(Boolean);
  return messages[0] ?? "";
}

export function getGctlDialogErrorMessage(error: unknown) {
  if (isRpcRateLimitError(error)) {
    return RPC_RATE_LIMIT_MESSAGE;
  }

  const message = extractPrimaryMessage(error);
  if (!message) return "Unknown error";
  const normalizedMessage = message.toLowerCase();

  if (isInsufficientBalanceError(message)) {
    return "Insufficient token balance. Approval succeeded, but your balance is now below this amount. Reduce the amount and try again.";
  }

  if (normalizedMessage.includes("user rejected")) {
    return "Transaction was rejected in your wallet.";
  }

  if (
    isInternalRpcError(error) ||
    normalizedMessage === "transactionexecutionerror" ||
    normalizedMessage === "an internal error was received."
  ) {
    return GCTL_RPC_INTERNAL_ERROR_MESSAGE;
  }

  const detailsMatch = message.match(/details:\s*([^\n]+)/i);
  if (detailsMatch?.[1]) return detailsMatch[1].trim();

  return message;
}

export { RPC_RATE_LIMIT_MESSAGE };
