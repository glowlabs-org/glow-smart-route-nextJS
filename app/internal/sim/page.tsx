import { Header } from "@/components/header";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import {
  isReferralDashboardAuthorized,
  isReferralDashboardPasswordConfigured,
} from "@/lib/referral-dashboard-auth";
import { InternalPasswordGate } from "../internal-password-gate";

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
  const isAuthorized = await isReferralDashboardAuthorized();
  const isConfigured = isReferralDashboardPasswordConfigured();
  const simUrl = getInternalSimUrl();

  return (
    <>
      <Header withIsScrolled={true} />
      <div className="min-h-screen bg-background">
        <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-32">
          {!isAuthorized ? (
            <InternalPasswordGate configured={isConfigured} />
          ) : !simUrl ? (
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
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-3xl border border-border/20 bg-card p-5 dark:border-border/40 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                    Internal Simulator
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground/70 dark:text-muted-foreground/80">
                    Embedded from <code>{simUrl}</code>
                  </p>
                </div>
                <a
                  href={simUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border/20 px-4 text-sm font-medium transition-colors hover:border-border/40 dark:border-border/40 dark:hover:border-border/60"
                >
                  Open In New Tab
                </a>
              </div>

              <div className="overflow-hidden rounded-3xl border border-border/20 bg-card dark:border-border/40">
                <iframe
                  title="Glow Internal Simulator"
                  src={simUrl}
                  className="h-[calc(100vh-16rem)] min-h-[720px] w-full bg-background"
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
