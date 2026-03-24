import { Header } from "@/components/header";
import { ReferralDashboard } from "./referral-dashboard";
import { ReferralPasswordGate } from "./referral-password-gate";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import {
  isReferralDashboardAuthorized,
  isReferralDashboardPasswordConfigured,
} from "@/lib/referral-dashboard-auth";

export const metadata: Metadata = buildPageMetadata({
  title: "Referral Dashboard",
  description: "Internal referral program tracking and analytics.",
  path: "/internal/referral",
  noIndex: true,
});

export default async function ReferralDashboardPage() {
  const isAuthorized = await isReferralDashboardAuthorized();
  const isConfigured = isReferralDashboardPasswordConfigured();

  return (
    <>
      <Header withIsScrolled={true} />
      <div className="min-h-screen bg-background">
        <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-32">
          {isAuthorized ? (
            <ReferralDashboard />
          ) : (
            <ReferralPasswordGate configured={isConfigured} />
          )}
        </section>
      </div>
    </>
  );
}
