import { Header } from "@/components/header";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import {
  isReferralDashboardAuthorized,
  isReferralDashboardPasswordConfigured,
} from "@/lib/referral-dashboard-auth";
import { InternalPasswordGate } from "../internal-password-gate";
import { PointsGrantDashboard } from "./points-grant-dashboard";

export const metadata: Metadata = buildPageMetadata({
  title: "Points Grants",
  description: "Internal manual points-grant dashboard.",
  path: "/internal/points",
  noIndex: true,
});

export default async function PointsGrantsPage() {
  const isAuthorized = await isReferralDashboardAuthorized();
  const isConfigured = isReferralDashboardPasswordConfigured();

  return (
    <>
      <Header withIsScrolled={true} />
      {isAuthorized ? (
        <div className="min-h-screen bg-background">
          <section className="max-w-screen-md mx-auto px-4 md:px-6 pb-16 pt-28 sm:pt-32">
            <PointsGrantDashboard />
          </section>
        </div>
      ) : (
        <InternalPasswordGate configured={isConfigured} />
      )}
    </>
  );
}
