"use client";

import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import { AlertCircle } from "lucide-react";
import { BeamsBackground } from "@/components/ui/beam-background";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { GlowSymbol } from "./glow-symbol";

export function Loading() {
  return (
    <div className="min-h-screen bg-background relative">
      <Image
        src="/images/sections/beam.png"
        alt="Background"
        fill
        className="object-cover dark:hidden"
      />
      <div className="h-screen flex flex-col items-center justify-center relative z-10 gap-4">
        <GlowSymbolAnimated className="w-32 h-32 md:w-40 md:h-40 text-foreground" />
        <h1 className="glow-headline text-2xl lg:text-4xl xl:text-5xl text-foreground">
          Loading...
        </h1>
        <p className="glow-body text-foreground/60 text-lg lg:text-xl xl:text-2xl">
          This may take a few seconds.
        </p>
      </div>
    </div>
  );
}

export function Error({ message }: { message: string }) {
  return (
    <BeamsBackground intensity="medium">
      <div className="h-screen flex flex-col items-center justify-center relative z-10 gap-4">
        <div className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center">
          <GlowSymbol className="size-24 text-foreground" />
        </div>

        <h1 className="glow-headline text-2xl lg:text-4xl xl:text-5xl text-foreground">
          Unable to Load Data
        </h1>

        <p className="glow-body text-foreground/60 text-lg lg:text-xl xl:text-2xl text-center max-w-md">
          {message}
        </p>

        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    </BeamsBackground>
  );
}
