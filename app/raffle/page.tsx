import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { RaffleEntry } from "./raffle-entry";

export const metadata: Metadata = {
  title: "Raffle",
  description:
    "Enter the Glow raffle. Open to wallets that have delegated GLW or sGCTL.",
  robots: { index: false, follow: false },
};

export default function RafflePage() {
  return (
    <>
      <Header withIsScrolled={true} />
      <div className="min-h-screen bg-background">
        <section className="max-w-5xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-8">
          <Suspense
            fallback={
              <div className="h-96 w-full animate-pulse rounded-3xl bg-muted/40" />
            }
          >
            <RaffleEntry />
          </Suspense>
        </section>
      </div>
    </>
  );
}
