"use client";

import { GlowSymbol } from "@/components/glow-symbol";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    if (typeof window !== "undefined") {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="flex h-screen justify-center items-center flex-col">
      <GlowSymbol className="size-16 mb-2 mx-auto" />
      <h2>Something went wrong!</h2>
      <Button className="mt-4 w-44" variant={"default"} onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
