export type ReferralErrorType =
  | "signature_rejected"
  | "signature_mismatch"
  | "wrong_chain"
  | "signature_expired"
  | "smart_wallet"
  | "network_error"
  | "unknown";

export interface ParsedReferralError {
  type: ReferralErrorType;
  message: string;
  isUserRejection: boolean;
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
    };
  }

  if (
    lower.includes("domain_chain_mismatch") ||
    (lower.includes("different chain") && lower.includes("signature"))
  ) {
    return {
      type: "wrong_chain",
      message:
        "Signature was produced on a different network. Please switch wallet network and try again.",
      isUserRejection: false,
    };
  }

  if (lower.includes("deadline") && lower.includes("expired")) {
    return {
      type: "signature_expired",
      message: "Signature request expired. Please try again.",
      isUserRejection: false,
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
    };
  }

  return {
    type: "unknown",
    message,
    isUserRejection: false,
  };
}
