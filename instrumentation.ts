import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next/dist/server/instrumentation/types";

export async function register() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors thrown from nested React Server Components and other request-level hooks
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  errorContext
) => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  // Next.js throws this from app-page.runtime when a client sends a
  // malformed Next-Router-State-Tree header — almost always a stale client
  // bundle hitting a newer deploy (we saw 6 events appear right after the
  // 15.4.8 → 16.2.6 upgrade). The framework falls back to a full re-render,
  // so the user is unaffected; capturing it just buries real errors.
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (/router state header .* could not be parsed/i.test(message)) {
    return;
  }

  Sentry.captureRequestError(error, request, errorContext);
};
