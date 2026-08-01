import * as Sentry from "@sentry/nextjs";

interface SwapDialogQuote {
  amount_in_uni: bigint;
  amount_in_glow_bonding_curve: bigint;
  amount_out_uni: string;
  amount_out_glow: string;
}

export interface SwapDialogFailureContext {
  error: unknown;
  fallbackMessage: string;
  sellToken: string;
  buyToken: string;
  failedStep: string | null;
  amountToSell: string;
  /** Null when the failure happened before the reviewed floor was computed. */
  reviewedMinimumOut: bigint | null;
  slippageBps: bigint;
  quote: SwapDialogQuote | undefined;
}

// A wallet rejection is the user changing their mind, not a defect. Matches the
// filtering `app/buy/swap-interface.tsx` already applies to its own captures,
// but case-insensitively: the dialogs surface both "User rejected" (viem) and
// "user rejected" (wallet-provided) spellings.
export function isUserRejectedSwapError(
  error: unknown,
  message: string,
): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return true;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("user rejected") || normalized.includes("user denied")
  );
}

/**
 * Report a failure from one of the swap dialogs. These dialogs own the whole
 * multi-leg GLW route and previously swallowed every throw into local UI state,
 * so route-level defects (a guard rejecting a quote, a leg failing between
 * signatures) were invisible in Sentry no matter how many users hit them.
 *
 * bigints are stringified: Sentry serialises `extra` as JSON, which throws on a
 * raw bigint and would drop the whole event.
 */
export function captureSwapDialogFailure({
  error,
  fallbackMessage,
  sellToken,
  buyToken,
  failedStep,
  amountToSell,
  reviewedMinimumOut,
  slippageBps,
  quote,
}: SwapDialogFailureContext): void {
  if (typeof window === "undefined") return;

  const errorMessage =
    (error as { message?: unknown } | null)?.message != null
      ? String((error as { message?: unknown }).message)
      : fallbackMessage;

  if (isUserRejectedSwapError(error, errorMessage)) return;

  const normalizedError =
    error instanceof Error ? error : new Error(errorMessage);

  Sentry.captureException(normalizedError, {
    tags: {
      swapStage: "dialog_execute",
      sellToken,
      buyToken,
      failedStep: failedStep ?? "none",
    },
    extra: {
      amountToSell,
      errorMessage,
      errorCode: (error as { code?: unknown } | null)?.code,
      errorReason: (error as { reason?: unknown } | null)?.reason,
      slippageBps: slippageBps.toString(),
      reviewedMinimumOut: reviewedMinimumOut?.toString() ?? null,
      // The route legs are what the minimum-out guards compare against, so
      // they are the first thing worth seeing on a guard rejection.
      quotedAmountInUni: quote?.amount_in_uni.toString(),
      quotedAmountInBonding: quote?.amount_in_glow_bonding_curve.toString(),
      quotedAmountOutUni: quote?.amount_out_uni,
      quotedAmountOutBonding: quote?.amount_out_glow,
    },
  });
}
