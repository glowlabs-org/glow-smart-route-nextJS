import { Header } from "@/components/header";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Simulator",
  description: "Internal simulator tooling.",
  path: "/internal/sim",
  noIndex: true,
});

function getInternalSimUrl() {
  const value = process.env.INTERNAL_SIM_URL?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    return null;
  }
}

export default async function InternalSimPage() {
  const simUrl = getInternalSimUrl();

  return (
    <>
      <Header withIsScrolled={true} />
      <div className="min-h-screen bg-background pt-20">
        {!simUrl ? (
          <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 py-16">
            <div className="rounded-3xl border border-border/20 bg-card p-8 dark:border-border/40 lg:p-12">
              <div className="max-w-2xl">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                  Internal Simulator
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  Simulator URL Not Configured
                </h1>
                <p className="mt-3 text-sm text-muted-foreground/70 dark:text-muted-foreground/80">
                  Set <code>INTERNAL_SIM_URL</code> on this Vercel project to
                  the deployed simulator URL, for example{" "}
                  <code>https://glow-mechanistic-twin-icrg-launch.vercel.app</code>.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <iframe
            title="Glow Internal Simulator"
            src={simUrl}
            className="h-[calc(100vh-5rem)] w-full border-0 bg-background"
          />
        )}
      </div>
    </>
  );
}
