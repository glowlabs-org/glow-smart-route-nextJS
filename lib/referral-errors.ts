export type ReferralErrorType =
  | "signature_rejected"
  | "signature_mismatch"
  | "wrong_chain"
  | "signature_expired"
  | "smart_wallet"
  | "network_error"
  | "invalid_code"
  | "self_referral"
  | "unknown";

export interface ParsedReferralError {
  type: ReferralErrorType;
  message: string;
  isUserRejection: boolean;
  isValidationError: boolean;
}

export function parseReferralError(error: unknown): ParsedReferralError {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const message = rawMessage || "Something went wrong";
  const lower = message.toLowerCase();

  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    (error as { code?: number })?.code === 4001
  ) {
    return {
      type: "signature_rejected",
      message: "Signature request was rejected.",
      isUserRejection: true,
      isValidationError: false,
    };
  }

  if (lower.includes("invalid referral code")) {
    return {
      type: "invalid_code",
      message,
      isUserRejection: false,
      isValidationError: true,
    };
  }

  if (lower.includes("cannot refer yourself")) {
    return {
      type: "self_referral",
      message,
      isUserRejection: false,
      isValidationError: true,
    };
  }

  if (
    lower.includes("signer_mismatch") ||
    lower.includes("signer mismatch") ||
    lower.includes("signature does not match the wallet address")
  ) {
    return {
      type: "signature_mismatch",
      message:
        "Signature did not match the connected wallet. If you recently switched accounts, reconnect and try again.",
      isUserRejection: false,
      isValidationError: false,
    };
  }

  if (
    lower.includes("domain_chain_mismatch") ||
    (lower.includes("different chain") && lower.includes("signature")) ||
    lower.includes("active chainid is different than the one provided") ||
    lower.includes("please switch your wallet to chain")
  ) {
    return {
      type: "wrong_chain",
      message:
        "Wrong network. Please switch your wallet to the Glow network and try again.",
      isUserRejection: false,
      isValidationError: false,
    };
  }

  if (lower.includes("deadline") && lower.includes("expired")) {
    return {
      type: "signature_expired",
      message: "Signature request expired. Please try again.",
      isUserRejection: false,
      isValidationError: false,
    };
  }

  if (
    lower.includes("smart wallet") ||
    lower.includes("erc-1271") ||
    lower.includes("erc1271") ||
    lower.includes("isvalidsignature")
  ) {
    return {
      type: "smart_wallet",
      message:
        "Smart wallet signature verification failed. Please try again or reconnect your wallet.",
      isUserRejection: false,
      isValidationError: false,
    };
  }

  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timeout") ||
    lower.includes("connection")
  ) {
    return {
      type: "network_error",
      message: "Network error while processing referral. Please try again.",
      isUserRejection: false,
      isValidationError: false,
    };
  }

  return {
    type: "unknown",
    message,
    isUserRejection: false,
    isValidationError: false,
  };
}
