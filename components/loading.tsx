"use client";

import { motion } from "framer-motion";
import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import { AlertCircle } from "lucide-react";
import { BeamsBackground } from "@/components/ui/beam-background";

export function Loading() {
  return (
    <BeamsBackground intensity="medium">
      <div className="h-screen flex flex-col items-center justify-center relative z-10 gap-4">
        <GlowSymbolAnimated className="w-32 h-32 md:w-40 md:h-40 text-white" />
        <h1 className="glow-headline text-2xl lg:text-4xl xl:text-5xl text-white">
          Loading...
        </h1>
        <p className="glow-body text-white/60 text-lg lg:text-xl xl:text-2xl">
          This may take a few seconds.
        </p>
      </div>
    </BeamsBackground>
  );
}

export function Error({ message }: { message: string }) {
  return (
    <BeamsBackground intensity="medium">
      <div className="h-screen flex flex-col items-center justify-center relative z-10 gap-4">
        <div className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center">
          <AlertCircle className="w-16 h-16 md:w-20 md:h-20 text-white" />
        </div>

        <h1 className="glow-headline text-2xl lg:text-4xl xl:text-5xl text-white">
          Unable to Load Data
        </h1>

        <p className="glow-body text-white/60 text-lg lg:text-xl xl:text-2xl text-center max-w-md">
          {message}
        </p>

        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors glow-cta"
        >
          Try Again
        </button>
      </div>
    </BeamsBackground>
  );
}
