// Error types for ToS acceptance UX and retry behavior.
export type TosErrorType =
  | "smart_wallet"
  | "signature_mismatch"
  | "deadline_expired"
  | "deadline_invalid"
  | "signature_rejected"
  | "already_pending"
  | "network_error"
  | "wrong_network"
  | "unknown";

// Detects EIP-1193 -32002 "Request already pending" responses, which surface
// when a previous wallet popup hasn't been resolved yet. Re-firing a signature
// in this state spawns a duplicate request that the wallet rejects.
export function isAlreadyPendingError(error: unknown): boolean {
  const err = error as {
    code?: string | number;
    message?: string;
    error?: { code?: string | number; message?: string };
    cause?: { code?: string | number; message?: string };
  } | null;
  if (!err) return false;

  const codes = [err.code, err.error?.code, err.cause?.code];
  if (codes.some((c) => c === -32002 || c === "-32002")) return true;

  const messages = [err.message, err.error?.message, err.cause?.message]
    .filter((m): m is string => typeof m === "string")
    .map((m) => m.toLowerCase());
  return messages.some((m) => m.includes("already pending"));
}

// Detects "user rejected" wallet errors across providers (MetaMask 4001,
// Phantom, Coinbase, etc). Used to skip the personal_sign fallback when the
// user actively dismissed the EIP-712 prompt — retrying just opens a second
// popup they'll dismiss again.
export function isUserRejectedError(error: unknown): boolean {
  const err = error as {
    code?: string | number;
    message?: string;
    error?: { code?: string | number; message?: string };
    cause?: { code?: string | number; message?: string };
  } | null;
  if (!err) return false;

  const codes = [err.code, err.error?.code, err.cause?.code];
  if (codes.some((c) => c === 4001 || c === "4001" || c === "ACTION_REJECTED"))
    return true;

  const messages = [err.message, err.error?.message, err.cause?.message]
    .filter((m): m is string => typeof m === "string")
    .map((m) => m.toLowerCase());
  return messages.some(
    (m) =>
      m.includes("user rejected") ||
      m.includes("user denied") ||
      m.includes("user reject this request") ||
      m.includes("rejected the request")
  );
}

// Whether to fall back from EIP-712 to personal_sign when signTypedData throws
// at the wallet layer. Only true when the wallet itself can't handle EIP-712
// (unsupported method). For pending-request or user-rejected errors, retrying
// would just spawn another popup — surface the error instead.
export function shouldFallbackToPersonalSign(error: unknown): boolean {
  if (isAlreadyPendingError(error)) return false;
  if (isUserRejectedError(error)) return false;
  return true;
}

export interface TosError {
  type: TosErrorType;
  title: string;
  message: string;
  suggestion: string;
  canRetry: boolean;
}

// Parse backend/API error messages into structured ToS errors.
export function parseTosApiError(error: unknown): TosError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Wallet has a previous request still pending (EIP-1193 -32002).
  // Detected first because "already pending" can also match the generic
  // network heuristic below.
  if (isAlreadyPendingError(error) || lowerMessage.includes("already pending")) {
    return {
      type: "already_pending",
      title: "Wallet Request Pending",
      message:
        "Your wallet has a previous request waiting for approval.",
      suggestion:
        "Open your wallet, approve or dismiss the pending request, then try again.",
      canRetry: true,
    };
  }

  // Smart wallet specific errors
  if (
    lowerMessage.includes("smart wallet") ||
    lowerMessage.includes("erc-1271") ||
    lowerMessage.includes("erc1271") ||
    lowerMessage.includes("isvalidsignature")
  ) {
    return {
      type: "smart_wallet",
      title: "Smart Wallet Signature Issue",
      message: "Your smart wallet couldn't verify the signature.",
      suggestion:
        "This can happen with some smart wallets (Safe, Coinbase Smart Wallet, etc.). Try signing again, or use a regular wallet if the issue persists.",
      canRetry: true,
    };
  }

  // Deadline expired
  if (lowerMessage.includes("deadline") && lowerMessage.includes("expired")) {
    return {
      type: "deadline_expired",
      title: "Signature Expired",
      message: "The signature request timed out.",
      suggestion:
        "Please try signing again. Make sure to complete the signing process promptly.",
      canRetry: true,
    };
  }

  // Deadline in milliseconds (developer error)
  if (lowerMessage.includes("deadline") && lowerMessage.includes("milliseconds")) {
    return {
      type: "deadline_invalid",
      title: "Invalid Signature Request",
      message: "There was a technical issue with the signature request.",
      suggestion: "Please try again. If the issue persists, try refreshing the page.",
      canRetry: true,
    };
  }

  // Deadline too far in future
  if (lowerMessage.includes("deadline") && lowerMessage.includes("too far")) {
    return {
      type: "deadline_invalid",
      title: "Invalid Signature Request",
      message: "The signature deadline was set too far in the future.",
      suggestion: "Please try again. If the issue persists, try refreshing the page.",
      canRetry: true,
    };
  }

  // User rejected
  if (
    lowerMessage.includes("user rejected") ||
    lowerMessage.includes("user denied") ||
    lowerMessage.includes("rejected the request")
  ) {
    return {
      type: "signature_rejected",
      title: "Signature Rejected",
      message: "You declined to sign the message in your wallet.",
      suggestion:
        "Click 'Sign & Accept' and approve the signature request in your wallet to continue.",
      canRetry: true,
    };
  }

  // Signer mismatch
  if (
    lowerMessage.includes("signer_mismatch") ||
    lowerMessage.includes("signer mismatch") ||
    lowerMessage.includes("signature does not match the wallet address")
  ) {
    return {
      type: "signature_mismatch",
      title: "Signature Verification Failed",
      message: "The signature doesn't match your wallet address.",
      suggestion:
        "Please sign again. If you recently switched accounts, disconnect and reconnect your wallet first.",
      canRetry: true,
    };
  }

  // Network errors
  if (
    lowerMessage.includes("network") ||
    lowerMessage.includes("fetch") ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("connection")
  ) {
    return {
      type: "network_error",
      title: "Connection Error",
      message: "Couldn't connect to the server.",
      suggestion: "Please check your internet connection and try again.",
      canRetry: true,
    };
  }

  // Unknown error
  return {
    type: "unknown",
    title: "Something Went Wrong",
    message: errorMessage || "An unexpected error occurred.",
    suggestion:
      "Please try again. If the problem persists, try refreshing the page or using a different browser.",
    canRetry: true,
  };
}

export function shouldRetryTosWithPersonalSign(
  signingMethod: "eip712" | "personal_sign",
  errorType: TosErrorType
): boolean {
  return (
    signingMethod === "eip712" &&
    (errorType === "smart_wallet" || errorType === "signature_mismatch")
  );
}
