"use client";

import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import { AlertCircle } from "lucide-react";
import { BeamsBackground } from "@/components/ui/beam-background";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { GlowSymbol } from "./glow-symbol";
import { useLang } from "@/lib/i18n";

export function Loading() {
  const { t } = useLang();
  const ls = t.common.loadingState;
  return (
    <div className="min-h-screen bg-background relative">
      <Image
        src="/images/sections/beam.png"
        alt={ls.backgroundAlt}
        fill
        className="object-cover dark:hidden"
      />
      <div className="h-screen flex flex-col items-center justify-center relative z-10 gap-4">
        <GlowSymbolAnimated className="w-32 h-32 md:w-40 md:h-40 text-foreground" />
        <h1 className="glow-headline text-2xl lg:text-4xl xl:text-5xl text-foreground">
          {ls.loading}
        </h1>
        <p className="glow-body text-foreground/60 text-lg lg:text-xl xl:text-2xl">
          {ls.mayTakeFewSeconds}
        </p>
      </div>
    </div>
  );
}

export function Error({ message }: { message: string }) {
  const { t } = useLang();
  const ls = t.common.loadingState;
  return (
    <BeamsBackground intensity="medium">
      <div className="h-screen flex flex-col items-center justify-center relative z-10 gap-4">
        <div className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center">
          <GlowSymbol className="size-24 text-foreground" />
        </div>

        <h1 className="glow-headline text-2xl lg:text-4xl xl:text-5xl text-foreground">
          {ls.unableToLoad}
        </h1>

        <p className="glow-body text-foreground/60 text-lg lg:text-xl xl:text-2xl text-center max-w-md">
          {message}
        </p>

        <Button onClick={() => window.location.reload()}>{ls.tryAgain}</Button>
      </div>
    </BeamsBackground>
  );
}
