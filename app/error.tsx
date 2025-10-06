"use client"; // Error components must be Client Components

import { GlowSymbol } from "@/components/glow-symbol";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen justify-center items-center flex-col">
      <GlowSymbol className="size-16 mb-2 mx-auto" />
      <h2>Something went wrong!</h2>
      <Button
        className="mt-4 w-44"
        variant={"default"}
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </Button>
    </div>
  );
}
