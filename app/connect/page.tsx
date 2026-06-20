import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { ConnectDiscordCard } from "./connect-card";

export const metadata: Metadata = {
  title: "Link Discord",
  description:
    "Connect your Discord account to your Glow wallet to flex your watts and delegated GLW in Discord.",
  robots: { index: false, follow: false },
};

export default function ConnectPage() {
  return (
    <>
      <Header withIsScrolled={true} />
      <div className="min-h-screen bg-background">
        <section className="max-w-md mx-auto px-4 pb-16 pt-12">
          <Suspense
            fallback={
              <div className="h-96 w-full animate-pulse rounded-3xl bg-muted/40" />
            }
          >
            <ConnectDiscordCard />
          </Suspense>
        </section>
      </div>
    </>
  );
}
