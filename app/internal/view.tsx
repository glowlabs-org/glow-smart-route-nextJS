"use client";

import { LifetimeFarms } from "../stats/lifetime-farms";
import { MiningStats } from "./mining-stats";

export default function InternalView() {
  return (
    <div className="min-h-screen bg-background">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-32">
        <div className="flex flex-col gap-8">
          <MiningStats />
          <LifetimeFarms withChart={true} />
        </div>
      </section>
    </div>
  );
}
