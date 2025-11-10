"use client";

import { MiningView } from "../stats/rewards/mining-view";

export default function InternalView() {
  return (
    <div className="min-h-screen bg-background">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-20">
        <div className="flex flex-col gap-8">
          <header className="border border-border/60 bg-muted/20 rounded-2xl p-6 md:p-8">
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Internal: Mining Performance Overview
              </h1>
              <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                Detailed farm performance metrics and comparison across all active farms in the network.
              </p>
            </div>
          </header>

          <MiningView />
        </div>
      </section>
    </div>
  );
}
