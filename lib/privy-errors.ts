import * as Sentry from "@sentry/nextjs";

// Privy's onError callbacks fire for every failure path including benign
// "user closed the modal" / "user rejected in wallet" cases. Capturing those
// to Sentry creates noise that drowns out real bugs. This helper filters
// the cancellation cases and downgrades remaining failures to warning so
// they're visible without paging anyone.

const BENIGN_PRIVY_ERROR_CODES = new Set([
  "user_rejected_connection_request",
  "user_rejected_request",
  "user_exited_login_flow",
  "user_exited_auth_flow",
  "exited_auth_flow",
  "exited_link_flow",
  "must_be_authenticated",
]);

function getPrivyErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "privyErrorCode" in error &&
    typeof (error as { privyErrorCode?: unknown }).privyErrorCode === "string"
  ) {
    return (error as { privyErrorCode: string }).privyErrorCode;
  }
  return String(error);
}

export function capturePrivyWalletError(
  error: unknown,
  stage: "connect" | "card_buy_login" | "fund_wallet"
): void {
  const code = getPrivyErrorCode(error);
  if (BENIGN_PRIVY_ERROR_CODES.has(code)) return;

  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    scope.setTag("walletStage", stage);
    scope.setTag("privyErrorCode", code);
    Sentry.captureException(new Error(String(error)));
  });
}
