"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center">
        <div className="text-center px-6 py-4">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          {error?.digest ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Error digest: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            className="mt-4 inline-flex items-center rounded-md bg-foreground px-4 py-2 text-background hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
