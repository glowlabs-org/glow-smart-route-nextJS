import { Header } from "@/components/header";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import {
  isReferralDashboardAuthorized,
  isReferralDashboardPasswordConfigured,
} from "@/lib/referral-dashboard-auth";
import { InternalPasswordGate } from "../internal-password-gate";
import { WidgetErrorBoundary } from "@/components/widget-error-boundary";
import { GctlMintDashboard } from "./gctl-mint-dashboard";

export const metadata: Metadata = buildPageMetadata({
  title: "POL GCTL Mint",
  description: "Internal Protocol-Owned Liquidity GCTL minting workflow.",
  path: "/internal/gctl-mint",
  noIndex: true,
});

export default async function GctlMintPage() {
  const isAuthorized = await isReferralDashboardAuthorized();
  const isConfigured = isReferralDashboardPasswordConfigured();

  return (
    <>
      <Header withIsScrolled />
      {isAuthorized ? (
        <div className="min-h-screen bg-background">
          <section className="mx-auto max-w-5xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
            <WidgetErrorBoundary>
              <GctlMintDashboard />
            </WidgetErrorBoundary>
          </section>
        </div>
      ) : (
        <InternalPasswordGate configured={isConfigured} />
      )}
    </>
  );
}
