"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LifetimeFarms } from "../stats/lifetime-farms";
import { MiningStats } from "./mining-stats";

export default function InternalView() {
  return (
    <div className="min-h-screen bg-background">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-8">
        <div className="flex flex-col gap-8">
          {/* Quick Links */}
          <div className="flex flex-wrap gap-4">
            <Link
              href="/internal/referral"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 transition-colors text-sm font-medium"
            >
              Referral Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/internal/points"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 transition-colors text-sm font-medium"
            >
              Points Grants
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/internal/gctl-mint"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 transition-colors text-sm font-medium"
            >
              POL GCTL Mint
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/internal/sim"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 transition-colors text-sm font-medium"
            >
              Simulator
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/internal/toolbox"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 transition-colors text-sm font-medium"
            >
              Toolbox
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <MiningStats />
        </div>
      </section>
    </div>
  );
}
