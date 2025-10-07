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
  Sentry.captureRequestError(error, request, errorContext);
};
