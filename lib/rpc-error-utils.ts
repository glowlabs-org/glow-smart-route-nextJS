export const WALLET_INTERACTION_TIMEOUT_MESSAGE =
  "Wallet response timed out. The request may still be queued. Open your wallet or tap its account button; do not submit this transaction again.";
export const INSUFFICIENT_GAS_ERROR_MESSAGE =
  "Insufficient ETH for gas. Add more ETH to your wallet and try again.";
export const NONCE_TOO_LOW_ERROR_MESSAGE =
  "A previous transaction is still pending in your wallet. Wait for it to confirm before trying again.";
export const GENERIC_SWAP_FAILURE_MESSAGE =
  "Transaction failed. This could be due to insufficient liquidity, slippage tolerance exceeded, or contract revert. Please try again with a smaller amount or adjust your slippage tolerance.";
export const SLIPPAGE_EXCEEDED_ERROR_MESSAGE =
  "Slippage tolerance exceeded. Refresh the quote and try again, or increase slippage tolerance.";
export const APPROVAL_NOT_VISIBLE_ERROR_MESSAGE =
  "Your token approval has not reached the network yet. Wait a few seconds and try again.";
export const TRANSFER_FROM_FAILED_ERROR_MESSAGE =
  "The swap could not move your tokens. Check that your balance and token approval both cover this amount, then try again.";

export function getRpcErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  const anyError = error as any;
  return (
    anyError?.cause?.message ||
    anyError?.cause?.data?.message ||
    anyError?.data?.message ||
    anyError?.error?.message ||
    anyError?.shortMessage ||
    anyError?.message ||
    "Unknown error"
  );
}

function extractRevertReason(message: string): string | null {
  const patterns = [
    /reverted with the following reason:\s*([^\n]+)/i,
    /execution reverted with reason:\s*([^\n]+)/i,
    /details:\s*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const reason = match?.[1]?.trim();
    if (reason) return reason;
  }

  return null;
}

export function getReadableRpcErrorMessage(
  error: unknown,
  defaultMessage = "Unknown error"
): string {
  let message = defaultMessage;

  if (typeof error === "string") {
    message = error;
  } else {
    const anyError = error as any;
    if (typeof anyError?.reason === "string" && anyError.reason.trim()) {
      message = anyError.reason;
    } else {
      const extracted = getRpcErrorMessage(error);
      if (extracted && extracted !== "Unknown error") {
        message = extracted;
      }
    }
  }

  if (isWalletInteractionTimeoutError(error) || isWalletInteractionTimeoutError(message)) {
    return WALLET_INTERACTION_TIMEOUT_MESSAGE;
  }

  return extractRevertReason(message) ?? message;
}

export function getRpcErrorCode(error: unknown): number | undefined {
  const anyError = error as any;
  const code = anyError?.cause?.code ?? anyError?.code;
  return typeof code === "number" ? code : undefined;
}

export function isWalletInteractionTimeoutError(error: unknown): boolean {
  const queue: unknown[] = [error];
  const seen = new Set<object>();
  let inspected = 0;

  while (queue.length && inspected < 20) {
    const current = queue.shift();
    inspected += 1;
    if (typeof current === "string") {
      const message = current.toLowerCase();
      if (
        message.includes("interaction timeout") ||
        message.includes("wallet response timed out")
      ) {
        return true;
      }
      continue;
    }
    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }
    seen.add(current);

    const candidate = current as Record<string, unknown>;
    if (
      candidate.code === "WALLET_RESPONSE_TIMEOUT" ||
      candidate.name === "WalletResponseTimeoutError"
    ) {
      return true;
    }
    queue.push(
      candidate.message,
      candidate.shortMessage,
      candidate.cause,
      candidate.error,
      candidate.data,
    );
  }

  return false;
}

export function isInsufficientGasError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error.toLowerCase()
      : getReadableRpcErrorMessage(error).toLowerCase();

  return (
    message.includes("gas required exceeds allowance") ||
    message.includes("insufficient funds for gas") ||
    message.includes("insufficient funds for intrinsic transaction cost") ||
    message.includes("cannot afford txn gas")
  );
}

export function isNonceTooLowError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name?.toLowerCase() ?? "";
  if (name === "noncetoolowerror") return true;

  const message =
    typeof error === "string"
      ? error.toLowerCase()
      : getReadableRpcErrorMessage(error).toLowerCase();

  return (
    message.includes("nonce too low") ||
    message.includes("nonce is too low") ||
    /\bnonce=\d+\s+minnonce=\d+/i.test(message)
  );
}

/**
 * Uniswap V2's TransferHelper wraps `transferFrom`; it reverts with this when
 * the router cannot pull the input token, meaning balance or allowance.
 *
 * Walks the cause chain because viem nests the node's revert reason several
 * levels below the top-level ContractFunctionExecutionError.
 */
export function isTransferFromFailedError(error: unknown): boolean {
  if (typeof error === "string") return /TRANSFER_FROM_FAILED/i.test(error);

  const queue: unknown[] = [error];
  const seen = new Set<object>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);

    const candidate = current as Record<string, unknown>;
    for (const key of ["shortMessage", "message", "details", "reason"]) {
      const value = candidate[key];
      if (typeof value === "string" && /TRANSFER_FROM_FAILED/i.test(value)) {
        return true;
      }
    }
    queue.push(candidate.cause, candidate.error);
  }
  return false;
}

export function normalizeSwapFailureMessage(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();

  if (isInsufficientGasError(errorMessage)) {
    return INSUFFICIENT_GAS_ERROR_MESSAGE;
  }

  if (
    normalized.includes("user rejected") ||
    normalized.includes("user denied") ||
    normalized.includes("transaction canceled") ||
    normalized.includes("request rejected")
  ) {
    return "Transaction was rejected";
  }

  if (
    normalized.includes("insufficient balance") ||
    normalized.includes("transfer amount exceeds balance")
  ) {
    return "Insufficient balance";
  }

  if (normalized.includes("insufficient liquidity")) {
    return "Insufficient liquidity for this swap. Try a smaller amount.";
  }

  if (
    normalized.includes("insufficient_output_amount") ||
    normalized.includes("excessive_input_amount")
  ) {
    return SLIPPAGE_EXCEEDED_ERROR_MESSAGE;
  }

  // Uniswap's TransferHelper reverts with this when the router cannot pull the
  // input token, which means balance or allowance. Callers that can read those
  // two values say which one; this is the net for everyone else, because the
  // raw revert string tells a user nothing they can act on.
  if (normalized.includes("transfer_from_failed")) {
    return TRANSFER_FROM_FAILED_ERROR_MESSAGE;
  }

  if (
    normalized.includes("failed to get amount out") ||
    normalized.includes("missing revert data") ||
    normalized === "execution reverted" ||
    normalized === "revert"
  ) {
    return GENERIC_SWAP_FAILURE_MESSAGE;
  }

  return errorMessage;
}

export function isInternalRpcError(error: unknown): boolean {
  const message = getRpcErrorMessage(error).toLowerCase();
  const code = getRpcErrorCode(error);
  const name = (error as { name?: string } | null)?.name?.toLowerCase() ?? "";
  return (
    code === -32603 ||
    message.includes("internal error") ||
    message.includes("internalrpcerror") ||
    message.includes("an internal error was received") ||
    message.includes("unknown rpc error") ||
    message.includes("could not coalesce") ||
    message.includes("missing or invalid parameters") ||
    name === "transactionexecutionerror" ||
    isWalletInteractionTimeoutError(error)
  );
}

export async function withInternalRpcRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    onRetry?: (attempt: number) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 1;
  const delayMs = options.delayMs ?? 1500;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt >= maxRetries;
      // Insufficient-gas and nonce-too-low are deterministic; viem reports
      // them inside a TransactionExecutionError so isInternalRpcError() would
      // otherwise loop on them.
      const isDeterministic =
        isInsufficientGasError(error) ||
        isNonceTooLowError(error) ||
        isWalletInteractionTimeoutError(error);
      if (isLastAttempt || isDeterministic || !isInternalRpcError(error)) {
        throw error;
      }
      options.onRetry?.(attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Retry loop exited unexpectedly");
}
